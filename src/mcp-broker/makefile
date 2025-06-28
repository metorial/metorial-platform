.PHONY: build-mcp-runner run-mcp-runner proto-mcp-runner build-mcp-runner-client run-mcp-runner-client

build-mcp-runner:
	go build -o bin/mcp-runner ./cmd/mcp-runner

run-mcp-runner: build-mcp-runner
	./bin/mcp-runner $(ARGS)

build-mcp-runner-client:
	go build -o bin/mcp-runner-client ./cmd/mcp-runner-client

run-mcp-runner-client: build-mcp-runner-client
	./bin/mcp-runner-client $(ARGS)

proto-mcp-runner:
	cd pkg/proto-mcp-runner && protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative ./proto-mcp-runner.proto