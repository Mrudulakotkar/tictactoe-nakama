import client from "./nakama";

export const login = async () => {
  const deviceId = "device123";

  const session = await client.authenticateDevice(deviceId);

  console.log("Session:", session);

  return session;
};