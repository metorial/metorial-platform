import { Text, theme } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import React from 'react';
import styled from 'styled-components';

type ChecklistStepState = 'done' | 'current' | 'pending';

let markerColors: Record<
  ChecklistStepState,
  { border: string; background: string; color: string }
> = {
  done: {
    border: theme.colors.foreground,
    background: theme.colors.foreground,
    color: theme.colors.background
  },
  current: {
    border: theme.colors.gray600,
    background: theme.colors.background,
    color: theme.colors.gray900
  },
  pending: {
    border: theme.colors.gray400,
    background: theme.colors.background,
    color: theme.colors.gray600
  }
};

let Marker = styled.span<{ $state: ChecklistStepState }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid ${({ $state }) => markerColors[$state].border};
  background: ${({ $state }) => markerColors[$state].background};
  color: ${({ $state }) => markerColors[$state].color};

  svg {
    width: 14px;
    height: 14px;
  }
`;

let StepRow = styled.div`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  column-gap: 14px;
  align-items: flex-start;
  padding: 16px 0;

  &:not(:last-child) {
    border-bottom: 1px solid ${theme.colors.gray300};
  }
`;

let StepText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding-top: 2px;
`;

let StepAction = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

let StepBody = styled.div`
  grid-column: 2 / 4;
  min-width: 0;
  padding-top: 14px;
`;

export let ChecklistStep = ({
  number,
  state,
  title,
  description,
  action,
  children
}: {
  number: number;
  state: ChecklistStepState;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <StepRow aria-current={state == 'current' ? 'step' : undefined}>
    <Marker $state={state} aria-hidden>
      {state == 'done' ? <RiCheckLine /> : number}
    </Marker>

    <StepText>
      <Text as="span" size="2" weight="strong">
        {title}
      </Text>

      {description ? (
        <Text as="div" size="2" color="gray700">
          {description}
        </Text>
      ) : null}
    </StepText>

    <StepAction>{action}</StepAction>

    {children ? <StepBody>{children}</StepBody> : null}
  </StepRow>
);
