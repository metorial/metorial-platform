import { portalService } from '@metorial/module-consumer';

type PortalWithSurface = Awaited<ReturnType<typeof portalService.getPortalPublic>>;

export let portalPresenter = async (d: { portal: PortalWithSurface }) => ({
  object: 'portal' as const,
  id: d.portal.id,
  status: d.portal.status,
  name: d.portal.name,
  slug: d.portal.slug,
  instanceId: d.portal.instance.id,
  projectId: d.portal.instance.project.id,
  organizationId: d.portal.organization.id,
  description: d.portal.description,
  allowConsumerSkillAuthoring: d.portal.surface.allowConsumerSkillAuthoring,
  allowConsumerSkillPublishing: d.portal.surface.allowConsumerSkillPublishing
});
