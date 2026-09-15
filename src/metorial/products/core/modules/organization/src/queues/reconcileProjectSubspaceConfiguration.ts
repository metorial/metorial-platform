import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { tenantService } from '@metorial-subspace/module-tenant';

export let RECONCILE_PROJECT_SUBSPACE_CONFIGURATION_BATCH_SIZE = 500;

export let reconcileProjectSubspaceConfigurationCron = createCron(
  {
    name: 'org/projectSubspaceConfiguration/reconcile/cron',
    cron: '0 4 * * *'
  },
  async () => {
    await reconcileProjectSubspaceConfigurationManyQueue.add(
      {},
      { id: 'org-project-subspace-configuration-reconcile' }
    );
  }
);

export let reconcileProjectSubspaceConfigurationManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'org/projectSubspaceConfiguration/reconcile/many',
  workerOpts: { concurrency: 1 }
});

void reconcileProjectSubspaceConfigurationManyQueue.add(
  {},
  { id: 'org-project-subspace-configuration-reconcile' }
);

export let reconcileProjectSubspaceConfigurationManyQueueProcessor =
  reconcileProjectSubspaceConfigurationManyQueue.process(async data => {
    let projects = await db.project.findMany({
      where: {
        status: 'active',
        subspaceTenantId: { not: null },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_PROJECT_SUBSPACE_CONFIGURATION_BATCH_SIZE,
      select: { id: true }
    });
    if (projects.length === 0) return;

    console.log(`Reconciling subspace configuration for ${projects.length} projects...`);

    await reconcileProjectSubspaceConfigurationSingleQueue.addManyWithOps(
      projects.map(project => ({
        data: { projectId: project.id },
        opts: { id: `project-subspace-configuration-${project.id}` }
      }))
    );

    if (projects.length === RECONCILE_PROJECT_SUBSPACE_CONFIGURATION_BATCH_SIZE) {
      await reconcileProjectSubspaceConfigurationManyQueue.add({
        cursor: projects[projects.length - 1]!.id
      });
    }
  });

export let reconcileProjectSubspaceConfigurationSingleQueue = createQueue<{
  projectId: string;
}>({
  name: 'org/projectSubspaceConfiguration/reconcile/single',
  workerOpts: { concurrency: 5 }
});

export let reconcileProjectSubspaceConfigurationSingleQueueProcessor =
  reconcileProjectSubspaceConfigurationSingleQueue.process(async data => {
    let project = await db.project.findUnique({
      where: { id: data.projectId }
    });
    if (!project || project.status !== 'active' || !project.subspaceTenantId) return;

    let tenant = await tenantService.getTenantById({ id: project.subspaceTenantId });
    let hasDrift =
      project.allowAuthConfigExport !== tenant.allowAuthConfigExport ||
      project.allowAuthConfigImport !== tenant.allowAuthConfigImport ||
      project.onlyAllowOAuthAuthMethods !== tenant.onlyAllowOAuthAuthMethods ||
      project.dataRetentionLevel !== tenant.dataRetentionLevel ||
      project.storeToolCallAttachments !== tenant.storeToolCallAttachments ||
      project.collectErrors !== tenant.collectErrors ||
      project.disableCallbacks !== tenant.disableCallbacks ||
      project.collectOperationDescriptionForToolCalls !==
        tenant.collectOperationDescriptionForToolCalls ||
      project.messageProcessingTimeoutMs !== tenant.messageProcessingTimeoutMs ||
      project.useIntegrationNamesForSessionProviderNameTemplates !==
        tenant.useIntegrationNamesForSessionProviderNameTemplates;
    if (!hasDrift) return;

    await db.project.update({
      where: { oid: project.oid },
      data: {
        allowAuthConfigExport: tenant.allowAuthConfigExport,
        allowAuthConfigImport: tenant.allowAuthConfigImport,
        onlyAllowOAuthAuthMethods: tenant.onlyAllowOAuthAuthMethods,
        dataRetentionLevel: tenant.dataRetentionLevel,
        storeToolCallAttachments: tenant.storeToolCallAttachments,
        collectErrors: tenant.collectErrors,
        disableCallbacks: tenant.disableCallbacks,
        collectOperationDescriptionForToolCalls:
          tenant.collectOperationDescriptionForToolCalls,
        messageProcessingTimeoutMs: tenant.messageProcessingTimeoutMs,
        useIntegrationNamesForSessionProviderNameTemplates:
          tenant.useIntegrationNamesForSessionProviderNameTemplates
      }
    });
  });

export let reconcileProjectSubspaceConfigurationProcessors = combineQueueProcessors([
  reconcileProjectSubspaceConfigurationCron,
  reconcileProjectSubspaceConfigurationManyQueueProcessor,
  reconcileProjectSubspaceConfigurationSingleQueueProcessor
]);
