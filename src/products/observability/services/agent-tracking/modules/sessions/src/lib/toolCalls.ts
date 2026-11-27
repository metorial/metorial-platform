import { maxIdLength } from '@mtsrc/agent-tracking-records-model';
import { claudeCodePlaceholderNames, type RecordRole } from '@mtsrc/agent-tracking-spec';
import type { RecordDocument } from '@mtsrc/agent-tracking-store';

export let maxSessionToolCalls = 500;

export let maxToolCallLookups = 200;

export let maxRecordsPerToolCall = 8;

export let toolCallMergeMarginMs = 5 * 60 * 1000;

let lookupConcurrency = 20;

let roleRank: Record<RecordRole, number> = {
  primary: 0,
  supplemental: 1,
  duplicate: 2,
  aggregate: 3
};

let placeholderMcpTools: readonly string[] = claudeCodePlaceholderNames.mcpTools;

let placeholderMcpServers: readonly string[] = claudeCodePlaceholderNames.mcpServers;

export type ToolCallRecord = Pick<
  RecordDocument,
  | '_id'
  | 'organizationId'
  | 'instanceId'
  | 'type'
  | 'occurredAt'
  | 'durationMs'
  | 'source'
  | 'client'
  | 'ctx'
  | 'data'
  | 'metorial'
>;

export type ToolCallRef = { clientFamily: string; toolCallId: string };

export type SessionMcpToolCall = ToolCallRef & {
  occurredAt: Date;
  durationMs: number | null;
  outcome: string | null;
  mcpServer: string | null;
  mcpTool: string | null;
};

export type ToolCallSession = ToolCallRef & { sessionKey: string; occurredAt: Date };

export type ToolCallRecordReader = (d: {
  call: ToolCallRef;
  limit: number;
}) => Promise<ToolCallRecord[]>;

export let toolCallProjection = {
  _id: 1,
  organizationId: 1,
  instanceId: 1,
  type: 1,
  occurredAt: 1,
  durationMs: 1,
  source: 1,
  client: 1,
  ctx: 1,
  'data.tool': 1,
  'data.outcome': 1,
  'data.durationMs': 1,
  metorial: 1
} as const;

// Older Claude Code records stored a redacted MCP call as an unknown tool named by placeholder.
export let mcpToolCallMatch = {
  type: 'tool.call',
  'ctx.toolCallId': { $exists: true },
  $or: [
    { 'data.tool.kind': 'mcp' },
    { 'client.family': 'claude-code', 'data.tool.name': { $in: [...placeholderMcpTools] } }
  ]
};

let record = (value: unknown) =>
  typeof value == 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

let text = (value: unknown) => (typeof value == 'string' && value ? value : undefined);

let duration = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

export type ToolCallShape = Pick<ToolCallRecord, 'type' | 'client' | 'ctx' | 'data'>;

let toolOf = (document: ToolCallShape) => record(document.data?.tool);

export let toolCallIdOf = (document: ToolCallShape) => text(document.ctx?.toolCallId);

export let toolCallKey = (call: ToolCallRef) => `${call.clientFamily}\u0000${call.toolCallId}`;

export let storedToolCallId = (toolCallId: string) => toolCallId.slice(0, maxIdLength);

export let isMcpToolCall = (document: ToolCallShape) => {
  if (document.type != 'tool.call' || !toolCallIdOf(document)) return false;

  let tool = toolOf(document);
  if (tool?.kind == 'mcp') return true;

  let name = text(tool?.name);

  return (
    document.client?.family == 'claude-code' && !!name && placeholderMcpTools.includes(name)
  );
};

let mcpServerOf = (document: ToolCallRecord) => {
  let server = text(record(toolOf(document)?.mcp)?.server);
  if (!server) return undefined;

  let placeholder =
    document.client?.family == 'claude-code' && placeholderMcpServers.includes(server);

  return placeholder ? undefined : server;
};

let mcpToolOf = (document: ToolCallRecord) => text(record(toolOf(document)?.mcp)?.tool);

let outcomeOf = (document: ToolCallRecord) => text(document.data?.outcome);

let durationOf = (document: ToolCallRecord) =>
  duration(document.data?.durationMs) ?? duration(document.durationMs);

let rankOf = (document: ToolCallRecord) => roleRank[document.source?.role] ?? 4;

let compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export let compareRecords = (a: ToolCallRecord, b: ToolCallRecord) =>
  a.occurredAt.getTime() - b.occurredAt.getTime() ||
  compareText(a._id, b._id) ||
  compareText(toolCallIdOf(a) ?? '', toolCallIdOf(b) ?? '');

let ranked = (documents: ToolCallRecord[]) =>
  [...documents].sort((a, b) => rankOf(a) - rankOf(b) || compareRecords(a, b));

let firstOf = <T>(
  documents: ToolCallRecord[],
  read: (document: ToolCallRecord) => T | undefined
) => {
  for (let document of documents) {
    let value = read(document);
    if (value !== undefined) return value;
  }

  return undefined;
};

let describeCall = (documents: ToolCallRecord[]) => {
  let calls = ranked(documents);
  let call = calls[0]!;

  return {
    record: call,
    call: {
      clientFamily: call.client.family,
      toolCallId: toolCallIdOf(call)!,
      occurredAt: call.occurredAt,
      durationMs: firstOf(calls, durationOf) ?? null,
      outcome: firstOf(calls, outcomeOf) ?? null,
      mcpServer: firstOf(calls, mcpServerOf) ?? null,
      mcpTool: firstOf(calls, mcpToolOf) ?? null
    } satisfies SessionMcpToolCall
  };
};

// The store sorts by time only; records sharing a time are released in a stable order so the
// bound always admits the same calls.
let inStableOrder = async function* (
  records: AsyncIterable<ToolCallRecord> | Iterable<ToolCallRecord>
) {
  let run: ToolCallRecord[] = [];

  for await (let document of records) {
    if (run.length && run[0]!.occurredAt.getTime() != document.occurredAt.getTime()) {
      yield* run.sort(compareRecords);
      run = [];
    }

    run.push(document);
  }

  yield* run.sort(compareRecords);
};

export let collectSessionMcpToolCalls = async (d: {
  records: AsyncIterable<ToolCallRecord> | Iterable<ToolCallRecord>;
  limit?: number;
  mergeMarginMs?: number;
}) => {
  let limit = d.limit ?? maxSessionToolCalls;
  let mergeMarginMs = d.mergeMarginMs ?? toolCallMergeMarginMs;
  let calls = new Map<string, ToolCallRecord[]>();
  let hasMore = false;
  let readUntil: number | undefined;

  for await (let document of inStableOrder(d.records)) {
    if (readUntil !== undefined && document.occurredAt.getTime() > readUntil) break;
    if (!isMcpToolCall(document)) continue;

    let key = toolCallKey({
      clientFamily: document.client.family,
      toolCallId: toolCallIdOf(document)!
    });
    let known = calls.get(key);
    if (known) {
      known.push(document);
      continue;
    }

    if (calls.size >= limit) {
      hasMore = true;
      readUntil ??= document.occurredAt.getTime() + mergeMarginMs;
      continue;
    }

    calls.set(key, [document]);
  }

  let items = [...calls.values()]
    .map(describeCall)
    .sort((a, b) => compareRecords(a.record, b.record))
    .map(item => item.call);

  return { items, hasMore };
};

let sessionsOf = (d: {
  records: ToolCallRecord[];
  organizationId: string;
  instanceId: string;
  call: ToolCallRef;
}) => {
  let bySession = new Map<string, ToolCallRecord[]>();

  for (let document of d.records) {
    if (document.organizationId != d.organizationId) continue;
    if (document.instanceId != d.instanceId || document.type != 'tool.call') continue;
    if (document.client?.family != d.call.clientFamily) continue;
    if (toolCallIdOf(document) != d.call.toolCallId) continue;

    let sessionKey = text(document.ctx?.sessionKey);
    if (!sessionKey) continue;

    bySession.set(sessionKey, [...(bySession.get(sessionKey) ?? []), document]);
  }

  return bySession;
};

export let resolveToolCallSessions = async (d: {
  calls: ToolCallRef[];
  organizationId: string;
  instanceId: string;
  read: ToolCallRecordReader;
  maxRecords?: number;
}) => {
  let maxRecords = d.maxRecords ?? maxRecordsPerToolCall;

  let requested = new Map<string, { stored: ToolCallRef; refs: Map<string, ToolCallRef> }>();
  for (let call of d.calls) {
    let stored = { ...call, toolCallId: storedToolCallId(call.toolCallId) };
    let entry = requested.get(toolCallKey(stored)) ?? { stored, refs: new Map() };
    entry.refs.set(toolCallKey(call), call);
    requested.set(toolCallKey(stored), entry);
  }

  let found: { ref: ToolCallRef; sessionKey: string; record: ToolCallRecord }[] = [];
  let ambiguous: ToolCallRef[] = [];

  let entries = [...requested.values()];
  for (let start = 0; start < entries.length; start += lookupConcurrency) {
    await Promise.all(
      entries.slice(start, start + lookupConcurrency).map(async entry => {
        let records = await d.read({ call: entry.stored, limit: maxRecords + 1 });
        let sessions = sessionsOf({ ...d, records, call: entry.stored });
        if (!sessions.size) return;

        let refs = [...entry.refs.values()];
        if (sessions.size > 1 || records.length > maxRecords) {
          ambiguous.push(...refs);
          return;
        }

        let [sessionKey, documents] = [...sessions.entries()][0]!;
        let record = ranked(documents)[0]!;
        for (let ref of refs) found.push({ ref, sessionKey, record });
      })
    );
  }

  let items: ToolCallSession[] = found
    .sort(
      (a, b) =>
        compareRecords(a.record, b.record) || compareText(a.ref.toolCallId, b.ref.toolCallId)
    )
    .map(item => ({
      sessionKey: item.sessionKey,
      clientFamily: item.ref.clientFamily,
      toolCallId: item.ref.toolCallId,
      occurredAt: item.record.occurredAt
    }));

  ambiguous.sort(
    (a, b) =>
      compareText(a.clientFamily, b.clientFamily) || compareText(a.toolCallId, b.toolCallId)
  );

  return { items, ambiguous };
};
