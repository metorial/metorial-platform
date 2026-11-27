import type { Organization, Project } from '@metorial/db';
import { assertAgentTrackingEnabled } from '@metorial/module-agent-tracking-sync';

export let requireAgentTrackingEnabled =
  (entity?: string) => async (ctx: { organization: Organization; project?: Project }) =>
    await assertAgentTrackingEnabled({
      organization: ctx.organization,
      project: ctx.project,
      entity
    });
