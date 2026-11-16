import { uniqueId } from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { getId, type Session } from '@metorial-subspace/db';
import { subspaceScopeService } from '@metorial-subspace/module-tenant';

export let loadScope = async (instanceId: string) => {
  let scope = await subspaceScopeService.ensureForInstanceUncached({ id: instanceId });
  let tenant = await subspaceDb.tenant.findUniqueOrThrow({ where: { oid: scope.tenant.oid } });
  let solution = await subspaceScopeService.getSolution();

  return { ...scope, tenant, solution };
};

export type Scope = Awaited<ReturnType<typeof loadScope>>;

let scopeColumns = (scope: Scope) => ({
  tenantOid: scope.tenant.oid,
  projectOid: scope.tenant.projectOid,
  environmentOid: scope.environment.oid,
  instanceOid: scope.environment.instanceOid,
  solutionOid: scope.solution.oid
});

export let seedSession = (scope: Scope, data: { isInternal?: boolean } = {}) =>
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
  data: { code: string; message?: string; createdAt?: Date }
) =>
  subspaceDb.sessionError.create({
    data: {
      ...getId('sessionError'),
      ...scopeColumns(scope),
      sessionOid: session.oid,
      type: 'message_processing_timeout',
      message: 'E2E provider issue',
      isProcessing: false,
      ...data
    }
  });

export let uniqueCode = () => uniqueId('e2e_issue').replace(/[^a-z0-9_]/gi, '_');
