import { describe, expect, it } from 'vitest';
import {
  createSkillSyncBranchName,
  normalizeSkillSyncBranchName
} from './branchName';

describe('skill sync branch names', () => {
  it('creates names accepted by restrictive GitLab push rules', () => {
    let branchName = createSkillSyncBranchName({
      target: 'marketplace',
      syncCounter: 36,
      suffix: 'QQV8'
    });

    expect(branchName).toBe('metorial-sync-marketplace-36-qqv8');
    expect(branchName).toMatch(/^[a-z0-9-]{1,63}$/);
  });

  it('normalizes unsupported characters without losing the unique suffix', () => {
    let branchName = createSkillSyncBranchName({
      target: 'Team/Skill Marketplace_v2',
      syncCounter: 42,
      suffix: 'Ab_C+12'
    });

    expect(branchName).toMatch(/^[a-z0-9-]{1,63}$/);
    expect(branchName.endsWith('-42-ab-c-12')).toBe(true);
  });

  it('trims generated long branches to 45 characters and appends five random characters', () => {
    let branchName = createSkillSyncBranchName({
      target: 'a'.repeat(100),
      syncCounter: 123,
      suffix: 'abcd'
    });

    expect(branchName).toHaveLength(50);
    expect(branchName.slice(0, 45)).toBe(`metorial-sync-${'a'.repeat(31)}`);
    expect(branchName).toMatch(/^[a-z0-9-]{1,50}$/);
  });

  it('repairs slash-containing names already queued before deployment', () => {
    expect(normalizeSkillSyncBranchName('metorial/sync-marketplace-36-QQV8')).toBe(
      'metorial-sync-marketplace-36-qqv8'
    );
  });

  it('trims legacy long names to 45 characters and appends five random characters', () => {
    let original = 'metorial-sync-' + 'a'.repeat(60);
    let branchName = normalizeSkillSyncBranchName(original);

    expect(branchName).toHaveLength(50);
    expect(branchName.slice(0, 45)).toBe(original.slice(0, 45));
    expect(branchName).toMatch(/^[a-z0-9-]{1,50}$/);
  });
});
