import { describe, expect, it } from 'vitest';
import { isLinkAllowed, linkPropagates, reachSince } from '../src/lib/linkRules';

describe('isLinkAllowed', () => {
  it.each([
    ['member_of', 'user', 'team'],
    ['member_of', 'user', 'cost_center'],
    ['member_of', 'user', 'project'],
    ['member_of', 'user', 'custom:department'],
    ['part_of', 'team', 'team'],
    ['part_of', 'team', 'cost_center'],
    ['part_of', 'team', 'custom:department'],
    ['part_of', 'repo', 'project'],
    ['part_of', 'workspace', 'repo'],
    ['part_of', 'workspace', 'project'],
    ['part_of', 'project', 'cost_center'],
    ['part_of', 'agent', 'agent'],
    ['part_of', 'client_installation', 'device'],
    ['part_of', 'custom:product', 'custom:department'],
    ['owned_by', 'device', 'user'],
    ['owned_by', 'client_user', 'user']
  ])('allows %s from %s to %s', (type, fromKind, toKind) => {
    expect(isLinkAllowed({ type, fromKind, toKind })).toBe(true);
  });

  it.each([
    ['member_of', 'team', 'team'],
    ['member_of', 'device', 'team'],
    ['part_of', 'user', 'team'],
    ['part_of', 'repo', 'team'],
    ['part_of', 'project', 'repo'],
    ['owned_by', 'user', 'user'],
    ['owned_by', 'repo', 'user'],
    ['assigned_to', 'user', 'team'],
    ['member_of', 'user', 'custom:']
  ])('rejects %s from %s to %s', (type, fromKind, toKind) => {
    expect(isLinkAllowed({ type, fromKind, toKind })).toBe(false);
  });
});

describe('linkPropagates', () => {
  it('propagates hierarchy and membership links', () => {
    expect(linkPropagates({ type: 'member_of', fromKind: 'user', toKind: 'team' })).toBe(true);
    expect(linkPropagates({ type: 'part_of', fromKind: 'team', toKind: 'cost_center' })).toBe(
      true
    );
  });

  it('does not propagate listing links', () => {
    expect(linkPropagates({ type: 'part_of', fromKind: 'agent', toKind: 'agent' })).toBe(
      false
    );
    expect(linkPropagates({ type: 'owned_by', fromKind: 'device', toKind: 'user' })).toBe(
      false
    );
    expect(
      linkPropagates({ type: 'part_of', fromKind: 'client_installation', toKind: 'device' })
    ).toBe(false);
  });

  it('propagates staffing only when switched on', () => {
    let staffing = { type: 'member_of', fromKind: 'user', toKind: 'project' };

    expect(linkPropagates(staffing)).toBe(false);
    expect(linkPropagates(staffing, { staffingPropagates: true })).toBe(true);
  });
});

describe('reachSince', () => {
  it('maps reach to the start of the affected window', () => {
    let now = new Date('2026-11-13T10:00:00Z');

    expect(reachSince('from_now', now)).toEqual(now);
    expect(reachSince('past_30_days', now)).toEqual(new Date('2026-10-14T10:00:00Z'));
  });
});
