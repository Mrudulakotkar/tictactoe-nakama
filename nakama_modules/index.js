function createMatch(ctx, logger, nk, payload) {
  logger.info("Creating match...");

  const matchId = nk.matchCreate("tictactoe_match", {});

  return JSON.stringify({
    matchId: matchId
  });
}

function InitModule(ctx, logger, nk, initializer) {
  logger.info("🔥 Nakama module loaded");

  initializer.registerRpc("create_tictactoe_match", createMatch);
}