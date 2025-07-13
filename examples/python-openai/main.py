from metorial import Metorial, metorial_openai
from openai import OpenAI
from typing import List, Dict, Any
import asyncio

metorial = Metorial(
  api_key="...your-metorial-api-key..."
)

openai_client = OpenAI(
  api_key="...your-openai-api-key..."
)

async def session_callback(session):
  # Message history for the chat completion
  messages: List[Dict[str, Any]] = [
    {
      "role": "user",
      "content": "Summarize the README.md in the metorial/mcp-containers repository on GitHub."
    }
  ]
  
  for i in range(10):
    # Get next response from OpenAI
    response = openai_client.chat.completions.create(
      model="gpt-4o",
      messages=messages,
      tools=session.tools
    )
    choice = response.choices[0]
    
    tool_calls = choice.message.tool_calls
    
    # No more tool calls -> we have the final response
    if not tool_calls:
      print(choice.message.content)
      return
    
    # Pass tool calls to Metorial
    tool_responses = await session.call_tools(tool_calls)
    
    # Save the tool call and tool responses to the message history
    messages.append(
      {
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
      }
    )
    messages.extend(tool_responses)
  
  raise Exception("No final response received after 10 iterations")

async def main():
  try:
    await metorial.with_provider_session(
      metorial_openai.chat_completions,
      {
        "server_deployments": ["...server-deployment-id..."]
      },
      session_callback
    )
  except NotImplementedError as e:
    print(f"❌ Metorial SDK Error: {e}")
    print("\n🔧 To make this work:")
    print("   1. Replace '...your-metorial-api-key...' with your actual Metorial API key")
    print("   2. Replace '...your-openai-api-key...' with your actual OpenAI API key")
    print("   3. Replace '...server-deployment-id...' with your actual server deployment ID")
    print("   4. Ensure Metorial services are running on localhost:4310 and localhost:4311")
    print("\n📖 See README.md for complete setup instructions.")
  except Exception as e:
    import traceback
    print(f"❌ Unexpected error: {e}")
    print(f"Error type: {type(e).__name__}")
    print(f"Full traceback:")
    traceback.print_exc()
    print("\n💡 This might be due to missing API keys or network issues.")

if __name__ == "__main__":
    asyncio.run(main())