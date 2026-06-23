import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderSpecificationChangeNotificationService = createSubspaceService(
  subspace.providerSpecificationChangeNotification,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderSpecificationChangeNotification = Awaited<
  ReturnType<typeof subspace.providerSpecificationChangeNotification.get>
>;
