import {
  addAfterTransactionHook,
  type Environment,
  getId,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';
import { sessionCreatedQueue } from '../../queues/lifecycle/session';
import { sessionProviderInclude } from '../sessionProvider';
import {
  type SessionProviderInput,
  sessionProviderInputService
} from '../sessionProviderInput';

export let sessionInclude = {
  identityActor: true,
  identity: true,
  providers: {
    include: sessionProviderInclude,
    where: { status: 'active' as const }
  }
};

export let createSessionRecord = async (d: {
  tenant: Tenant;
  environment: Environment;
  identityActorOid?: bigint | null;
  identityOid?: bigint | null;
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
  let solution = await getMetorialSolution();

  return withTransaction(async db => {
    let templateId = d.input.providers.find(
      provider => provider.sessionTemplateId
    )?.sessionTemplateId;
    let templateIdentity =
      d.identityActorOid === undefined && d.identityOid === undefined && templateId
        ? await db.sessionTemplate.findFirst({
            where: {
              id: templateId,
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              status: 'active'
            },
            select: {
              identityActorOid: true,
              identityOid: true
            }
          })
        : null;

    let session = await db.session.create({
      data: {
        ...getId('session'),
        status: 'active',

        isEphemeral: d.isEphemeral,

        name: d.input.name?.trim() || undefined,
        description: d.input.description?.trim() || undefined,
        metadata: d.input.metadata,
        privateMetadata: d.input.privateMetadata,

        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        identityActorOid: d.identityActorOid ?? templateIdentity?.identityActorOid ?? null,
        identityOid: d.identityOid ?? templateIdentity?.identityOid ?? null,
        ephemeralManagedSessionOid: d.ephemeralManagedSessionOid ?? undefined,

        sessionEvents: {
          create: {
            ...getId('sessionEvent'),
            type: 'session_created',
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid
          }
        }
      },
      include: sessionInclude
    });

    session.providers = await sessionProviderInputService.createSessionProvidersForInput({
      tenant: d.tenant,
      environment: d.environment,
      session,
      providers: d.input.providers
    });

    await addAfterTransactionHook(async () =>
      sessionCreatedQueue.add({ sessionId: session.id })
    );

    return session;
  });
};
