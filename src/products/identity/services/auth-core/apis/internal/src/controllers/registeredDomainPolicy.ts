import { v } from '@lowerdeck/validation';
import { adminService } from '@mtsrc/auth-core-module-admin';
import { registeredDomainPolicyService } from '@mtsrc/auth-core-module-account';
import type { App } from '@mtsrc/auth-core-db';
import { internalApp } from '../_app';

let present = (app: App) => ({
  object: 'ares#registered_domain_policy' as const,
  appId: app.id,
  enabled: app.restrictSignupToRegisteredDomains,
  owner: app.registeredDomainOwner,
  domains: app.registeredDomains
});

export let registeredDomainPolicyController = internalApp.controller({
  get: internalApp
    .handler()
    .input(v.object({ appId: v.string() }))
    .do(async ({ input }) => present(await adminService.getApp({ appId: input.appId }))),

  set: internalApp
    .handler()
    .input(
      v.object({
        appId: v.string(),
        enabled: v.boolean(),
        owner: v.nullable(v.string()),
        domains: v.array(v.string())
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let updated = await registeredDomainPolicyService.setPolicy({
        app,
        input: { enabled: input.enabled, owner: input.owner, domains: input.domains }
      });
      return present(updated);
    })
});
