import { Button, Flex, Spacer, Text, Title } from '@metorial-io/ui';
import { SecuredByFooter, StepContentBlock, StepWrapper } from '../components/StepLayout';
import type { OAuthSetup } from '../types';

interface OAuthRedirectStepProps {
  oauthSetup: OAuthSetup;
  isMetorialElement?: boolean;
}

export let OAuthRedirectStep = ({
  oauthSetup,
  isMetorialElement = false
}: OAuthRedirectStepProps) => {
  let handleRedirect = () => {
    if (oauthSetup.url) {
      window.location.href = oauthSetup.url;
    }
  };

  if (!oauthSetup.url) {
    return (
      <Flex
        direction="column"
        align="center"
        style={{ padding: '16px 0', textAlign: 'center' }}
      >
        <Title size="3" weight="bold">
          OAuth Setup Error
        </Title>
        <Spacer size={8} />
        <Text style={{ textAlign: 'center' }}>
          Unable to initiate OAuth flow. The setup URL is not available.
        </Text>
      </Flex>
    );
  }

  return (
    <StepWrapper $isMetorialElement={isMetorialElement}>
      <StepContentBlock $isMetorialElement={isMetorialElement}>
        <div>
          <Text size="2" weight="medium">
            Sign in required
          </Text>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            You'll be redirected to connect your account.
          </Text>
        </div>

        <Spacer size={30} />

        <Button onClick={handleRedirect} color="black" size="4" fullWidth>
          Connect Account
        </Button>

        <SecuredByFooter isMetorialElement={isMetorialElement} />
      </StepContentBlock>
    </StepWrapper>
  );
};
