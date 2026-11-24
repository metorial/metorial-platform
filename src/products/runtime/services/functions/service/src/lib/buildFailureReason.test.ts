import { describe, expect, it } from 'vitest';
import { GENERIC_BUILD_FAILURE_MESSAGE, getBuildFailureReason } from './buildFailureReason';

let log = (message: string) => ({ timestamp: Date.now(), message });

describe('getBuildFailureReason', () => {
  it('uses the last line of the failed step', () => {
    expect(
      getBuildFailureReason([
        { step: { status: 'succeeded' }, logs: [log('Setting up')] },
        {
          step: { status: 'failed' },
          logs: [log('npm install'), log('npm ERR! missing script: build'), log('  ')]
        },
        { step: { status: 'failed' }, logs: [] }
      ])
    ).toBe('npm ERR! missing script: build');
  });

  it('falls back to the last line of any step', () => {
    expect(
      getBuildFailureReason([
        { step: { status: 'succeeded' }, logs: [log('Build failed: DeadlineExceeded')] },
        { step: { status: 'pending' }, logs: [] }
      ])
    ).toBe('Build failed: DeadlineExceeded');
  });

  it('returns the generic message when there are no logs', () => {
    expect(getBuildFailureReason([{ step: { status: 'failed' }, logs: null }])).toBe(
      GENERIC_BUILD_FAILURE_MESSAGE
    );
  });

  it('truncates long reasons', () => {
    expect(
      getBuildFailureReason([{ step: { status: 'failed' }, logs: [log('x'.repeat(5000))] }])
    ).toHaveLength(2000);
  });
});
