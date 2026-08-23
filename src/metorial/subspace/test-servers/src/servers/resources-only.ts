import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function createResourcesOnlyServer(): McpServer {
  const mcpServer = new McpServer(
    {
      name: 'test-resources-only',
      version: '1.0.0'
    },
    {
      capabilities: {
        resources: {}
      }
    }
  );

  // Register static resources
  mcpServer.registerResource(
    'Application Config',
    'file://config.json',
    {
      description: 'Main application configuration',
      mimeType: 'application/json'
    },
    async () => {
      return {
        contents: [
          {
            uri: 'file://config.json',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                app: {
                  name: 'Test Application',
                  version: '2.1.0',
                  environment: 'test'
                },
                database: {
                  host: 'localhost',
                  port: 5432,
                  name: 'testdb'
                },
                features: {
                  authentication: true,
                  api: true,
                  caching: true
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
    'Products Database',
    'file://data/products.json',
    {
      description: 'List of all products',
      mimeType: 'application/json'
    },
    async () => {
      return {
        contents: [
          {
            uri: 'file://data/products.json',
            mimeType: 'application/json',
            text: JSON.stringify(
              [
                {
                  id: 'prod-1',
                  name: 'Widget A',
                  price: 29.99,
                  stock: 100
                },
                {
                  id: 'prod-2',
                  name: 'Widget B',
                  price: 49.99,
                  stock: 50
                },
                {
                  id: 'prod-3',
                  name: 'Gadget C',
                  price: 99.99,
                  stock: 25
                }
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
    'Application Logs',
    'file://logs/app.log',
    {
      description: 'Recent application logs',
      mimeType: 'text/plain'
    },
    async () => {
      return {
        contents: [
          {
            uri: 'file://logs/app.log',
            mimeType: 'text/plain',
            text: [
              '2024-01-15 08:00:00 [INFO] Application started',
              '2024-01-15 08:00:01 [INFO] Database connection established',
              '2024-01-15 08:00:05 [INFO] Cache initialized',
              '2024-01-15 08:01:23 [WARN] High CPU usage detected',
              '2024-01-15 08:02:45 [INFO] API request processed: GET /api/products',
              '2024-01-15 08:03:12 [ERROR] Failed to connect to external service',
              '2024-01-15 08:03:15 [INFO] Retrying connection...',
              '2024-01-15 08:03:20 [INFO] Connection successful'
            ].join('\n')
          }
        ]
      };
    }
  );

  mcpServer.registerResource(
    'Documentation',
    'file://docs/readme.md',
    {
      description: 'Project documentation',
      mimeType: 'text/markdown'
    },
    async () => {
      return {
        contents: [
          {
            uri: 'file://docs/readme.md',
            mimeType: 'text/markdown',
            text: `# Test Application

## Overview
This is a test application for MCP e2e testing.

## Features
- Resource management
- API endpoints
- Data persistence

## Getting Started
1. Install dependencies
2. Configure environment
3. Run tests

## API Documentation
See the /api endpoint for full documentation.
`
          }
        ]
      };
    }
  );

  mcpServer.registerResource(
    'Statistics',
    'file://data/stats.csv',
    {
      description: 'Usage statistics',
      mimeType: 'text/csv'
    },
    async () => {
      return {
        contents: [
          {
            uri: 'file://data/stats.csv',
            mimeType: 'text/csv',
            text: [
              'date,users,requests,errors',
              '2024-01-01,120,1450,5',
              '2024-01-02,135,1678,3',
              '2024-01-03,142,1823,7',
              '2024-01-04,151,1901,2',
              '2024-01-05,148,1756,4'
            ].join('\n')
          }
        ]
      };
    }
  );

  return mcpServer;
}
