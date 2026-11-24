import { resourceSet } from '../../_lib/resource';
import { agentTrackingIngestSourceAuditResource } from './agentTrackingIngestSource';
import { agentTrackingIngestTokenAuditResource } from './agentTrackingIngestToken';
import { agentTrackingSettingsAuditResource } from './agentTrackingSettings';
import { agentTrackingViewAuditResource } from './agentTrackingView';

export let observabilityResources = resourceSet({
  agent_tracking_ingest_source: agentTrackingIngestSourceAuditResource,
  agent_tracking_ingest_token: agentTrackingIngestTokenAuditResource,
  agent_tracking_settings: agentTrackingSettingsAuditResource,
  agent_tracking_view: agentTrackingViewAuditResource
});
