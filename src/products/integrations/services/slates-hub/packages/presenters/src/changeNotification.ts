import type { ChangeNotification } from '@mtsrc/slates-hub-db/client';

export let changeNotificationPresenter = (changeNotification: ChangeNotification) => ({
  object: 'change_notification',

  id: changeNotification.id,

  type: changeNotification.type,
  slateId: changeNotification.slateId,
  slateVersionId: changeNotification.slateVersionId,

  createdAt: changeNotification.createdAt
});
