import type { ChangeNotification } from '../../prisma/generated/client';

export let changeNotificationPresenter = (changeNotification: ChangeNotification) => ({
  object: 'change_notification',

  id: changeNotification.id,
  type: changeNotification.type,

  slate: {
    id: changeNotification.slateId,
    identifier: changeNotification.slateIdentifier,
    fullIdentifier: changeNotification.slateFullIdentifier
  },

  slateVersion: changeNotification.slateVersionId
    ? {
        id: changeNotification.slateVersionId,
        identifier: changeNotification.slateVersionIdentifier,
        slateId: changeNotification.slateId
      }
    : null,

  createdAt: changeNotification.createdAt
});
