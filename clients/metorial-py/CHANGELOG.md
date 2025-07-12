# Changelog

All notable changes to the Metorial Python SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-12

### Added

- Initial release of Metorial Python SDK
- Multi-provider support for AI models:
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic (Claude)
  - Google (Gemini)
  - Mistral AI
  - DeepSeek
  - Together AI
  - XAI (Grok)
  - AI SDK frameworks
- Async/await interface for modern Python development
- Automatic session lifecycle handling
- Tool discovery and formatting capabilities
- Provider-specific tool format conversion
- High-performance async HTTP operations with aiohttp
- Comprehensive error handling with `MetorialAPIError`
- Full type hints and mypy support
- Extensive documentation and examples

### Core Features

- `Metorial` class for SDK initialization
- `with_provider_session()` for provider-specific sessions
- `with_session()` for direct session management
- OpenAI-compatible tool interface
- Automatic tool calling and response handling

### Dependencies

- `aiohttp>=3.8.0` for async HTTP requests
- `typing-extensions>=4.0.0` for enhanced type support
- Optional provider-specific SDKs:
  - `openai>=1.0.0` for OpenAI integration
  - `anthropic>=0.3.0` for Anthropic integration

### Development Tools

- Black code formatting
- MyPy type checking
- Pytest for testing
- Flake8 for linting
