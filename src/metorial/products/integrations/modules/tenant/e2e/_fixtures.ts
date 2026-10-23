import { subspaceDb } from '@metorial/e2e/db';
import { getId, type Prisma, type Session, type Tenant } from '@metorial-subspace/db';
import { subspaceScopeService, tenantService } from '../src';

type TenantInput = Parameters<typeof tenantService.upsertTenant>[0]['input'];

export let loadScope = async (instanceId: string) => {
  let scope = await subspaceScopeService.ensureForInstanceUncached({ id: instanceId });
  let tenant = await subspaceDb.tenant.findUniqueOrThrow({ where: { oid: scope.tenant.oid } });
  let solution = await subspaceScopeService.getSolution();

  return { ...scope, tenant, solution };
};

export type Scope = Awaited<ReturnType<typeof loadScope>>;

export let updateTenant = (tenant: Tenant, input: Partial<TenantInput>) =>
  tenantService.upsertTenant({
    input: {
      name: tenant.name,
      identifier: tenant.identifier,
      resourceTenantId: tenant.resourceTenantId!,
      resourceTenantIdentifier: tenant.resourceTenantIdentifier!,
      environments: [],
      ...input
    }
  });

let scopeColumns = (scope: Scope) => ({
  tenantOid: scope.tenant.oid,
  projectOid: scope.tenant.projectOid,
  environmentOid: scope.environment.oid,
  instanceOid: scope.environment.instanceOid,
  solutionOid: scope.solution.oid
});

export let daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

export let seedSession = (
  scope: Scope,
  data: Partial<
    Pick<
      Prisma.SessionUncheckedCreateInput,
      'status' | 'dataRetentionLevel' | 'collectErrors' | 'storeToolCallAttachments'
    >
  > = {}
) =>
  subspaceDb.session.create({
    data: {
      ...getId('session'),
      ...scopeColumns(scope),
      status: 'active',
      isEphemeral: false,
      ...data
    }
  });

export let seedSessionError = (
  scope: Scope,
  session: Session,
  data: { createdAt: Date; isProcessing: boolean }
) =>
  subspaceDb.sessionError.create({
    data: {
      ...getId('sessionError'),
      ...scopeColumns(scope),
      sessionOid: session.oid,
      type: 'message_processing_timeout',
      code: 'e2e_error',
      message: 'E2E session error',
      ...data
    }
  });

export let seedSessionRecords = async (scope: Scope, session: Session, createdAt: Date) => {
  let event = await subspaceDb.sessionEvent.create({
    data: {
      ...getId('sessionEvent'),
      ...scopeColumns(scope),
      sessionOid: session.oid,
      type: 'session_created',
      createdAt
    }
  });
  let warning = await subspaceDb.sessionWarning.create({
    data: {
      ...getId('sessionWarning'),
      ...scopeColumns(scope),
      sessionOid: session.oid,
      code: 'e2e_warning',
      message: 'E2E session warning',
      createdAt
    }
  });
  let error = await seedSessionError(scope, session, { createdAt, isProcessing: false });

  return { eventOid: event.oid, warningOid: warning.oid, errorOid: error.oid };
};

export let countSessionRecords = async (records: {
  eventOid: bigint;
  warningOid: bigint;
  errorOid: bigint;
}) => ({
  events: await subspaceDb.sessionEvent.count({ where: { oid: records.eventOid } }),
  warnings: await subspaceDb.sessionWarning.count({ where: { oid: records.warningOid } }),
  errors: await subspaceDb.sessionError.count({ where: { oid: records.errorOid } })
});
