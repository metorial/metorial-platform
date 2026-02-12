import { Spacer, Text } from '@metorial/ui';
import { useState } from 'react';
import styled from 'styled-components';
import { ProviderSetupSessionEmbed } from '../../scenes/providerDeployments/setupSessionEmbed';

type AuthMethod = {
  id: string;
  type: 'oauth' | 'token' | 'custom';
  name: string;
  description: string | null;
  input_schema: Record<string, any> | null;
  scopes: { id: string; scope: string; name: string; description: string | null }[] | null;
};

type AuthCredential = {
  id: string;
  name: string | null;
  clientId: string | null;
};

export type AuthPanelProps = {
  instanceId: string;
  deploymentId: string;
  provider: { id: string; name: string | null };
  authMethods: AuthMethod[];
  authCredentials: AuthCredential[];
  onAuthComplete: (authConfigId: string) => void;
  refetchAuthCredentials?: () => void;
};

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 900px;
  width: 100%;
  padding: 24px;
`;

export let AuthPanel = ({
  instanceId,
  deploymentId,
  provider,
  onAuthComplete
}: AuthPanelProps) => {
  let [error, setError] = useState<string | null>(null);

  return (
    <Wrapper>
      <Text size="4" weight="strong">
        Authentication Required
      </Text>
      <Spacer size={5} />
      <Text size="2" color="gray700">
        {provider.name ?? 'This provider'} requires authentication to connect.
      </Text>
      <Spacer size={10} />

      <ProviderSetupSessionEmbed
        instanceId={instanceId}
        providerId={provider.id}
        deploymentId={deploymentId}
        onComplete={setupSession => {
          if (setupSession?.authConfig?.id) {
            onAuthComplete(setupSession.authConfig.id);
            return;
          }
          setError('Authentication completed but no auth config was returned.');
        }}
      />

      {error && (
        <>
          <Spacer size={8} />
          <Text size="2" color="red600">
            {error}
          </Text>
        </>
      )}
    </Wrapper>
  );
};
