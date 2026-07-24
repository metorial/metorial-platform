import { describe, expect, it, vi } from 'vitest';
import { MountedTableRegistry } from './tableRegistry';

describe('MountedTableRegistry', () => {
  it('tracks unique mounted table IDs and notifies subscribers', () => {
    let registry = new MountedTableRegistry();
    let listener = vi.fn();
    let unsubscribe = registry.subscribe(listener);

    let unregisterFirst = registry.register('first');
    let unregisterFirstDuplicate = registry.register('first');
    let unregisterSecond = registry.register('second');

    expect(registry.getSnapshot()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);

    unregisterFirstDuplicate();
    expect(registry.getSnapshot()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);

    unregisterSecond();
    expect(registry.getSnapshot()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(3);

    unregisterFirst();
    unregisterFirst();
    expect(registry.getSnapshot()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    registry.register('after-unsubscribe');
    expect(listener).toHaveBeenCalledTimes(4);
  });
});
