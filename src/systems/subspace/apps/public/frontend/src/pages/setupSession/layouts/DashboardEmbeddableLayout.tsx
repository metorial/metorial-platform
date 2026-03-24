import { Flex, Text } from '@metorial-io/ui';
import { RiCheckLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import styled from 'styled-components';

interface DashboardEmbeddableLayoutProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  children: ReactNode;
}

let Wrapper = styled.div`
  padding: 24px;
  max-width: 600px;
  margin: 0 auto;

  @media (max-width: 640px) {
    padding: 16px;
  }
`;

let StepIndicator = styled(Flex)`
  margin-bottom: 32px;

  @media (max-width: 640px) {
    margin-bottom: 24px;
  }
`;

let StepLabel = styled(Text)<{ $isCompleted: boolean; $isActive: boolean }>`
  white-space: nowrap;
  color: ${p => (p.$isCompleted ? '#10b981' : p.$isActive ? '#1a1a1a' : '#999')};

  @media (max-width: 480px) {
    display: none;
  }
`;

let StepConnector = styled.div<{ $isCompleted: boolean }>`
  flex: 1;
  height: 2px;
  margin: 0 12px;
  background: ${p => (p.$isCompleted ? '#10b981' : '#e5e5e5')};
  transition: background 0.2s;

  @media (max-width: 480px) {
    margin: 0 8px;
  }
`;

export let DashboardEmbeddableLayout = ({
  currentStep,
  totalSteps,
  stepLabels,
  children
}: DashboardEmbeddableLayoutProps) => {
  return (
    <Wrapper>
      {totalSteps > 1 && (
        <StepIndicator align="center">
          {stepLabels.map((label, index) => {
            let isActive = index === currentStep;
            let isCompleted = index < currentStep;
            let isLast = index === stepLabels.length - 1;

            return (
              <Flex key={label} align="center" style={{ flex: isLast ? 0 : 1 }}>
                <Flex align="center" gap={8}>
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      fontSize: 13,
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      background: isCompleted ? '#10b981' : isActive ? '#1a1a1a' : '#e5e5e5',
                      color: isCompleted || isActive ? 'white' : '#999'
                    }}
                  >
                    {isCompleted ? <RiCheckLine size={14} /> : index + 1}
                  </Flex>
                  <StepLabel weight="medium" $isCompleted={isCompleted} $isActive={isActive}>
                    {label}
                  </StepLabel>
                </Flex>
                {!isLast && <StepConnector $isCompleted={isCompleted} />}
              </Flex>
            );
          })}
        </StepIndicator>
      )}

      <div>{children}</div>
    </Wrapper>
  );
};
