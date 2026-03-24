import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import z from 'zod';

export function createFullFeaturedServer(): McpServer {
  const mcpServer = new McpServer(
    {
      name: 'test-full-featured',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    }
  );

  // ========== TOOLS ==========

  mcpServer.registerTool(
    'echo',
    {
      description: 'Echo back the provided arguments',
      inputSchema: {
        message: z.string().optional().describe('Message to echo')
      }
    },
    async args => {
      return {
        content: [
          {
            type: 'text',
            text: `Echo: ${JSON.stringify(args)}`
          }
        ]
      };
    }
  );

  mcpServer.registerTool(
    'add',
    {
      description: 'Add two numbers',
      inputSchema: {
        a: z.number().default(0).describe('First number'),
        b: z.number().default(0).describe('Second number')
      }
    },
    async ({ a, b }) => {
      return {
        content: [
          {
            type: 'text',
            text: `Result: ${a + b}`
          }
        ]
      };
    }
  );

  mcpServer.registerTool(
    'generate_list',
    {
      description: 'Generate a list of items',
      inputSchema: {
        count: z.number().default(5).describe('Number of items to generate')
      }
    },
    async ({ count }) => {
      return {
        content: [
          {
            type: 'text',
            text: Array.from({ length: count }, (_, i) => `Item ${i + 1}`).join('\n')
          }
        ]
      };
    }
  );

  mcpServer.registerTool(
    'async_operation',
    {
      description: 'Perform an async operation with a delay'
    },
    async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        content: [
          {
            type: 'text',
            text: 'Async operation completed'
          }
        ]
      };
    }
  );

  // ========== RESOURCES ==========

  mcpServer.registerResource(
    'Users list',
    'test://data/users',
    {
      description: 'A list of test users',
      mimeType: 'application/json'
    },
    async () => {
      return {
        contents: [
          {
            uri: 'test://data/users',
            mimeType: 'application/json',
            text: JSON.stringify(
              [
                { id: 1, name: 'Alice', email: 'alice@example.com' },
                { id: 2, name: 'Bob', email: 'bob@example.com' },
                { id: 3, name: 'Charlie', email: 'charlie@example.com' }
              ],
              null,
              2
            )
          }
        ]
      };
    }
  );

  mcpServer.registerResource(
    'Configuration',
    'test://data/config',
    {
      description: 'Application configuration',
      mimeType: 'application/json'
    },
    async () => {
      return {
        contents: [
          {
            uri: 'test://data/config',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                appName: 'Test Server',
                version: '1.0.0',
                features: {
                  authentication: true,
                  logging: true
                }
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  mcpServer.registerResource(
    'Logs',
    'test://data/logs',
    {
      description: 'Application logs',
      mimeType: 'text/plain'
    },
    async () => {
      return {
        contents: [
          {
            uri: 'test://data/logs',
            mimeType: 'text/plain',
            text: [
              '[2024-01-01 10:00:00] INFO: Server started',
              '[2024-01-01 10:01:00] INFO: Connected to database',
              '[2024-01-01 10:02:00] WARN: High memory usage detected',
              '[2024-01-01 10:03:00] INFO: Request processed successfully'
            ].join('\n')
          }
        ]
      };
    }
  );

  // ========== RESOURCE TEMPLATES ==========

  mcpServer.registerResource(
    'User by ID',
    new ResourceTemplate('test://user/{id}', {
      list: undefined
    }),
    {
      description: 'Get a specific user by their ID',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const idValue = variables.id;
      const id = Array.isArray(idValue) ? (idValue[0] ?? '0') : (idValue ?? '0');
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                id: Number.parseInt(id, 10),
                name: `User ${id}`,
                email: `user${id}@example.com`
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  mcpServer.registerResource(
    'Logs by date',
    new ResourceTemplate('test://log/{date}', {
      list: undefined
    }),
    {
      description: 'Get logs for a specific date',
      mimeType: 'text/plain'
    },
    async (uri, variables) => {
      const date = Array.isArray(variables.date)
        ? variables.date[0]
        : variables.date || 'unknown';
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'text/plain',
            text: [
              `[${date} 08:00:00] INFO: Server started`,
              `[${date} 09:30:00] INFO: Processing batch job`,
              `[${date} 14:15:00] WARN: High memory usage`,
              `[${date} 18:45:00] INFO: Backup completed`
            ].join('\n')
          }
        ]
      };
    }
  );

  // ========== PROMPTS ==========

  mcpServer.registerPrompt(
    'code_review',
    {
      description: 'Generate a code review prompt',
      argsSchema: {
        language: z.string().describe('Programming language'),
        focus: z.string().optional().describe('Focus area (security, performance, style)')
      }
    },
    async ({ language, focus }) => {
      const focusArea = focus || 'general';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please review this ${language} code with a focus on ${focusArea}. Look for potential issues, improvements, and best practices.`
            }
          }
        ]
      };
    }
  );

  mcpServer.registerPrompt(
    'summarize',
    {
      description: 'Create a summary prompt',
      argsSchema: {
        length: z.string().optional().describe('Desired length (short, medium, long)')
      }
    },
    async ({ length }) => {
      const summaryLength = length || 'medium';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please provide a ${summaryLength} summary of the following content, highlighting the key points and main ideas.`
            }
          }
        ]
      };
    }
  );

  mcpServer.registerPrompt(
    'explain',
    {
      description: 'Explain a concept',
      argsSchema: {
        topic: z.string().describe('Topic to explain'),
        audience: z
          .string()
          .optional()
          .describe('Target audience (beginner, intermediate, expert)')
      }
    },
    async ({ topic, audience }) => {
      const targetAudience = audience || 'general';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please explain ${topic} in a way that is appropriate for a ${targetAudience} audience. Use clear examples and analogies where helpful.`
            }
          }
        ]
      };
    }
  );

  return mcpServer;
}
