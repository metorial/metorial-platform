import type { RebuildRunWithRelations } from '@mtsrc/agent-tracking-module-rebuild';

export let rebuildRunPresenter = (rebuildRun: RebuildRunWithRelations) => ({
  object: 'agent_tracking#rebuild_run',

  id: rebuildRun.id,
  status: rebuildRun.status,
  layers: rebuildRun.layers,
  reason: rebuildRun.reason,

  organizationId: rebuildRun.organization.id,
  scope: {
    projectId: rebuildRun.project?.id ?? rebuildRun.instance?.project.id ?? null,
    instanceId: rebuildRun.instance?.id ?? null
  },
  range: { from: rebuildRun.rangeFrom, to: rebuildRun.rangeTo },

  progress: { processed: rebuildRun.processed, total: rebuildRun.total },
  error: rebuildRun.error,

  completedAt: rebuildRun.completedAt,
  createdAt: rebuildRun.createdAt,
  updatedAt: rebuildRun.updatedAt
});
