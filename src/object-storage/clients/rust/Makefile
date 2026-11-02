.PHONY: test build fmt clippy clean

test:
	cargo test

build:
	cargo build --release

fmt:
	cargo fmt

clippy:
	cargo clippy -- -D warnings

clean:
	cargo clean

all: fmt clippy test build
