import { describe, expect, it } from 'vitest';
import { getProgressStepStates } from './lib';

let steps = ['pending', 'draining', 'resizing', 'verifying', 'restarting'] as const;

describe('getProgressStepStates', () => {
  it('marks earlier steps complete and the current one active', () => {
    expect(getProgressStepStates(steps, 'resizing')).toEqual({
      pending: 'complete',
      draining: 'complete',
      resizing: 'active',
      verifying: 'pending',
      restarting: 'pending'
    });
  });

  it('marks the current step failed', () => {
    expect(getProgressStepStates(steps, 'draining', 'failed').draining).toBe('failed');
  });

  it('marks everything complete on success', () => {
    expect(Object.values(getProgressStepStates(steps, 'restarting', 'complete'))).toEqual(
      steps.map(() => 'complete')
    );
  });

  it('leaves everything pending without a current step', () => {
    expect(Object.values(getProgressStepStates(steps, null))).toEqual(
      steps.map(() => 'pending')
    );
  });
});
