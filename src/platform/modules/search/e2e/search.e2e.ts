import { eventually, uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import {
  deleteFirewallDocument,
  indexFirewallDocument,
  isSearchEnabled,
  searchFirewallIds
} from '../src';

describe('module-search', () => {
  it('is backed by voyager', async () => {
    expect(isSearchEnabled()).toBe(true);
    expect(await searchFirewallIds({ instanceId: uniqueId('ins'), query: '   ' })).toEqual([]);
  });

  it('indexes, searches and deletes documents scoped to an instance', async () => {
    let instanceId = uniqueId('ins');
    let otherInstanceId = uniqueId('ins');
    let id = uniqueId('fw');

    await indexFirewallDocument({
      id,
      instanceId,
      name: 'Gateway Firewall',
      description: 'Blocks outbound traffic'
    });

    await eventually(async () => {
      expect(await searchFirewallIds({ instanceId, query: 'gateway' })).toContain(id);
    });
    expect(await searchFirewallIds({ instanceId: otherInstanceId, query: 'gateway' })).toEqual(
      []
    );

    await deleteFirewallDocument({ id });

    await eventually(async () => {
      expect(await searchFirewallIds({ instanceId, query: 'gateway' })).not.toContain(id);
    });
  });
});
