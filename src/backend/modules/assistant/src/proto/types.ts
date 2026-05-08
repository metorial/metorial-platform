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

export type ItemStatus = 'running' | 'completed' | 'failed';

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
      content: string[]; // lines to insert
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
