import { describe, expect, test } from 'vitest';
import { Semaphore } from '../../src/core/semaphore';

describe('Semaphore', () => {
  test('allows up to N concurrent holders', async () => {
    let sem = new Semaphore(2);

    await sem.acquire();
    await sem.acquire();

    expect(sem.getAvailable()).toBe(0);

    let acquired3 = false;
    let p = sem.acquire().then(() => {
      acquired3 = true;
    });

    // The third acquire must wait.
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(acquired3).toBe(false);
    expect(sem.getWaiting()).toBe(1);

    // Releasing hands the permit to the waiter.
    sem.release();
    await p;
    expect(acquired3).toBe(true);
    expect(sem.getWaiting()).toBe(0);
  });

  test('serializes work to at most N concurrent', async () => {
    let sem = new Semaphore(3);
    let active = 0;
    let maxActive = 0;

    let task = async () => {
      await sem.acquire();
      try {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 20));
      } finally {
        active--;
        sem.release();
      }
    };

    await Promise.all(Array.from({ length: 12 }, () => task()));

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(active).toBe(0);
  });
});
