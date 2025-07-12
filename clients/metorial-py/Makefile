.PHONY: help install install-dev install-local build clean test lint format check-format type-check all-checks publish-test publish

# Default target
help:
	@echo "Metorial Python SDK - Development Commands"
	@echo "==========================================="
	@echo ""
	@echo "Installation:"
	@echo "  install        - Install package dependencies"
	@echo "  install-dev    - Install package with development dependencies"
	@echo "  install-local  - Install package locally from built wheel"
	@echo ""
	@echo "Building:"
	@echo "  build          - Build distribution packages"
	@echo "  clean          - Clean build artifacts"
	@echo ""
	@echo "Testing:"
	@echo "  test           - Run tests"
	@echo "  test-cov       - Run tests with coverage"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint           - Run linting (flake8)"
	@echo "  format         - Format code with black"
	@echo "  check-format   - Check if code is formatted"
	@echo "  type-check     - Run type checking with mypy"
	@echo "  all-checks     - Run all checks (lint, format, type-check)"
	@echo ""
	@echo "Publishing:"
	@echo "  publish-test   - Publish to test PyPI"
	@echo "  publish        - Publish to PyPI"

# Installation targets
install:
	pip install -e .

install-dev:
	pip install -e ".[dev]"

install-local: build
	pip install dist/metorial-*.whl

# Building targets
build: clean
	python -m build

clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf __pycache__/
	rm -rf .pytest_cache/
	rm -rf .mypy_cache/
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete

# Testing targets
test:
	pytest

test-cov:
	pytest --cov=metorial --cov-report=html --cov-report=term

# Code quality targets
lint:
	flake8 metorial/ packages/mcp_sdk_utils/ packages/sdk/ packages/util_endpoint/

format:
	black metorial/ packages/mcp_sdk_utils/ packages/sdk/ packages/util_endpoint/

check-format:
	black --check metorial/ packages/mcp_sdk_utils/ packages/sdk/ packages/util_endpoint/

type-check:
	mypy metorial/ packages/mcp_sdk_utils/ packages/sdk/ packages/util_endpoint/

all-checks: lint check-format type-check
	@echo "All code quality checks passed!"

# Publishing targets
publish-test: build
	twine upload --repository testpypi dist/*

publish: build
	twine upload dist/*

# Development shortcuts
dev-setup: install-dev
	@echo "Development environment setup complete!"
	@echo "You can now run: make test, make lint, etc."

# Quick development loop
quick-check: format lint type-check test
	@echo "Quick development check complete!"

# Reset environment
reset: clean
	pip uninstall -y metorial || true
	pip install -e ".[dev]"
