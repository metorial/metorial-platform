import { generateText, stepCountIs, wrapLanguageModel, type ToolSet } from 'ai';
import { compactMessages } from './compaction';
import { addUsage, emptyUsage, type ReviewModel, type ReviewUsage } from './model';
import { acquireReviewModel, type ReviewModelAccess } from './rateLimit';
import { formatStepLog } from './stepLog';
import type { ReviewRunState } from './tools';

// A model request that never answers would otherwise hold the run until its overall timeout.
let MODEL_TIMEOUT_MS = 3 * 60 * 1000;
let WRAP_UP_STEPS = 3;
let WRAP_UP_COST_RATIO = 0.85;

export type ReviewAgentOutcome =
  | 'submitted'
  | 'unchanged'
  | 'step_budget_exhausted'
  | 'cost_budget_exhausted'
  | 'fix_rounds_exhausted'
  | 'stopped';

export type ReviewAgentResult = {
  outcome: ReviewAgentOutcome;
  usage: ReviewUsage;
  steps: number;
  modelSteps: Record<string, number>;
  compactions: number;
};

let cacheable = { anthropic: { cacheControl: { type: 'ephemeral' } } };

export let runReviewAgent = async (d: {
  model: ReviewModel;
  modelAccess?: ReviewModelAccess;
  system: string;
  prompt: string;
  tools: ToolSet;
  state: ReviewRunState;
  maxSteps: number;
  maxCostMicros: number;
  maxFixRounds: number;
  extraCostMicros?: () => number;
  abortSignal?: AbortSignal;
  onLog?: (entry: string) => void;
  onStep?: (d: { usage: ReviewUsage; steps: number }) => Promise<void>;
}): Promise<ReviewAgentResult> => {
  let usage = emptyUsage();
  let steps = 0;
  let stepModel = d.model;
  let stepStartedAt = Date.now();
  let modelSteps: Record<string, number> = {};
  let compactions = 0;

  let totalCostMicros = () => usage.costMicros + (d.extraCostMicros?.() ?? 0);

  let isWrappingUp = () =>
    d.maxSteps - steps <= WRAP_UP_STEPS ||
    totalCostMicros() >= d.maxCostMicros * WRAP_UP_COST_RATIO;

  await generateText({
    model: d.model.model,
    instructions: { role: 'system', content: d.system, providerOptions: cacheable },
    prompt: d.prompt,
    tools: d.tools,
    abortSignal: d.abortSignal,
    stopWhen: [
      stepCountIs(d.maxSteps),
      () => d.state.submitted,
      () => d.state.recheck?.outcome == 'unchanged',
      () => totalCostMicros() >= d.maxCostMicros,
      () => d.state.fixRounds > d.maxFixRounds
    ],

    // Keep evidence reads available so verification feedback can still be checked near the budget limit.
    prepareStep: async ({ messages, steps: previousSteps }) => {
      stepModel = await acquireReviewModel({
        model: d.model,
        access: d.modelAccess,
        signal: d.abortSignal,
        onFallback: ({ from, to }) => {
          console.warn(
            `Security review: ${from.slug} rate limit wait timed out, using ${to.slug}`
          );
          d.onLog?.(`${from.slug} rate limit wait timed out, switching to ${to.slug}`);
        }
      });
      stepStartedAt = Date.now();

      let compaction = compactMessages({
        messages,
        lastInputTokens: previousSteps.at(-1)?.usage.inputTokens ?? 0,
        contextWindow: stepModel.contextWindow
      });
      if (compaction.compacted) {
        compactions++;
        d.onLog?.('conversation history compacted to fit the context window');
      }

      return {
        ...(compaction.compacted ? { messages: compaction.messages } : {}),
        model: wrapLanguageModel({
          model: stepModel.model as Parameters<typeof wrapLanguageModel>[0]['model'],
          middleware: {
            transformParams: async ({ params }) => ({
              ...params,
              abortSignal: AbortSignal.any([
                AbortSignal.timeout(MODEL_TIMEOUT_MS),
                ...(params.abortSignal ? [params.abortSignal] : [])
              ])
            })
          }
        }),
        ...(isWrappingUp()
          ? {
              activeTools: [
                'bash',
                ...(d.state.lastErrors.length ? ['fetch_url', 'web_search'] : []),
                'write_section',
                'preview_scores',
                'submit',
                'conclude_recheck'
              ].filter(name => name in d.tools),
              instructions: {
                role: 'system' as const,
                content: `${d.system}\n\nYour budget is almost exhausted. Finish the report and submit now. If submit returns corrections, use the existing evidence and conversation to fix the affected sections and submit again. Read cited evidence if needed; avoid new exploration.`,
                providerOptions: cacheable
              }
            }
          : {})
      };
    },

    onStepEnd: async step => {
      steps++;
      usage = addUsage(usage, step.usage, stepModel.pricing);
      modelSteps[stepModel.slug] = (modelSteps[stepModel.slug] ?? 0) + 1;
      d.onLog?.(
        formatStepLog({
          step,
          stepNumber: steps,
          model: stepModel,
          total: usage,
          durationMs: Date.now() - stepStartedAt
        })
      );
      await d.onStep?.({ usage, steps });
    }
  });

  let outcome: ReviewAgentOutcome = d.state.submitted
    ? 'submitted'
    : d.state.recheck?.outcome == 'unchanged'
      ? 'unchanged'
      : d.state.fixRounds > d.maxFixRounds
        ? 'fix_rounds_exhausted'
        : totalCostMicros() >= d.maxCostMicros
          ? 'cost_budget_exhausted'
          : steps >= d.maxSteps
            ? 'step_budget_exhausted'
            : 'stopped';

  return { outcome, usage, steps, modelSteps, compactions };
};
