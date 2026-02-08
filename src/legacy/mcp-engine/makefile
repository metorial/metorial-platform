.PHONY: test build-worker-mcp-runner run-worker-mcp-runner proto-worker-mcp-runner build-manager run-manager proto-mcp-manager proto vet staticcheck lint build-worker-launcher run-worker-launcher build-worker-mcp-remote run-worker-mcp-remote build-unified run-unified dev

build-worker-mcp-runner:
	go build -o bin/worker-mcp-runner ./cmd/worker-mcp-runner

run-worker-mcp-runner: build-worker-mcp-runner
	./bin/worker-mcp-runner $(ARGS)

build-worker-mcp-remote:
	go build -o bin/worker-mcp-remote ./cmd/worker-mcp-remote

run-worker-mcp-remote: build-worker-mcp-remote
	./bin/worker-mcp-remote $(ARGS)

build-worker-launcher:
	go build -o bin/worker-launcher ./cmd/worker-launcher

run-worker-launcher: build-worker-launcher
	./bin/worker-launcher $(ARGS)

build-manager:
	go build -o bin/manager ./cmd/manager

run-manager: build-manager
	./bin/manager $(ARGS)

build-unified:
	go build -o bin/unified ./cmd/unified

run-unified: build-unified
	./bin/unified $(ARGS)

dev:
	air --build.cmd "go build -o bin/unified ./cmd/unified" --build.bin "./bin/unified"

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

proto-mcp-manager:
	cd pkg/proto-mcp-manager && protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative ./proto-mcp-manager.proto