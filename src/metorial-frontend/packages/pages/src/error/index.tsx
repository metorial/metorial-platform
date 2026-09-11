import React from 'react';
import { Button, theme } from '@metorial/ui';
import { Balancer } from 'react-wrap-balancer';
import styled from 'styled-components';

let Wrapper = styled.main`
  box-sizing: border-box;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at 50% 0%, ${theme.colors.red200}, transparent 42%),
    ${theme.colors.gray100};
`;

let Card = styled.section`
  box-sizing: border-box;
  width: min(100%, 520px);
  padding: 40px;
  text-align: center;
  background: ${theme.colors.white100};
  border: 1px solid ${theme.colors.gray400};
  border-radius: 16px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.08);

  @media (max-width: 600px) {
    padding: 32px 24px;
  }
`;

let Icon = styled.div`
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: ${theme.colors.red900};
  background: ${theme.colors.red300};
  border-radius: 14px;

  svg {
    width: 26px;
    height: 26px;
  }
`;

let Title = styled.h1`
  margin: 0;
  color: ${theme.colors.gray900};
  font-size: 28px;
  line-height: 1.2;
  font-weight: 650;
  letter-spacing: -0.03em;
`;

let Description = styled.p`
  margin: 14px auto 0;
  max-width: 420px;
  color: ${theme.colors.gray700};
  font-size: 16px;
  line-height: 1.55;
`;

let Actions = styled.div`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
`;

export let ErrorPage = ({
  title,
  description,
  onRetry,
  homeHref = '/',
  retryLabel = 'Try again',
  homeLabel = 'Go home'
}: {
  title: string;
  description: string;
  onRetry?: () => void;
  homeHref?: string;
  retryLabel?: string;
  homeLabel?: string;
}) => {
  let retry = onRetry || (() => window.location.reload());

  return (
    <Wrapper>
      <Card aria-labelledby="error-page-title">
        <Icon aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6" />
            <path d="M12 16.5h.01" />
          </svg>
        </Icon>
        <Title id="error-page-title">
          <Balancer>{title}</Balancer>
        </Title>
        <Description>
          <Balancer>{description}</Balancer>
        </Description>
        <Actions>
          <Button color="red" onClick={retry}>
            {retryLabel}
          </Button>
          <Button color="gray" variant="outline" onClick={() => window.location.assign(homeHref)}>
            {homeLabel}
          </Button>
        </Actions>
      </Card>
    </Wrapper>
  );
};
