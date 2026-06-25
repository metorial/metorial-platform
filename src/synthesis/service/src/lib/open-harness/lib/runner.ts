import type { ModelMessage } from 'ai';
import type { Agent, AgentEvent } from '../agent';

/**
 * A Runner has the same shape as Agent.run() but as a standalone function.
 * Middleware wraps Runners to add cross-cutting concerns.
 */
export type Runner = (
  history: ModelMessage[],
  input: string | ModelMessage[],
  options?: { signal?: AbortSignal }
) => AsyncGenerator<AgentEvent>;

/** Middleware transforms one Runner into another. */
export type Middleware = (runner: Runner) => Runner;

/** Convert an Agent into a Runner. */
export function toRunner(agent: Agent): Runner {
  return (history, input, options) => agent.run(history, input, options);
}

/**
 * Compose middleware (outermost listed first).
 * `pipe(a, b, c)(runner)` === `a(b(c(runner)))`.
 */
export function pipe(...middleware: Middleware[]): Middleware {
  return middleware.reduceRight(
    (inner, outer) => runner => outer(inner(runner)),
    (runner: Runner) => runner
  );
}

/**
 * Apply middleware to a runner (shorthand for `pipe(...mw)(runner)`).
 */
export function apply(runner: Runner, ...middleware: Middleware[]): Runner {
  return pipe(...middleware)(runner);
}
