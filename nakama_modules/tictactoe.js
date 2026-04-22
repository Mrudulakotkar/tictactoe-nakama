const OP_CODE_STATE = 1;
const OP_CODE_MOVE = 2;
const OP_CODE_ERROR = 3;

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function InitModule(ctx, logger, nk, initializer) {
  initializer.registerMatch('tictactoe', {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal,
  });
  initializer.registerRpc('create_tictactoe_match', rpcCreateTictactoeMatch);
  initializer.registerMatchmakerMatched(matchmakerMatched);

  logger.info('Tic-Tac-Toe authoritative match module loaded');
}

function rpcCreateTictactoeMatch(ctx, logger, nk, payload) {
  const matchId = nk.matchCreate('tictactoe', {});
  return JSON.stringify({ matchId: matchId });
}

function matchmakerMatched(ctx, logger, nk, matches) {
  logger.info('Creating Tic-Tac-Toe match from matchmaker with %d players', matches.length);
  return nk.matchCreate('tictactoe', { source: 'matchmaker' });
}

// ✅ UPDATED: label is now JSON (required for room discovery)
function matchInit(ctx, logger, nk, params) {
  return {
    state: {
      board: Array(9).fill(null),
      players: {},
      marksByUserId: {},
      currentTurn: 'X',
      status: 'waiting',
      winner: null,
      winningLine: [],
      draw: false,
    },
    tickRate: 1,
    label: JSON.stringify({
      mode: 'classic',
      open: true,
      playerCount: 0,
    }),
  };
}

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  if (Object.keys(state.players).length >= 2 && !state.marksByUserId[presence.userId]) {
    return {
      state: state,
      accept: false,
      rejectMessage: 'This match already has two players.',
    };
  }

  return {
    state: state,
    accept: true,
  };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (const presence of presences) {
    if (state.marksByUserId[presence.userId]) {
      continue;
    }

    const mark = state.players.X ? 'O' : 'X';
    state.players[mark] = presence.userId;
    state.marksByUserId[presence.userId] = mark;
  }

  if (state.players.X && state.players.O && state.status === 'waiting') {
    state.status = 'playing';
  }

  // ✅ UPDATED: update room label
  dispatcher.matchLabelUpdate(JSON.stringify({
    mode: 'classic',
    open: Object.keys(state.players).length < 2,
    playerCount: Object.keys(state.players).length,
  }));

  broadcastState(dispatcher, state);
  return { state: state };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  if (state.status === 'finished') {
    return { state: state };
  }

  for (const presence of presences) {
    const mark = state.marksByUserId[presence.userId];

    if (!mark) {
      continue;
    }

    const opponent = mark === 'X' ? 'O' : 'X';
    state.status = 'finished';
    state.winner = state.players[opponent] ? opponent : null;
    state.draw = !state.winner;
  }

  // ✅ UPDATED: update room label
  dispatcher.matchLabelUpdate(JSON.stringify({
    mode: 'classic',
    open: Object.keys(state.players).length < 2,
    playerCount: Object.keys(state.players).length,
  }));

  broadcastState(dispatcher, state);
  return { state: state };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  for (const message of messages) {
    if (message.opCode !== OP_CODE_MOVE) {
      continue;
    }

    const mark = state.marksByUserId[message.sender.userId];
    const move = parseJson(nk, message.data);

    if (move && move.requestState === true) {
      dispatcher.broadcastMessage(OP_CODE_STATE, JSON.stringify(publicState(state)), [message.sender]);
      continue;
    }

    if (!mark) {
      sendError(dispatcher, message.sender, 'You are not a player in this match.');
      continue;
    }

    if (!move || !Number.isInteger(move.index)) {
      sendError(dispatcher, message.sender, 'Move must include a board index.');
      continue;
    }

    const error = validateMove(state, mark, move.index);
    if (error) {
      sendError(dispatcher, message.sender, error);
      continue;
    }

    state.board[move.index] = mark;
    const result = getWinner(state.board);

    if (result) {
      state.status = 'finished';
      state.winner = result.player;
      state.winningLine = result.line;
    } else if (state.board.every(Boolean)) {
      state.status = 'finished';
      state.draw = true;
    } else {
      state.currentTurn = mark === 'X' ? 'O' : 'X';
    }

    broadcastState(dispatcher, state);
  }

  return { state: state };
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return { state: state };
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return {
    state: state,
    data: JSON.stringify(publicState(state)),
  };
}

function validateMove(state, mark, index) {
  if (state.status !== 'playing') {
    return 'The game is not currently active.';
  }

  if (state.currentTurn !== mark) {
    return 'It is not your turn.';
  }

  if (index < 0 || index > 8) {
    return 'Move index must be between 0 and 8.';
  }

  if (state.board[index]) {
    return 'That cell is already occupied.';
  }

  return null;
}

function getWinner(board) {
  for (const line of winningLines) {
    const [a, b, c] = line;

    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        player: board[a],
        line,
      };
    }
  }

  return null;
}

function publicState(state) {
  return {
    board: state.board,
    players: state.players,
    currentTurn: state.currentTurn,
    status: state.status,
    winner: state.winner,
    winningLine: state.winningLine,
    draw: state.draw,
  };
}

function broadcastState(dispatcher, state) {
  dispatcher.broadcastMessage(OP_CODE_STATE, JSON.stringify(publicState(state)), null, null);
}

function sendError(dispatcher, presence, message) {
  dispatcher.broadcastMessage(OP_CODE_ERROR, JSON.stringify({ message: message }), [presence], null);
}

function parseJson(nk, data) {
  try {
    return JSON.parse(nk.binaryToString(data));
  } catch (error) {
    return null;
  }
}