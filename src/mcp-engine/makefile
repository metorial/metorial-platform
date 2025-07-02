.PHONY: build-mcp-runner run-mcp-runner proto-mcp-runner build-mcp-runner-client run-mcp-runner-client build-manager run-manager proto-mcp-manager proto vet staticcheck lint

build-mcp-runner:
	go build -o bin/mcp-runner ./cmd/mcp-runner

run-mcp-runner: build-mcp-runner
	./bin/mcp-runner $(ARGS)

build-mcp-runner-client:
	go build -o bin/mcp-runner-client ./cmd/mcp-runner-client

run-mcp-runner-client: build-mcp-runner-client
	./bin/mcp-runner-client $(ARGS)

build-manager:
	go build -o bin/manager ./cmd/manager

run-manager: build-manager
	./bin/manager $(ARGS)

vet:
	go vet ./...

staticcheck:
	staticcheck ./...

lint:
	golangci-lint run ./...

proto:
	cd proto && \
	mkdir -p ../gen && \
	protoc \
		--proto_path=. \
		--go_out=../gen \
		--go-grpc_out=../gen \
		common.proto \
		manager.proto \
		workerBroker.proto \
		mcp.proto \
		runner.proto && \
	cp -r ../gen/github.com/metorial/metorial/mcp-engine/* ../ && \
	rm -rf ../gen/github.com 

proto-mcp-manager:
	cd pkg/proto-mcp-manager && protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative ./proto-mcp-manager.proto