FROM heroiclabs/nakama:3.22.0

COPY ./nakama_modules /nakama/data/modules

ENTRYPOINT ["/nakama/nakama","--name","nakama1","--database.address","postgres://$(NAKAMA_DB_USER):$(NAKAMA_DB_PASSWORD)@$(NAKAMA_DB_HOST):$(NAKAMA_DB_PORT)/$(NAKAMA_DB_NAME)?sslmode=disable","--runtime.path","/nakama/data/modules","--socket.server_key","defaultkey","--session.encryption_key","somesecret","--runtime.http_key","defaulthttpkey","--logger.level","INFO"]