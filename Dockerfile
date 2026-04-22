FROM heroiclabs/nakama:3.22.0

COPY ./nakama_modules /nakama/data/modules

CMD ["nakama","--name", "nakama1","--database.in_memory", "true","--logger.level", "INFO"]