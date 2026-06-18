import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { runProviderTelemetryErrorGroupsExport } from '../services/providerTelemetryErrorGroupExport';

export let providerTelemetryErrorGroupsExportQueue = createQueue<{}>({
  name: 'sub/ses/provider-error-groups/export',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

let providerTelemetryErrorGroupsExportCron = createCron(
  {
    name: 'sub/ses/provider-error-groups/export/cron',
    cron: '*/15 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await providerTelemetryErrorGroupsExportQueue.add(
      {},
      { id: 'provider-telemetry-error-groups-export' }
    );
  }
);

let providerTelemetryErrorGroupsExportQueueProcessor =
  providerTelemetryErrorGroupsExportQueue.process(async () => {
    await runProviderTelemetryErrorGroupsExport();
  });

export let providerTelemetryErrorGroupsExportProcessors = combineQueueProcessors([
  providerTelemetryErrorGroupsExportCron,
  providerTelemetryErrorGroupsExportQueueProcessor
]);
