import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceBucketService = createSubspaceService(
  subspace.bucket,
  ['get', 'list', 'getEditorUrl', 'getFile', 'getFiles', 'getZipUrl', 'putFile'],
  () => ({})
);

export type SubspaceBucket = Awaited<ReturnType<typeof subspace.bucket.get>>;
