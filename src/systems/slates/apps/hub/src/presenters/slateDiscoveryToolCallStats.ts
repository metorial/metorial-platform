export let slateDiscoveryToolCallStatsPresenter = (stats: {
  total: number;
  succeeded: number;
  failed: number;
  byTool: Record<string, { total: number; succeeded: number; failed: number }>;
}) => ({
  object: 'slate.discovery.tool_call_stats',
  total: stats.total,
  succeeded: stats.succeeded,
  failed: stats.failed,
  byTool: stats.byTool
});
