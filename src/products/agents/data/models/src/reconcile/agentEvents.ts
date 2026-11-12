import { formatCost, formatDuration, formatTokens, shorten, type Log } from './log';

let argumentLimit = 90;
let shownArguments = ['path', 'pattern', 'glob', 'file', 'query'];
let resultLimit = 400;
let transcriptResultLimit = 2_000;
let sayLimit = 60;
let sayLineLimit = 220;

export interface AgentStats {
  turns: number;
  toolCalls: number;
  toolErrors: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  cost: number;
}

export let emptyStats = (): AgentStats => ({
  turns: 0,
  toolCalls: 0,
  toolErrors: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  reasoningTokens: 0,
  cost: 0
});

export let addStats = (a: AgentStats, b: AgentStats): AgentStats => ({
  turns: a.turns + b.turns,
  toolCalls: a.toolCalls + b.toolCalls,
  toolErrors: a.toolErrors + b.toolErrors,
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  cachedTokens: a.cachedTokens + b.cachedTokens,
  reasoningTokens: a.reasoningTokens + b.reasoningTokens,
  cost: a.cost + b.cost
});

export let describeStats = (stats: AgentStats) =>
  [
    `${stats.turns} turns`,
    `${stats.toolCalls} tool calls${stats.toolErrors ? ` (${stats.toolErrors} failed)` : ''}`,
    `${formatTokens(stats.inputTokens)} in (${formatTokens(stats.cachedTokens)} cached) / ${formatTokens(stats.outputTokens)} out`,
    formatCost(stats.cost)
  ].join(' · ');

let tail = (value: string, limit: number) =>
  value.length > limit ? `…${value.slice(value.length - limit + 1)}` : value;

let describeArguments = (args: unknown) => {
  if (!args || typeof args !== 'object') return '';

  let shown = Object.entries(args as Record<string, unknown>).filter(([key]) =>
    shownArguments.includes(key)
  );

  // Paths are the part worth reading at the end, so a long one loses its start, not its filename.
  return shown
    .map(([key, value], index) => {
      let text = tail(shorten(String(value), argumentLimit * 4), argumentLimit);
      return index === 0 ? text : `${key}=${text}`;
    })
    .join(' ');
};

let textOf = (content: unknown) =>
  Array.isArray(content)
    ? content
        .map(block => (block && typeof block === 'object' ? ((block as any).text ?? '') : ''))
        .filter(Boolean)
        .join('\n')
    : typeof content === 'string'
      ? content
      : '';

// Turns pi's `--mode json` event stream into progress lines, a readable transcript and usage
// totals. Anything that isn't a JSON event (stderr, startup noise) is passed through as it is.
export let createEventReader = (opts: {
  log: Log;
  transcript: (text: string) => void;
  now?: () => number;
}) => {
  let now = opts.now ?? Date.now;
  let stats = emptyStats();
  let startedAt = now();
  let lastEventAt = startedAt;
  let lastActivity = 'starting';
  let pendingArgs = new Map<string, string>();

  let handle = (event: any) => {
    lastEventAt = now();

    if (event.type === 'tool_execution_start') {
      stats.toolCalls++;
      lastActivity = `${event.toolName} ${describeArguments(event.args)}`.trim();
      pendingArgs.set(event.toolCallId, lastActivity);
      return;
    }

    if (event.type === 'tool_execution_end') {
      let described = pendingArgs.get(event.toolCallId) ?? event.toolName;
      pendingArgs.delete(event.toolCallId);

      let text = textOf(event.result?.content);
      if (event.isError) stats.toolErrors++;

      opts.log(
        `  ${event.isError ? '✗' : '↳'} ${described}  ${event.durationMs ?? 0}ms${
          event.isError ? `  ${shorten(text, resultLimit)}` : ''
        }`
      );
      opts.transcript(
        `tool ${event.isError ? 'ERROR ' : ''}${event.toolName} (${event.durationMs ?? 0}ms)\n${text.slice(0, transcriptResultLimit)}`
      );
      lastActivity = `${described} (done)`;
      return;
    }

    if (event.type === 'message_end' && event.message?.role === 'assistant') {
      let message = event.message;
      let usage = message.usage ?? {};
      stats.turns++;
      stats.inputTokens += usage.input ?? 0;
      stats.outputTokens += usage.output ?? 0;
      stats.cachedTokens += usage.cacheRead ?? 0;
      stats.reasoningTokens += usage.reasoning ?? 0;
      stats.cost += usage.cost?.total ?? 0;

      let failed = message.stopReason === 'error' || message.errorMessage;
      opts.log(
        `turn ${stats.turns}  ${formatDuration(message.durationMs ?? 0)}  in ${formatTokens(usage.input ?? 0)} (${formatTokens(usage.cacheRead ?? 0)} cached) out ${formatTokens(usage.output ?? 0)}${
          usage.reasoning ? ` (reasoning ${formatTokens(usage.reasoning)})` : ''
        }  ${formatCost(usage.cost?.total ?? 0)}${failed ? `  FAILED: ${shorten(String(message.errorMessage ?? message.stopReason), resultLimit)}` : ''}`
      );

      let blocks: any[] = Array.isArray(message.content) ? message.content : [];
      for (let block of blocks) {
        if (block.type === 'thinking')
          opts.transcript(`thinking\n${block.thinking ?? block.text ?? ''}`);
        else if (block.type === 'text') {
          opts.transcript(`assistant\n${block.text}`);

          // The closing message is one line per decision, which is the agent's own account of the batch.
          if (message.stopReason !== 'toolUse')
            for (let line of String(block.text).split('\n').filter(Boolean).slice(0, sayLimit))
              opts.log(`  says: ${shorten(line, sayLineLimit)}`);
        } else if (block.type === 'toolCall')
          opts.transcript(`call ${block.name} ${JSON.stringify(block.arguments)}`);
      }

      lastActivity = 'waiting for the model';
      return;
    }

    if (event.type === 'agent_end' && event.willRetry) opts.log('will retry after an error');
  };

  return {
    stats,

    push: (line: string) => {
      let trimmed = line.trim();
      if (!trimmed) return;

      let event: any = null;
      if (trimmed.startsWith('{')) {
        try {
          event = JSON.parse(trimmed);
        } catch {}
      }

      if (!event) {
        lastEventAt = now();
        opts.log(`  pi: ${shorten(trimmed, resultLimit)}`);
        opts.transcript(`output\n${trimmed}`);
        return;
      }

      handle(event);
    },

    heartbeat: () =>
      `working ${formatDuration(now() - startedAt)} · ${describeStats(stats)} · last event ${formatDuration(now() - lastEventAt)} ago (${lastActivity})`
  };
};
