FROM oven/bun:1.2.22-alpine
WORKDIR /mock
ARG MOCK_SERVER=object-store/server.ts
COPY ${MOCK_SERVER} ./server.ts
ENV PORT=52010
EXPOSE 52010
CMD ["bun", "./server.ts"]
