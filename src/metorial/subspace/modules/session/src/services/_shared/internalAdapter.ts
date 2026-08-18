import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { db, type Environment, type Session, type Tenant } from '@metorial-subspace/db';

export type InternalAdapterInput = { identifier: string };

export let resolveInternalAdapter = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapter: InternalAdapterInput;
}) => {
  let adapter = await db.providerAdapterGlobal.findUnique({
    where: { identifier: d.adapter.identifier }
  });
  if (!adapter) {
    throw new ServiceError(notFoundError('provider.adapter', d.adapter.identifier));
  }

  return adapter;
};

export let assertInternalAdapterSupportedBySession = async (d: {
  session: Pick<Session, 'oid'>;
  adapterGlobalOid: bigint;
}) => {
  let sessionProviders = await db.sessionProvider.findMany({
    where: { sessionOid: d.session.oid, status: 'active' },
    include: {
      deployment: {
        include: {
          currentVersion: true,
          providerVariant: true
        }
      }
    }
  });

  let versionOids = sessionProviders
    .map(
      provider =>
        provider.deployment.currentVersion?.lockedVersionOid ??
        provider.deployment.providerVariant.currentVersionOid
    )
    .filter((oid): oid is bigint => oid != null);

  let supported = versionOids.length
    ? await db.providerVersionAdapter.findFirst({
        where: {
          providerVersionOid: { in: versionOids },
          adapter: { globalOid: d.adapterGlobalOid }
        },
        select: { oid: true }
      })
    : null;

  if (!supported) {
    throw new ServiceError(
      badRequestError({
        code: 'internal_adapter_not_supported',
        message: 'None of the session provider versions support the requested adapter.'
      })
    );
  }
};

export let assertSessionInternalAdapter = async (d: {
  session: Pick<Session, 'isInternal' | 'adapterGlobalOid'>;
  adapter?: InternalAdapterInput;
}) => {
  if (!d.session.isInternal) {
    if (d.adapter) {
      throw new ServiceError(
        badRequestError({
          code: 'adapter_not_allowed_for_ordinary_session',
          message: 'An adapter may only be supplied when accessing an internal session.'
        })
      );
    }
    return null;
  }

  if (!d.adapter || !d.session.adapterGlobalOid) {
    throw new ServiceError(
      badRequestError({
        code: 'internal_session_adapter_required',
        message: 'The adapter bound to this internal session must be supplied.'
      })
    );
  }

  let adapter = await db.providerAdapterGlobal.findUnique({
    where: { identifier: d.adapter.identifier }
  });
  if (!adapter || adapter.oid !== d.session.adapterGlobalOid) {
    throw new ServiceError(
      badRequestError({
        code: 'internal_session_adapter_mismatch',
        message: 'The supplied adapter does not match the adapter bound to this session.'
      })
    );
  }

  return adapter;
};

export let assertInternalSessionMutable = (
  session: Pick<Session, 'isInternal'>,
  action: string,
  allow = false
) => {
  if (!session.isInternal || allow) return;

  throw new ServiceError(
    badRequestError({
      code: 'internal_session_readonly',
      message: `Cannot ${action} an internal session.`
    })
  );
};
