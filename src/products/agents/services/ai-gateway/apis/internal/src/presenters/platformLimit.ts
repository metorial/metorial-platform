import type { Organization, Project } from '@mtsrc/ai-gateway-db';
import type { PlatformLimitEventDrain } from '@mtsrc/ai-gateway-module-limits';
import { projectRestrictionsPresenter } from './scope';

export let platformLimitTargetPresenter = (
  project: Project & { organization: Organization }
) => ({
  object: 'ai_gateway#platform_limit_target',

  id: project.id,
  ref: project.ref,

  organizationId: project.organization.id,
  organizationRef: project.organization.ref,

  platformLimits: project.platformLimits,
  platformLimitsSyncedAt: project.platformLimitsSyncedAt,
  ...projectRestrictionsPresenter(project)
});

export let platformLimitEventsPresenter = (drain: PlatformLimitEventDrain) => ({
  object: 'ai_gateway#platform_limit_events',

  trips: drain.trips,
  usage: drain.usage
});
