import { Button, theme } from '@metorial/ui';
import { RiCloseLine } from '@remixicon/react';
import React from 'react';
import { css, styled } from 'styled-components';

export type TerminalStripTone = 'neutral' | 'warning' | 'danger';

let toneStyles = {
  neutral: css`
    color: ${theme.colors.gray900};
    background: ${theme.colors.background};
    border-color: ${theme.colors.gray400};
  `,

  warning: css`
    color: ${theme.colors.orange900};
    background: ${theme.colors.orange200};
    border-color: ${theme.colors.orange400};
  `,

  danger: css`
    color: ${theme.colors.red900};
    background: ${theme.colors.red200};
    border-color: ${theme.colors.red400};
  `
};

let Wrapper = styled.div<{ $tone: TerminalStripTone }>`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  margin: 8px;
  padding: 5px 10px 5px 12px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  flex-shrink: 0;

  ${({ $tone }) => toneStyles[$tone]}
`;

let Icon = styled.span`
  display: flex;
  align-items: center;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
  }
`;

let Message = styled.span`
  flex: 1;
  min-width: 0;
`;

let Actions = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

export let TerminalStrip = ({
  tone,
  icon,
  children,
  actions,
  onDismiss
}: {
  tone: TerminalStripTone;
  icon: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  onDismiss?: () => void;
}) => (
  <Wrapper $tone={tone} role={tone == 'danger' ? 'alert' : 'status'}>
    <Icon>{icon}</Icon>
    <Message>{children}</Message>

    {(actions || onDismiss) && (
      <Actions>
        {actions}

        {onDismiss && (
          <Button
            size="1"
            variant="ghost"
            aria-label="Dismiss"
            iconLeft={<RiCloseLine />}
            onClick={onDismiss}
          />
        )}
      </Actions>
    )}
  </Wrapper>
);
