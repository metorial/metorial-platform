import { CenteredSpinner, Title, theme } from '@metorial/ui';
import { useEffect, type ReactNode } from 'react';
import styled from 'styled-components';
import { SecuredByFooter } from './securedByFooter';
import { ErrorIcon } from './statusIcon';

let Wrapper = styled.div`
  min-height: 100dvh;
  padding: 60px 20px;
  background: ${theme.colors.background};
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 640px) {
    padding: 0;
    align-items: flex-start;
  }
`;

let Card = styled.div`
  width: 420px;
  max-width: 100%;

  @media (max-width: 640px) {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
`;

let Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;

  @media (max-width: 640px) {
    margin: auto 0;
  }
`;

let IconWrapper = styled.div`
  margin-bottom: 24px;
`;

let StatusTitle = styled(Title)`
  text-align: center;
`;

let Description = styled.p`
  text-align: center;
  line-height: 1.5;
  margin-top: 12px;
  color: ${theme.colors.gray600};
  font-size: 14px;
  text-wrap: balance;
`;

let Footer = styled.div`
  display: flex;
  justify-content: center;
  padding: 16px 0;

  @media (max-width: 640px) {
    margin-top: auto;
    padding: 24px;
  }
`;

let LoadingWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100dvh;
`;

export let PublicStatusPage = ({
  icon,
  title,
  description,
  isWhitelabel
}: {
  icon: ReactNode;
  title: string;
  description: string;
  isWhitelabel?: boolean;
}) => (
  <Wrapper>
    <Card>
      <Content>
        <IconWrapper>{icon}</IconWrapper>

        <StatusTitle size="3" weight="bold">
          {title}
        </StatusTitle>

        <Description>{description}</Description>
      </Content>

      {!isWhitelabel && (
        <Footer>
          <SecuredByFooter />
        </Footer>
      )}
    </Card>
  </Wrapper>
);

export let PublicErrorPage = ({ error }: { error: { message: string } }) => (
  <PublicStatusPage
    icon={<ErrorIcon />}
    title="Something went wrong"
    description={error.message}
  />
);

export let PublicLoadingPage = () => (
  <LoadingWrapper>
    <CenteredSpinner />
  </LoadingWrapper>
);

export let Redirect = ({ url }: { url: string }) => {
  useEffect(() => {
    window.location.href = url;
  }, [url]);

  return <PublicLoadingPage />;
};
