import type { FilePurpose } from '../../prisma/generated/client';

export let filePurposePresenter = (purpose: FilePurpose) => ({
  object: 'cargo#filePurpose',
  id: purpose.id,
  slug: purpose.slug,
  name: purpose.name,
  ownerType: purpose.ownerType,
  canHaveLinks: purpose.canHaveLinks,
  createdAt: purpose.createdAt
});
