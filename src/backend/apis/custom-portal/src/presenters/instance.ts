import { portalService } from '@metorial/module-portal';

type PortalWithSurface = Awaited<ReturnType<typeof portalService.getPortalPublic>>;

export let presentInstance = (d: { portal: PortalWithSurface }) => ({
  object: 'organization.instance' as const,
  id: d.portal.instance.id,
  slug: d.portal.instance.slug,
  name: d.portal.instance.name,
  type: d.portal.instance.type
});
