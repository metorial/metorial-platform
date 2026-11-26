import { createError, ServiceError } from '@lowerdeck/error';
import { agentTrackingSettingsService } from '@metorial/module-agent-tracking-sync';
import type { ReadScope } from './scope';

export let individualsHiddenError = createError({
  status: 403,
  code: 'agent_tracking_individuals_hidden',
  message:
    'This organization hides individual data in agent usage, so this cannot be shown per member or per session.',
  hint: 'An organization admin can turn off Hide Individuals in the Agent Usage settings.'
});

export let loadSettings = (scope: Pick<ReadScope, 'organization'>) =>
  agentTrackingSettingsService.getOrganizationValues(scope);

export let loadPrivacy = async (scope: Pick<ReadScope, 'organization'>) =>
  (await loadSettings(scope)).privacy;

export let loadVisibleSettings = async (scope: Pick<ReadScope, 'organization'>) => {
  let settings = await loadSettings(scope);
  if (settings.privacy.hideIndividuals) throw new ServiceError(individualsHiddenError);

  return settings;
};
