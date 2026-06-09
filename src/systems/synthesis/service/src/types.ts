export type MessagePart =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'file';
      data: string;
      encoding: 'base64' | 'utf-8';
      filename?: string;
      mediaType: string;
    };

export type InputMessage = {
  parts: MessagePart[];
};

export type ItemStatus = 'pending' | 'running' | 'waiting_for_user' | 'completed' | 'failed';

export type Message = {
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
};

export type ToolCallState = {
  id: string;
  input: unknown;
  output?: unknown;
  error?: { message: string };
  status: ItemStatus;
  handoff?: {
    title: string;
    description?: string;
  };
};

export type FileExploreOperation = (
  | {
      type: 'read';
      path: string;
    }
  | {
      type: 'explore';
      path: string | null;
      pattern?: string;
    }
) & {
  id: string;
  input: unknown;
  output?: unknown;
  error?: { message: string };
  status: ItemStatus;
};

export type FileWriteChange =
  | {
      type: 'insert';
      line: number;
      content: string[];
    }
  | {
      type: 'replace';
      oldString: string;
      newString: string;
      replaceAll: boolean;
    }
  | {
      type: 'delete';
      line?: number;
      count?: number;
    };

export type WebSearchResult = {
  title: string;
  url: string;
  description?: string;
  category?: string;
};

export type WebOperation = (
  | {
      type: 'search';
      query: string;
      country?: string;
      searchType?: string;
      results?: WebSearchResult[];
    }
  | {
      type: 'fetch';
      url: string;
      content?: string;
    }
) & {
  id: string;
  input: unknown;
  output?: unknown;
  error?: { message: string };
  status: ItemStatus;
};

export type StateItem = {
  id: string;
} & (
  | {
      type: 'tool';
      tool: { key: string; name: string };
      calls: ToolCallState[];
    }
  | {
      type: 'files/explore';
      operations: FileExploreOperation[];
    }
  | {
      type: 'files/write';
      status: ItemStatus;
      toolCallId: string;
      operation: 'write' | 'edit' | 'delete';
      path: string;
      input: unknown;
      output?: unknown;
      error?: { message: string };
      changes: FileWriteChange;
    }
  | {
      type: 'shell';
      status: ItemStatus;
      toolCallId: string;
      command: string;
      stdout: string;
      stderr: string;
      exitCode: number | null;
      input: unknown;
      output?: unknown;
      error?: { message: string };
    }
  | {
      type: 'web';
      operations: WebOperation[];
    }
  | {
      type: 'message';
      status: ItemStatus;
      message: Message;
    }
  | {
      type: 'reasoning';
      status: ItemStatus;
      text: string;
    }
  | {
      type: 'compaction';
      status: ItemStatus;
      reason?: 'overflow' | 'manual';
      summary?: string;
      tokensBefore?: number;
      tokensAfter?: number;
      tokensRemoved?: number;
      messagesRemoved?: number;
    }
  | {
      type: 'error';
      error: {
        message: string;
      };
    }
);

export interface State {
  items: StateItem[];
}

export type AssistantMessageSerializedContent = {
  b: 'ai-sdk-1';
  messages: [number, unknown][];
};

export type AssistantRequestStatus =
  | 'pending'
  | 'waiting_for_user'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type AssistantRunUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AssistantRunCost = AssistantRunUsage & {
  inputCost: number;
  outputCost: number;
  totalCost: number;
};

export type AssistantRunMetadata = {
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  durationMs?: number;
  finalSnapshotIndex?: number;
  usage?: AssistantRunUsage;
  usageEvents?: ({ eventType: string } & AssistantRunUsage)[];
  compactions?: Extract<StateItem, { type: 'compaction' }>[];
  error?: {
    message: string;
  };
};

export type SubspaceMcpToolList = {
  tools: Array<{
    name: string;
    title?: string;
    description?: string;
    inputSchema: Record<string, unknown>;
    annotations?: Record<string, unknown>;
    _meta?: Record<string, unknown>;
  }>;
  nextCursor?: string;
};
