import { Flex } from '@metorial-io/ui';
import { RiAlertLine, RiCheckLine, RiCloseLine } from '@remixicon/react';

export let SuccessIcon = () => {
  return (
    <Flex
      align="center"
      justify="center"
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: '#10b981'
      }}
    >
      <RiCheckLine size={32} color="white" />
    </Flex>
  );
};

export let WarningIcon = () => {
  return (
    <Flex
      align="center"
      justify="center"
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: '#f59e0b'
      }}
    >
      <RiAlertLine size={32} color="white" />
    </Flex>
  );
};

export let ErrorIcon = () => {
  return (
    <Flex
      align="center"
      justify="center"
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: '#dc2626'
      }}
    >
      <RiCloseLine size={32} color="white" />
    </Flex>
  );
};
