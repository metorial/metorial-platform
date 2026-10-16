import { Button, CenteredSpinner, Spacer, Text, Title, theme } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { StepContainer } from '../../../components/stepContainer';
import type { OAuthSetup } from '../../../state/types';
import { RetryError } from '../_retryError';

let assurances = [
  {
    title: 'Encrypted & Private',
    description: 'Your data is encrypted end-to-end.'
  },
  {
    title: 'Choose What to Share',
    description: 'You have full control over what data you share.'
  }
];

let MissingUrl = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  text-align: center;
`;

let Assurance = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;

  &:not(:last-child) {
    border-bottom: 1px solid ${theme.colors.gray300};
  }
`;

let AssuranceIcon = styled.div`
  width: 16px;
`;

let AssuranceContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;

  h2 {
    font-size: 14px;
    font-weight: 600;
  }

  p {
    font-size: 12px;
    color: ${theme.colors.gray650};
    font-weight: 500;
  }
`;

export let OAuthLoadingStep = ({ error }: { error: string | null }) =>
  error ? <RetryError message={error} /> : <CenteredSpinner />;

export let OAuthRedirectStep = ({ oauthSetup }: { oauthSetup: OAuthSetup }) => {
  let [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    let handlePageShow = () => setIsRedirecting(false);
    window.addEventListener('pageshow', handlePageShow);

    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  let oauthUrl = oauthSetup.url;

  if (!oauthUrl) {
    return (
      <MissingUrl>
        <Title size="3" weight="bold">
          OAuth Setup Error
        </Title>

        <Spacer size={8} />

        <Text>Unable to initiate OAuth flow. The setup URL is not available.</Text>
      </MissingUrl>
    );
  }

  return (
    <StepContainer>
      <div>
        <Text size="4" weight="strong">
          Sign in required
        </Text>

        <Text size="2" color="gray600">
          You'll be redirected to connect your account.
        </Text>
      </div>

      <Spacer size={15} />

      <div>
        {assurances.map(item => (
          <Assurance key={item.title}>
            <AssuranceIcon>
              <RiCheckLine size={16} />
            </AssuranceIcon>

            <AssuranceContent>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </AssuranceContent>
          </Assurance>
        ))}
      </div>

      <Spacer size={30} />

      <Button
        size="3"
        fullWidth
        loading={isRedirecting}
        onClick={() => {
          setIsRedirecting(true);
          window.location.href = oauthUrl;
        }}
      >
        Connect Account
      </Button>
    </StepContainer>
  );
};
