import { useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { isAiReviewConfigured } from '@metorial/shared-settings';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aiAvailabilityUnavailableReason,
  applyAiAvailability,
  applyEnabledFlags,
  defaultFlags,
  disabledFlag,
  flagService,
  getFlagDisabledReason,
  isAiAvailable,
  isFlagEnabled,
  setFlagProvider
} from '../src';

describe('module-flags', () => {
  let org = useOrganization();

  afterEach(() => {
    vi.unstubAllEnvs();
    setFlagProvider(async () => defaultFlags);
  });

  it('resolves the default flags for an organization, project and user', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let flags = await flagService.getFlags({
      organization: fixture.organization,
      project: fixture.project,
      user: fixture.user ?? undefined
    });
    expect(flags).toEqual({
      ...applyAiAvailability(
        applyEnabledFlags(defaultFlags, process.env.METORIAL_ENABLED_FLAGS),
        isAiAvailable()
      ),
      'ai-reviews-available': isAiReviewConfigured()
    });
    expect(isFlagEnabled(flags['paid-audit-logs'])).toBe(true);
  });

  it('enables the flags listed in METORIAL_ENABLED_FLAGS', () => {
    let some = applyEnabledFlags(defaultFlags, 'skills-enabled, outposts');
    expect(isFlagEnabled(some['skills-enabled'])).toBe(true);
    expect(isFlagEnabled(some.outposts)).toBe(true);
    expect(isFlagEnabled(some['chat-enabled'])).toBe(false);

    let all = applyEnabledFlags(defaultFlags, '*');
    expect(isFlagEnabled(all['test-flag'])).toBe(true);
    expect(all['sandbox-max-vcpus']).toBe(defaultFlags['sandbox-max-vcpus']);

    expect(applyEnabledFlags(defaultFlags, undefined)).toBe(defaultFlags);
  });

  it('routes lookups through a custom flag provider', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let seen: string[] = [];

    setFlagProvider(async params => {
      seen.push(params.organization.id);
      return { ...defaultFlags, 'test-flag': true, outposts: disabledFlag('e2e') };
    });

    let flags = await flagService.getFlags({ organization: fixture.organization });
    expect(seen).toEqual([org.ids.organizationId]);
    expect(isFlagEnabled(flags['test-flag'])).toBe(true);
    expect(isFlagEnabled(flags.outposts)).toBe(false);
    expect(getFlagDisabledReason(flags.outposts)).toBe('e2e');
  });

  it('treats a non-empty AI_GATEWAY_API_KEY as AI being available', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    expect(isAiAvailable()).toBe(false);

    vi.stubEnv('AI_GATEWAY_API_KEY', '   ');
    expect(isAiAvailable()).toBe(false);

    vi.stubEnv('AI_GATEWAY_API_KEY', 'key');
    expect(isAiAvailable()).toBe(true);
  });

  it('disables AI-dependent flags when AI is unavailable, whatever the provider says', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    setFlagProvider(async () => applyEnabledFlags(defaultFlags, '*'));

    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    let without = await flagService.getFlags({ organization: fixture.organization });
    expect(isFlagEnabled(without['ai-available'])).toBe(false);
    expect(isFlagEnabled(without['assistant-enabled'])).toBe(false);
    expect(getFlagDisabledReason(without['ai-available'])).toBe(
      aiAvailabilityUnavailableReason
    );
    expect(isFlagEnabled(without['skills-enabled'])).toBe(true);

    vi.stubEnv('AI_GATEWAY_API_KEY', 'key');
    let withKey = await flagService.getFlags({ organization: fixture.organization });
    expect(isFlagEnabled(withKey['ai-available'])).toBe(true);
    expect(isFlagEnabled(withKey['assistant-enabled'])).toBe(true);
  });
});
