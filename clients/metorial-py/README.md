# Metorial Python SDK

The official Python SDK for [Metorial](https://metorial.com) - AI-powered tool calling and session management.

## Features

🔧 **Multi-Provider Support**: Use the same tools across different AI providers

- ✅ OpenAI (GPT-4, GPT-3.5)
- ✅ Anthropic (Claude)
- ✅ Google (Gemini)
- ✅ Mistral AI
- ✅ DeepSeek
- ✅ Together AI
- ✅ XAI (Grok)
- ✅ AI SDK frameworks

🚀 **Easy Integration**: Simple async/await interface
📡 **Session Management**: Automatic session lifecycle handling
🛠️ **Tool Discovery**: Automatic tool detection and formatting
🔄 **Format Conversion**: Provider-specific tool format conversion
⚡ **High Performance**: Built with aiohttp for fast async operations

## Installation

```bash
pip install metorial
```

## Quick Start

### OpenAI Example

```python
import asyncio
from metorial import Metorial, metorial_openai
from openai import OpenAI

async def main():
    # Initialize clients
    metorial = Metorial(
        api_key="your-metorial-api-key"
    )

    openai_client = OpenAI(api_key="your-openai-api-key")

    # Use Metorial tools with OpenAI
    async def session_callback(session):
        messages = [{"role": "user", "content": "What are the latest commits?"}]

        for i in range(10):
            # Call OpenAI with Metorial tools
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                tools=session.tools
            )

            choice = response.choices[0]
            tool_calls = choice.message.tool_calls

            if not tool_calls:
                print(choice.message.content)
                return

            # Execute tools through Metorial
            tool_responses = await session.call_tools(tool_calls)

            # Add to conversation
            messages.append({
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    } for tc in tool_calls
                ]
            })
            messages.extend(tool_responses)

    await metorial.with_provider_session(
        metorial_openai.chat_completions,
        {"server_deployments": ["your-server-deployment-id"]},
        session_callback
    )

asyncio.run(main())
```

## Provider Examples

### Anthropic (Claude)

```python
from metorial import metorial_anthropic
import anthropic

# Format tools for Anthropic
anthropic_tools = metorial_anthropic.format_tools(tool_data)

# Use with Anthropic client
client = anthropic.Anthropic(api_key="your-key")
response = client.messages.create(
    model="claude-3-sonnet-20240229",
    tools=anthropic_tools,
    messages=[{"role": "user", "content": "Help me with GitHub"}]
)

# Handle tool calls
if response.tool_calls:
    tool_result = await metorial_anthropic.call_tools(
        tool_manager, response.tool_calls
    )
```

### Google (Gemini)

```python
from metorial import metorial_google
import google.generativeai as genai

# Format tools for Google
google_tools = metorial_google.format_tools(tool_data)

# Use with Google client
model = genai.GenerativeModel('gemini-pro', tools=google_tools)
response = model.generate_content("What can you help me with?")

# Handle function calls
if response.function_calls:
    function_result = await metorial_google.call_tools(
        tool_manager, response.function_calls
    )
```

### OpenAI-Compatible (DeepSeek, TogetherAI, XAI)

```python
from metorial import metorial_deepseek, metorial_xai
from openai import OpenAI

# Works with any OpenAI-compatible API
deepseek_client = OpenAI(
    api_key="your-deepseek-key",
    base_url="https://api.deepseek.com"
)

# Format tools (same as OpenAI format)
tools = metorial_deepseek.format_tools(tool_data)

response = deepseek_client.chat.completions.create(
    model="deepseek-chat",
    messages=messages,
    tools=tools
)
```

## Available Providers

| Provider   | Import                | Format                       | Description                   |
| ---------- | --------------------- | ---------------------------- | ----------------------------- |
| OpenAI     | `metorial_openai`     | OpenAI function calling      | GPT-4, GPT-3.5, etc.          |
| Anthropic  | `metorial_anthropic`  | Claude tool format           | Claude 3.5, Claude 3, etc.    |
| Google     | `metorial_google`     | Gemini function declarations | Gemini Pro, Gemini Flash      |
| Mistral    | `metorial_mistral`    | Mistral function calling     | Mistral Large, Codestral      |
| DeepSeek   | `metorial_deepseek`   | OpenAI-compatible            | DeepSeek Chat, DeepSeek Coder |
| TogetherAI | `metorial_togetherai` | OpenAI-compatible            | Llama, Mixtral, etc.          |
| XAI        | `metorial_xai`        | OpenAI-compatible            | Grok models                   |
| AI SDK     | `metorial_ai_sdk`     | Framework tools              | Vercel AI SDK, etc.           |

## Core API

### Metorial Class

```python
from metorial import Metorial

metorial = Metorial(
    api_key="your-api-key"
)
```

### Session Management

```python
# Provider session (recommended)
await metorial.with_provider_session(
    provider.chat_completions,
    {"server_deployments": ["deployment-id"]},
    session_callback
)

# Direct session management
await metorial.with_session(
    ["deployment-id"],
    session_callback
)
```

### Session Object

The session object passed to your callback provides:

```python
async def session_callback(session):
    # OpenAI-compatible interface
    tools = session.tools                    # List of tool definitions
    responses = await session.call_tools(tool_calls)  # Execute tools

    # Advanced access
    tool_manager = session.tool_manager      # Direct tool management
    mcp_session = session.session           # Raw MCP session
```

## Error Handling

```python
from metorial.client import MetorialAPIError

try:
    await metorial.with_provider_session(...)
except MetorialAPIError as e:
    print(f"API Error: {e.message} (Status: {e.status_code})")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## Examples

Check out the `examples/` directory for more comprehensive examples:

- [`examples/python-openai.py`](examples/anthropic_example.py) - OpenAi integration

## Requirements

- Python 3.8+
- `aiohttp` for async HTTP requests
- Provider-specific SDKs (optional):
  - `openai` for OpenAI integration
  - `anthropic` for Anthropic integration
  - `google-generativeai` for Google integration
  - `mistralai` for Mistral integration

## Development

This project includes a `Makefile` to help with common development tasks:

### Setup and Installation

```bash
make install         # Install dependencies
make install-dev     # Install development dependencies
```

### Code Quality

```bash
make lint           # Run linting checks
make format         # Format code with black
make type-check     # Run type checking with mypy
make test           # Run test suite
make test-cov       # Run tests with coverage
```

### Build and Distribution

```bash
make build          # Build the package
make clean          # Clean build artifacts
make publish        # Publish to PyPI (requires credentials)
```

### Development Workflow

```bash
make all-checks     # Run all development checks (lint, format check, type-check)
make quick-check    # Run complete pipeline (format, lint, type-check, test)
```

### Help

```bash
make help           # Show all available targets
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `make all-checks` to ensure code quality
5. Add tests and run `make test`
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://docs.metorial.com)
- 💬 [Discord Community](https://discord.gg/metorial)
- 🐛 [GitHub Issues](https://github.com/metorial/metorial-enterprise/issues)
- 📧 [Email Support](mailto:support@metorial.com)
