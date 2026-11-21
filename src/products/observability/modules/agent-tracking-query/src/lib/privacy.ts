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

export let loadPrivacy = async (scope: Pick<ReadScope, 'organization'>) =>
  await agentTrackingSettingsService.getPrivacy({ organization: scope.organization });

export let loadVisiblePrivacy = async (scope: Pick<ReadScope, 'organization'>) => {
  let privacy = await loadPrivacy(scope);
  if (privacy.hideIndividuals) throw new ServiceError(individualsHiddenError);

  return privacy;
};
