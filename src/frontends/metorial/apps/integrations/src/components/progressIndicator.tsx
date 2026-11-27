import { Flex, Text, theme } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import styled from 'styled-components';

type Size = 'sm' | 'md';

type StepState = { $isCompleted: boolean; $isActive: boolean };

let completedColor = theme.colors.green900;
let activeColor = theme.colors.gray900;
let inactiveColor = theme.colors.gray350;
let mutedTextColor = theme.colors.gray600;

let Wrapper = styled(Flex)<{ $size: Size }>`
  padding: ${p => (p.$size === 'sm' ? '16px 32px' : '0')};
  margin-bottom: ${p => (p.$size === 'sm' ? '0' : '32px')};

  @media (max-width: 640px) {
    margin-bottom: ${p => (p.$size === 'sm' ? '0' : '24px')};
  }
`;

let Step = styled.div<{ $isLast: boolean }>`
  display: flex;
  align-items: center;
  flex: ${p => (p.$isLast ? 0 : 1)};
`;

let Label = styled(Text)<StepState>`
  white-space: nowrap;
  color: ${p =>
    p.$isCompleted ? completedColor : p.$isActive ? activeColor : mutedTextColor};

  @media (max-width: 480px) {
    display: none;
  }
`;

let Connector = styled.div<{ $isCompleted: boolean }>`
  flex: 1;
  height: 2px;
  margin: 0 12px;
  background: ${p => (p.$isCompleted ? completedColor : inactiveColor)};
  transition: background 0.2s;

  @media (max-width: 480px) {
    margin: 0 8px;
  }
`;

let Circle = styled.div<StepState & { $size: Size }>`
  width: ${p => (p.$size === 'sm' ? 24 : 28)}px;
  height: ${p => (p.$size === 'sm' ? 24 : 28)}px;
  border-radius: 50%;
  font-size: ${p => (p.$size === 'sm' ? 12 : 13)}px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  background: ${p =>
    p.$isCompleted ? completedColor : p.$isActive ? activeColor : inactiveColor};
  color: ${p => (p.$isCompleted || p.$isActive ? theme.colors.background : mutedTextColor)};
`;

export let ProgressIndicator = ({
  currentStep,
  stepLabels,
  size
}: {
  currentStep: number;
  stepLabels: string[];
  size: Size;
}) => {
  if (stepLabels.length <= 1) return null;

  return (
    <Wrapper align="center" $size={size}>
      {stepLabels.map((label, index) => {
        let isActive = index === currentStep;
        let isCompleted = index < currentStep;
        let isLast = index === stepLabels.length - 1;

        return (
          <Step key={label} $isLast={isLast}>
            <Flex align="center" gap={8}>
              <Circle $isCompleted={isCompleted} $isActive={isActive} $size={size}>
                {isCompleted ? <RiCheckLine size={size === 'sm' ? 12 : 14} /> : index + 1}
              </Circle>

              <Label size="1" weight="medium" $isCompleted={isCompleted} $isActive={isActive}>
                {label}
              </Label>
            </Flex>

            {!isLast && <Connector $isCompleted={isCompleted} />}
          </Step>
        );
      })}
    </Wrapper>
  );
};
