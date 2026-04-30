import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { sessionCreatedQueue } from '../../queues/lifecycle/session';
import { sessionProviderInclude } from '../sessionProvider';
import {
  type SessionProviderInput,
  sessionProviderInputService
} from '../sessionProviderInput';

export let sessionInclude = {
  providers: {
    include: sessionProviderInclude,
    where: { status: 'active' as const }
  }
};

export let createSessionRecord = async (d: {
  db: {
    session: typeof db.session;
  };
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    providers: SessionProviderInput[];
  };
  isEphemeral: boolean;
  ephemeralManagedSessionOid?: bigint | null;
}) => {
  let session = await d.db.session.create({
    data: {
      ...getId('session'),
      status: 'active',

      isEphemeral: d.isEphemeral,

      name: d.input.name?.trim() || undefined,
      description: d.input.description?.trim() || undefined,
      metadata: d.input.metadata,
      privateMetadata: d.input.privateMetadata,

      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid,
      ephemeralManagedSessionOid: d.ephemeralManagedSessionOid ?? undefined,

      sessionEvents: {
        create: {
          ...getId('sessionEvent'),
          type: 'session_created',
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      }
    },
    include: sessionInclude
  });

  session.providers = await sessionProviderInputService.createSessionProvidersForInput({
    tenant: d.tenant,
    solution: d.solution,
    environment: d.environment,
    session,
    providers: d.input.providers
  });

  await addAfterTransactionHook(async () =>
    sessionCreatedQueue.add({ sessionId: session.id })
  );

  return session;
};
