import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import type { Instance, Project, StoreParticipantRole } from '@metorial/db';
import { withTransaction } from '@metorial/db';
import {
  type AnyAccessTagSelector,
  getStoreResourceKindAccessWhere,
  registerStoreResourceKind,
  type ResourceAuthorization,
  skillStoreResourceKind,
  storeAccessGrantService,
  type StoreResourceAccessLevel,
  type StoreResourceKind,
  unregisterStoreResourceKind
} from '@metorial/module-access';
import { storeParticipantService } from '../services/storeParticipant';

type StoreRef = { oid: bigint };

let getGrantStore = async (store: StoreRef) => {
  let record = await withTransaction(
    async db =>
      await db.store.findUnique({
        where: { oid: store.oid },
        select: { oid: true, project: { select: { organizationOid: true } } }
      }),
    { ifExists: true }
  );
  if (!record) throw new ServiceError(notFoundError('store'));

  return { oid: record.oid, organizationOid: record.project.organizationOid };
};

export let defineStoreResource = (kind: StoreResourceKind) => {
  registerStoreResourceKind(kind);

  let accessWhere = (d: {
    accessTags?: AnyAccessTagSelector;
    level: StoreResourceAccessLevel;
  }) => getStoreResourceKindAccessWhere({ kind, ...d });

  let hasAccess = async (d: {
    store: StoreRef;
    authorization: ResourceAuthorization;
    level: StoreResourceAccessLevel;
  }) => {
    if (d.authorization.type == 'privileged') return true;

    let where = await accessWhere({ accessTags: d.authorization.accessTags, level: d.level });
    let store = await withTransaction(
      async db =>
        await db.store.findFirst({
          where: { oid: d.store.oid, AND: [where] },
          select: { oid: true }
        }),
      { ifExists: true }
    );

    return !!store;
  };

  return {
    kind,

    accessWhere,
    hasAccess,

    assertAccess: async (d: Parameters<typeof hasAccess>[0]) => {
      if (await hasAccess(d)) return;

      throw new ServiceError(
        forbiddenError({ message: `You do not have ${d.level} access to this ${kind.kind}.` })
      );
    },

    listGrants: async (d: { store: StoreRef }) =>
      await storeAccessGrantService.listGrants({
        store: await getGrantStore(d.store),
        access: kind.access
      }),

    setAccessLevel: async (d: {
      store: StoreRef;
      accessTagOids: bigint[];
      level: StoreResourceAccessLevel | 'none';
    }) =>
      await storeAccessGrantService.setAccessLevel({
        store: await getGrantStore(d.store),
        access: kind.access,
        accessTagOids: d.accessTagOids,
        level: d.level
      }),

    grantAccessLevel: async (d: {
      store: StoreRef;
      accessTagOids: bigint[];
      level: StoreResourceAccessLevel;
    }) =>
      await storeAccessGrantService.grantAccessLevel({
        store: await getGrantStore(d.store),
        access: kind.access,
        accessTagOids: d.accessTagOids,
        level: d.level
      }),

    participants: {
      record: async (d: {
        store: StoreRef;
        actor: { oid: bigint };
        roles?: StoreParticipantRole[];
      }) => await storeParticipantService.recordParticipationSafely(d),

      list: async (d: { project: Project; instance: Instance; store: StoreRef }) =>
        await storeParticipantService.listStoreResourceParticipants(d),

      get: async (d: {
        project: Project;
        instance: Instance;
        store: StoreRef;
        participantId: string;
      }) => await storeParticipantService.getStoreResourceParticipantById(d)
    },

    unregister: () => unregisterStoreResourceKind(kind)
  };
};

export type StoreResource = ReturnType<typeof defineStoreResource>;

export let skillStoreResource = defineStoreResource(skillStoreResourceKind);
