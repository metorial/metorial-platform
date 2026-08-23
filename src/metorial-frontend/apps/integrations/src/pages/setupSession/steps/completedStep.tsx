import { Flex, Spacer, Spinner, Text, Title } from '@metorial/ui';
import { useEffect } from 'react';
import { SuccessIcon } from '../components/statusIcons';

interface CompletedStepProps {
  redirectUrl: string | null;
  completionRedirectUrl?: string | null;
}

export let CompletedStep = ({ redirectUrl, completionRedirectUrl }: CompletedStepProps) => {
  let finalRedirectUrl = completionRedirectUrl ?? redirectUrl;

  useEffect(() => {
    if (!finalRedirectUrl) return;

    let destOrigin = new URL(finalRedirectUrl).origin;
    let sourceOrigin = window.location.origin;

    let isSameOrigin = destOrigin === sourceOrigin;

    let timeout = setTimeout(
      () => {
        window.location.href = finalRedirectUrl;
      },
      isSameOrigin ? 0 : 1500
    );

    return () => clearTimeout(timeout);
  }, [finalRedirectUrl]);

  let description = finalRedirectUrl
    ? 'Your configuration has been saved. Redirecting you back...'
    : 'Your configuration has been saved successfully. You can close this window.';

  return (
    <Flex direction="column" align="center" style={{ padding: '24px 0', textAlign: 'center' }}>
      <div style={{ marginBottom: 24 }}>
        <SuccessIcon />
      </div>

      <Title size="3" weight="bold">
        Setup Complete
      </Title>

      <Spacer size={12} />

      <Text
        color="gray600"
        style={{ textAlign: 'center', lineHeight: 1.5, textWrap: 'balance' }}
      >
        {description}
      </Text>

      {finalRedirectUrl && (
        <>
          <Spacer size={24} />
          <Flex align="center" gap={8} style={{ color: '#999', fontSize: 13 }}>
            <Spinner size={16} />
            <span>Redirecting...</span>
          </Flex>
        </>
      )}
    </Flex>
  );
};
