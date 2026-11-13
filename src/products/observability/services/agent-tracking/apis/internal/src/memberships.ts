import { v } from '@lowerdeck/validation';
import { linkReaches } from '@mtsrc/agent-tracking-module-entities';
import { membershipChangePresenter, membershipImportPresenter } from './presenters/membership';
import { entityService, membershipService } from '@mtsrc/agent-tracking-module-entities';
import { organizationApp } from './_app';

let memberSchema = v.object({
  email: v.optional(v.string()),
  userId: v.optional(v.string()),
  weight: v.optional(v.nullable(v.number({ modifiers: [v.minValue(0), v.maxValue(1)] })))
});

let membershipTypes = ['member_of'] as const;

let reachSchema = v.optional(v.enumOf(linkReaches));

export let membershipsController = organizationApp.controller({
  replace: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        targetId: v.string(),
        type: v.optional(v.enumOf(membershipTypes)),
        members: v.array(memberSchema),

        reach: reachSchema
      })
    )
    .do(async ctx => {
      let target = await entityService.getEntityById({
        organization: ctx.organization,
        entityId: ctx.input.targetId
      });

      let change = await membershipService.replaceMemberships({
        organization: ctx.organization,
        target,
        input: {
          type: ctx.input.type,
          members: ctx.input.members,
          reach: ctx.input.reach ?? 'from_now'
        }
      });

      return membershipChangePresenter(change);
    }),

  update: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        targetId: v.string(),
        type: v.optional(v.enumOf(membershipTypes)),
        add: v.optional(v.array(memberSchema)),
        remove: v.optional(v.array(memberSchema)),

        reach: reachSchema
      })
    )
    .do(async ctx => {
      let target = await entityService.getEntityById({
        organization: ctx.organization,
        entityId: ctx.input.targetId
      });

      let change = await membershipService.updateMemberships({
        organization: ctx.organization,
        target,
        input: {
          type: ctx.input.type,
          add: ctx.input.add ?? [],
          remove: ctx.input.remove ?? [],
          reach: ctx.input.reach ?? 'from_now'
        }
      });

      return membershipChangePresenter(change);
    }),

  import: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        csv: v.string(),
        dryRun: v.optional(v.boolean()),
        kind: v.optional(v.string()),

        reach: reachSchema
      })
    )
    .do(async ctx => {
      let result = await membershipService.importMemberships({
        organization: ctx.organization,
        input: {
          csv: ctx.input.csv,
          dryRun: ctx.input.dryRun ?? true,
          kind: ctx.input.kind,
          reach: ctx.input.reach ?? 'from_now'
        }
      });

      return membershipImportPresenter(result);
    })
});
