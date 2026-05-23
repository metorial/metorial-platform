import { slugify } from '@mtsrc/slugify';

type ConnectionTarget = {
  name?: string | null;
  url: string;
  token: string;
};

export let getCursorConnection = (target: ConnectionTarget) => {
  let last = slugify(target.name ?? 'Unknown Server');

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
          url: target.url,
          headers: {
            Authorization: `Bearer ${target.token}`
          }
        }
      }
    }
  };
};

export let getClaudeCodeConnection = (target: ConnectionTarget) => {
  let last = slugify(target.name ?? 'Unknown Server');

  return {
    steps: [
      {
        text: 'Run the following command in the Claude Code CLI',
        command: `claude mcp add \\
  --transport http \\
  ${last} \\
  ${target.url} \\
  -H "Authorization: Bearer ${target.token}"`
      },
      {
        text: 'Restart Claude Code'
      }
    ]
  };
};

export let getCodexConnection = (target: ConnectionTarget) => {
  let last = slugify(target.name ?? 'Unknown Server');
  let tokenEnvVar = `METORIAL_MAGIC_MCP_TOKEN_${last.replace(/-/g, '_').toUpperCase()}`;

  return {
    steps: [
      {
        text: 'Run the following command to store the bearer token for Codex',
        command: `export ${tokenEnvVar}="${target.token}"`
      },
      {
        text: 'Run the following command in the Codex CLI',
        command: `codex mcp add ${last} \\
  --url ${target.url} \\
  --bearer-token-env-var ${tokenEnvVar}`
      },
      {
        text: 'Start a new Codex session'
      }
    ]
  };
};

export let getGeminiCliConnection = (target: ConnectionTarget) => {
  let last = slugify(target.name ?? 'Unknown Server');

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
          url: target.url,
          trust: true,
          headers: {
            Authorization: `Bearer ${target.token}`
          }
        }
      }
    }
  };
};

export let getVisualStudioConnection = (target: ConnectionTarget) => {
  let last = slugify(target.name ?? 'Unknown Server');

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
          url: target.url,
          headers: {
            Authorization: `Bearer ${target.token}`
          }
        }
      }
    }
  };
};

export let getWindsurfConnection = (target: ConnectionTarget) => {
  let last = slugify(target.name ?? 'Unknown Server');

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
          serverUrl: target.url,
          headers: {
            Authorization: `Bearer ${target.token}`
          }
        }
      }
    }
  };
};

export type ConnectionType =
  | 'cursor'
  | 'claude-code'
  | 'codex'
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
  codex: {
    name: 'Codex',
    getConnection: getCodexConnection
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
