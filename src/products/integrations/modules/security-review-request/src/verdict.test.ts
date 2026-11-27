import { describe, expect, it } from 'vitest';
import { skillSecurityVerdict } from './verdict';

let active = { dismissedAt: null };

let revision = (d: {
  risk: 'low' | 'moderate' | 'high' | 'critical' | null;
  mode?: 'ai' | 'deterministic';
  blockReason?: 'billing' | 'ai_disabled' | 'admin_disabled' | null;
}) => ({
  mode: d.mode ?? 'ai',
  blockReason: d.blockReason ?? null,
  risk: d.risk,
  scores: null
});

describe('skillSecurityVerdict', () => {
  it('reports dismissed reviews regardless of their result', () => {
    expect(
      skillSecurityVerdict({
        review: { dismissedAt: new Date() },
        current: revision({ risk: 'critical' }),
        inProgress: null
      })
    ).toBe('dismissed');
  });

  it('is pending until the first revision exists, and unavailable when it failed', () => {
    expect(skillSecurityVerdict({ review: active, current: null, inProgress: null })).toBe(
      'pending'
    );
    expect(
      skillSecurityVerdict({ review: active, current: null, inProgress: { status: 'failed' } })
    ).toBe('unavailable');
  });

  it('fails high and critical risk, even from the deterministic scan alone', () => {
    expect(
      skillSecurityVerdict({
        review: active,
        current: revision({ risk: 'high', mode: 'deterministic' }),
        inProgress: null
      })
    ).toBe('fail');
    expect(
      skillSecurityVerdict({
        review: active,
        current: revision({ risk: 'critical' }),
        inProgress: null
      })
    ).toBe('fail');
  });

  it('keeps a passing deterministic scan pending while the AI review is scheduled', () => {
    expect(
      skillSecurityVerdict({
        review: active,
        current: revision({ risk: 'low', mode: 'deterministic' }),
        inProgress: null
      })
    ).toBe('pending');
  });

  it('settles a blocked deterministic scan instead of waiting for an AI review that cannot run', () => {
    expect(
      skillSecurityVerdict({
        review: active,
        current: revision({ risk: 'low', mode: 'deterministic', blockReason: 'ai_disabled' }),
        inProgress: null
      })
    ).toBe('pass');
  });

  it('warns on moderate risk and passes low risk', () => {
    expect(
      skillSecurityVerdict({
        review: active,
        current: revision({ risk: 'moderate' }),
        inProgress: null
      })
    ).toBe('warn');
    expect(
      skillSecurityVerdict({
        review: active,
        current: revision({ risk: 'low' }),
        inProgress: null
      })
    ).toBe('pass');
  });

  it('is unavailable when a revision has no risk', () => {
    expect(
      skillSecurityVerdict({
        review: active,
        current: revision({ risk: null }),
        inProgress: null
      })
    ).toBe('unavailable');
  });
});
