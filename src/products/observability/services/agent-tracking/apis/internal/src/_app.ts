import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Group } from '@lowerdeck/rpc-server';
import { instanceService, organizationService } from '@mtsrc/agent-tracking-module-scope';

export let app = new Group();

let requireIdOrRef = (value: unknown, field: string) => {
  if (typeof value != 'string' || !value) {
    throw new ServiceError(badRequestError({ message: `${field} is required.` }));
  }

  return value;
};

export let organizationApp = app.use(async ctx => ({
  organization: await organizationService.getOrganizationById({
    organizationId: requireIdOrRef(ctx.body.organizationId, 'organizationId')
  })
}));

export let instanceApp = organizationApp.use(async ctx => ({
  instance: await instanceService.getInstanceById({
    organization: ctx.organization,
    instanceId: requireIdOrRef(ctx.body.instanceId, 'instanceId')
  })
}));
