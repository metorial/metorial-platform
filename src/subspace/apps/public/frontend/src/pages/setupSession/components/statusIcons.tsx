import { Flex } from '@metorial/ui';
import { RiAlertLine, RiCheckLine, RiCloseLine } from '@remixicon/react';
import type React from 'react';

let StatusIcon = ({
  background,
  children
}: {
  background: string;
  children: React.ReactNode;
}) => {
  return (
    <Flex
      align="center"
      justify="center"
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background
      }}
    >
      {children}
    </Flex>
  );
};

export let SuccessIcon = () => {
  return (
    <StatusIcon background="#10b981">
      <RiCheckLine size={32} color="white" />
    </StatusIcon>
  );
};

export let WarningIcon = () => {
  return (
    <StatusIcon background="#f59e0b">
      <RiAlertLine size={32} color="white" />
    </StatusIcon>
  );
};

export let ErrorIcon = () => {
  return (
    <StatusIcon background="#dc2626">
      <RiCloseLine size={32} color="white" />
    </StatusIcon>
  );
};
