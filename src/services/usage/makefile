.PHONY: test proto vet staticcheck lint build run dev

build:
	go build -o bin/server ./cmd/server

run: build
	./bin/server $(ARGS)

dev:
	air --build.exclude_dir node_modules --build.cmd "go build -o bin/server ./cmd/server" --build.bin "./bin/server"

vet:
	go vet ./...

test:
	go test -v ./...

staticcheck:
	staticcheck ./...

lint:
	golangci-lint run ./...

proto:
	./scripts/ts-proto.sh && ./scripts/go-proto.sh
