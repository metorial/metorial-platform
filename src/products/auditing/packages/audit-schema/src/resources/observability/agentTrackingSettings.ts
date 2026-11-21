import { v } from '@lowerdeck/validation';
import type { AgentTrackingSettingsValues } from '@metorial/fabric';
import { resource } from '../../_lib/resource';

export let agentTrackingSettingsAuditResource = resource({
  name: 'agent_tracking_settings',
  payload: v.typedAny<AgentTrackingSettingsValues>('agent_tracking_settings'),
  presenter: undefined,
  actions: {
    update: true
  }
});
