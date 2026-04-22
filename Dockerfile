FROM heroiclabs/nakama:3.22.0

COPY ./nakama_modules /nakama/data/modules

ENTRYPOINT ["/bin/sh", "-ec", "/nakama/nakama migrate up --database.address \"$DATABASE_URL\" && exec /nakama/nakama --name nakama1 --database.address \"$DATABASE_URL\" --socket.server_key defaultkey --session.encryption_key somesecret --runtime.http_key defaulthttpkey --logger.level INFO"]