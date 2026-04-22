function createMatch(ctx, logger, nk, payload) {
    const matchId = nk.matchCreate("tictactoe_match", {});
    return JSON.stringify({ matchId: matchId });
}

function InitModule(ctx, logger, nk, initializer) {
    logger.info("🔥 Nakama module loaded");
    initializer.registerRpc("create_tictactoe_match", createMatch);
}

// 🔥 THIS LINE IS MISSING IN YOUR CODE
!InitModule;