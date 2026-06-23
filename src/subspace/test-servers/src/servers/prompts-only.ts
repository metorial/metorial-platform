import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function createPromptsOnlyServer(): McpServer {
  const mcpServer = new McpServer(
    {
      name: 'test-prompts-only',
      version: '1.0.0'
    },
    {
      capabilities: {
        prompts: {}
      }
    }
  );

  // Register debug_code prompt
  mcpServer.registerPrompt(
    'debug_code',
    {
      description: 'Generate a debugging prompt for code',
      argsSchema: {
        language: z.string().describe('Programming language'),
        error_type: z.string().optional().describe('Type of error (syntax, runtime, logic)')
      }
    },
    async ({ language, error_type }) => {
      const errorType = error_type || 'general';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please help me debug this ${language} code. I'm encountering a ${errorType} error. Analyze the code carefully and:
1. Identify the root cause of the issue
2. Explain why it's happening
3. Provide a fix with explanation
4. Suggest how to prevent similar issues in the future`
            }
          }
        ]
      };
    }
  );

  // Register write_tests prompt
  mcpServer.registerPrompt(
    'write_tests',
    {
      description: 'Generate a prompt for writing tests',
      argsSchema: {
        framework: z.string().describe('Testing framework (jest, mocha, pytest, etc)'),
        coverage: z
          .string()
          .optional()
          .describe('Coverage level (basic, thorough, comprehensive)')
      }
    },
    async ({ framework, coverage }) => {
      const coverageLevel = coverage || 'thorough';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Write ${coverageLevel} tests for this code using ${framework}. Include:
1. Unit tests for individual functions
2. Integration tests for component interactions
3. Edge cases and error handling
4. Mock any external dependencies appropriately`
            }
          }
        ]
      };
    }
  );

  // Register refactor prompt
  mcpServer.registerPrompt(
    'refactor',
    {
      description: 'Generate a code refactoring prompt',
      argsSchema: {
        goal: z
          .string()
          .describe('Refactoring goal (performance, readability, maintainability)'),
        constraints: z.string().optional().describe('Any constraints or requirements')
      }
    },
    async ({ goal, constraints }) => {
      const constraintsText = constraints || 'maintain backwards compatibility';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Refactor this code to improve ${goal}. Requirements:
1. ${constraintsText}
2. Explain each change and its benefit
3. Preserve existing functionality
4. Follow best practices and design patterns`
            }
          }
        ]
      };
    }
  );

  // Register document prompt
  mcpServer.registerPrompt(
    'document',
    {
      description: 'Generate documentation prompt',
      argsSchema: {
        type: z.string().describe('Documentation type (api, user_guide, developer_guide)'),
        detail_level: z
          .string()
          .optional()
          .describe('Level of detail (brief, standard, detailed)')
      }
    },
    async ({ type, detail_level }) => {
      const detailLevel = detail_level || 'standard';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Generate ${detailLevel} ${type} documentation for this code. Include:
1. Overview and purpose
2. Detailed descriptions of all public interfaces
3. Usage examples with code snippets
4. Common patterns and best practices
5. Troubleshooting section if applicable`
            }
          }
        ]
      };
    }
  );

  // Register analyze prompt
  mcpServer.registerPrompt(
    'analyze',
    {
      description: 'Analyze code or architecture',
      argsSchema: {
        focus: z
          .string()
          .describe('Analysis focus (security, performance, architecture, patterns)')
      }
    },
    async ({ focus }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Perform a ${focus} analysis of this code. Provide:
1. Overview of current implementation
2. Strengths and potential concerns
3. Specific recommendations for improvement
4. Priority ranking of suggested changes
5. Examples of better approaches where applicable`
            }
          }
        ]
      };
    }
  );

  return mcpServer;
}
