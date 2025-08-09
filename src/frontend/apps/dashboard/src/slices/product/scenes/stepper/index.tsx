import { AnimatePanes, theme } from '@metorial/ui';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let Header = styled.header`
  display: grid;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  overflow: hidden;
`;

let Step = styled.button`
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 10px 0px 10px 45px;
  background: var(--bg);
  border: none;
  text-align: left;
  position: relative;
  height: 60px;

  .inner {
    z-index: 3;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: ${theme.colors.gray900};
    }

    p {
      font-size: 10px;
      color: ${theme.colors.gray700};
      font-weight: 400;
    }
  }

  &:first-of-type {
    padding-left: 20px;
  }

  &:last-of-type {
    padding-right: 20px;
  }

  &[data-arrow='true'] {
    &::before {
      z-index: 1;
      content: '';
      position: absolute;
      top: 50%;
      right: -64px;
      transform: translateY(-50%);
      border: 32px solid transparent;
      border-left: 32px solid ${theme.colors.gray400};
    }

    &::after {
      z-index: 2;
      content: '';
      position: absolute;
      top: 50%;
      right: -60px;
      transform: translateY(-50%);
      border: 30px solid transparent;
      border-left: 30px solid var(--bg);
    }
  }
`;

let Main = styled.main``;

export let Stepper = ({
  steps,
  currentStep,
  setCurrentStep
}: {
  steps: { title: string; subtitle?: string; render: () => React.ReactNode }[];
  currentStep: number;
  setCurrentStep: (step: number) => void;
}) => {
  let currentStepContent = steps[currentStep];
  let children = currentStepContent.render();

  let [maxSeen, setMaxSeen] = useState(currentStep);
  useEffect(() => {
    if (currentStep > maxSeen) setMaxSeen(currentStep);
  }, [currentStep]);

  return (
    <Wrapper>
      <Header
        style={{
          gridTemplateColumns: new Array(steps.length)
            .fill(0)
            .map((_, i) => {
              if (i == 0) return `calc(${100 / steps.length}% - 20px)`;
              if (i === steps.length - 1) return `calc(${100 / steps.length}% + 20px)`;

              return `calc(${100 / steps.length}%)`;
            })
            .join(' ')
        }}
      >
        {steps.map((step, index) => (
          <Step
            key={index}
            onClick={() => setCurrentStep(index)}
            disabled={index > maxSeen}
            data-arrow={index < steps.length - 1}
            title={step.title}
            type="button"
            style={
              {
                '--bg': index <= currentStep ? theme.colors.gray300 : theme.colors.gray100
              } as any
            }
          >
            <div className="inner">
              <h3>{step.title}</h3>
              {step.subtitle && <p>{step.subtitle}</p>}
            </div>
          </Step>
        ))}
      </Header>

      <Main>
        <AnimatePanes orderedIdentifier={currentStep}>{children}</AnimatePanes>
      </Main>
    </Wrapper>
  );
};
