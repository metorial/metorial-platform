import type { Agent } from '../agent';
import type { SessionOptions, SessionStore } from '../session';

export interface SubagentDescriptor {
  name: string;
  description?: string;
}

export interface SubagentCatalog {
  list(): Promise<SubagentDescriptor[]>;
  resolve(name: string): Promise<Agent | undefined>;
}

export type SubagentSource = Agent[] | SubagentCatalog;

export type SubagentSessionMode = 'stateless' | 'new' | 'resume' | 'fork';
export type SubagentSessionDefaultMode = 'stateless' | 'new';

export interface SubagentSessionMetadata {
  sessionId: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubagentSessionMetadataStore {
  load(sessionId: string): Promise<SubagentSessionMetadata | undefined>;
  save(metadata: SubagentSessionMetadata): Promise<void>;
  delete?(sessionId: string): Promise<void>;
  list?(filter?: { agentName?: string }): Promise<SubagentSessionMetadata[]>;
}

export interface SubagentSessionsConfig {
  messages: SessionStore;
  metadata?: SubagentSessionMetadataStore;
  defaultMode?: SubagentSessionDefaultMode;
  sessionOptions?: Omit<SessionOptions, 'agent' | 'sessionId' | 'sessionStore'>;
}

export class InMemorySubagentSessionMetadataStore implements SubagentSessionMetadataStore {
  private entries = new Map<string, SubagentSessionMetadata>();

  async load(sessionId: string): Promise<SubagentSessionMetadata | undefined> {
    return this.entries.get(sessionId);
  }

  async save(metadata: SubagentSessionMetadata): Promise<void> {
    this.entries.set(metadata.sessionId, metadata);
  }

  async delete(sessionId: string): Promise<void> {
    this.entries.delete(sessionId);
  }

  async list(filter?: { agentName?: string }): Promise<SubagentSessionMetadata[]> {
    const values = [...this.entries.values()];
    if (!filter?.agentName) return values;
    return values.filter(entry => entry.agentName === filter.agentName);
  }
}

export function isSubagentCatalog(source: SubagentSource): source is SubagentCatalog {
  return !Array.isArray(source);
}
