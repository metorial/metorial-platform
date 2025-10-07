import {
  DashboardInstanceMagicMcpServersGetOutput,
  DashboardInstanceMagicMcpTokensGetOutput
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { ServerListing } from '../../../../../../state/server';

export let getCursorConnection = (
  listing: ServerListing,
  server: DashboardInstanceMagicMcpServersGetOutput,
  token: DashboardInstanceMagicMcpTokensGetOutput
) => {
  let last = listing.slug.split('/').pop() ?? listing.slug;

  return {
    steps: [
      {
        text: 'Go to your global MCP configuration file at ~/.cursor/mcp.json and enter the code block below'
      },
      {
        text: `In Tools & Integrations > MCP tools, click the pencil icon next to "${last}"`
      },
      {
        text: 'Save the file.'
      },
      {
        text: 'Restart Cursor'
      }
    ],
    config: {
      mcpServers: {
        [last]: {
          url: server.endpoints[0].urls.streamableHttp,
          headers: {
            Authorization: `Bearer ${token.secret}`
          }
        }
      }
    }
  };
};

export let getClaudeCodeConnection = (
  listing: ServerListing,
  server: DashboardInstanceMagicMcpServersGetOutput,
  token: DashboardInstanceMagicMcpTokensGetOutput
) => {
  let last = listing.slug.split('/').pop() ?? listing.slug;

  return {
    steps: [
      {
        text: 'Run the following command in the Claude Code CLI',
        command: `claude mcp add --transport http ${last} ${server.endpoints[0].urls.streamableHttp} -H "Authorization: Bearer ${token.secret}"`
      },
      {
        text: 'Restart Claude Code'
      }
    ]
  };
};

export let getGeminiCliConnection = (
  listing: ServerListing,
  server: DashboardInstanceMagicMcpServersGetOutput,
  token: DashboardInstanceMagicMcpTokensGetOutput
) => {
  let last = listing.slug.split('/').pop() ?? listing.slug;

  return {
    steps: [
      {
        text: 'Go to your global MCP configuration file at ~/.gemini/settings.json and enter the code block below'
      },
      {
        text: 'Save the file.'
      },
      {
        text: 'Restart Gemini CLI'
      }
    ],
    config: {
      mcpServers: {
        [last]: {
          url: server.endpoints[0].urls.streamableHttp,
          trust: true,
          headers: {
            Authorization: `Bearer ${token.secret}`
          }
        }
      }
    }
  };
};

export let getVisualStudioConnection = (
  listing: ServerListing,
  server: DashboardInstanceMagicMcpServersGetOutput,
  token: DashboardInstanceMagicMcpTokensGetOutput
) => {
  let last = listing.slug.split('/').pop() ?? listing.slug;

  return {
    steps: [
      {
        text: 'Add the following configuration to the `.mcp.json` file in your solution'
      },
      {
        text: 'Save the file.'
      },
      {
        text: 'Restart Visual Studio'
      }
    ],
    config: {
      servers: {
        [last]: {
          url: server.endpoints[0].urls.streamableHttp,
          headers: {
            Authorization: `Bearer ${token.secret}`
          }
        }
      }
    }
  };
};

export let getWindsurfConnection = (
  listing: ServerListing,
  server: DashboardInstanceMagicMcpServersGetOutput,
  token: DashboardInstanceMagicMcpTokensGetOutput
) => {
  let last = listing.slug.split('/').pop() ?? listing.slug;

  return {
    steps: [
      {
        text: 'Add the following configuration to your Windsurf MCP configuration file'
      },
      {
        text: 'Save the file.'
      }
    ],
    config: {
      mcpServers: {
        [last]: {
          serverUrl: server.endpoints[0].urls.streamableHttp,
          headers: {
            Authorization: `Bearer ${token.secret}`
          }
        }
      }
    }
  };
};

export type ConnectionType =
  | 'cursor'
  | 'claude-code'
  | 'gemini-cli'
  | 'visual-studio'
  | 'windsurf';

export let connectionTypes = {
  cursor: {
    name: 'Cursor',
    getConnection: getCursorConnection
  },
  'claude-code': {
    name: 'Claude Code',
    getConnection: getClaudeCodeConnection
  },
  'gemini-cli': {
    name: 'Gemini CLI',
    getConnection: getGeminiCliConnection
  },
  'visual-studio': {
    name: 'Visual Studio',
    getConnection: getVisualStudioConnection
  },
  windsurf: {
    name: 'Windsurf',
    getConnection: getWindsurfConnection
  }
};
