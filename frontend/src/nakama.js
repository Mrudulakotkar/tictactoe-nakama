import { Client } from "@heroiclabs/nakama-js";

const client = new Client(
  "defaultkey",
  "tictactoe-nakama-production.up.railway.app",
  "443",
  true
);

// 🔥 IMPORTANT
client.httpKey = "defaulthttpkey";

export default client;