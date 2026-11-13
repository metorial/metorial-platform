import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { billingModes } from '@mtsrc/agent-tracking-spec';
import type { Organization } from '@mtsrc/agent-tracking-db';
import { billingDeclarationService } from '@mtsrc/agent-tracking-module-pricing';
import { billingDeclarationPresenter } from './presenters/billing';
import { organizationApp } from './_app';

let nameSchema = v.string({ modifiers: [v.minLength(1), v.maxLength(200)] });

let reasonSchema = v.nullable(v.string({ modifiers: [v.maxLength(1000)] }));

let idSchema = v.string({ modifiers: [v.minLength(1), v.maxLength(500)] });

let planSchema = v.nullable(v.string({ modifiers: [v.maxLength(200)] }));

let loadDeclaration = (organization: Organization, billingDeclarationId: string) =>
  billingDeclarationService.getBillingDeclarationById({ organization, billingDeclarationId });

export let billingController = organizationApp.controller({
  declarations: organizationApp.controller({
    create: organizationApp
      .handler()
      .input(
        v.object({
          organizationId: v.string(),

          name: nameSchema,
          reason: v.optional(reasonSchema),
          projectId: v.optional(v.nullable(v.string())),
          userId: v.optional(v.nullable(idSchema)),
          agentId: v.optional(v.nullable(idSchema)),
          mode: v.enumOf(billingModes),
          plan: v.optional(planSchema),
          createdBy: v.optional(v.nullable(v.string({ modifiers: [v.maxLength(200)] }))),
          validFrom: v.optional(v.date()),
          validTo: v.optional(v.nullable(v.date()))
        })
      )
      .do(async ctx => {
        let declaration = await billingDeclarationService.createBillingDeclaration({
          organization: ctx.organization,
          input: {
            name: ctx.input.name,
            reason: ctx.input.reason,
            projectId: ctx.input.projectId,
            userId: ctx.input.userId,
            agentId: ctx.input.agentId,
            mode: ctx.input.mode,
            plan: ctx.input.plan,
            createdBy: ctx.input.createdBy,
            validFrom: ctx.input.validFrom,
            validTo: ctx.input.validTo
          }
        });

        return billingDeclarationPresenter(declaration);
      }),

    update: organizationApp
      .handler()
      .input(
        v.object({
          organizationId: v.string(),
          billingDeclarationId: v.string(),

          name: v.optional(nameSchema),
          reason: v.optional(reasonSchema),
          projectId: v.optional(v.nullable(v.string())),
          userId: v.optional(v.nullable(idSchema)),
          agentId: v.optional(v.nullable(idSchema)),
          mode: v.optional(v.enumOf(billingModes)),
          plan: v.optional(planSchema),
          validFrom: v.optional(v.date()),
          validTo: v.optional(v.nullable(v.date()))
        })
      )
      .do(async ctx => {
        let declaration = await loadDeclaration(
          ctx.organization,
          ctx.input.billingDeclarationId
        );

        declaration = await billingDeclarationService.updateBillingDeclaration({
          organization: ctx.organization,
          billingDeclaration: declaration,
          input: {
            name: ctx.input.name,
            reason: ctx.input.reason,
            projectId: ctx.input.projectId,
            userId: ctx.input.userId,
            agentId: ctx.input.agentId,
            mode: ctx.input.mode,
            plan: ctx.input.plan,
            validFrom: ctx.input.validFrom,
            validTo: ctx.input.validTo
          }
        });

        return billingDeclarationPresenter(declaration);
      }),

    archive: organizationApp
      .handler()
      .input(v.object({ organizationId: v.string(), billingDeclarationId: v.string() }))
      .do(async ctx => {
        let declaration = await loadDeclaration(
          ctx.organization,
          ctx.input.billingDeclarationId
        );

        declaration = await billingDeclarationService.archiveBillingDeclaration({
          organization: ctx.organization,
          billingDeclaration: declaration
        });

        return billingDeclarationPresenter(declaration);
      }),

    get: organizationApp
      .handler()
      .input(v.object({ organizationId: v.string(), billingDeclarationId: v.string() }))
      .do(async ctx =>
        billingDeclarationPresenter(
          await loadDeclaration(ctx.organization, ctx.input.billingDeclarationId)
        )
      ),

    list: organizationApp
      .handler()
      .input(
        Paginator.validate(
          v.object({
            organizationId: v.string(),

            projectIds: v.optional(v.array(v.string())),
            userIds: v.optional(v.array(v.string())),
            agentIds: v.optional(v.array(v.string())),
            modes: v.optional(v.array(v.enumOf(billingModes))),
            includeArchived: v.optional(v.boolean())
          })
        )
      )
      .do(async ctx => {
        let paginator = await billingDeclarationService.listBillingDeclarations({
          organization: ctx.organization,
          projectIds: ctx.input.projectIds,
          userIds: ctx.input.userIds,
          agentIds: ctx.input.agentIds,
          modes: ctx.input.modes,
          includeArchived: ctx.input.includeArchived
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, billingDeclarationPresenter);
      })
  })
});
