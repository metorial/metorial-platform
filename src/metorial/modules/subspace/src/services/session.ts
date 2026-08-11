import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionService = createSubspaceService(
  subspace.session,
  ['get', 'getMany', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceSession = Awaited<ReturnType<typeof subspace.session.get>> & {
  clientSecret?: string | null;
  magicMcpServer?: any;
  magicMcpSession?: any;
};
