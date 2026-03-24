import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeNotificationType } from '../../../../prisma/generated/client';
import { testDb, cleanDatabase } from '../../../test/setup';
import { fixtures } from '../../../test/fixtures';
import { slatesHubClient } from '../../../test/client';

describe('changeNotification:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

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
      object: 'change_notification',
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

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single change notification by ID', async () => {
    const { notification, slate } = await f.changeNotification.withSlate();

    const result = await slatesHubClient.changeNotification.get({
      changeNotificationId: notification.id
    });

    expect(result).toMatchObject({
      object: 'change_notification',
      id: notification.id,
      slateId: slate.id
    });
  });
});
