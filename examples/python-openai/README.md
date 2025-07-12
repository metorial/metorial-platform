# Metorial + OpenAI (Python) Example

This example shows how to use the [Metorial SDK](https://pypi.org/project/metorial/) with [OpenAI](https://pypi.org/project/openai/) in a Python project. It demonstrates how to power OpenAI's `chat.completions` with dynamic tool calling using Metorial's OpenAI bindings.

> 🔧 This is a minimal, self-contained project to help you understand how Metorial can extend OpenAI workflows with custom tools.

## What's Included

- **Metorial SDK** — Core integration with `metorial` and the OpenAI helper for OpenAI-compatible tool interfaces.
- **OpenAI SDK** — For invoking `chat.completions` with support for tool calling (`tool_calls`).
- **Example session loop** — A full example of how to iterate on tool-augmented completions until a final response is returned.

## Project Structure

```
├── main.py              # Main example script
├── requirements.txt     # Python dependencies
├── pyproject.toml       # Modern Python project configuration
├── .gitignore           # Git ignore patterns
└── README.md            # This file
```

## Getting Started

### 1. Install Dependencies

This project requires Python 3.8+ and pip. You can install dependencies in several ways:

**Option 1: Using requirements.txt**

```bash
pip install -r requirements.txt
```

**Option 2: Using pyproject.toml (recommended)**

```bash
pip install -e .
```

**Option 3: Direct installation**

```bash
pip install metorial openai
```

### 2. Set Your API Keys

Replace placeholders in `main.py`:

```python
metorial = Metorial(
    api_key="...your-metorial-api-key..."
)

openai_client = OpenAI(
    api_key="...your-openai-api-key..."
)
```

You'll also need to provide a valid `server_deployments` ID when initializing the session:

```python
{"server_deployments": ["...server-deployment-id..."]}
```

### 3. Run the Example

```bash
python main.py
```

**In a development environment**, you may see a "Metorial client implementation needed" message. This is expected and indicates the example structure is correct.

**In a production environment** with proper API keys and services running, this will:

1. Start a chat with OpenAI (using GPT-4o).
2. Inject Metorial-compatible tools via the OpenAI integration.
3. Automatically call tools returned by OpenAI.
4. Iterate through the conversation until a final response is received.

## Code Walkthrough

The core logic is inside an async `session_callback` function used with `with_provider_session`:

```python
async def session_callback(session):
    # Chat message history
    messages = [{"role": "user", "content": "..."}]

    for i in range(10):
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=session.tools
        )

        choice = response.choices[0]
        tool_calls = choice.message.tool_calls

        if not tool_calls:
            print(choice.message.content)
            return

        tool_responses = await session.call_tools(tool_calls)

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

    raise Exception("No final response received after 10 iterations")

await metorial.with_provider_session(
    metorial_openai.chat_completions,
    {"server_deployments": ["..."]},
    session_callback
)
```

> 🧠 The tool loop allows OpenAI to use tools you've deployed via Metorial until it arrives at a final response.

## Requirements

- Python 3.8+
- pip or another package manager
- Metorial account + deployment ID
- OpenAI API key with GPT-4o access

## Development

### Setting up a Development Environment

1. **Create a virtual environment:**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install in development mode:**

   ```bash
   pip install -e .
   ```

3. **Install development dependencies:**
   ```bash
   pip install black isort pytest pytest-asyncio
   ```

### Code Formatting

```bash
# Format code with Black
black .

# Sort imports with isort
isort .
```

### Running Tests

```bash
pytest
```

## Troubleshooting

- **"Metorial client implementation needed" error**: This is expected when running without proper API keys. Replace the placeholders in `main.py` with your actual keys.
- **Connection errors**: Ensure Metorial services are running on the correct ports (4310 for API, 4311 for MCP).
- **Import errors**: Make sure you've installed all dependencies using one of the methods above.

## License

MIT — feel free to use and adapt this code in your own projects.

## Learn More

- [Metorial Documentation](https://metorial.com/docs)
- [OpenAI Tool Calling](https://platform.openai.com/docs/guides/tool-calling)
- [OpenAI Python SDK](https://pypi.org/project/openai/)
