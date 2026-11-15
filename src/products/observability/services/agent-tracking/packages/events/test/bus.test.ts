import { describe, expect, it, vi } from 'vitest';
import { Events } from '../src/bus';

describe('Events', () => {
  it('awaits every listener of an event and ignores events nobody listens to', async () => {
    let order: string[] = [];
    let stopA = Events.listen('sessions.session.idle:after', async d => {
      await new Promise(resolve => setTimeout(resolve, 5));
      order.push(`a:${d.sessionKeys.join(',')}`);
    });
    let stopB = Events.listen('sessions.session.idle:after', d => {
      order.push(`b:${d.sessionKeys.length}`);
    });

    await Events.fire('sessions.session.idle:after', { sessionKeys: ['s1', 's2'] });
    expect(order.sort()).toEqual(['a:s1,s2', 'b:2']);

    await Events.fire('sessions.session.turn_completed:after', { sessionKey: 's1' });

    stopA();
    stopB();
  });

  it('stops calling a listener once unsubscribed', async () => {
    let listener = vi.fn();
    let stop = Events.listen('entities.entity.merged:after', listener);

    await Events.fire('entities.entity.merged:after', {
      organizationId: 'o',
      winnerId: 'w',
      loserId: 'l',
      tokenPrefixes: []
    });
    stop();
    await Events.fire('entities.entity.merged:after', {
      organizationId: 'o',
      winnerId: 'w',
      loserId: 'l',
      tokenPrefixes: []
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rejects the fire when a listener fails', async () => {
    let stop = Events.listen('rules.rule.changed:after', async () => {
      throw new Error('listener failed');
    });

    await expect(
      Events.fire('rules.rule.changed:after', { organizationId: 'o', since: new Date() })
    ).rejects.toThrow('listener failed');

    stop();
  });
});
