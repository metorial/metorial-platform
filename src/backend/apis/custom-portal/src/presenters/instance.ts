import type { PortalWithSurface } from '../types/portal';

export let instancePresenter = (d: { portal: PortalWithSurface }) => ({
  object: 'organization.instance' as const,
  id: d.portal.instance.id,
  slug: d.portal.instance.slug,
  name: d.portal.instance.name,
  type: d.portal.instance.type
});
