import type { RequestSummary } from '@mtsrc/ai-gateway-request-features';
import type { DecisionConfig } from '@mtsrc/ai-gateway-spec';
import { createHash } from 'node:crypto';

let defaultPriorTurns = 3;
let defaultMaxChars = 8000;
let maxSystemChars = 2000;
let minTurnChars = 120;

export type DecisionState = {
  request: string;
  conversation?: string[];
  system?: string;
  tools?: string[];
  attachments?: { images: boolean; files: boolean; audio: boolean };
};

let truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;

// Only text a person wrote is classified: tool results and assistant turns are left out, so every
// step of an agent loop answering the same ask produces the same state (and hits the same cache).
export let buildDecisionState = (
  summary: RequestSummary,
  context: DecisionConfig['context'] = {}
): DecisionState => {
  let maxChars = context.maxChars ?? defaultMaxChars;
  let priorTurns = context.priorTurns ?? defaultPriorTurns;

  let turns = summary.userTexts;
  let request = truncate(turns[turns.length - 1] ?? '', Math.floor(maxChars / 2));
  let remaining = maxChars - request.length;

  let state: DecisionState = { request };

  if ((context.includeSystem ?? true) && summary.systemText.trim()) {
    state.system = truncate(
      summary.systemText,
      Math.min(maxSystemChars, Math.floor(remaining / 3))
    );
    remaining -= state.system.length;
  }

  let conversation: string[] = [];
  let prior = turns.slice(Math.max(0, turns.length - 1 - priorTurns), -1);
  for (let turn of prior.reverse()) {
    if (remaining < minTurnChars) break;

    let text = truncate(turn, remaining);
    conversation.unshift(text);
    remaining -= text.length;
  }
  if (conversation.length) state.conversation = conversation;

  if ((context.includeToolNames ?? true) && summary.toolNames.length) {
    state.tools = summary.toolNames.slice(0, 64);
  }

  if (summary.hasImages || summary.hasFiles || summary.hasAudio) {
    state.attachments = {
      images: summary.hasImages,
      files: summary.hasFiles,
      audio: summary.hasAudio
    };
  }

  return state;
};

export let decisionStateHash = (state: DecisionState) =>
  createHash('sha256').update(JSON.stringify(state)).digest('hex');
