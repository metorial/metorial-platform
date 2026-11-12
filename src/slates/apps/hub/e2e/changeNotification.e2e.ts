import { describe, expect, it } from 'vitest';
import { ChangeNotificationType } from '../prisma/generated/client';
import { slatesHubClient } from './client';
import { fixtures } from './fixtures';
import { db as testDb } from '../src/db';

describe('changeNotification:list E2E', () => {
  const f = fixtures(testDb);

  it('returns change notifications', async () => {
    const { notification, slate } = await f.changeNotification.withSlate({
      type: ChangeNotificationType.slate_version_created
    });

    await f.changeNotification.withSlate();

    const result = await slatesHubClient.changeNotification.list({
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: notification.id,
      type: ChangeNotificationType.slate_version_created,
      slateId: slate.id,
      slateVersionId: slate.currentVersion.id,
      createdAt: expect.any(Date)
    });
  });
});

describe('changeNotification:get E2E', () => {
  const f = fixtures(testDb);

  it('returns a single change notification by ID', async () => {
    const { notification, slate } = await f.changeNotification.withSlate();

    const result = await slatesHubClient.changeNotification.get({
      changeNotificationId: notification.id
    });

    expect(result).toMatchObject({
      id: notification.id,
      slateId: slate.id
    });
  });
});
