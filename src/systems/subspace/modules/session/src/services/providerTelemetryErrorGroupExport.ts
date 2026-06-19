import { Service } from '@lowerdeck/service';
import {
  runProviderTelemetryErrorGroupsExport,
  type ProviderTelemetryErrorGroupsExportDeps
} from '../lib/providerTelemetryErrorGroupExport';

class providerTelemetryErrorGroupExportServiceImpl {
  async runProviderTelemetryErrorGroupsExport(d?: ProviderTelemetryErrorGroupsExportDeps) {
    return await runProviderTelemetryErrorGroupsExport(d);
  }
}

export let providerTelemetryErrorGroupExportService = Service.create(
  'providerTelemetryErrorGroupExport',
  () => new providerTelemetryErrorGroupExportServiceImpl()
).build();
