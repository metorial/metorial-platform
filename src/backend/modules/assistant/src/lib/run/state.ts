import type { SessionEvent } from '@openharness/core';
import type { ModelMessage } from 'ai';
import type {
  FileWriteChange,
  ItemStatus,
  Message,
  State,
  StateItem,
  WebSearchResult
} from '../../proto/types';
import {
  DeltaTransportSink,
  JsonValue,
  ServerStateHandle,
  WireMessage,
  WireSnapshot,
  createServerState
} from '../delta';

export type AgentRunWireMessage = WireMessage;

export type AgentRunStateOptions = {
  onWireMessage?: (message: AgentRunWireMessage) => void;
  emit?: DeltaTransportSink<AgentRunWireMessage>;
  deltaFormat?: 'batch' | 'message';
};

export type AgentRunResult = {
  state: State;
  serialized: PrismaJson.AssistantMessageSerializedContent;
  snapshotIndex: number;
  usage: AgentRunUsage;
  metadata: PrismaJson.AssistantRunMetadata;
};

export type AgentRunUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type UsageEvent = AgentRunUsage & {
  eventType: string;
};

let emptyUsage = (): AgentRunUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0
});

let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value == 'object' && !Array.isArray(value);

let getString = (value: unknown, key: string) => {
  if (!isRecord(value)) return undefined;
  let item = value[key];
  return typeof item == 'string' ? item : undefined;
};

let getBoolean = (value: unknown, key: string) => {
  if (!isRecord(value)) return undefined;
  let item = value[key];
  return typeof item == 'boolean' ? item : undefined;
};

let getWebSearchResults = (value: unknown): WebSearchResult[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap(result => {
    if (!isRecord(result)) return [];

    let title = getString(result, 'title');
    let url = getString(result, 'url');
    if (!title || !url) return [];

    return [
      {
        title,
        url,
        description: getString(result, 'description'),
        category: getString(result, 'category')
      }
    ];
  });
};

let getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error == 'string') return error;
  if (isRecord(error) && typeof error.message == 'string') return error.message;
  return 'Unknown error';
};

let getNestedNumber = (value: unknown, path: string[]) => {
  let current = value;

  for (let key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }

  return typeof current == 'number' && Number.isFinite(current) ? current : undefined;
};

let firstNumber = (value: unknown, paths: string[][]) => {
  for (let path of paths) {
    let number = getNestedNumber(value, path);
    if (typeof number == 'number') return number;
  }
};

let extractUsage = (event: SessionEvent): AgentRunUsage | null => {
  let inputTokens = firstNumber(event, [
    ['usage', 'inputTokens'],
    ['usage', 'promptTokens'],
    ['usage', 'input_tokens'],
    ['usage', 'prompt_tokens'],
    ['usage', 'input'],
    ['inputTokens'],
    ['promptTokens']
  ]);
  let outputTokens = firstNumber(event, [
    ['usage', 'outputTokens'],
    ['usage', 'completionTokens'],
    ['usage', 'output_tokens'],
    ['usage', 'completion_tokens'],
    ['usage', 'output'],
    ['outputTokens'],
    ['completionTokens']
  ]);
  let totalTokens = firstNumber(event, [
    ['usage', 'totalTokens'],
    ['usage', 'total_tokens'],
    ['usage', 'total'],
    ['totalTokens']
  ]);

  if (
    typeof inputTokens != 'number' &&
    typeof outputTokens != 'number' &&
    typeof totalTokens != 'number'
  ) {
    return null;
  }

  inputTokens ??= 0;
  outputTokens ??= 0;
  totalTokens ??= inputTokens + outputTokens;

  return { inputTokens, outputTokens, totalTokens };
};

let serializeMessages = (
  messages: ModelMessage[]
): PrismaJson.AssistantMessageSerializedContent => {
  let now = Date.now();

  return {
    b: 'ai-sdk-1',
    messages: messages.map((msg, i) => [now + i, msg])
  };
};

let findLastItem = <T extends StateItem>(
  state: State,
  predicate: (item: StateItem) => item is T
) => {
  for (let i = state.items.length - 1; i >= 0; i--) {
    let item = state.items[i];
    if (predicate(item)) return item;
  }
};

let appendTextPart = (message: Message, text: string) => {
  let lastPart = message.parts[message.parts.length - 1];

  if (lastPart?.type == 'text') {
    lastPart.text += text;
  } else {
    message.parts.push({ type: 'text', text });
  }
};

export class AgentRunState {
  private delta: ServerStateHandle<JsonValue>;
  private state: State;
  private serialized: PrismaJson.AssistantMessageSerializedContent;
  private usage = emptyUsage();
  private usageEvents: UsageEvent[] = [];
  private startedAt = new Date();

  constructor(initialMessages: ModelMessage[] = [], options: AgentRunStateOptions = {}) {
    this.delta = createServerState({
      initial: { items: [] },
      emit: options.emit,
      deltaFormat: options.deltaFormat
    });
    this.state = this.delta.state as unknown as State;
    this.serialized = serializeMessages(initialMessages);

    if (options.onWireMessage) this.onWireMessage(options.onWireMessage);
  }

  pipe(event: SessionEvent) {
    this.delta.transact(() => {
      this.applyEvent(event);
    });
  }

  get version() {
    return this.delta.version;
  }

  getSnapshot(): WireSnapshot {
    return this.delta.getSnapshot();
  }

  onWireMessage(listener: (message: AgentRunWireMessage) => void) {
    return this.delta.onWireMessage(listener);
  }

  private applyEvent(event: SessionEvent) {
    switch (event.type) {
      case 'text.delta':
        this.appendAssistantText(event.text, 'running');
        break;

      case 'text.done':
        this.setAssistantText(event.text);
        break;

      case 'reasoning.delta':
        this.appendReasoning(event.text, 'running');
        break;

      case 'reasoning.done':
        this.setReasoning(event.text);
        break;

      case 'tool.start':
        if (['readFile', 'listFiles', 'grep'].includes(event.toolName)) {
          this.upsertFileExploreOperation({
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.input
          });
          break;
        }

        if (['writeFile', 'editFile', 'deleteFile'].includes(event.toolName)) {
          this.createFileWriteItem({
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.input
          });
          break;
        }

        if (event.toolName == 'bash') {
          this.createShellItem({
            toolCallId: event.toolCallId,
            input: event.input
          });
          break;
        }

        if (['webSearch', 'getWebContent'].includes(event.toolName)) {
          this.upsertWebOperation({
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.input
          });
          break;
        }

        this.upsertGenericToolCall({
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          input: event.input
        });
        break;

      case 'tool.done':
        this.updateToolDone({
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          output: event.output
        });
        break;

      case 'tool.error':
        this.updateToolError({
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          error: event.error
        });
        break;

      case 'compaction.start':
        this.state.items.push({
          id: `compaction:${this.state.items.length}`,
          type: 'compaction',
          status: 'running',
          reason: event.reason,
          tokensBefore: event.tokensBefore
        });
        break;

      case 'compaction.pruned': {
        let item = this.latestCompactionItem();
        if (item) {
          item.tokensRemoved = event.tokensRemoved;
          item.messagesRemoved = event.messagesRemoved;
        }
        break;
      }

      case 'compaction.summary': {
        let item = this.latestCompactionItem();
        if (item) item.summary = event.summary;
        break;
      }

      case 'compaction.done': {
        let item = this.latestCompactionItem();
        if (item) {
          item.status = 'completed';
          item.tokensBefore = event.tokensBefore;
          item.tokensAfter = event.tokensAfter;
        }
        break;
      }

      case 'step.done':
      case 'turn.done':
        this.addUsage(event);
        break;

      case 'error':
        this.addErrorItem(event.error);
        break;

      case 'done':
        this.serialized = serializeMessages(event.messages);
        if (event.result == 'error') this.addErrorItem('Agent run failed');
        break;

      case 'step.start':
      case 'turn.start':
      case 'retry':
        break;
    }
  }

  result(): AgentRunResult {
    return {
      state: this.getSnapshot()[2] as unknown as State,
      serialized: this.serialized,
      snapshotIndex: this.version,
      usage: this.usage,
      metadata: {
        startedAt: this.startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        usage: this.usage,
        usageEvents: this.usageEvents,
        compactions: this.state.items.filter(item => item.type == 'compaction')
      }
    };
  }

  private addUsage(event: SessionEvent) {
    let usage = extractUsage(event);
    if (!usage) return;

    this.usage.inputTokens += usage.inputTokens;
    this.usage.outputTokens += usage.outputTokens;
    this.usage.totalTokens += usage.totalTokens;
    this.usageEvents.push({
      eventType: event.type,
      ...usage
    });
  }

  private appendAssistantText(text: string, status: ItemStatus) {
    let item = this.findLastItem(
      (item): item is Extract<StateItem, { type: 'message' }> =>
        item.type == 'message' && item.message.role == 'assistant'
    );

    if (!item || item.status == 'completed') {
      item = {
        id: `message:${this.state.items.length}`,
        type: 'message',
        status: 'running',
        message: {
          role: 'assistant',
          parts: []
        }
      };
      this.state.items.push(item);
    }

    appendTextPart(item.message, text);
    item.status = status;
  }

  private setAssistantText(text: string) {
    let item = this.findLastItem(
      (item): item is Extract<StateItem, { type: 'message' }> =>
        item.type == 'message' && item.message.role == 'assistant'
    );

    if (!item) {
      this.appendAssistantText(text, 'completed');
      return;
    }

    item.message.parts = [{ type: 'text', text }];
    item.status = 'completed';
  }

  private appendReasoning(text: string, status: ItemStatus) {
    let item = this.findLastItem(
      (item): item is Extract<StateItem, { type: 'reasoning' }> => item.type == 'reasoning'
    );

    if (!item || item.status == 'completed') {
      item = {
        id: `reasoning:${this.state.items.length}`,
        type: 'reasoning',
        status: 'running',
        text: ''
      };
      this.state.items.push(item);
    }

    item.text += text;
    item.status = status;
  }

  private setReasoning(text: string) {
    let item = this.findLastItem(
      (item): item is Extract<StateItem, { type: 'reasoning' }> => item.type == 'reasoning'
    );

    if (!item) {
      this.appendReasoning(text, 'completed');
      return;
    }

    item.text = text;
    item.status = 'completed';
  }

  private filesExploreItem() {
    let item = this.state.items.find(
      (item): item is Extract<StateItem, { type: 'files/explore' }> =>
        item.type == 'files/explore'
    );

    if (!item) {
      item = {
        id: 'files/explore',
        type: 'files/explore',
        operations: []
      };
      this.state.items.push(item);
    }

    return item;
  }

  private upsertFileExploreOperation(d: {
    toolCallId: string;
    toolName: string;
    input: unknown;
  }) {
    let item = this.filesExploreItem();
    let operation = item.operations.find(operation => operation.id == d.toolCallId);

    if (!operation) {
      operation =
        d.toolName == 'readFile'
          ? {
              id: d.toolCallId,
              type: 'read',
              path: getString(d.input, 'filePath') ?? '',
              input: d.input,
              status: 'running'
            }
          : {
              id: d.toolCallId,
              type: 'explore',
              path: getString(d.input, 'dirPath') ?? null,
              pattern: getString(d.input, 'pattern'),
              input: d.input,
              status: 'running'
            };

      item.operations.push(operation);
    }

    operation.input = d.input;
    operation.status = 'running';

    return operation;
  }

  private findFileExploreOperation(toolCallId: string) {
    for (let item of this.state.items) {
      if (item.type != 'files/explore') continue;

      let operation = item.operations.find(operation => operation.id == toolCallId);
      if (operation) return operation;
    }
  }

  private createFileWriteItem(d: { toolCallId: string; toolName: string; input: unknown }) {
    let existing = this.state.items.find(
      (item): item is Extract<StateItem, { type: 'files/write' }> =>
        item.type == 'files/write' && item.toolCallId == d.toolCallId
    );
    if (existing) return existing;

    let operation: Extract<StateItem, { type: 'files/write' }>['operation'] =
      d.toolName == 'editFile' ? 'edit' : d.toolName == 'deleteFile' ? 'delete' : 'write';
    let path = getString(d.input, 'filePath') ?? '';
    let content = getString(d.input, 'content') ?? '';
    let changes: FileWriteChange =
      operation == 'edit'
        ? {
            type: 'replace',
            oldString: getString(d.input, 'oldString') ?? '',
            newString: getString(d.input, 'newString') ?? '',
            replaceAll: getBoolean(d.input, 'replaceAll') ?? false
          }
        : operation == 'delete'
          ? { type: 'delete' }
          : {
              type: 'insert',
              line: 1,
              content: content.split('\n')
            };

    let item: StateItem = {
      id: `files/write:${d.toolCallId}`,
      type: 'files/write',
      status: 'running',
      toolCallId: d.toolCallId,
      operation,
      path,
      input: d.input,
      changes
    };

    this.state.items.push(item);
    return item;
  }

  private createShellItem(d: { toolCallId: string; input: unknown }) {
    let existing = this.state.items.find(
      (item): item is Extract<StateItem, { type: 'shell' }> =>
        item.type == 'shell' && item.toolCallId == d.toolCallId
    );
    if (existing) return existing;

    let item: StateItem = {
      id: `shell:${d.toolCallId}`,
      type: 'shell',
      status: 'running',
      toolCallId: d.toolCallId,
      command: getString(d.input, 'command') ?? '',
      stdout: '',
      stderr: '',
      exitCode: null,
      input: d.input
    };

    this.state.items.push(item);
    return item;
  }

  private upsertWebOperation(d: { toolCallId: string; toolName: string; input: unknown }) {
    let buildOperation = () =>
      d.toolName == 'webSearch'
        ? {
            id: d.toolCallId,
            type: 'search' as const,
            query: getString(d.input, 'query') ?? '',
            country: getString(d.input, 'country'),
            searchType: getString(d.input, 'type'),
            input: d.input,
            status: 'running' as const
          }
        : {
            id: d.toolCallId,
            type: 'fetch' as const,
            url: getString(d.input, 'url') ?? '',
            input: d.input,
            status: 'running' as const
          };

    let item = this.state.items.find(
      (item): item is Extract<StateItem, { type: 'web' }> => item.type == 'web'
    );

    if (!item) {
      let operation = buildOperation();
      item = {
        id: 'web',
        type: 'web',
        operations: [operation]
      };
      this.state.items.push(item);
      return operation;
    }

    let operation = item.operations.find(operation => operation.id == d.toolCallId);

    if (!operation) {
      operation = buildOperation();
      item.operations.push(operation);
    }

    operation.input = d.input;
    operation.status = 'running';

    if (operation.type == 'search') {
      operation.query = getString(d.input, 'query') ?? operation.query;
      operation.country = getString(d.input, 'country');
      operation.searchType = getString(d.input, 'type');
    } else {
      operation.url = getString(d.input, 'url') ?? operation.url;
    }

    return operation;
  }

  private findWebOperation(toolCallId: string) {
    for (let item of this.state.items) {
      if (item.type != 'web') continue;

      let operation = item.operations.find(operation => operation.id == toolCallId);
      if (operation) return operation;
    }
  }

  private upsertGenericToolCall(d: { toolCallId: string; toolName: string; input: unknown }) {
    let item = this.state.items.find(
      (item): item is Extract<StateItem, { type: 'tool' }> =>
        item.type == 'tool' && item.id == d.toolName
    );

    if (!item) {
      item = {
        id: d.toolName,
        type: 'tool',
        tool: {
          key: d.toolName,
          name: d.toolName
        },
        calls: []
      };
      this.state.items.push(item);
    }

    let call = item.calls.find(call => call.id == d.toolCallId);
    if (!call) {
      call = {
        id: d.toolCallId,
        input: d.input,
        status: 'running'
      };
      item.calls.push(call);
    }

    call.input = d.input;
    call.status = 'running';

    return call;
  }

  private findGenericToolCall(toolCallId: string) {
    for (let item of this.state.items) {
      if (item.type != 'tool') continue;

      let call = item.calls.find(call => call.id == toolCallId);
      if (call) return call;
    }
  }

  private updateToolDone(d: { toolCallId: string; toolName: string; output: unknown }) {
    if (['readFile', 'listFiles', 'grep'].includes(d.toolName)) {
      let operation = this.findFileExploreOperation(d.toolCallId);
      if (operation) {
        operation.output = d.output;
        operation.status = 'completed';
        return;
      }
    }

    if (['writeFile', 'editFile', 'deleteFile'].includes(d.toolName)) {
      let item = this.state.items.find(
        (item): item is Extract<StateItem, { type: 'files/write' }> =>
          item.type == 'files/write' && item.toolCallId == d.toolCallId
      );
      if (item) {
        item.output = d.output;
        item.status = 'completed';
        return;
      }
    }

    if (d.toolName == 'bash') {
      let item = this.state.items.find(
        (item): item is Extract<StateItem, { type: 'shell' }> =>
          item.type == 'shell' && item.toolCallId == d.toolCallId
      );
      if (item) {
        item.output = d.output;
        item.status = 'completed';
        item.stdout = getString(d.output, 'stdout') ?? '';
        item.stderr = getString(d.output, 'stderr') ?? '';
        item.exitCode =
          isRecord(d.output) && typeof d.output.exitCode == 'number'
            ? d.output.exitCode
            : null;
        return;
      }
    }

    if (['webSearch', 'getWebContent'].includes(d.toolName)) {
      let operation = this.findWebOperation(d.toolCallId);
      if (operation) {
        operation.output = d.output;
        operation.status = 'completed';
        if (operation.type == 'search') {
          operation.results = getWebSearchResults(d.output);
        } else {
          operation.content = typeof d.output == 'string' ? d.output : getString(d.output, 'content');
        }
        return;
      }
    }

    let call = this.findGenericToolCall(d.toolCallId);
    if (call) {
      call.output = d.output;
      call.status = 'completed';
    }
  }

  private updateToolError(d: { toolCallId: string; toolName: string; error: string }) {
    let error = { message: d.error };

    if (['readFile', 'listFiles', 'grep'].includes(d.toolName)) {
      let operation = this.findFileExploreOperation(d.toolCallId);
      if (operation) {
        operation.error = error;
        operation.status = 'failed';
        return;
      }
    }

    if (['writeFile', 'editFile', 'deleteFile'].includes(d.toolName)) {
      let item = this.state.items.find(
        (item): item is Extract<StateItem, { type: 'files/write' }> =>
          item.type == 'files/write' && item.toolCallId == d.toolCallId
      );
      if (item) {
        item.error = error;
        item.status = 'failed';
        return;
      }
    }

    if (d.toolName == 'bash') {
      let item = this.state.items.find(
        (item): item is Extract<StateItem, { type: 'shell' }> =>
          item.type == 'shell' && item.toolCallId == d.toolCallId
      );
      if (item) {
        item.error = error;
        item.status = 'failed';
        item.stderr = d.error;
        item.exitCode = 1;
        return;
      }
    }

    if (['webSearch', 'getWebContent'].includes(d.toolName)) {
      let operation = this.findWebOperation(d.toolCallId);
      if (operation) {
        operation.error = error;
        operation.status = 'failed';
        return;
      }
    }

    let call = this.findGenericToolCall(d.toolCallId);
    if (call) {
      call.error = error;
      call.status = 'failed';
    }
  }

  private addErrorItem(error: unknown) {
    this.state.items.push({
      id: `error:${this.state.items.length}`,
      type: 'error',
      error: {
        message: getErrorMessage(error)
      }
    });
  }

  private latestCompactionItem() {
    return this.findLastItem(
      (item): item is Extract<StateItem, { type: 'compaction' }> => item.type == 'compaction'
    );
  }

  private findLastItem<T extends StateItem>(predicate: (item: StateItem) => item is T) {
    return findLastItem(this.state, predicate);
  }
}
