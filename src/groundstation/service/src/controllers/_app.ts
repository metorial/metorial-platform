import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Group } from '@lowerdeck/rpc-server';
import { db } from '../db';

export let app = new Group();

let findOrganization = async (idOrRef: unknown) => {
  if (typeof idOrRef != 'string' || !idOrRef) {
    throw new ServiceError(badRequestError({ message: 'organizationId is required.' }));
  }

  let organization = await db.organization.findFirst({
    where: { OR: [{ id: idOrRef }, { ref: idOrRef }], archivedAt: null }
  });
  if (!organization) throw new ServiceError(notFoundError('organization'));

  return organization;
};

export let organizationApp = app.use(async ctx => ({
  organization: await findOrganization(ctx.body.organizationId)
}));

export let instanceApp = organizationApp.use(async ctx => {
  let idOrRef = ctx.body.instanceId;
  if (typeof idOrRef != 'string' || !idOrRef) {
    throw new ServiceError(badRequestError({ message: 'instanceId is required.' }));
  }

  let instance = await db.instance.findFirst({
    where: {
      OR: [{ id: idOrRef }, { ref: idOrRef }],
      organizationOid: ctx.organization.oid,
      archivedAt: null
    },
    include: { project: true }
  });
  if (!instance) throw new ServiceError(notFoundError('instance'));

  return { instance };
});
