import type { ReactNode } from 'react';
import styled from 'styled-components';
import {
  SetupProgressFrame,
  SetupProgressIndicator
} from '../components/setupProgress';

interface DashboardEmbeddableLayoutProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  children: ReactNode;
}

let Wrapper = styled.div`
  /* padding: 24px;
  max-width: 600px;
  margin: 0 auto; */

  /* @media (max-width: 640px) {
    padding: 16px;
  } */
`;

export let DashboardEmbeddableLayout = ({
  currentStep,
  totalSteps,
  stepLabels,
  children
}: DashboardEmbeddableLayoutProps) => {
  return (
    <Wrapper>
      <SetupProgressFrame
        progress={
          totalSteps > 1 ? (
            <SetupProgressIndicator currentStep={currentStep} stepLabels={stepLabels} size="md" />
          ) : null
        }
      >
        {children}
      </SetupProgressFrame>
    </Wrapper>
  );
};
