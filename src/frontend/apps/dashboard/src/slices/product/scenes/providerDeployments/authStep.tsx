import { ProviderSetupSessionEmbed } from './setupSessionEmbed';

export type AuthStepProps = {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  onComplete: () => void;
  onSkip?: () => void;
};

export let AuthStep = ({
  instanceId,
  providerId,
  deploymentId,
  onComplete,
  onSkip
}: AuthStepProps) => {
  return (
    <ProviderSetupSessionEmbed
      instanceId={instanceId}
      providerId={providerId}
      deploymentId={deploymentId}
      onComplete={() => onComplete()}
      onCancel={onSkip}
      cancelLabel={onSkip ? 'Skip for now' : 'Cancel'}
    />
  );
};
