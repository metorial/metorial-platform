import { v } from '@lowerdeck/validation';
import { tenantIsolationService } from '../../services';
import { app } from './_app';

let presentTenantIsolation = (isolation: {
  enabled: boolean;
  tenantId: string | null;
  identifier: string | null;
}) => ({
  object: 'tenant.isolation' as const,
  enabled: isolation.enabled,
  tenantId: isolation.tenantId,
  identifier: isolation.identifier
});

export let tenantIsolationController = app.controller({
  get: app
    .handler()
    .input(
      v.object({
        tenantId: v.string()
      })
    )
    .do(async ctx => presentTenantIsolation(await tenantIsolationService.get(ctx.input))),

  update: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        enabled: v.boolean()
      })
    )
    .do(async ctx => presentTenantIsolation(await tenantIsolationService.update(ctx.input)))
});
