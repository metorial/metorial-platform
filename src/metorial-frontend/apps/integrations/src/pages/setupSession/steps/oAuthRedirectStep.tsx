import { Button, Flex, Spacer, Text, Title } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { StepContentBlock, StepWrapper } from '../components/stepLayout';
import type { OAuthSetup } from '../types';

let CheckList = styled.div`
  display: flex;
  flex-direction: column;
`;

let CheckListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0px;

  &:not(:last-child) {
    border-bottom: 1px solid #eee;
  }
`;

let CheckListIcon = styled.div`
  width: 16px;
`;

let CheckListContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;

  h2 {
    font-size: 14px;
    font-weight: 600;
  }

  p {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }
`;

let introItems = [
  {
    title: 'Encrypted & Private',
    description: 'Your data is encrypted end-to-end.'
  },
  {
    title: 'Choose What to Share',
    description: 'You have full control over what data you share.'
  }
];

interface OAuthRedirectStepProps {
  oauthSetup: OAuthSetup;
  isMetorialElement?: boolean;
}

export let OAuthRedirectStep = ({
  oauthSetup,
  isMetorialElement = false
}: OAuthRedirectStepProps) => {
  let [loading, setLoading] = useState(false);

  useEffect(() => {
    let handlePageShow = () => setLoading(false);
    window.addEventListener('pageshow', handlePageShow);

    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

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
          <Text size="4" weight="strong">
            Sign in required
          </Text>
          <Text size="2" color="gray600">
            You'll be redirected to connect your account.
          </Text>
        </div>

        <Spacer size={15} />

        <CheckList>
          {introItems.map(item => (
            <CheckListItem key={item.title}>
              <CheckListIcon>
                <RiCheckLine size={16} />
              </CheckListIcon>
              <CheckListContent>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </CheckListContent>
            </CheckListItem>
          ))}
        </CheckList>

        <Spacer size={30} />

        <Button
          onClick={() => {
            handleRedirect();
            setLoading(true);
          }}
          color="black"
          size="3"
          fullWidth
          loading={loading}
        >
          Connect Account
        </Button>
      </StepContentBlock>
    </StepWrapper>
  );
};
