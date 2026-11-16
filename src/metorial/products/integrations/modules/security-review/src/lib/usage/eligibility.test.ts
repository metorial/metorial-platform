import { describe, expect, it } from 'vitest';
import { findMaterialUsageChanges } from './eligibility';

let snapshot = {
  takenAt: '2026-10-01T00:00:00.000Z',
  baseRevisionId: 'srr_1',
  calls: 1000,
  toolsUsed: ['search', 'read'],
  allowedTools: ['search', 'read', 'delete'],
  scopes: ['read'],
  authConfigs: 3,
  configs: 4,
  severeProtoGuardMatches: 0
};

let changes = (overrides: Partial<typeof snapshot>) =>
  findMaterialUsageChanges({ previous: snapshot, current: { ...snapshot, ...overrides } });

describe('findMaterialUsageChanges', () => {
  it('ignores a single new config or auth config', () => {
    expect(changes({ configs: 5, authConfigs: 4 })).toEqual([]);
  });

  it('ignores small call growth', () => {
    expect(changes({ calls: 1150 })).toEqual([]);
  });

  it('flags doubled usage', () => {
    expect(changes({ calls: 2300 })).toHaveLength(1);
  });

  it('flags newly used tools', () => {
    expect(changes({ toolsUsed: ['search', 'read', 'delete'] })[0]).toContain('delete');
  });

  it('flags filter and scope changes', () => {
    expect(changes({ allowedTools: ['search', 'read'] })).toHaveLength(1);
    expect(changes({ scopes: ['read', 'write'] })).toHaveLength(1);
  });

  it('flags the first severe runtime match', () => {
    expect(changes({ severeProtoGuardMatches: 1 })).toHaveLength(1);
  });

  it('flags a new base review', () => {
    expect(changes({ baseRevisionId: 'srr_2' })).toHaveLength(1);
  });

  it('flags a large jump in configs', () => {
    expect(changes({ configs: 20 })).toHaveLength(1);
  });
});
