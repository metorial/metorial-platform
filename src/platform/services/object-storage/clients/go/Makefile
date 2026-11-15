.PHONY: test build fmt vet clean

test:
	go test -v -race -cover ./...

build:
	go build -v ./...

fmt:
	go fmt ./...

vet:
	go vet ./...

clean:
	go clean

all: fmt vet test build
