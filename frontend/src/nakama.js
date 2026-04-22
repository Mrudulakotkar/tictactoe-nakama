import { Client } from "@heroiclabs/nakama-js";

const client = new Client(
  "defaultkey",
  "your-app-name.up.railway.app", // replace this
  "443",
  true
);

export default client;