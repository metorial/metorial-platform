import { generateText, stepCountIs, type ModelMessage, type ToolSet } from 'ai';
import { addUsage, emptyUsage, type ReviewModel, type ReviewUsage } from './model';
import type { ReviewRunState } from './tools';

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
};

let cacheable = { anthropic: { cacheControl: { type: 'ephemeral' } } };

export let runReviewAgent = async (d: {
  model: ReviewModel;
  system: string;
  prompt: string;
  tools: ToolSet;
  state: ReviewRunState;
  maxSteps: number;
  maxCostMicros: number;
  maxFixRounds: number;
  abortSignal?: AbortSignal;
  onStep?: (d: { usage: ReviewUsage; steps: number }) => Promise<void>;
}): Promise<ReviewAgentResult> => {
  let usage = emptyUsage();
  let steps = 0;

  let isWrappingUp = () =>
    d.maxSteps - steps <= WRAP_UP_STEPS ||
    usage.costMicros >= d.maxCostMicros * WRAP_UP_COST_RATIO;

  let messages: ModelMessage[] = [
    { role: 'system', content: d.system, providerOptions: cacheable },
    { role: 'user', content: d.prompt }
  ];

  await generateText({
    model: d.model.model,
    messages,
    tools: d.tools,
    abortSignal: d.abortSignal,
    stopWhen: [
      stepCountIs(d.maxSteps),
      () => d.state.submitted,
      () => d.state.recheck?.outcome == 'unchanged',
      () => usage.costMicros >= d.maxCostMicros,
      () => d.state.fixRounds > d.maxFixRounds
    ],

    // Near the end of the budget the agent may only write and submit, so a run that would
    // otherwise be cut off mid-exploration still produces a usable (if partial) report.
    prepareStep: async () =>
      isWrappingUp()
        ? {
            activeTools: ['write_section', 'preview_scores', 'submit', 'conclude_recheck'],
            system: `${d.system}\n\nYour budget is almost exhausted. Write any missing sections now and submit.`
          }
        : {},

    onStepEnd: async step => {
      steps++;
      usage = addUsage(usage, step.usage, d.model.pricing);
      await d.onStep?.({ usage, steps });
    }
  });

  let outcome: ReviewAgentOutcome = d.state.submitted
    ? 'submitted'
    : d.state.recheck?.outcome == 'unchanged'
      ? 'unchanged'
      : d.state.fixRounds > d.maxFixRounds
        ? 'fix_rounds_exhausted'
        : usage.costMicros >= d.maxCostMicros
          ? 'cost_budget_exhausted'
          : steps >= d.maxSteps
            ? 'step_budget_exhausted'
            : 'stopped';

  return { outcome, usage, steps };
};
