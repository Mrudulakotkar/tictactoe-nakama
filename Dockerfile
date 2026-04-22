FROM heroiclabs/nakama:3.22.0

COPY ./nakama_modules /nakama/data/modules

CMD ["nakama", "--name", "nakama1", "--database.in_memory", "true", "--socket.server_key", "defaultkey", "--session.encryption_key", "somesecret", "--runtime.http_key", "defaulthttpkey", "--logger.level", "INFO"]