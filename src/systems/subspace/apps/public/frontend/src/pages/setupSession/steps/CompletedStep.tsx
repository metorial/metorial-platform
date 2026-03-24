import { Flex, Spacer, Spinner, Text, Title } from '@metorial-io/ui';
import { RiCheckLine } from '@remixicon/react';
import { useEffect } from 'react';

interface CompletedStepProps {
  redirectUrl: string | null;
}

export let CompletedStep = ({ redirectUrl }: CompletedStepProps) => {
  useEffect(() => {
    if (!redirectUrl) return;

    let timeout = setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1500);

    return () => clearTimeout(timeout);
  }, [redirectUrl]);

  let description = redirectUrl
    ? 'Your configuration has been saved. Redirecting you back...'
    : 'Your configuration has been saved successfully. You can close this window.';

  return (
    <Flex direction="column" align="center" style={{ padding: '24px 0', textAlign: 'center' }}>
      <Flex
        align="center"
        justify="center"
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: '#10b981',
          color: 'white',
          marginBottom: 24
        }}
      >
        <RiCheckLine size={32} />
      </Flex>

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

      {redirectUrl && (
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
