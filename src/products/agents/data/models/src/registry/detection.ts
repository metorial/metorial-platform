// Passive signals Metorial Desktop looks for to tell which AI tools are on a device, keyed by
// agent id. A wrong signal reports a tool that isn't there, so an entry only lists what is
// specific to the tool: no shared folders, no generic executable names, and no process name
// that another tool also uses when compared ignoring case. A missing signal only costs recall.
//
// Paths use `/` and start with a root: `~` (the home folder), `%APPDATA%`, `%LOCALAPPDATA%` or
// `%PROGRAMFILES%`. macOS apps are bundle names looked up in `/Applications` and `~/Applications`;
// Windows apps are install folders. Binaries are looked up on `PATH`. Process names are matched
// against the executable name the OS reports, ignoring case. A tool matched only by a process or
// only by a binary is reported with low confidence.

export type DetectionPlatform = 'macos' | 'windows' | 'linux';

export interface DetectionSignatures {
  configDirs?: string[];
  apps?: string[];
  binaries?: string[];
  processNames?: string[];
}

export interface DetectionSeed {
  agentId: string;
  ideExtensionIds?: string[];
  macos?: DetectionSignatures;
  windows?: DetectionSignatures;
  linux?: DetectionSignatures;
}

export let detectionSeeds: DetectionSeed[] = [
  {
    agentId: 'claude-code',
    ideExtensionIds: ['anthropic.claude-code'],
    macos: { configDirs: ['~/.claude'], binaries: ['claude'] },
    windows: { configDirs: ['~/.claude'], binaries: ['claude'] },
    linux: { configDirs: ['~/.claude'], binaries: ['claude'] }
  },
  {
    agentId: 'claude-desktop',
    macos: {
      configDirs: ['~/Library/Application Support/Claude'],
      apps: ['Claude.app'],
      processNames: ['Claude']
    },
    windows: { configDirs: ['%APPDATA%/Claude'], apps: ['%LOCALAPPDATA%/AnthropicClaude'] }
  },
  {
    agentId: 'codex',
    ideExtensionIds: ['openai.chatgpt'],
    macos: { configDirs: ['~/.codex'], binaries: ['codex'], processNames: ['codex'] },
    windows: { configDirs: ['~/.codex'], binaries: ['codex'], processNames: ['codex.exe'] },
    linux: { configDirs: ['~/.codex'], binaries: ['codex'], processNames: ['codex'] }
  },
  {
    agentId: 'chatgpt',
    macos: {
      configDirs: ['~/Library/Application Support/com.openai.chat'],
      apps: ['ChatGPT.app'],
      processNames: ['ChatGPT']
    },
    windows: { processNames: ['ChatGPT.exe'] }
  },
  {
    agentId: 'gemini-cli',
    macos: { binaries: ['gemini'] },
    windows: { binaries: ['gemini'] },
    linux: { binaries: ['gemini'] }
  },
  {
    agentId: 'qwen-code',
    macos: { configDirs: ['~/.qwen'], binaries: ['qwen'] },
    windows: { configDirs: ['~/.qwen'], binaries: ['qwen'] },
    linux: { configDirs: ['~/.qwen'], binaries: ['qwen'] }
  },
  {
    agentId: 'github-copilot',
    ideExtensionIds: ['github.copilot', 'github.copilot-chat'],
    macos: { configDirs: ['~/.copilot'] },
    windows: { configDirs: ['~/.copilot'] },
    linux: { configDirs: ['~/.copilot'] }
  },
  {
    agentId: 'cursor',
    macos: {
      configDirs: ['~/.cursor'],
      apps: ['Cursor.app'],
      binaries: ['cursor-agent'],
      processNames: ['Cursor']
    },
    windows: {
      configDirs: ['~/.cursor'],
      apps: ['%LOCALAPPDATA%/Programs/cursor'],
      processNames: ['Cursor.exe']
    },
    linux: { configDirs: ['~/.cursor'], binaries: ['cursor-agent'] }
  },
  {
    agentId: 'kiro',
    macos: {
      configDirs: ['~/.kiro'],
      apps: ['Kiro.app'],
      binaries: ['kiro-cli'],
      processNames: ['Kiro']
    },
    windows: {
      configDirs: ['~/.kiro'],
      apps: ['%LOCALAPPDATA%/Programs/Kiro'],
      processNames: ['Kiro.exe']
    },
    linux: { configDirs: ['~/.kiro'], binaries: ['kiro-cli'] }
  },
  {
    agentId: 'antigravity',
    macos: {
      configDirs: ['~/.gemini/antigravity'],
      apps: ['Antigravity.app'],
      processNames: ['Antigravity']
    },
    windows: {
      configDirs: ['~/.gemini/antigravity'],
      apps: ['%LOCALAPPDATA%/Programs/Antigravity'],
      processNames: ['Antigravity.exe']
    },
    linux: { configDirs: ['~/.gemini/antigravity'] }
  },
  {
    agentId: 'devin-desktop',
    macos: {
      configDirs: ['~/.codeium/windsurf'],
      apps: ['Windsurf.app'],
      binaries: ['windsurf'],
      processNames: ['Windsurf']
    },
    windows: {
      configDirs: ['~/.codeium/windsurf'],
      apps: ['%LOCALAPPDATA%/Programs/Windsurf'],
      processNames: ['Windsurf.exe']
    },
    linux: { configDirs: ['~/.codeium/windsurf'], binaries: ['windsurf'] }
  },
  {
    agentId: 'opencode',
    macos: {
      configDirs: ['~/.config/opencode'],
      binaries: ['opencode'],
      processNames: ['opencode']
    },
    windows: { binaries: ['opencode'], processNames: ['opencode.exe'] },
    linux: {
      configDirs: ['~/.config/opencode'],
      binaries: ['opencode'],
      processNames: ['opencode']
    }
  },
  { agentId: 'kilo-code', ideExtensionIds: ['kilocode.kilo-code'] },
  { agentId: 'cline', ideExtensionIds: ['saoudrizwan.claude-dev'] },
  {
    agentId: 'goose',
    macos: { configDirs: ['~/.config/goose'], apps: ['Goose.app'] },
    linux: { configDirs: ['~/.config/goose'] }
  },
  {
    agentId: 'continue',
    ideExtensionIds: ['continue.continue'],
    macos: { configDirs: ['~/.continue'] },
    windows: { configDirs: ['~/.continue'] },
    linux: { configDirs: ['~/.continue'] }
  },
  { agentId: 'amp', ideExtensionIds: ['sourcegraph.amp'] },
  {
    agentId: 'augment',
    ideExtensionIds: ['augment.vscode-augment'],
    macos: { configDirs: ['~/.augment'], binaries: ['auggie'] },
    windows: { configDirs: ['~/.augment'], binaries: ['auggie'] },
    linux: { configDirs: ['~/.augment'], binaries: ['auggie'] }
  },
  {
    agentId: 'aider',
    macos: { binaries: ['aider'] },
    windows: { binaries: ['aider'] },
    linux: { binaries: ['aider'] }
  },
  {
    agentId: 'warp',
    macos: { configDirs: ['~/.warp'], apps: ['Warp.app'] },
    linux: { binaries: ['warp-terminal'] }
  },
  {
    agentId: 'crush',
    macos: { binaries: ['crush'] },
    windows: { binaries: ['crush'] },
    linux: { binaries: ['crush'] }
  },
  {
    agentId: 'perplexity',
    macos: { apps: ['Perplexity.app'], processNames: ['Perplexity'] },
    windows: {
      apps: ['%LOCALAPPDATA%/Programs/Perplexity'],
      processNames: ['Perplexity.exe']
    }
  },
  {
    agentId: 'ollama',
    macos: {
      configDirs: ['~/.ollama'],
      apps: ['Ollama.app'],
      binaries: ['ollama'],
      processNames: ['ollama']
    },
    windows: {
      configDirs: ['~/.ollama'],
      apps: ['%LOCALAPPDATA%/Programs/Ollama'],
      binaries: ['ollama'],
      processNames: ['ollama.exe', 'ollama app.exe']
    },
    linux: { configDirs: ['~/.ollama'], binaries: ['ollama'], processNames: ['ollama'] }
  },
  {
    agentId: 'lm-studio',
    macos: {
      configDirs: ['~/.lmstudio', '~/.cache/lm-studio'],
      apps: ['LM Studio.app'],
      processNames: ['LM Studio']
    },
    windows: {
      configDirs: ['~/.lmstudio', '~/.cache/lm-studio'],
      apps: ['%LOCALAPPDATA%/Programs/LM Studio'],
      processNames: ['LM Studio.exe']
    },
    linux: { configDirs: ['~/.lmstudio', '~/.cache/lm-studio'] }
  }
];
