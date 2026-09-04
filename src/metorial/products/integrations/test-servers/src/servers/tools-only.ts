import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function createToolsOnlyServer(): McpServer {
  const mcpServer = new McpServer(
    {
      name: 'test-tools-only',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Register calculate tool
  mcpServer.registerTool(
    'calculate',
    {
      description: 'Perform basic calculations',
      inputSchema: {
        operation: z
          .enum(['add', 'subtract', 'multiply', 'divide'])
          .describe('The operation to perform'),
        a: z.number().describe('First operand'),
        b: z.number().describe('Second operand')
      }
    },
    async ({ operation, a, b }) => {
      let result: number;

      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) {
            throw new Error('Division by zero');
          }
          result = a / b;
          break;
      }

      return {
        content: [
          {
            type: 'text',
            text: `${a} ${operation} ${b} = ${result}`
          }
        ]
      };
    }
  );

  // Register string_transform tool
  mcpServer.registerTool(
    'string_transform',
    {
      description: 'Transform string in various ways',
      inputSchema: {
        text: z.string().describe('The text to transform'),
        operation: z
          .enum(['uppercase', 'lowercase', 'reverse', 'length'])
          .describe('The transformation to apply')
      }
    },
    async ({ text, operation }) => {
      let result: string | number;

      switch (operation) {
        case 'uppercase':
          result = text.toUpperCase();
          break;
        case 'lowercase':
          result = text.toLowerCase();
          break;
        case 'reverse':
          result = text.split('').reverse().join('');
          break;
        case 'length':
          result = text.length;
          break;
      }

      return {
        content: [
          {
            type: 'text',
            text: String(result)
          }
        ]
      };
    }
  );

  // Register sleep tool
  mcpServer.registerTool(
    'sleep',
    {
      description: 'Sleep for a specified duration (for testing async operations)',
      inputSchema: {
        milliseconds: z.number().default(1000).describe('Duration to sleep in milliseconds')
      }
    },
    async ({ milliseconds }) => {
      await new Promise(resolve => setTimeout(resolve, milliseconds));

      return {
        content: [
          {
            type: 'text',
            text: `Slept for ${milliseconds}ms`
          }
        ]
      };
    }
  );

  return mcpServer;
}
