FROM heroiclabs/nakama:3.22.0

COPY ./nakama_modules /nakama/data/modules

ENTRYPOINT ["/nakama/nakama"]

CMD ["--name","nakama1","--database.address","sqlite:///nakama/data/nakama.db","--socket.server_key","defaultkey","--session.encryption_key","somesecret","--runtime.http_key","defaulthttpkey","--logger.level","INFO"]