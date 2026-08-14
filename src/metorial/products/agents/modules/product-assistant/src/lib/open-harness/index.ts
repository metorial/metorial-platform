// ── Agent ────────────────────────────────────────────────────────────

export {
  Agent,
  ToolDeniedError,
  type AgentEvent,
  type ApproveFn,
  type SubagentEventFn,
  type TokenUsage,
  type ToolCallInfo
} from './agent';

// ── Subagent catalogs & resumable sessions ─────────────────────────

export {
  InMemorySubagentSessionMetadataStore,
  isSubagentCatalog,
  type SubagentCatalog,
  type SubagentDescriptor,
  type SubagentSessionDefaultMode,
  type SubagentSessionMetadata,
  type SubagentSessionMetadataStore,
  type SubagentSessionMode,
  type SubagentSessionsConfig,
  type SubagentSource
} from './lib/subagents';

// ── Agent Registry (background subagents) ───────────────────────────

export {
  AgentRegistry,
  type AgentStatus,
  type AwaitMode,
  type BackgroundAgentConfig,
  type SettledResult,
  type SubagentBackground
} from './lib/agent-registry';

// ── MCP ─────────────────────────────────────────────────────────────

export {
  closeMCPClients,
  connectMCPServers,
  type HttpMCPServer,
  type MCPConnection,
  type MCPServerConfig,
  type SseMCPServer
} from './lib/mcp';

// ── Session ─────────────────────────────────────────────────────────

export {
  DefaultCompactionStrategy,
  Session,
  type CompactionCheckInfo,
  type CompactionContext,
  type CompactionResult,
  type CompactionStrategy,
  type RetryConfig,
  type SessionEvent,
  type SessionHooks,
  type SessionLifecycleEvent,
  type SessionOptions,
  type SessionStore,
  type TurnInfo
} from './session';

// ── Skills ──────────────────────────────────────────────────────────

export {
  discoverSkills,
  scanSkillFiles,
  type SkillInfo,
  type SkillsConfig
} from './lib/skills';
export { createSkillTool } from './tools/skill';

// ── Instructions ────────────────────────────────────────────────────

export { findInstructions, loadInstructions } from './lib/instructions';

// ── Runner & Middleware ─────────────────────────────────────────────

export { apply, pipe, toRunner, type Middleware, type Runner } from './lib/runner';

// ── Stream Combinators ──────────────────────────────────────────────

export { filter, map, takeUntil, tap } from './lib/stream';

// ── Middleware ──────────────────────────────────────────────────────

export { withCompaction, type CompactionConfig } from './middleware/compaction';
export { withHooks } from './middleware/hooks';
export { withPersistence, type PersistenceConfig } from './middleware/persistence';
export { withRetry } from './middleware/retry';
export { withTurnTracking } from './middleware/turn-tracking';

// ── Conversation ───────────────────────────────────────────────────

export { Conversation, type ConversationOptions } from './lib/conversation';

// ── Providers ────────────────────────────────────────────────────

export type {
  DirEntry,
  FileStat,
  FsProvider,
  ShellProvider,
  ShellResult
} from './providers/types';

// ── Tool Factories ──────────────────────────────────────────────

export { createBashTool } from './tools/create-bash-tool';
export { createFsTools, type CreateFsToolsOptions } from './tools/create-fs-tools';
