import { useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { afterEach, describe, expect, it } from 'vitest';
import {
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
    expect(flags).toEqual(defaultFlags);
    expect(isFlagEnabled(flags['paid-audit-logs'])).toBe(true);
    expect(isFlagEnabled(flags['test-flag'])).toBe(false);
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
