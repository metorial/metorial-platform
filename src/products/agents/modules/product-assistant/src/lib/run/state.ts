import { generatePlainId } from '@lowerdeck/id';
import type { ModelMessage } from 'ai';
import type {
  FileWriteChange,
  ItemStatus,
  Message,
  State,
  StateItem,
  ToolCallState,
  WebOperation,
  WebSearchResult
} from '../../types';
import type { ClientHandoffToolMetadata } from '../definitions';
import type {
  DeltaTransportSink,
  JsonValue,
  ServerStateHandle,
  WireMessage,
  WireSnapshot
} from '../delta';
import { createServerState } from '../delta';
import type { SessionEvent } from '../open-harness';
import type { AgentRunExtension, AgentRunStateWriter, AgentRunToolAdapter } from './extension';
import { parsePartialJson } from './partialJson';

export type AgentRunWireMessage = WireMessage;

export type AgentRunStateOptions = {
  onWireMessage?: (message: AgentRunWireMessage) => void;
  emit?: DeltaTransportSink<AgentRunWireMessage>;
  deltaFormat?: 'batch' | 'message';
  extensions?: AgentRunExtension[];
};

let fileExploreTools = ['readFile', 'listFiles', 'grep'];
let fileWriteTools = ['writeFile', 'editFile', 'deleteFile'];
let webTools = ['webSearch', 'getWebContent'];

export type AgentRunResult = {
  status: 'completed' | 'waiting_for_user';
  state: State;
  serialized: PrismaJson.ProductAssistantMessageSerializedContent;
  snapshotIndex: number;
  usage: AgentRunUsage;
  metadata: PrismaJson.ProductAssistantRunMetadata;
};

export type AgentRunUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type UsageEvent = AgentRunUsage & {
  eventType: string;
};

export type HandoffToolCall = {
  toolName: string;
  call: Extract<StateItem, { type: 'tool' }>['calls'][number];
};

let emptyUsage = (): AgentRunUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0
});

export let createItemId = () => generatePlainId(8);

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

let getWebSearchResults = (output: unknown): WebSearchResult[] => {
  if (!Array.isArray(output)) return [];

  return output
    .filter(isRecord)
    .map(result => ({
      title: getString(result, 'title') ?? '',
      url: getString(result, 'url') ?? '',
      description: getString(result, 'description'),
      category: getString(result, 'category')
    }))
    .filter(result => result.url);
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
): PrismaJson.ProductAssistantMessageSerializedContent => {
  let now = Date.now();

  return {
    b: 'ai-sdk-1',
    messages: messages.map((msg, i) => [now + i, msg])
  };
};

export let getHandoffToolCalls = (state: State) => {
  let calls: HandoffToolCall[] = [];

  for (let item of state.items) {
    if (item.type != 'tool') continue;

    for (let call of item.calls) {
      if (!call.handoff) continue;
      calls.push({
        toolName: item.tool.key,
        call
      });
    }
  }

  return calls;
};

export let getWaitingHandoffToolCalls = (state: State) =>
  getHandoffToolCalls(state).filter(({ call }) => call.status == 'waiting_for_user');

export let applyHandoffToolResponses = (
  state: State,
  responses: Array<{ toolCallId: string; output: unknown }>
) => {
  let nextState = structuredClone(state);
  let handoffCalls = getHandoffToolCalls(nextState);
  let handoffCallById = new Map(
    handoffCalls.map(({ toolName, call }) => [call.id, { toolName, call }])
  );
  let seen = new Set<string>();

  for (let response of responses) {
    if (seen.has(response.toolCallId)) {
      throw new Error(`Duplicate handoff response for tool call ${response.toolCallId}`);
    }
    seen.add(response.toolCallId);

    let handoff = handoffCallById.get(response.toolCallId);
    if (!handoff) {
      throw new Error(`No waiting handoff tool call found for ${response.toolCallId}`);
    }
    if (handoff.call.status != 'waiting_for_user') {
      throw new Error(
        `Handoff tool call ${response.toolCallId} is not waiting for a response`
      );
    }

    handoff.call.output = response.output;
    handoff.call.status = 'completed';
  }

  return {
    state: nextState,
    remaining: getWaitingHandoffToolCalls(nextState),
    completed: responses.map(response => {
      let handoff = handoffCallById.get(response.toolCallId)!;
      return {
        toolCallId: response.toolCallId,
        toolName: handoff.toolName,
        output: response.output
      };
    })
  };
};

let findLastItem = <T extends StateItem>(
  state: State,
  predicate: (item: StateItem) => item is T
) => {
  for (let i = state.items.length - 1; i >= 0; i--) {
    let item = state.items[i];
    if (!item) continue;
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
  private serialized: PrismaJson.ProductAssistantMessageSerializedContent;
  private usage = emptyUsage();
  private usageEvents: UsageEvent[] = [];
  private startedAt = new Date();
  private extensions: AgentRunExtension[];
  private toolInputText = new Map<string, string>();

  constructor(
    initialMessages: ModelMessage[] = [],
    options: AgentRunStateOptions = {},
    initialState?: State
  ) {
    this.delta = createServerState({
      initial: structuredClone(initialState ?? { items: [] }) as unknown as JsonValue,
      emit: options.emit,
      deltaFormat: options.deltaFormat
    });
    this.state = this.delta.state as unknown as State;
    this.serialized = serializeMessages(initialMessages);
    this.extensions = options.extensions ?? [];

    if (options.onWireMessage) this.onWireMessage(options.onWireMessage);
  }

  pipe(event: SessionEvent) {
    this.delta.transact(() => {
      this.applyEvent(event);

      for (let extension of this.extensions) {
        extension.onEvent?.({ event, writer: this.writer() });
      }
    });
  }

  private writer(): AgentRunStateWriter {
    return {
      items: this.state.items,
      createItemId
    };
  }

  private toolAdapter(toolName: string): AgentRunToolAdapter | undefined {
    for (let extension of this.extensions) {
      let adapter = extension.tools?.[toolName];
      if (adapter) return adapter;
    }
  }

  private applyToolAdapterEvent(event: SessionEvent) {
    if (
      event.type != 'tool.input.start' &&
      event.type != 'tool.input.delta' &&
      event.type != 'tool.start' &&
      event.type != 'tool.done' &&
      event.type != 'tool.error'
    ) {
      return false;
    }

    let adapter = this.toolAdapter(event.toolName);
    if (!adapter) return false;

    let writer = this.writer();

    switch (event.type) {
      case 'tool.input.start':
        this.toolInputText.set(event.toolCallId, '');
        adapter.onInputStart?.({ toolCallId: event.toolCallId, writer });
        break;

      case 'tool.input.delta': {
        let text = (this.toolInputText.get(event.toolCallId) ?? '') + event.delta;
        this.toolInputText.set(event.toolCallId, text);

        let partialInput = parsePartialJson(text);
        if (partialInput !== undefined) {
          adapter.onInputDelta?.({ toolCallId: event.toolCallId, partialInput, writer });
        }
        break;
      }

      case 'tool.start':
        this.toolInputText.delete(event.toolCallId);
        adapter.onStart?.({ toolCallId: event.toolCallId, input: event.input, writer });
        break;

      case 'tool.done':
        adapter.onDone?.({ toolCallId: event.toolCallId, output: event.output, writer });
        break;

      case 'tool.error':
        adapter.onError?.({ toolCallId: event.toolCallId, error: event.error, writer });
        break;
    }

    return true;
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
    if (this.applyToolAdapterEvent(event)) return;

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
        if (fileExploreTools.includes(event.toolName)) {
          this.upsertFileExploreOperation({
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.input
          });
          break;
        }

        if (webTools.includes(event.toolName)) {
          this.upsertWebOperation({
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.input
          });
          break;
        }

        if (fileWriteTools.includes(event.toolName)) {
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

        this.upsertGenericToolCall({
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          input: event.input,
          handoff: event.handoff
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
          id: createItemId(),
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
      case 'turn.done':
      case 'retry':
      case 'tool.input.start':
      case 'tool.input.delta':
        break;
    }
  }

  result(): AgentRunResult {
    let state = this.getSnapshot()[2] as unknown as State;

    return {
      status: getWaitingHandoffToolCalls(state).length > 0 ? 'waiting_for_user' : 'completed',
      state,
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
        id: createItemId(),
        type: 'message',
        status,
        message: {
          role: 'assistant',
          parts: [{ type: 'text', text }]
        }
      };
      this.state.items.push(item);
      return;
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
        id: createItemId(),
        type: 'reasoning',
        status,
        text
      };
      this.state.items.push(item);
      return;
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
        id: createItemId(),
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

  private webItem() {
    let item = this.findLastItem(
      (item): item is Extract<StateItem, { type: 'web' }> => item.type == 'web'
    );

    if (!item || item != this.state.items[this.state.items.length - 1]) {
      item = {
        id: createItemId(),
        type: 'web',
        operations: []
      };
      this.state.items.push(item);
    }

    return item;
  }

  private upsertWebOperation(d: { toolCallId: string; toolName: string; input: unknown }) {
    let existing = this.findWebOperation(d.toolCallId);
    if (existing) {
      existing.input = d.input;
      existing.status = 'running';
      return existing;
    }

    let item = this.webItem();
    let operation: WebOperation =
      d.toolName == 'webSearch'
        ? {
            id: d.toolCallId,
            type: 'search',
            query: getString(d.input, 'query') ?? '',
            country: getString(d.input, 'country'),
            searchType: getString(d.input, 'type'),
            input: d.input,
            status: 'running'
          }
        : {
            id: d.toolCallId,
            type: 'fetch',
            url: getString(d.input, 'url') ?? '',
            input: d.input,
            status: 'running'
          };

    item.operations.push(operation);
    return item.operations[item.operations.length - 1]!;
  }

  private findWebOperation(toolCallId: string) {
    for (let item of this.state.items) {
      if (item.type != 'web') continue;

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
      id: createItemId(),
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
      id: createItemId(),
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

  private upsertGenericToolCall(d: {
    toolCallId: string;
    toolName: string;
    input: unknown;
    handoff?: ClientHandoffToolMetadata;
  }) {
    let item = this.state.items.find(
      (item): item is Extract<StateItem, { type: 'tool' }> =>
        item.type == 'tool' && item.tool.key == d.toolName
    );

    if (!item) {
      let call: ToolCallState = {
        id: d.toolCallId,
        input: d.input,
        status: d.handoff ? 'waiting_for_user' : 'running',
        handoff: d.handoff
      };

      item = {
        id: createItemId(),
        type: 'tool',
        tool: {
          key: d.toolName,
          name: d.toolName
        },
        calls: [call]
      };
      this.state.items.push(item);
      return call;
    }

    let call = item.calls.find(call => call.id == d.toolCallId);
    if (!call) {
      call = {
        id: d.toolCallId,
        input: d.input,
        status: d.handoff ? 'waiting_for_user' : 'running',
        handoff: d.handoff
      };
      item.calls.push(call);
    }

    call.input = d.input;
    call.status = d.handoff ? 'waiting_for_user' : 'running';
    call.handoff = d.handoff;

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
    if (fileExploreTools.includes(d.toolName)) {
      let operation = this.findFileExploreOperation(d.toolCallId);
      if (operation) {
        operation.output = d.output;
        operation.status = 'completed';
        return;
      }
    }

    if (webTools.includes(d.toolName)) {
      let operation = this.findWebOperation(d.toolCallId);
      if (operation) {
        operation.output = d.output;
        operation.status = 'completed';

        if (operation.type == 'search') operation.results = getWebSearchResults(d.output);
        if (operation.type == 'fetch') operation.content = getString(d.output, 'markdown');
        return;
      }
    }

    if (fileWriteTools.includes(d.toolName)) {
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

    let call = this.findGenericToolCall(d.toolCallId);
    if (call) {
      call.output = d.output;
      call.status = 'completed';
    }
  }

  private updateToolError(d: { toolCallId: string; toolName: string; error: string }) {
    let error = { message: d.error };

    if (fileExploreTools.includes(d.toolName)) {
      let operation = this.findFileExploreOperation(d.toolCallId);
      if (operation) {
        operation.error = error;
        operation.status = 'failed';
        return;
      }
    }

    if (webTools.includes(d.toolName)) {
      let operation = this.findWebOperation(d.toolCallId);
      if (operation) {
        operation.error = error;
        operation.status = 'failed';
        return;
      }
    }

    if (fileWriteTools.includes(d.toolName)) {
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

    let call = this.findGenericToolCall(d.toolCallId);
    if (call) {
      call.error = error;
      call.status = 'failed';
    }
  }

  private addErrorItem(error: unknown) {
    this.state.items.push({
      id: createItemId(),
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
