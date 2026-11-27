import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { RiCheckLine, RiCloseLine } from '@remixicon/react';
import React from 'react';
import { keyframes, styled } from 'styled-components';
import { theme } from '../theme';
import type { ColorKey } from '../theme/colors';
import type { ProgressStepState } from './lib';

export * from './lib';

export type ProgressStepItem = {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  state: ProgressStepState;
};

export type ProgressStepsProps = {
  steps: ProgressStepItem[];
  orientation?: 'vertical' | 'horizontal';
  'aria-label'?: string;
  style?: React.CSSProperties;
};

let stateLabels: Record<ProgressStepState, string> = {
  complete: 'Completed',
  active: 'In progress',
  pending: 'Pending',
  failed: 'Failed'
};

let labelColors: Record<ProgressStepState, ColorKey> = {
  complete: 'gray900',
  active: 'gray900',
  pending: 'gray600',
  failed: 'red900'
};

let spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

let List = styled('ol')<{ $orientation: 'vertical' | 'horizontal' }>`
  display: flex;
  flex-direction: ${({ $orientation }) => ($orientation == 'vertical' ? 'column' : 'row')};
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  min-width: 0;
`;

let Connector = styled('span')<{ $complete: boolean }>`
  display: block;
  border-radius: 2px;
  background: ${({ $complete }) =>
    $complete ? theme.colors.primary300 : theme.colors.gray300};
  transition: background 0.3s ease;
`;

let VerticalStep = styled('li')`
  position: relative;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  column-gap: 10px;
  padding-bottom: 18px;

  &:last-child {
    padding-bottom: 0;
  }

  ${Connector} {
    position: absolute;
    left: 9px;
    top: 24px;
    bottom: 2px;
    width: 2px;
  }
`;

let HorizontalStep = styled('li')`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 0;
  min-width: 0;

  &:last-child {
    flex: 0 0 auto;
    max-width: 30%;
  }
`;

let HorizontalRail = styled('div')`
  display: flex;
  align-items: center;
  gap: 6px;

  ${Connector} {
    flex: 1;
    height: 2px;
    margin-right: 6px;
  }
`;

let Indicator = styled('span')<{ $state: ProgressStepState }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1.5px solid
    ${({ $state }) => {
      if ($state == 'complete') return theme.colors.primary300;
      if ($state == 'failed') return theme.colors.red900;
      if ($state == 'active') return theme.colors.blue300;
      return 'rgba(17, 17, 17, 0.14)';
    }};
  background: ${({ $state }) => {
    if ($state == 'complete') return theme.colors.primary300;
    if ($state == 'failed') return theme.colors.red900;
    return theme.colors.background;
  }};
  color: ${theme.colors.background};
  transition:
    background 0.3s ease,
    border-color 0.3s ease;

  svg {
    width: 13px;
    height: 13px;
  }
`;

let ActiveRing = styled('span')`
  position: absolute;
  inset: -1.5px;
  border-radius: 999px;
  border: 1.5px solid transparent;
  border-top-color: ${theme.colors.primary300};
  animation: ${spin} 0.9s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    border-color: ${theme.colors.primary300};
  }
`;

let Dot = styled('span')<{ $active: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: ${({ $active }) =>
    $active ? theme.colors.primary300 : 'rgba(17, 17, 17, 0.22)'};
`;

let Content = styled('span')`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-top: 1px;
`;

let Label = styled('span')<{ $state: ProgressStepState }>`
  font-size: 14px;
  line-height: 18px;
  font-weight: ${({ $state }) => ($state == 'active' ? 600 : 500)};
  color: ${({ $state }) => theme.colors[labelColors[$state]]};
  transition: color 0.3s ease;
`;

let Description = styled('span')`
  font-size: 12px;
  line-height: 16px;
  color: ${theme.colors.gray600};
`;

let StepIndicator = ({ state }: { state: ProgressStepState }) => (
  <Indicator $state={state} aria-hidden>
    {state == 'complete' && <RiCheckLine />}
    {state == 'failed' && <RiCloseLine />}
    {state == 'active' && <ActiveRing />}
    {(state == 'active' || state == 'pending') && <Dot $active={state == 'active'} />}
  </Indicator>
);

let StepContent = ({ step }: { step: ProgressStepItem }) => (
  <Content>
    <Label $state={step.state}>
      {step.label}
      <VisuallyHidden>{` (${stateLabels[step.state]})`}</VisuallyHidden>
    </Label>

    {step.description && <Description>{step.description}</Description>}
  </Content>
);

export let ProgressSteps = ({
  steps,
  orientation = 'vertical',
  style,
  ...rest
}: ProgressStepsProps) => (
  <List $orientation={orientation} aria-label={rest['aria-label']} style={style}>
    {steps.map((step, index) => {
      let isLast = index == steps.length - 1;
      let connector = isLast ? null : <Connector $complete={step.state == 'complete'} />;
      let ariaCurrent = step.state == 'active' ? ('step' as const) : undefined;

      if (orientation == 'horizontal') {
        return (
          <HorizontalStep key={step.id} aria-current={ariaCurrent}>
            <HorizontalRail>
              <StepIndicator state={step.state} />
              {connector}
            </HorizontalRail>

            <StepContent step={step} />
          </HorizontalStep>
        );
      }

      return (
        <VerticalStep key={step.id} aria-current={ariaCurrent}>
          <StepIndicator state={step.state} />
          <StepContent step={step} />
          {connector}
        </VerticalStep>
      );
    })}
  </List>
);
