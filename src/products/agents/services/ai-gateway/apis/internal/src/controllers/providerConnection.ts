import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerConnectionService,
  type ConnectionScope
} from '@mtsrc/ai-gateway-module-credentials';
import type { Instance, Organization } from '@mtsrc/ai-gateway-db';
import { connectionPricingOverrideSchema } from '@mtsrc/ai-gateway-spec';
import { providerConnectionPresenter } from '../presenters/providerConnection';
import { app, instanceApp } from './_app';

let connectionStatuses = ['pending', 'valid', 'invalid', 'disabled'] as const;

let credentialsSchema = v.record(v.string({ modifiers: [v.maxLength(8192)] }));

let configSchema = v.record(v.union([v.string(), v.number(), v.boolean()]));

let featuresSchema = v.record(v.boolean());

let createFields = {
  providerSlug: v.string(),
  name: v.string({ modifiers: [v.minLength(1), v.maxLength(200)] }),
  description: v.optional(v.nullable(v.string({ modifiers: [v.maxLength(2000)] }))),
  priority: v.optional(
    v.number({ modifiers: [v.integer(), v.minValue(-1000), v.maxValue(1000)] })
  ),
  credentials: credentialsSchema,
  config: v.optional(configSchema),
  features: v.optional(featuresSchema),
  pricingOverride: v.optional(v.nullable(connectionPricingOverrideSchema))
};

let updateFields = {
  connectionId: v.string(),
  name: v.optional(createFields.name),
  description: createFields.description,
  priority: createFields.priority,
  credentials: v.optional(credentialsSchema),
  config: v.optional(configSchema),
  features: createFields.features,
  pricingOverride: createFields.pricingOverride
};

let listFields = {
  providerSlug: v.optional(v.string()),
  status: v.optional(v.array(v.enumOf(connectionStatuses)))
};

let customerScope = (ctx: {
  organization: Organization;
  instance: Instance;
}): ConnectionScope => ({
  organization: ctx.organization,
  instance: ctx.instance
});

let getConnection = async (scope: ConnectionScope, connectionId: string) =>
  await providerConnectionService.getConnectionById({ scope, connectionId });

let scopeIds = { organizationId: v.string(), instanceId: v.string() };

export let providerConnectionController = app.controller({
  create: instanceApp
    .handler()
    .input(v.object({ ...scopeIds, ...createFields }))
    .do(async ctx => {
      let connection = await providerConnectionService.createConnection({
        scope: customerScope(ctx),
        input: ctx.input
      });

      return providerConnectionPresenter(connection);
    }),

  get: instanceApp
    .handler()
    .input(v.object({ ...scopeIds, connectionId: v.string() }))
    .do(async ctx =>
      providerConnectionPresenter(
        await getConnection(customerScope(ctx), ctx.input.connectionId)
      )
    ),

  list: instanceApp
    .handler()
    .input(Paginator.validate(v.object({ ...scopeIds, ...listFields })))
    .do(async ctx => {
      let paginator = await providerConnectionService.listConnections({
        scope: customerScope(ctx),
        providerSlug: ctx.input.providerSlug,
        status: ctx.input.status
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerConnectionPresenter);
    }),

  update: instanceApp
    .handler()
    .input(v.object({ ...scopeIds, ...updateFields }))
    .do(async ctx => {
      let connection = await providerConnectionService.updateConnection({
        connection: await getConnection(customerScope(ctx), ctx.input.connectionId),
        input: ctx.input
      });

      return providerConnectionPresenter(connection);
    }),

  check: instanceApp
    .handler()
    .input(v.object({ ...scopeIds, connectionId: v.string() }))
    .do(async ctx => {
      let connection = await providerConnectionService.checkConnection({
        connection: await getConnection(customerScope(ctx), ctx.input.connectionId)
      });

      return providerConnectionPresenter(connection);
    }),

  setEnabled: instanceApp
    .handler()
    .input(v.object({ ...scopeIds, connectionId: v.string(), enabled: v.boolean() }))
    .do(async ctx => {
      let connection = await providerConnectionService.setConnectionEnabled({
        connection: await getConnection(customerScope(ctx), ctx.input.connectionId),
        enabled: ctx.input.enabled
      });

      return providerConnectionPresenter(connection);
    }),

  archive: instanceApp
    .handler()
    .input(v.object({ ...scopeIds, connectionId: v.string() }))
    .do(async ctx => {
      let connection = await providerConnectionService.archiveConnection({
        connection: await getConnection(customerScope(ctx), ctx.input.connectionId)
      });

      return providerConnectionPresenter(connection);
    })
});
