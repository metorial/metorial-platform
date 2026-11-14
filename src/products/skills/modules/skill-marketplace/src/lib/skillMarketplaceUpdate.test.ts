import { describe, expect, it } from 'vitest';
import { getSkillMarketplaceUpdateFlags } from './skillMarketplaceUpdate';

describe('skill marketplace update flags', () => {
  it.each([
    { repositoryAccessMode: 'default_branch' },
    { forceMergeOrPush: true },
    { mergeBeforeChecksPass: true }
  ])('treats repository policy as settings-only: %j', input => {
    expect(getSkillMarketplaceUpdateFlags(input)).toEqual({
      hasUpdate: true,
      hasContentUpdate: false
    });
  });

  it('recognizes content updates', () => {
    expect(getSkillMarketplaceUpdateFlags({ name: 'Marketplace' })).toEqual({
      hasUpdate: true,
      hasContentUpdate: true
    });
  });

  it('rejects an empty update', () => {
    expect(getSkillMarketplaceUpdateFlags({})).toEqual({
      hasUpdate: false,
      hasContentUpdate: false
    });
  });
});
