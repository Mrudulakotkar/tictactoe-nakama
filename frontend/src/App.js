import { useEffect, useMemo, useState } from 'react';
import * as Nakama from '@heroiclabs/nakama-js';
import './App.css';

const OP_CODE_STATE = 1;
const OP_CODE_MOVE = 2;
const OP_CODE_ERROR = 3;

const emptyGame = {
  board: Array(9).fill(null),
  players: {},
  currentTurn: 'X',
  status: 'idle',
  winner: null,
  winningLine: [],
  draw: false,
};

function App() {
  const [client] = useState(() => new Nakama.Client(
  'defaultkey',
  "tictactoe-nakama-production.up.railway.app", // 🔥 replace this
  '443',
  true
  ));
  const [session, setSession] = useState(null);
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting');
  const [matchId, setMatchId] = useState('');
  const [matchmakerTicket, setMatchmakerTicket] = useState('');
  const [joinMatchId, setJoinMatchId] = useState('');
  const [game, setGame] = useState(emptyGame);
  const [notice, setNotice] = useState('Create a room, then open another browser tab to join it.');
  const [matches, setMatches] = useState([]);

  const myMark = useMemo(() => {
    if (!session) return null;
    return Object.entries(game.players).find(([, userId]) => userId === session.user_id)?.[0] || null;
  }, [game.players, session]);

  useEffect(() => {
    let isMounted = true;
    const nextSocket = client.createSocket(true, false);

    async function connect() {
      try {
        const deviceId = localStorage.getItem('nakama-device-id') || `web-${crypto.randomUUID()}`;
        localStorage.setItem('nakama-device-id', deviceId);

        const nextSession = await client.authenticateDevice(deviceId, true);
        await nextSocket.connect(nextSession, true);
        console.log("✅ Socket connected");

        nextSocket.onmatchdata = (message) => {
          const opCode = message.op_code ?? message.opCode;
          const rawData = typeof message.data === 'string'
            ? message.data
            : new TextDecoder().decode(message.data);
          const payload = JSON.parse(rawData);

          if (opCode === OP_CODE_STATE) {
            setGame(payload);
            setNotice('Server state synced.');
          }

          if (opCode === OP_CODE_ERROR) {
            setNotice(payload.message);
          }
        };

        nextSocket.onmatchmakermatched = async (matched) => {
          try {
            const matchedMatchId = matched.match_id
              ?? matched.matchId
              ?? matched.match?.id
              ?? matched.match?.match_id
              ?? matched.match?.matchId;

            let joinedMatch;
            if (matchedMatchId) {
              joinedMatch = await nextSocket.joinMatch(matchedMatchId);
            } else if (matched.token) {
              joinedMatch = await nextSocket.joinMatch(null, matched.token);
            } else {
              joinedMatch = await nextSocket.joinMatch(matched);
            }

            const nextMatchId = joinedMatch.match_id
              ?? joinedMatch.matchId
              ?? matchedMatchId;

            await nextSocket.sendMatchState(nextMatchId, OP_CODE_MOVE, JSON.stringify({ requestState: true }));
            setMatchId(nextMatchId);
            setJoinMatchId(nextMatchId);
            setMatchmakerTicket('');
            setNotice('Quick Match found an opponent.');
          } catch (error) {
            setMatchmakerTicket('');
            setNotice(`Quick Match failed: ${error.message}`);
          }
        };

        if (!isMounted) return;

        setSession(nextSession);
        setSocket(nextSocket);
        setConnectionStatus('Authenticated');
      } catch (error) {
        if (isMounted) {
          setConnectionStatus('Offline');
          setNotice(error.message);
        }
      }
    }

    connect();
    return () => { isMounted = false; };
  }, [client]);

  async function createRoom() {
    if (!socket || !session) return;

    try {
      const response = await client.rpc(session, 'create_tictactoe_match', {});
      const createdMatchId = response.payload.matchId;

      await socket.joinMatch(createdMatchId);
      await socket.sendMatchState(createdMatchId, OP_CODE_MOVE, JSON.stringify({ requestState: true }));
      setMatchId(createdMatchId);
      setJoinMatchId(createdMatchId);
      setNotice('Room created.');
    } catch (error) {
      setNotice(`Create room failed: ${error.message}`);
    }
  }

  async function quickMatch() {
    if (!socket || matchmakerTicket) return;

    try {
      const ticket = await socket.addMatchmaker('*', 2, 2, { mode: 'classic' }, {});
      setMatchmakerTicket(ticket.ticket || 'queued');
      setNotice('Searching for an opponent...');
    } catch (error) {
      setNotice(`Quick Match failed: ${error.message}`);
    }
  }

  async function joinRoom(event) {
    event.preventDefault();
    if (!socket || !joinMatchId.trim()) return;

    try {
      const match = await socket.joinMatch(joinMatchId.trim());
      const id = match.match_id ?? match.matchId;

      await socket.sendMatchState(id, OP_CODE_MOVE, JSON.stringify({ requestState: true }));
      setMatchId(id);
      setNotice('Joined room.');
    } catch (error) {
      setNotice(`Join failed: ${error.message}`);
    }
  }

  // ✅ FIXED FUNCTION
  async function findRooms() {
    if (!client || !session) return;

    try {
      const res = await client.listMatches(
        session,
        10,
        true,
        null,
        null,
        null // ✅ FIXED (removed 'classic')
      );

      console.log('Matches:', res);
      setMatches(res.matches || []);
      setNotice('Rooms updated');
    } catch (error) {
      console.error(error);
      setNotice(`Fetch failed: ${error.message}`);
    }
  }

  async function sendMove(index) {
    if (!socket || !matchId || game.status !== 'playing' || game.board[index]) return;

    await socket.sendMatchState(matchId, OP_CODE_MOVE, JSON.stringify({ index }));
  }

  const headline = game.status === 'finished'
    ? game.winner
      ? `Player ${game.winner} wins`
      : 'Round draw'
    : game.status === 'playing'
      ? `Player ${game.currentTurn} turn`
      : game.status === 'waiting'
        ? 'Waiting for opponent'
        : 'Create or join a room';

  const canMove = game.status === 'playing' && myMark === game.currentTurn;

  return (
    <main className="app-shell">
      <section className="game-panel">

        <h1>{headline}</h1>

        <div className="room-actions">
          <button onClick={quickMatch}>Quick Match</button>
          <button onClick={createRoom}>Create Room</button>

          <form onSubmit={joinRoom}>
            <input
              value={joinMatchId}
              onChange={(e) => setJoinMatchId(e.target.value)}
              placeholder="Room ID"
            />
            <button type="submit">Join</button>
          </form>
        </div>

        <div style={{ marginTop: 20 }}>
          <button onClick={findRooms}>Find Rooms</button>

          {matches.map((m) => {
            let label = {};
            try { label = JSON.parse(m.label); } catch {}

            return (
              <div key={m.match_id}>
                {m.match_id.slice(0, 6)}... | {label.playerCount || 0}/2
                <button onClick={async () => {
                  const match = await socket.joinMatch(m.match_id);
                  const id = match.match_id ?? match.matchId;

                  await socket.sendMatchState(id, OP_CODE_MOVE, JSON.stringify({ requestState: true }));
                  setMatchId(id);
                }}>
                  Join
                </button>
              </div>
            );
          })}
        </div>

        <div className="board">
          {game.board.map((cell, i) => (
            <button key={i} disabled={!canMove || cell} onClick={() => sendMove(i)}>
              {cell}
            </button>
          ))}
        </div>

        <p>{notice}</p>

      </section>
    </main>
  );
}

export default App; 