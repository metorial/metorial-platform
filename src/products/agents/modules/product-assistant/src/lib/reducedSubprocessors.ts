import { forbiddenError, ServiceError } from '@lowerdeck/error';

export let reducedSubprocessorsErrorMessage =
  'Due to elevated compliance settings enabled on this account, the request cannot be fulfilled.';

export let assertAiChatAllowed = (project: {
  reducedSubprocessors: boolean;
  assistantEnabled: boolean;
}) => {
  if (project.assistantEnabled && !project.reducedSubprocessors) return;

  throw new ServiceError(
    forbiddenError({
      message: project.reducedSubprocessors
        ? reducedSubprocessorsErrorMessage
        : 'Metorial Assistant is disabled for this project.'
    })
  );
};
