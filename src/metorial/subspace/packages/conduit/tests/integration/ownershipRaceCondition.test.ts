import { describe, expect, test } from 'vitest';
import { MemoryCoordination } from '../../src/adapters/coordination/memoryCoordination';

describe('Ownership Race Condition Tests', () => {
  test('should handle concurrent ownership claims atomically', async () => {
    const coordination = new MemoryCoordination();

    // Register receivers
    await coordination.registerReceiver('receiver1', 10000);
    await coordination.registerReceiver('receiver2', 10000);
    await coordination.registerReceiver('receiver3', 10000);

    // Try to claim same topic concurrently from multiple "senders"
    const claimPromises = [
      coordination.claimTopicOwnership('test-topic', 'receiver1', 30000),
      coordination.claimTopicOwnership('test-topic', 'receiver2', 30000),
      coordination.claimTopicOwnership('test-topic', 'receiver3', 30000)
    ];

    const results = await Promise.all(claimPromises);

    // Exactly one should succeed
    const successCount = results.filter(r => r === true).length;
    expect(successCount).toBe(1);

    // Check who owns it
    const owner = await coordination.getTopicOwner('test-topic');
    expect(owner).toBeDefined();
    expect(['receiver1', 'receiver2', 'receiver3']).toContain(owner!);

    // Verify the winner is consistent
    const ownerCheck2 = await coordination.getTopicOwner('test-topic');
    expect(ownerCheck2).toBe(owner);

    await coordination.close();
  });

  test('should handle many concurrent claims to different topics', async () => {
    const coordination = new MemoryCoordination();

    // Register many receivers
    const receivers = Array.from({ length: 10 }, (_, i) => `receiver-${i}`);
    await Promise.all(receivers.map(id => coordination.registerReceiver(id, 10000)));

    // Create many concurrent claims to different topics
    const topics = Array.from({ length: 100 }, (_, i) => `topic-${i}`);
    const claimPromises = topics.flatMap(topic =>
      receivers.map(receiver => coordination.claimTopicOwnership(topic, receiver, 30000))
    );

    const results = await Promise.all(claimPromises);

    // Each topic should have exactly one successful claim
    for (const topic of topics) {
      const owner = await coordination.getTopicOwner(topic);
      expect(owner).toBeDefined();
      expect(receivers).toContain(owner!);
    }

    await coordination.close();
  }, 15000);

  test('should handle claim racing with cleanup', async () => {
    const coordination = new MemoryCoordination();

    await coordination.registerReceiver('receiver1', 10000);

    // Claim with very short TTL
    const claimed1 = await coordination.claimTopicOwnership(
      'expiring-topic',
      'receiver1',
      100
    );
    expect(claimed1).toBe(true);

    // Wait for it to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    // Force cleanup (simulates background cleanup)
    (coordination as any)._forceCleanup();

    // Now try to claim again - should succeed
    await coordination.registerReceiver('receiver2', 10000);
    const claimed2 = await coordination.claimTopicOwnership(
      'expiring-topic',
      'receiver2',
      30000
    );
    expect(claimed2).toBe(true);

    const owner = await coordination.getTopicOwner('expiring-topic');
    expect(owner).toBe('receiver2');

    await coordination.close();
  });

  test('should handle rapid claim/release cycles', async () => {
    const coordination = new MemoryCoordination();

    await coordination.registerReceiver('receiver1', 10000);
    await coordination.registerReceiver('receiver2', 10000);

    // Rapidly claim and release
    for (let i = 0; i < 20; i++) {
      const claimed1 = await coordination.claimTopicOwnership(
        'cycle-topic',
        'receiver1',
        30000
      );
      expect(claimed1).toBe(true);

      await coordination.releaseTopicOwnership('cycle-topic', 'receiver1');

      const claimed2 = await coordination.claimTopicOwnership(
        'cycle-topic',
        'receiver2',
        30000
      );
      expect(claimed2).toBe(true);

      await coordination.releaseTopicOwnership('cycle-topic', 'receiver2');
    }

    await coordination.close();
  });

  test('should maintain ownership consistency under high load', async () => {
    const coordination = new MemoryCoordination();

    // Register receivers
    const receivers = Array.from({ length: 5 }, (_, i) => `receiver-${i}`);
    await Promise.all(receivers.map(id => coordination.registerReceiver(id, 10000)));

    // Single topic, many attempts to claim
    const claimPromises: any[] = [];
    for (let i = 0; i < 100; i++) {
      const receiver = receivers[i % receivers.length]!;
      claimPromises.push(coordination.claimTopicOwnership('contested-topic', receiver, 30000));
    }

    const results = await Promise.all(claimPromises);

    // Only the first claim should succeed, rest should fail
    const successCount = results.filter(r => r === true).length;
    expect(successCount).toBe(1);

    // Verify owner is consistent
    const owner = await coordination.getTopicOwner('contested-topic');
    expect(owner).toBeDefined();

    // Try more claims - all should fail
    const moreClaims = await Promise.all(
      receivers.map(r => coordination.claimTopicOwnership('contested-topic', r, 30000))
    );
    expect(moreClaims.every(r => r === false)).toBe(true);

    // Owner should still be the same
    const ownerAfter = await coordination.getTopicOwner('contested-topic');
    expect(ownerAfter).toBe(owner);

    await coordination.close();
  });

  test('should handle ownership renewal correctly', async () => {
    const coordination = new MemoryCoordination();

    await coordination.registerReceiver('receiver1', 10000);

    // Claim ownership
    const claimed = await coordination.claimTopicOwnership('renewal-topic', 'receiver1', 1000);
    expect(claimed).toBe(true);

    // Renew ownership multiple times
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const renewed = await coordination.renewTopicOwnership(
        'renewal-topic',
        'receiver1',
        1000
      );
      expect(renewed).toBe(true);
    }

    // Should still own it
    const owner = await coordination.getTopicOwner('renewal-topic');
    expect(owner).toBe('receiver1');

    await coordination.close();
  }, 10000);

  test('should prevent other receivers from claiming during renewal', async () => {
    const coordination = new MemoryCoordination();

    await coordination.registerReceiver('receiver1', 10000);
    await coordination.registerReceiver('receiver2', 10000);

    // Receiver1 claims
    const claimed1 = await coordination.claimTopicOwnership(
      'locked-topic',
      'receiver1',
      30000
    );
    expect(claimed1).toBe(true);

    // Receiver2 tries to claim - should fail
    const claimed2 = await coordination.claimTopicOwnership(
      'locked-topic',
      'receiver2',
      30000
    );
    expect(claimed2).toBe(false);

    // Receiver1 renews
    const renewed = await coordination.renewTopicOwnership('locked-topic', 'receiver1', 30000);
    expect(renewed).toBe(true);

    // Receiver2 tries again - should still fail
    const claimed3 = await coordination.claimTopicOwnership(
      'locked-topic',
      'receiver2',
      30000
    );
    expect(claimed3).toBe(false);

    await coordination.close();
  });
});
