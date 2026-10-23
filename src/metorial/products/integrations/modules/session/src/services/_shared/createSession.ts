import {
  addAfterTransactionHook,
  type Environment,
  getId,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { recordSessionCreatedUsage } from '@metorial/module-usage';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';
import { sessionProviderInclude } from '../sessionProvider';
import {
  type SessionProviderInput,
  sessionProviderInputService
} from '../sessionProviderInput';

export let sessionInclude = {
  identityActor: true,
  identity: true,
  adapterGlobal: true,
  providers: {
    include: sessionProviderInclude,
    where: { status: 'active' as const }
  }
};

export let resolveSessionRecordProviders = async (d: {
  tenant: Tenant;
  environment: Environment;
  providers: SessionProviderInput[];
}) => {
  let resolved = await sessionProviderInputService.resolveProviderSessionInput(d);

  let templateId = d.providers.find(provider => provider.sessionTemplateId)?.sessionTemplateId;
  let template = templateId ? (resolved.templates.get(templateId) ?? null) : null;

  return { providers: resolved.providers, template };
};

export type ResolvedSessionRecordProviders = Awaited<
  ReturnType<typeof resolveSessionRecordProviders>
>;

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
  resolvedProviders?: ResolvedSessionRecordProviders;
  isEphemeral: boolean;
  isInternal?: boolean;
  adapterGlobalOid?: bigint | null;
  ephemeralManagedSessionOid?: bigint | null;
}) => {
  let solution = await getMetorialSolution();

  let resolved =
    d.resolvedProviders ??
    (await resolveSessionRecordProviders({
      tenant: d.tenant,
      environment: d.environment,
      providers: d.input.providers
    }));

  let templateIdentity =
    d.identityActorOid === undefined && d.identityOid === undefined ? resolved.template : null;

  return withTransaction(async db => {
    let created = await db.session.create({
      data: {
        ...getId('session'),
        status: 'active',

        isEphemeral: d.isEphemeral,
        isInternal: d.isInternal ?? false,
        adapterGlobalOid: d.adapterGlobalOid ?? null,

        name: d.input.name?.trim() || undefined,
        description: d.input.description?.trim() || undefined,
        metadata: d.input.metadata,
        privateMetadata: d.input.privateMetadata,

        dataRetentionLevel: d.tenant.dataRetentionLevel,
        storeToolCallAttachments: d.tenant.storeToolCallAttachments,
        collectErrors: d.tenant.collectErrors,

        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid,
        identityActorOid: d.identityActorOid ?? templateIdentity?.identityActorOid ?? null,
        identityOid: d.identityOid ?? templateIdentity?.identityOid ?? null,
        ephemeralManagedSessionOid: d.ephemeralManagedSessionOid ?? undefined,

        ...(d.isInternal
          ? {}
          : {
              sessionEvents: {
                create: {
                  ...getId('sessionEvent'),
                  type: 'session_created',
                  tenantOid: d.tenant.oid,
                  projectOid: d.tenant.projectOid,
                  solutionOid: solution.oid,
                  environmentOid: d.environment.oid,
                  instanceOid: d.environment.instanceOid
                }
              }
            })
      },
      include: {
        identityActor: true,
        identity: true,
        adapterGlobal: true
      }
    });

    let providers = await sessionProviderInputService.createSessionProvidersForInput({
      tenant: d.tenant,
      environment: d.environment,
      session: created,
      providers: d.input.providers,
      resolvedProviders: resolved.providers,
      isNewSession: true
    });

    await addAfterTransactionHook(() => recordSessionCreatedUsage(created));

    return { ...created, providers };
  });
};
