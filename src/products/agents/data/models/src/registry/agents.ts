import type { AgentSurface, AgentVendor } from '../types';

export interface AgentSeed {
  id: string;
  name: string;
  makerId: string;
  description: string;
  website?: string;
  docs?: string;
  repository?: string;
  openSource: boolean;
  license?: string;
  surfaces: AgentSurface[];
  aliases?: string[];
  vendors?: AgentVendor[];
  derivedFrom?: string;
  retired?: boolean;
}

// Aliases are the ids telemetry and client integrations use for the agent (OTel `service.name`
// values, agent-tracking client families, CLI binary names). Every maker needs an organization seed.
export let agentSeeds: AgentSeed[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    makerId: 'anthropic',
    description: "Anthropic's coding agent for the terminal, IDEs, desktop and web.",
    website: 'https://claude.com/product/claude-code',
    docs: 'https://code.claude.com/docs',
    openSource: false,
    surfaces: ['cli', 'ide-extension', 'desktop', 'web'],
    aliases: ['claude_code', 'claude-code-desktop'],
    vendors: [
      { vendorId: 'anthropic', role: 'default' },
      { vendorId: 'aws-bedrock', role: 'supported' },
      { vendorId: 'google-vertex', role: 'supported' },
      { vendorId: 'azure', role: 'supported' }
    ]
  },
  {
    id: 'codex',
    name: 'Codex',
    makerId: 'openai',
    description:
      "OpenAI's coding agent for the terminal, IDEs, the desktop app and the cloud.",
    website: 'https://openai.com/codex',
    docs: 'https://developers.openai.com/codex',
    repository: 'https://github.com/openai/codex',
    openSource: true,
    license: 'Apache-2.0',
    surfaces: ['cli', 'ide-extension', 'desktop', 'cloud'],
    aliases: ['openai-codex', 'codex-cli', 'codex_cli_rs', 'codex_exec', 'codex-app-server'],
    vendors: [
      { vendorId: 'openai', role: 'default' },
      { vendorId: 'azure', role: 'supported' }
    ]
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    makerId: 'google',
    description: "Google's open-source coding agent for the terminal.",
    website: 'https://geminicli.com',
    docs: 'https://geminicli.com/docs',
    repository: 'https://github.com/google-gemini/gemini-cli',
    openSource: true,
    license: 'Apache-2.0',
    surfaces: ['cli'],
    aliases: ['gemini_cli'],
    vendors: [
      { vendorId: 'google-ai-studio', role: 'default' },
      { vendorId: 'google-vertex', role: 'supported' }
    ]
  },
  {
    id: 'qwen-code',
    name: 'Qwen Code',
    makerId: 'alibaba',
    description: "Alibaba's coding agent for the terminal, forked from Gemini CLI.",
    repository: 'https://github.com/QwenLM/qwen-code',
    openSource: true,
    license: 'Apache-2.0',
    surfaces: ['cli'],
    aliases: ['qwen_code'],
    vendors: [{ vendorId: 'alibaba-cloud', role: 'default' }],
    derivedFrom: 'gemini-cli'
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    makerId: 'github',
    description:
      "GitHub's coding assistant and agent in IDEs, the terminal and GitHub's cloud.",
    website: 'https://github.com/features/copilot',
    docs: 'https://docs.github.com/en/copilot',
    openSource: false,
    surfaces: ['ide-extension', 'cli', 'cloud'],
    aliases: [
      'copilot',
      'copilot-cli',
      'copilot-chat',
      'copilot_cli',
      'copilot_vscode',
      'github-copilot-cli'
    ],
    vendors: [{ vendorId: 'github-copilot', role: 'subscription' }]
  },
  {
    id: 'cursor',
    name: 'Cursor',
    makerId: 'anysphere',
    description: 'AI code editor with an agent, a CLI and cloud agents.',
    website: 'https://cursor.com',
    docs: 'https://cursor.com/docs',
    openSource: false,
    surfaces: ['ide', 'cli', 'cloud'],
    aliases: ['cursor-agent', 'cursor-cli']
  },
  {
    id: 'kiro',
    name: 'Kiro',
    makerId: 'amazon',
    description: "AWS's agentic IDE and CLI, the successor of Amazon Q Developer CLI.",
    website: 'https://kiro.dev',
    docs: 'https://kiro.dev/docs',
    openSource: false,
    surfaces: ['ide', 'cli', 'web'],
    aliases: ['kiro-cli', 'kiro-ide', 'kiro-enterprise']
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    makerId: 'google',
    description: "Google's agent manager app, CLI and IDE.",
    website: 'https://antigravity.google',
    docs: 'https://antigravity.google/docs',
    openSource: false,
    surfaces: ['desktop', 'cli', 'ide', 'ide-extension'],
    aliases: ['google-antigravity', 'agy']
  },
  {
    id: 'jetbrains-ai',
    name: 'JetBrains AI',
    makerId: 'jetbrains',
    description: 'AI Assistant and the Junie coding agent in JetBrains IDEs and the terminal.',
    website: 'https://www.jetbrains.com/ai',
    docs: 'https://www.jetbrains.com/help/ai-assistant',
    openSource: false,
    surfaces: ['ide-extension', 'cli'],
    aliases: ['jetbrains', 'junie', 'jetbrains-junie', 'jetbrains-ai-assistant'],
    vendors: [
      { vendorId: 'anthropic', role: 'supported' },
      { vendorId: 'openai', role: 'supported' },
      { vendorId: 'google-ai-studio', role: 'supported' },
      { vendorId: 'aws-bedrock', role: 'supported' },
      { vendorId: 'xai', role: 'supported' },
      { vendorId: 'openrouter', role: 'supported' }
    ]
  },
  {
    id: 'opencode',
    name: 'opencode',
    makerId: 'opencode',
    description: 'Open-source coding agent for the terminal that works with any provider.',
    website: 'https://opencode.ai',
    docs: 'https://opencode.ai/docs',
    repository: 'https://github.com/anomalyco/opencode',
    openSource: true,
    license: 'MIT',
    surfaces: ['cli'],
    vendors: [{ vendorId: 'opencode', role: 'subscription' }]
  },
  {
    id: 'kilo-code',
    name: 'Kilo Code',
    makerId: 'kilo',
    description: 'Open-source coding agent for VS Code, JetBrains and the terminal.',
    website: 'https://kilo.ai',
    repository: 'https://github.com/Kilo-Org/kilocode',
    openSource: true,
    surfaces: ['ide-extension', 'cli'],
    aliases: ['kilocode'],
    vendors: [{ vendorId: 'kilo', role: 'default' }],
    derivedFrom: 'opencode'
  },
  {
    id: 'cline',
    name: 'Cline',
    makerId: 'cline',
    description: 'Open-source coding agent for VS Code, JetBrains and the terminal.',
    website: 'https://cline.bot',
    docs: 'https://docs.cline.bot',
    repository: 'https://github.com/cline/cline',
    openSource: true,
    license: 'Apache-2.0',
    surfaces: ['ide-extension', 'cli'],
    vendors: [{ vendorId: 'cline-pass', role: 'subscription' }]
  },
  {
    id: 'goose',
    name: 'Goose',
    makerId: 'block',
    description: 'Open-source on-machine agent for the terminal and desktop.',
    website: 'https://block.github.io/goose',
    repository: 'https://github.com/block/goose',
    openSource: true,
    license: 'Apache-2.0',
    surfaces: ['cli', 'desktop'],
    aliases: ['goose-cli']
  },
  {
    id: 'factory-droid',
    name: 'Factory Droid',
    makerId: 'factory',
    description: "Factory's enterprise coding agent.",
    website: 'https://factory.ai',
    docs: 'https://docs.factory.com',
    openSource: false,
    surfaces: ['cli'],
    aliases: ['droid']
  },
  {
    id: 'continue',
    name: 'Continue',
    makerId: 'continue',
    description: 'Open-source coding agent for IDEs and the terminal.',
    website: 'https://continue.dev',
    docs: 'https://docs.continue.dev',
    repository: 'https://github.com/continuedev/continue',
    openSource: true,
    license: 'Apache-2.0',
    surfaces: ['ide-extension', 'cli'],
    aliases: ['continue-cli']
  },
  {
    id: 'devin-desktop',
    name: 'Devin Desktop',
    makerId: 'cognition',
    description: "Cognition's agentic IDE, formerly Windsurf.",
    website: 'https://devin.ai',
    docs: 'https://docs.devin.ai/desktop',
    openSource: false,
    surfaces: ['ide'],
    aliases: ['windsurf']
  },
  {
    id: 'devin',
    name: 'Devin',
    makerId: 'cognition',
    description: "Cognition's autonomous cloud coding agent and CLI.",
    website: 'https://devin.ai',
    docs: 'https://docs.devin.ai',
    openSource: false,
    surfaces: ['cloud', 'cli'],
    aliases: ['devin-cli']
  },
  {
    id: 'amp',
    name: 'Amp',
    makerId: 'sourcegraph',
    description: 'Coding agent for the terminal and editors.',
    website: 'https://ampcode.com',
    docs: 'https://ampcode.com/manual',
    openSource: false,
    surfaces: ['cli', 'ide-extension']
  },
  {
    id: 'augment',
    name: 'Augment Code',
    makerId: 'augment',
    description: 'Coding agent for IDEs and the Auggie CLI.',
    website: 'https://www.augmentcode.com',
    docs: 'https://docs.augmentcode.com',
    openSource: false,
    surfaces: ['ide-extension', 'cli'],
    aliases: ['auggie', 'augment-code']
  },
  {
    id: 'zed-agent',
    name: 'Zed Agent',
    makerId: 'zed-industries',
    description: 'The agent built into the Zed editor.',
    website: 'https://zed.dev',
    docs: 'https://zed.dev/docs/ai/agent-panel',
    repository: 'https://github.com/zed-industries/zed',
    openSource: true,
    license: 'GPL-3.0',
    surfaces: ['ide'],
    aliases: ['zed']
  },
  {
    id: 'aider',
    name: 'Aider',
    makerId: 'aider-ai',
    description: 'Open-source AI pair programming in the terminal.',
    website: 'https://aider.chat',
    repository: 'https://github.com/Aider-AI/aider',
    openSource: true,
    license: 'Apache-2.0',
    surfaces: ['cli']
  },
  {
    id: 'warp',
    name: 'Warp',
    makerId: 'warp',
    description: 'Agentic terminal with local and cloud agents.',
    website: 'https://www.warp.dev',
    docs: 'https://docs.warp.dev',
    repository: 'https://github.com/warpdotdev/warp',
    openSource: true,
    license: 'AGPL-3.0',
    surfaces: ['desktop', 'cloud']
  },
  {
    id: 'crush',
    name: 'Crush',
    makerId: 'charm',
    description: "Charm's coding agent for the terminal.",
    repository: 'https://github.com/charmbracelet/crush',
    openSource: true,
    license: 'FSL-1.1-MIT',
    surfaces: ['cli']
  },
  {
    id: 'mistral-vibe',
    name: 'Mistral Vibe',
    makerId: 'mistral',
    description: "Mistral's open-source coding agent for the terminal.",
    repository: 'https://github.com/mistralai/mistral-vibe',
    openSource: true,
    license: 'Apache-2.0',
    surfaces: ['cli'],
    aliases: ['vibe'],
    vendors: [{ vendorId: 'mistral', role: 'default' }]
  },
  {
    id: 'grok-build',
    name: 'Grok Build',
    makerId: 'xai',
    description: "xAI's coding agent for the terminal.",
    openSource: false,
    surfaces: ['cli'],
    aliases: ['grok-cli', 'grok-code', 'grok_code'],
    vendors: [{ vendorId: 'xai', role: 'default' }]
  },
  {
    id: 'muse-code',
    name: 'Muse Code',
    makerId: 'meta',
    description: "Meta's coding agent.",
    openSource: false,
    surfaces: ['cli'],
    aliases: ['muse']
  }
];
