import { useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyEnabledFlags,
  defaultFlags,
  disabledFlag,
  flagService,
  getFlagDisabledReason,
  isFlagEnabled,
  setFlagProvider
} from '../src';

describe('module-flags', () => {
  let org = useOrganization();

  afterEach(() => {
    setFlagProvider(async () => defaultFlags);
  });

  it('resolves the default flags for an organization, project and user', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let flags = await flagService.getFlags({
      organization: fixture.organization,
      project: fixture.project,
      user: fixture.user ?? undefined
    });
    expect(flags).toEqual(applyEnabledFlags(defaultFlags, process.env.METORIAL_ENABLED_FLAGS));
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
});
