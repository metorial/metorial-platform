import { Spacer, Spinner, Text, Title, theme } from '@metorial/ui';
import { useEffect } from 'react';
import styled from 'styled-components';
import { SuccessIcon } from '../../../components/statusIcon';

let CROSS_ORIGIN_REDIRECT_DELAY_MS = 1500;

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
  text-align: center;
`;

let IconWrapper = styled.div`
  margin-bottom: 24px;
`;

let Description = styled(Text)`
  text-align: center;
  line-height: 1.5;
  text-wrap: balance;
`;

let Redirecting = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${theme.colors.gray600};
  font-size: 13px;
`;

export let CompletedStep = ({ redirectUrl }: { redirectUrl: string | null }) => {
  useEffect(() => {
    if (!redirectUrl) return;

    let isSameOrigin = new URL(redirectUrl).origin === window.location.origin;
    let timeout = setTimeout(
      () => {
        window.location.href = redirectUrl;
      },
      isSameOrigin ? 0 : CROSS_ORIGIN_REDIRECT_DELAY_MS
    );

    return () => clearTimeout(timeout);
  }, [redirectUrl]);

  return (
    <Wrapper>
      <IconWrapper>
        <SuccessIcon />
      </IconWrapper>

      <Title size="3" weight="bold">
        Setup Complete
      </Title>

      <Spacer size={12} />

      <Description color="gray600">
        {redirectUrl
          ? 'Your configuration has been saved. Redirecting you back...'
          : 'Your configuration has been saved successfully. You can close this window.'}
      </Description>

      {redirectUrl && (
        <>
          <Spacer size={24} />

          <Redirecting>
            <Spinner size={16} />
            <span>Redirecting...</span>
          </Redirecting>
        </>
      )}
    </Wrapper>
  );
};
