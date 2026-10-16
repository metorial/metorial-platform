import { theme } from '@metorial/ui';
import { RiAlertLine, RiCheckLine, RiCloseLine } from '@remixicon/react';
import styled from 'styled-components';

let toneColors = {
  success: theme.colors.green900,
  warning: theme.colors.orange850,
  error: theme.colors.red900
};

let Circle = styled.div<{ $tone: keyof typeof toneColors }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: ${p => toneColors[p.$tone]};
  color: ${theme.colors.background};
`;

export let SuccessIcon = () => (
  <Circle $tone="success">
    <RiCheckLine size={32} />
  </Circle>
);

export let WarningIcon = () => (
  <Circle $tone="warning">
    <RiAlertLine size={32} />
  </Circle>
);

export let ErrorIcon = () => (
  <Circle $tone="error">
    <RiCloseLine size={32} />
  </Circle>
);
