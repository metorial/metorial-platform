import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ICoordinationAdapter } from '../../src/adapters/coordination/coordinationAdapter';
import { OwnershipManager } from '../../src/core/ownershipManager';

describe('OwnershipManager', () => {
  let manager: OwnershipManager;
  let mockCoordination: ICoordinationAdapter;
  let receiverId: string;

  beforeEach(() => {
    receiverId = 'test-receiver-1';

    // Create mock coordination adapter
    mockCoordination = {
      registerReceiver: vi.fn().mockResolvedValue(undefined),
      unregisterReceiver: vi.fn().mockResolvedValue(undefined),
      getActiveReceivers: vi.fn().mockResolvedValue([receiverId]),
      claimTopicOwnership: vi.fn().mockResolvedValue(true),
      getTopicOwner: vi.fn().mockResolvedValue(null),
      releaseTopicOwnership: vi.fn().mockResolvedValue(undefined),
      renewTopicOwnership: vi.fn().mockResolvedValue(true),
      close: vi.fn().mockResolvedValue(undefined)
    };

    manager = new OwnershipManager(receiverId, mockCoordination, 1000, 30000);
  });

  afterEach(() => {
    manager.stop();
  });

  test('should track owned topics', () => {
    expect(manager.getOwnedTopics()).toEqual([]);
    expect(manager.getOwnedCount()).toBe(0);

    manager.addTopic('topic-1');
    expect(manager.getOwnedTopics()).toEqual(['topic-1']);
    expect(manager.getOwnedCount()).toBe(1);

    manager.addTopic('topic-2');
    expect(manager.getOwnedTopics()).toContain('topic-1');
    expect(manager.getOwnedTopics()).toContain('topic-2');
    expect(manager.getOwnedCount()).toBe(2);
  });

  test('should check topic ownership', () => {
    expect(manager.ownsTopic('topic-1')).toBe(false);

    manager.addTopic('topic-1');
    expect(manager.ownsTopic('topic-1')).toBe(true);
    expect(manager.ownsTopic('topic-2')).toBe(false);
  });

  test('should remove topics', () => {
    manager.addTopic('topic-1');
    manager.addTopic('topic-2');
    expect(manager.getOwnedCount()).toBe(2);

    manager.removeTopic('topic-1');
    expect(manager.getOwnedCount()).toBe(1);
    expect(manager.ownsTopic('topic-1')).toBe(false);
    expect(manager.ownsTopic('topic-2')).toBe(true);
  });

  test('should handle duplicate topic additions', () => {
    manager.addTopic('topic-1');
    manager.addTopic('topic-1');
    expect(manager.getOwnedCount()).toBe(1);
  });

  test('should handle removing non-existent topics', () => {
    manager.removeTopic('non-existent');
    expect(manager.getOwnedCount()).toBe(0);
  });

  test('should start and stop renewal process', async () => {
    manager.addTopic('topic-1');

    manager.start();
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Should have called renewTopicOwnership at least once
    expect(mockCoordination.renewTopicOwnership).toHaveBeenCalledWith(
      'topic-1',
      receiverId,
      30000
    );

    manager.stop();
  });

  test('should not start renewal if already started', () => {
    manager.start();
    manager.start();
    // Should not throw or cause issues
    manager.stop();
  });

  test('should handle renewal failures by removing lost topics', async () => {
    manager.addTopic('topic-1');
    manager.addTopic('topic-2');

    // Mock renewal to fail for topic-1
    (mockCoordination.renewTopicOwnership as any).mockImplementation((topic: string) => {
      return Promise.resolve(topic !== 'topic-1');
    });

    manager.start();
    await new Promise(resolve => setTimeout(resolve, 1200));

    // topic-1 should be removed due to failed renewal
    expect(manager.ownsTopic('topic-1')).toBe(false);
    expect(manager.ownsTopic('topic-2')).toBe(true);

    manager.stop();
  });

  test('should handle renewal errors without removing topics', async () => {
    manager.addTopic('topic-1');

    // Mock renewal to throw error
    (mockCoordination.renewTopicOwnership as any).mockRejectedValue(
      new Error('Network error')
    );

    manager.start();
    await new Promise(resolve => setTimeout(resolve, 1200));

    // topic-1 should still be owned (transient error)
    expect(manager.ownsTopic('topic-1')).toBe(true);

    manager.stop();
  });

  test('should release all topics on releaseAll', async () => {
    manager.addTopic('topic-1');
    manager.addTopic('topic-2');
    manager.addTopic('topic-3');

    await manager.releaseAll();

    expect(mockCoordination.releaseTopicOwnership).toHaveBeenCalledTimes(3);
    expect(mockCoordination.releaseTopicOwnership).toHaveBeenCalledWith('topic-1', receiverId);
    expect(mockCoordination.releaseTopicOwnership).toHaveBeenCalledWith('topic-2', receiverId);
    expect(mockCoordination.releaseTopicOwnership).toHaveBeenCalledWith('topic-3', receiverId);

    expect(manager.getOwnedCount()).toBe(0);
  });

  test('should handle release errors gracefully', async () => {
    manager.addTopic('topic-1');
    manager.addTopic('topic-2');

    // Mock release to fail for topic-1
    (mockCoordination.releaseTopicOwnership as any).mockImplementation((topic: string) => {
      if (topic === 'topic-1') {
        return Promise.reject(new Error('Release failed'));
      }
      return Promise.resolve();
    });

    await manager.releaseAll();

    // Should still clear all topics even if some releases failed
    expect(manager.getOwnedCount()).toBe(0);
  });

  test('should handle concurrent topic additions', () => {
    const topics = Array.from({ length: 100 }, (_, i) => `topic-${i}`);

    topics.forEach(topic => {
      manager.addTopic(topic);
    });

    expect(manager.getOwnedCount()).toBe(100);
    topics.forEach(topic => {
      expect(manager.ownsTopic(topic)).toBe(true);
    });
  });

  test('should renew multiple topics in parallel', async () => {
    const topics = ['topic-1', 'topic-2', 'topic-3', 'topic-4', 'topic-5'];
    topics.forEach(topic => {
      manager.addTopic(topic);
    });

    manager.start();
    await new Promise(resolve => setTimeout(resolve, 1200));

    // All topics should have been renewed
    topics.forEach(topic => {
      expect(mockCoordination.renewTopicOwnership).toHaveBeenCalledWith(
        topic,
        receiverId,
        30000
      );
    });

    manager.stop();
  });

  test('should handle empty topic list', async () => {
    manager.start();
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Should not error with no topics
    expect(mockCoordination.renewTopicOwnership).not.toHaveBeenCalled();

    await manager.releaseAll();
    expect(mockCoordination.releaseTopicOwnership).not.toHaveBeenCalled();

    manager.stop();
  });

  test('should continue renewal after adding topics mid-cycle', async () => {
    manager.addTopic('topic-1');
    manager.start();

    await new Promise(resolve => setTimeout(resolve, 600));

    // Add topic during renewal cycle
    manager.addTopic('topic-2');

    await new Promise(resolve => setTimeout(resolve, 700));

    // Both topics should eventually be renewed
    expect(mockCoordination.renewTopicOwnership).toHaveBeenCalledWith(
      'topic-1',
      receiverId,
      30000
    );
    expect(mockCoordination.renewTopicOwnership).toHaveBeenCalledWith(
      'topic-2',
      receiverId,
      30000
    );

    manager.stop();
  });
});
