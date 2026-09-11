import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

export function createResourceTemplatesServer(): McpServer {
  const mcpServer = new McpServer(
    {
      name: 'test-resource-templates',
      version: '1.0.0'
    },
    {
      capabilities: {
        resources: {}
      }
    }
  );

  // Register a static resource with server info
  mcpServer.registerResource(
    'Server Info',
    'meta://info',
    {
      description: 'Information about available templates',
      mimeType: 'application/json'
    },
    async () => {
      return {
        contents: [
          {
            uri: 'meta://info',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                server: 'test-resource-templates',
                description: 'This server demonstrates resource templates',
                templates: [
                  'user://{userId}',
                  'user://{userId}/posts',
                  'post://{postId}',
                  'post://{postId}/comments',
                  'file://{path}',
                  'log://{date}/{level}'
                ],
                examples: [
                  'user://123',
                  'user://456/posts',
                  'post://789',
                  'post://789/comments',
                  'file://config.json',
                  'log://2024-01-15/ERROR'
                ]
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  // Register user profile template
  mcpServer.registerResource(
    'User Profile',
    new ResourceTemplate('user://{userId}', {
      list: undefined // No listing capability
    }),
    {
      description: 'Get user profile by ID',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const userIdValue = variables.userId;
      const userId = Array.isArray(userIdValue)
        ? (userIdValue[0] ?? '0')
        : (userIdValue ?? '0');
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                id: userId,
                username: `user${userId}`,
                email: `user${userId}@example.com`,
                name: `Test User ${userId}`,
                role: Number.parseInt(userId, 10) % 2 === 0 ? 'admin' : 'user'
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  // Register user posts template
  mcpServer.registerResource(
    'User Posts',
    new ResourceTemplate('user://{userId}/posts', {
      list: undefined
    }),
    {
      description: 'Get all posts by a user',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const userId = Array.isArray(variables.userId)
        ? variables.userId[0]
        : variables.userId || '0';
      const posts = Array.from({ length: 3 }, (_, i) => ({
        id: `${userId}-${i + 1}`,
        userId,
        title: `Post ${i + 1} by User ${userId}`,
        content: `This is the content of post ${i + 1}`,
        createdAt: new Date(Date.now() - i * 86400000).toISOString()
      }));

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(posts, null, 2)
          }
        ]
      };
    }
  );

  // Register post template
  mcpServer.registerResource(
    'Post',
    new ResourceTemplate('post://{postId}', {
      list: undefined
    }),
    {
      description: 'Get a specific post',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const postId = Array.isArray(variables.postId)
        ? variables.postId[0]
        : variables.postId || '0';
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                id: postId,
                title: `Post ${postId}`,
                content: `This is the content of post ${postId}. It contains some interesting information.`,
                author: 'user123',
                tags: ['test', 'example', 'mcp'],
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T15:30:00Z'
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  // Register post comments template
  mcpServer.registerResource(
    'Post Comments',
    new ResourceTemplate('post://{postId}/comments', {
      list: undefined
    }),
    {
      description: 'Get comments for a post',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const postId = Array.isArray(variables.postId)
        ? variables.postId[0]
        : variables.postId || '0';
      const comments = Array.from({ length: 4 }, (_, i) => ({
        id: `comment-${i + 1}`,
        postId,
        author: `user${100 + i}`,
        content: `This is comment ${i + 1} on post ${postId}`,
        createdAt: new Date(Date.now() - i * 3600000).toISOString()
      }));

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(comments, null, 2)
          }
        ]
      };
    }
  );

  // Register file template
  mcpServer.registerResource(
    'File Content',
    new ResourceTemplate('file://{path}', {
      list: undefined
    }),
    {
      description: 'Get file content by path',
      mimeType: 'text/plain'
    },
    async (uri, variables) => {
      const path = Array.isArray(variables.path)
        ? variables.path[0]
        : variables.path || 'unknown';
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'text/plain',
            text: `This is the content of file: ${path}\n\nLine 2 of content\nLine 3 of content\n`
          }
        ]
      };
    }
  );

  // Register logs template with two variables
  mcpServer.registerResource(
    'Filtered Logs',
    new ResourceTemplate('log://{date}/{level}', {
      list: undefined
    }),
    {
      description: 'Get logs by date and level',
      mimeType: 'text/plain'
    },
    async (uri, variables) => {
      const date = Array.isArray(variables.date)
        ? variables.date[0]
        : variables.date || 'unknown';
      const level = Array.isArray(variables.level)
        ? variables.level[0]
        : variables.level || 'INFO';
      const logs = [
        `[${date} 08:00:00] ${level}: First log entry`,
        `[${date} 09:15:30] ${level}: Second log entry`,
        `[${date} 10:45:12] ${level}: Third log entry`,
        `[${date} 14:20:05] ${level}: Fourth log entry`
      ];

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'text/plain',
            text: logs.join('\n')
          }
        ]
      };
    }
  );

  return mcpServer;
}
