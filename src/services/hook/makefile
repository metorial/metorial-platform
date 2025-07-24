.PHONY: test proto vet staticcheck lint build-worker build-manager build-unified run-worker run-manager run-unified dev

build-manager:
	go build -o bin/manager ./cmd/manager

run-manager: build-manager
	./bin/manager $(ARGS)

build-worker:
	go build -o bin/worker ./cmd/worker

run-worker: build-worker
	./bin/worker $(ARGS)

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
