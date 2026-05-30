import { v } from '@lowerdeck/validation';
import { protoGuardConfigService } from '@metorial-subspace/module-monitor';
import { protoGuardFilterConfigPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let protoGuardConfigController = app.controller({
  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string()
      })
    )
    .do(async ctx =>
      protoGuardFilterConfigPresenter(
        await protoGuardConfigService.listFilters({
          tenant: ctx.tenant
        })
      )
    ),

  setFilterEnabled: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        filterId: v.string(),
        enabled: v.boolean()
      })
    )
    .do(async ctx => {
      await protoGuardConfigService.setTenantFilterEnabled({
        tenant: ctx.tenant,
        filterId: ctx.input.filterId,
        enabled: ctx.input.enabled
      });

      return protoGuardFilterConfigPresenter(
        await protoGuardConfigService.listFilters({ tenant: ctx.tenant })
      );
    }),

  setFilterAlertConfidenceThreshold: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        filterId: v.string(),
        threshold: v.nullable(v.number())
      })
    )
    .do(async ctx => {
      await protoGuardConfigService.setTenantFilterAlertConfidenceThreshold({
        tenant: ctx.tenant,
        filterId: ctx.input.filterId,
        threshold: ctx.input.threshold
      });

      return protoGuardFilterConfigPresenter(
        await protoGuardConfigService.listFilters({ tenant: ctx.tenant })
      );
    }),

  setAlertFilterCountThreshold: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        threshold: v.nullable(v.number())
      })
    )
    .do(async ctx => {
      await protoGuardConfigService.setTenantAlertFilterCountThreshold({
        tenant: ctx.tenant,
        threshold: ctx.input.threshold
      });

      return protoGuardFilterConfigPresenter(
        await protoGuardConfigService.listFilters({ tenant: ctx.tenant })
      );
    })
});
