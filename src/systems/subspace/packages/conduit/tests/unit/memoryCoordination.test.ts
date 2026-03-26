import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { MemoryCoordination } from '../../src/adapters/coordination/memoryCoordination';

describe('MemoryCoordination', () => {
  let coordination: MemoryCoordination;

  beforeEach(() => {
    coordination = new MemoryCoordination('test-conduit');
  });

  afterEach(async () => {
    await coordination.close();
  });

  describe('Receiver Management', () => {
    test('should register receivers', async () => {
      await coordination.registerReceiver('receiver-1', 10000);
      await coordination.registerReceiver('receiver-2', 10000);

      const receivers = await coordination.getActiveReceivers();
      expect(receivers).toContain('receiver-1');
      expect(receivers).toContain('receiver-2');
      expect(receivers).toHaveLength(2);
    });

    test('should update receiver TTL on re-registration', async () => {
      await coordination.registerReceiver('receiver-1', 100);

      await new Promise(resolve => setTimeout(resolve, 60));

      // Re-register to extend TTL
      await coordination.registerReceiver('receiver-1', 100);

      await new Promise(resolve => setTimeout(resolve, 60));

      // Should still be active
      const receivers = await coordination.getActiveReceivers();
      expect(receivers).toContain('receiver-1');
    });

    test('should expire receivers after TTL', async () => {
      await coordination.registerReceiver('receiver-1', 50);

      let receivers = await coordination.getActiveReceivers();
      expect(receivers).toContain('receiver-1');

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100));

      receivers = await coordination.getActiveReceivers();
      expect(receivers).not.toContain('receiver-1');
    });

    test('should unregister receivers', async () => {
      await coordination.registerReceiver('receiver-1', 10000);
      await coordination.registerReceiver('receiver-2', 10000);

      await coordination.unregisterReceiver('receiver-1');

      const receivers = await coordination.getActiveReceivers();
      expect(receivers).not.toContain('receiver-1');
      expect(receivers).toContain('receiver-2');
    });

    test('should handle unregistering non-existent receiver', async () => {
      await coordination.unregisterReceiver('non-existent');
      // Should not throw
    });

    test('should cleanup expired receivers automatically', async () => {
      await coordination.registerReceiver('receiver-1', 50);
      await coordination.registerReceiver('receiver-2', 10000);

      await new Promise(resolve => setTimeout(resolve, 100));

      const receivers = await coordination.getActiveReceivers();
      expect(receivers).not.toContain('receiver-1');
      expect(receivers).toContain('receiver-2');
    });
  });

  describe('Topic Ownership', () => {
    test('should claim topic ownership', async () => {
      const claimed = await coordination.claimTopicOwnership('topic-1', 'receiver-1', 30000);
      expect(claimed).toBe(true);

      const owner = await coordination.getTopicOwner('topic-1');
      expect(owner).toBe('receiver-1');
    });

    test('should prevent duplicate ownership claims', async () => {
      const claimed1 = await coordination.claimTopicOwnership('topic-1', 'receiver-1', 30000);
      expect(claimed1).toBe(true);

      const claimed2 = await coordination.claimTopicOwnership('topic-1', 'receiver-2', 30000);
      expect(claimed2).toBe(false);

      const owner = await coordination.getTopicOwner('topic-1');
      expect(owner).toBe('receiver-1');
    });

    test('should allow claiming after ownership expires', async () => {
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 50);

      await new Promise(resolve => setTimeout(resolve, 100));

      const claimed = await coordination.claimTopicOwnership('topic-1', 'receiver-2', 30000);
      expect(claimed).toBe(true);

      const owner = await coordination.getTopicOwner('topic-1');
      expect(owner).toBe('receiver-2');
    });

    test('should return null for non-existent topic owner', async () => {
      const owner = await coordination.getTopicOwner('non-existent');
      expect(owner).toBeNull();
    });

    test('should return null for expired topic ownership', async () => {
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 50);

      await new Promise(resolve => setTimeout(resolve, 100));

      const owner = await coordination.getTopicOwner('topic-1');
      expect(owner).toBeNull();
    });

    test('should release topic ownership', async () => {
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 30000);

      await coordination.releaseTopicOwnership('topic-1', 'receiver-1');

      const owner = await coordination.getTopicOwner('topic-1');
      expect(owner).toBeNull();
    });

    test('should not release ownership for wrong receiver', async () => {
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 30000);

      await coordination.releaseTopicOwnership('topic-1', 'receiver-2');

      const owner = await coordination.getTopicOwner('topic-1');
      expect(owner).toBe('receiver-1');
    });

    test('should renew topic ownership', async () => {
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 50);

      await new Promise(resolve => setTimeout(resolve, 30));

      const renewed = await coordination.renewTopicOwnership('topic-1', 'receiver-1', 50);
      expect(renewed).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 30));

      // Should still be owned due to renewal
      const owner = await coordination.getTopicOwner('topic-1');
      expect(owner).toBe('receiver-1');
    });

    test('should fail to renew non-existent ownership', async () => {
      const renewed = await coordination.renewTopicOwnership('topic-1', 'receiver-1', 30000);
      expect(renewed).toBe(false);
    });

    test('should fail to renew ownership for wrong receiver', async () => {
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 30000);

      const renewed = await coordination.renewTopicOwnership('topic-1', 'receiver-2', 30000);
      expect(renewed).toBe(false);
    });

    test('should fail to renew expired ownership', async () => {
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 50);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Force cleanup to ensure expired entry is removed
      coordination._forceCleanup();

      const renewed = await coordination.renewTopicOwnership('topic-1', 'receiver-1', 30000);
      expect(renewed).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent receiver registrations', async () => {
      const receivers = Array.from({ length: 10 }, (_, i) => `receiver-${i}`);

      await Promise.all(receivers.map(id => coordination.registerReceiver(id, 10000)));

      const activeReceivers = await coordination.getActiveReceivers();
      expect(activeReceivers).toHaveLength(10);
      receivers.forEach(id => {
        expect(activeReceivers).toContain(id);
      });
    });

    test('should handle concurrent ownership claims (race condition)', async () => {
      const topic = 'contested-topic';
      const receivers = ['receiver-1', 'receiver-2', 'receiver-3'];

      // All try to claim at once
      const results = await Promise.all(
        receivers.map(id => coordination.claimTopicOwnership(topic, id, 30000))
      );

      // Only one should succeed
      const successCount = results.filter(r => r === true).length;
      expect(successCount).toBe(1);

      // Verify only one owner
      const owner = await coordination.getTopicOwner(topic);
      expect(receivers).toContain(owner!);
    });

    test('should handle concurrent renewals', async () => {
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 100);

      const renewals = await Promise.all([
        coordination.renewTopicOwnership('topic-1', 'receiver-1', 100),
        coordination.renewTopicOwnership('topic-1', 'receiver-1', 100),
        coordination.renewTopicOwnership('topic-1', 'receiver-1', 100)
      ]);

      // All should succeed
      expect(renewals).toEqual([true, true, true]);
    });

    test('should handle many topics on single receiver', async () => {
      const topics = Array.from({ length: 100 }, (_, i) => `topic-${i}`);

      await Promise.all(
        topics.map(topic => coordination.claimTopicOwnership(topic, 'receiver-1', 30000))
      );

      // All should be owned by receiver-1
      for (const topic of topics) {
        const owner = await coordination.getTopicOwner(topic);
        expect(owner).toBe('receiver-1');
      }
    });

    test('should distribute topics across multiple receivers', async () => {
      const topics = Array.from({ length: 10 }, (_, i) => `topic-${i}`);
      const receivers = ['receiver-1', 'receiver-2', 'receiver-3'];

      // Distribute topics round-robin
      for (let i = 0; i < topics.length; i++) {
        const receiver = receivers[i % receivers.length]!;
        await coordination.claimTopicOwnership(topics[i]!, receiver, 30000);
      }

      // Verify distribution
      const ownerCounts = new Map<string, number>();
      for (const topic of topics) {
        const owner = await coordination.getTopicOwner(topic);
        ownerCounts.set(owner!, (ownerCounts.get(owner!) || 0) + 1);
      }

      expect(ownerCounts.get('receiver-1')).toBe(4);
      expect(ownerCounts.get('receiver-2')).toBe(3);
      expect(ownerCounts.get('receiver-3')).toBe(3);
    });
  });

  describe('Cleanup and Lifecycle', () => {
    test('should cleanup all data on close', async () => {
      await coordination.registerReceiver('receiver-1', 10000);
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 30000);

      await coordination.close();

      const receivers = await coordination.getActiveReceivers();
      const owner = await coordination.getTopicOwner('topic-1');

      expect(receivers).toHaveLength(0);
      expect(owner).toBeNull();
    });

    test('should force cleanup', async () => {
      await coordination.registerReceiver('receiver-1', 50);
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 50);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Force cleanup using internal method
      coordination._forceCleanup();

      const receivers = await coordination.getActiveReceivers();
      const owner = await coordination.getTopicOwner('topic-1');

      expect(receivers).toHaveLength(0);
      expect(owner).toBeNull();
    });

    test('should handle operations after close', async () => {
      await coordination.registerReceiver('receiver-1', 10000);
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 30000);

      await coordination.close();

      // After close, data is cleared but adapter still functions
      let receivers = await coordination.getActiveReceivers();
      let owner = await coordination.getTopicOwner('topic-1');

      expect(receivers).toHaveLength(0);
      expect(owner).toBeNull();

      // Can still register new receivers after close (adapter is stateless)
      await coordination.registerReceiver('receiver-2', 10000);
      receivers = await coordination.getActiveReceivers();
      expect(receivers).toContain('receiver-2');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very short TTLs', async () => {
      await coordination.registerReceiver('receiver-1', 1);
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', 1);

      await new Promise(resolve => setTimeout(resolve, 50));

      const receivers = await coordination.getActiveReceivers();
      const owner = await coordination.getTopicOwner('topic-1');

      expect(receivers).toHaveLength(0);
      expect(owner).toBeNull();
    });

    test('should handle very long TTLs', async () => {
      const longTTL = 24 * 60 * 60 * 1000; // 24 hours
      await coordination.registerReceiver('receiver-1', longTTL);
      await coordination.claimTopicOwnership('topic-1', 'receiver-1', longTTL);

      const receivers = await coordination.getActiveReceivers();
      const owner = await coordination.getTopicOwner('topic-1');

      expect(receivers).toContain('receiver-1');
      expect(owner).toBe('receiver-1');
    });

    test('should handle empty strings as IDs', async () => {
      await coordination.registerReceiver('', 10000);
      await coordination.claimTopicOwnership('', '', 30000);

      const receivers = await coordination.getActiveReceivers();
      const owner = await coordination.getTopicOwner('');

      expect(receivers).toContain('');
      expect(owner).toBe('');
    });

    test('should handle special characters in IDs', async () => {
      const specialId = 'receiver-!@#$%^&*()_+-=[]{}|;:,.<>?';
      const specialTopic = 'topic-!@#$%^&*()_+-=[]{}|;:,.<>?';

      await coordination.registerReceiver(specialId, 10000);
      await coordination.claimTopicOwnership(specialTopic, specialId, 30000);

      const receivers = await coordination.getActiveReceivers();
      const owner = await coordination.getTopicOwner(specialTopic);

      expect(receivers).toContain(specialId);
      expect(owner).toBe(specialId);
    });

    test('should handle rapid claim/release cycles', async () => {
      for (let i = 0; i < 50; i++) {
        await coordination.claimTopicOwnership('topic-1', 'receiver-1', 30000);
        await coordination.releaseTopicOwnership('topic-1', 'receiver-1');
      }

      const owner = await coordination.getTopicOwner('topic-1');
      expect(owner).toBeNull();
    });
  });
});
