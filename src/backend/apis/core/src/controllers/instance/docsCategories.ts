import { createCategory } from '@metorial/rest';

export let fileCollectionDocsCategory = createCategory({
  id: 'file-collection',
  name: 'File Collections',
  indexHint: 18
});

export let portalDocsCategory = createCategory({
  id: 'portal',
  name: 'Portals',
  indexHint: 19
});
