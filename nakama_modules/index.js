function createMatch(ctx, logger, nk, payload) {
    logger.info("RPC called");

    const matchId = nk.matchCreate("tictactoe_match", {});
    return JSON.stringify({ matchId });
}

function InitModule(ctx, logger, nk, initializer) {
    logger.info("🔥 Nakama module loaded");

    initializer.registerRpc("create_tictactoe_match", createMatch);
}

!InitModule;