import type { StepResult, ToolSet } from 'ai';
import { addUsage, emptyUsage, type ReviewModel, type ReviewUsage } from './model';

let MAX_TEXT = 1200;
let MAX_TOOL_INPUT = 600;
let MAX_TOOL_OUTPUT = 800;

let clip = (value: string, max: number) => {
  let flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}… [+${flat.length - max} chars]` : flat;
};

let stringify = (value: unknown) =>
  typeof value == 'string' ? value : (JSON.stringify(value) ?? String(value));

let dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(4)}`;

export let formatStepLog = (d: {
  step: StepResult<ToolSet>;
  stepNumber: number;
  model: ReviewModel;
  total: ReviewUsage;
  durationMs: number;
}) => {
  let usage = addUsage(emptyUsage(), d.step.usage, d.model.pricing);
  let lines = [
    `step ${d.stepNumber} · ${d.model.slug} · ${usage.inputTokens} in / ${usage.outputTokens} out · ${dollars(usage.costMicros)} (total ${dollars(d.total.costMicros)}) · ${(d.durationMs / 1000).toFixed(1)}s · ${d.step.finishReason}`
  ];

  if (d.step.reasoningText) lines.push(`  thinking: ${clip(d.step.reasoningText, MAX_TEXT)}`);
  if (d.step.text) lines.push(`  said: ${clip(d.step.text, MAX_TEXT)}`);

  for (let call of d.step.toolCalls) {
    lines.push(`  → ${call.toolName} ${clip(stringify(call.input), MAX_TOOL_INPUT)}`);
  }

  for (let result of d.step.toolResults) {
    lines.push(`  ← ${result.toolName} ${clip(stringify(result.output), MAX_TOOL_OUTPUT)}`);
  }

  for (let part of d.step.content) {
    if (part.type == 'tool-error') {
      let message = part.error instanceof Error ? part.error.message : stringify(part.error);
      lines.push(`  ✗ ${part.toolName} failed: ${clip(message, MAX_TOOL_OUTPUT)}`);
    }
  }

  return lines.join('\n');
};
