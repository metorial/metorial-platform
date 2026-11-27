import { Button, Flex, Spacer, Text } from '@metorial/ui';
import { ProviderSetupSessionEmbed } from '../../providerDeployments/setupSessionEmbed';
import { useWizard } from '../index';

export let AuthSetupStep = ({
  instanceId,
  onComplete
}: {
  instanceId: string;
  onComplete: (deploymentId: string) => void;
}) => {
  let { state, setStep, setAuthConfigId } = useWizard();

  let handleBack = () => {
    setStep('deploymentDetails');
  };

  let handleSkip = () => {
    if (state.deploymentId) onComplete(state.deploymentId);
  };

  if (!state.providerId || !state.deploymentId) {
    return (
      <Flex direction="column" gap={15}>
        <Text size="2" color="gray600">
          Provider deployment is not ready for authentication setup yet.
        </Text>
        <Flex gap={10}>
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap={15}>
      <Flex gap={10}>
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
      </Flex>

      <Spacer size={5} />

      <ProviderSetupSessionEmbed
        instanceId={instanceId}
        providerId={state.providerId}
        deploymentId={state.deploymentId}
        onComplete={setupSession => {
          if (setupSession?.authConfig?.id) {
            setAuthConfigId(setupSession.authConfig.id);
          }
          onComplete(state.deploymentId!);
        }}
        onCancel={handleSkip}
        cancelLabel="Skip for now"
      />
    </Flex>
  );
};
