import { portalService } from '@metorial/module-portal';

type PortalWithSurface = Awaited<ReturnType<typeof portalService.getPortalPublic>>;

export let portalPresenter = async (d: { portal: PortalWithSurface }) => ({
  object: 'portal' as const,
  id: d.portal.id,
  status: d.portal.status,
  name: d.portal.name,
  slug: d.portal.slug,
  description: d.portal.description
});
