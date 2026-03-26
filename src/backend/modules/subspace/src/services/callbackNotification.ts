import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCallbackNotificationService = createSubspaceService(
  subspace.callbackDelivery,
  ['get', 'list'],
  () => ({})
);

export let subspaceCallbackNotificationAttemptService = createSubspaceService(
  subspace.callbackDeliveryAttempt,
  ['get', 'list'],
  () => ({})
);

export type SubspaceCallbackNotification = Awaited<
  ReturnType<typeof subspace.callbackDelivery.get>
>;

export type SubspaceCallbackNotificationAttempt = Awaited<
  ReturnType<typeof subspace.callbackDeliveryAttempt.get>
>;
