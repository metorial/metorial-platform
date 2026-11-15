type InstallStep = {
  title: string;
  description: string;
  code?: { label: string; value: string };
};

type InstallClient = {
  id: string;
  name: string;
  docsUrl: string;
  steps: InstallStep[];
};

let shellQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

export let getPublicMcpInstallInstructions = (d: {
  slug: string;
  url: string;
  name: string;
}): InstallClient[] => {
  let config = (root: string, urlKey: string) =>
    JSON.stringify({ [root]: { [d.slug]: { [urlKey]: d.url } } }, null, 2);

  let serverArgument = shellQuote(d.slug);
  let urlArgument = shellQuote(d.url);

  return [
    {
      id: 'cursor',
      name: 'Cursor',
      docsUrl: 'https://cursor.com/docs/mcp',
      steps: [
        {
          title: 'Add the Server',
          description:
            'Add this entry to ~/.cursor/mcp.json. If you already have servers configured, merge it into mcpServers.',
          code: { label: '~/.cursor/mcp.json', value: config('mcpServers', 'url') }
        },
        {
          title: 'Connect Your Account',
          description: `Open Cursor’s MCP settings and authenticate ${d.name}. Complete the sign-in in your browser.`
        },
        {
          title: 'Start a Conversation',
          description: 'Enable the server’s tools, then ask your agent to help.'
        }
      ]
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      docsUrl: 'https://code.claude.com/docs/en/mcp',
      steps: [
        {
          title: 'Add the Server',
          description: 'Run this command in your terminal.',
          code: {
            label: 'Terminal',
            value: `claude mcp add --transport http ${serverArgument} \\\n  ${urlArgument}`
          }
        },
        {
          title: 'Connect Your Account',
          description: `Run /mcp in Claude Code, select ${d.name}, and follow the browser sign-in.`
        },
        {
          title: 'Start a Conversation',
          description: 'Once the server is connected, ask Claude to help.'
        }
      ]
    },
    {
      id: 'codex',
      name: 'Codex',
      docsUrl: 'https://learn.chatgpt.com/docs/extend/mcp',
      steps: [
        {
          title: 'Add the Server',
          description: 'Run this command in your terminal.',
          code: {
            label: 'Terminal',
            value: `codex mcp add ${serverArgument} \\\n  --url ${urlArgument}`
          }
        },
        {
          title: 'Connect Your Account',
          description: 'Run the command below and finish signing in through your browser.',
          code: { label: 'Terminal', value: `codex mcp login ${serverArgument}` }
        },
        {
          title: 'Start a Conversation',
          description: `Start a new Codex session. Use /mcp to check that ${d.name} is available.`
        }
      ]
    },
    {
      id: 'gemini-cli',
      name: 'Gemini CLI',
      docsUrl: 'https://geminicli.com/docs/tools/mcp-server/',
      steps: [
        {
          title: 'Add the Server',
          description: 'Merge this entry into mcpServers in your Gemini settings file.',
          code: { label: '~/.gemini/settings.json', value: config('mcpServers', 'httpUrl') }
        },
        {
          title: 'Connect Your Account',
          description: `Start Gemini CLI and complete the browser sign-in. If needed, run /mcp auth ${d.slug}.`
        },
        {
          title: 'Start a Conversation',
          description: 'Use /mcp to check the server, then ask Gemini to help.'
        }
      ]
    },
    {
      id: 'visual-studio',
      name: 'Visual Studio',
      docsUrl: 'https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers',
      steps: [
        {
          title: 'Add the Server',
          description:
            'Add this configuration to .mcp.json in your solution. Merge it with any existing servers.',
          code: { label: '.mcp.json', value: config('servers', 'url') }
        },
        {
          title: 'Connect Your Account',
          description:
            'Save the file and use the authentication CodeLens above the server entry to sign in through your browser.'
        },
        {
          title: 'Start a Conversation',
          description:
            'Switch Copilot Chat to Agent mode and enable the tools you want to use.'
        }
      ]
    },
    {
      id: 'windsurf',
      name: 'Windsurf / Cascade',
      docsUrl: 'https://docs.devin.ai/desktop/cascade/mcp',
      steps: [
        {
          title: 'Add the Server',
          description:
            'In Cascade’s Actions menu, choose Open MCP config file and merge this entry. Devin Local uses a different configuration; see the setup guide.',
          code: {
            label: 'mcp_config.json · Cascade',
            value: config('mcpServers', 'serverUrl')
          }
        },
        {
          title: 'Connect Your Account',
          description:
            'Refresh the MCP server list in Cascade and complete the browser authorization when prompted.'
        },
        {
          title: 'Start a Conversation',
          description: 'Enable the server and ask Cascade to help.'
        }
      ]
    }
  ];
};
