# Docker context is the OSS monorepo root (./oss).

FROM golang:1.26-alpine AS builder

WORKDIR /src

COPY src/lib/doctor/go/ src/lib/doctor/go/
COPY src/platform/services/error-collector/go.mod src/platform/services/error-collector/go.sum src/platform/services/error-collector/

WORKDIR /src/src/platform/services/error-collector
RUN go mod download

COPY src/platform/services/error-collector/ ./

ARG METORIAL_VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags "-s -w -X main.version=${METORIAL_VERSION}" -o /out/error-collector ./cmd/error-collector

FROM alpine:3.24

RUN apk --no-cache add ca-certificates tzdata \
 && addgroup -S -g 10001 metorial \
 && adduser -S -D -H -u 10001 -G metorial metorial

WORKDIR /app

COPY --from=builder /out/error-collector .

EXPOSE 8095
EXPOSE 8096
EXPOSE 12121

USER 10001:10001

CMD ["./error-collector"]
