import { Text, theme } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import React from 'react';
import styled from 'styled-components';

export type VerticalWizardStepState = 'completed' | 'current' | 'upcoming';

export type VerticalWizardStep = {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  state: VerticalWizardStepState;
  onClick?: () => void;
};

let Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: ${theme.colors.background};

  && {
    overflow: hidden;
  }
`;

let Body = styled.div`
  display: grid;
  grid-template-columns: minmax(150px, 200px) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
`;

let Rail = styled.nav`
  grid-column: 1;
  grid-row: 1;
  min-height: 0;
  overflow: auto;
  padding: 28px 0px 24px 28px;

  @media (max-width: 720px) {
    grid-column: 1;
    grid-row: 1;
    padding: 18px 20px;
    border-right: 0;
    border-bottom: 1px solid ${theme.colors.gray400};
    overflow-x: auto;
  }
`;

let Steps = styled.ol`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: 720px) {
    min-width: max-content;
    flex-direction: row;
  }
`;

let Step = styled.li`
  position: relative;
  min-width: 0;

  &:not(:last-child)::after {
    position: absolute;
    top: 28px;
    bottom: -4px;
    left: 11px;
    width: 1px;
    content: '';
    background: ${theme.colors.gray500};
  }

  &[data-state='completed']:not(:last-child)::after {
    background: ${theme.colors.gray900};
  }

  @media (max-width: 720px) {
    padding-right: 36px;

    &:not(:last-child)::after {
      top: 11px;
      right: 4px;
      bottom: auto;
      left: 28px;
      width: auto;
      height: 1px;
    }
  }
`;

let StepButton = styled.button`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 10px;
  width: 100%;
  padding: 0 0 26px;
  border: 0;
  color: inherit;
  text-align: left;
  background: transparent;

  &:enabled {
    cursor: pointer;
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.gray800};
    outline-offset: 4px;
    border-radius: 4px;
  }

  @media (max-width: 720px) {
    padding-bottom: 0;
  }
`;

let Marker = styled.span`
  position: relative;
  z-index: 1;
  display: flex;
  width: 24px;
  height: 24px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border: 1px solid ${theme.colors.gray500};
  border-radius: 50%;
  color: ${theme.colors.gray700};
  background: ${theme.colors.gray100};
  font-size: 11px;
  font-weight: 600;

  [data-state='completed'] &,
  [data-state='current'] & {
    border-color: ${theme.colors.gray900};
    color: ${theme.colors.gray100};
    background: ${theme.colors.gray900};
  }

  [data-state='current'] & {
    box-shadow: 0 0 0 3px ${theme.colors.gray400};
  }
`;

let StepCopy = styled.span`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding-top: 2px;
`;

let Main = styled.div`
  grid-column: 2;
  grid-row: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: auto;

  @media (max-width: 720px) {
    grid-column: 1;
    grid-row: 2;
  }
`;

let Content = styled.div`
  width: 100%;
  max-width: 760px;
  box-sizing: border-box;
  flex: 1;
  margin: 0 auto;
  padding: 32px;

  @media (max-width: 720px) {
    padding: 24px 20px;
  }
`;

let Footer = styled.footer`
  display: flex;
  flex: none;
  width: 100%;
  min-height: 70px;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 32px;
  border-top: 1px solid ${theme.colors.gray400};
  background: color-mix(in srgb, ${theme.colors.background} 92%, transparent);
  backdrop-filter: blur(10px);

  @media (max-width: 720px) {
    flex-wrap: wrap;
    padding: 14px 20px;
  }
`;

export let VerticalWizard = ({
  steps,
  children,
  footer,
  footerStart,
  ariaLabel = 'Setup progress'
}: {
  steps: VerticalWizardStep[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerStart?: React.ReactNode;
  ariaLabel?: string;
}) => (
  <Root>
    <Body>
      <Rail aria-label={ariaLabel}>
        <Steps>
          {steps.map((step, index) => (
            <Step key={step.id} data-state={step.state}>
              <StepButton
                type="button"
                disabled={!step.onClick}
                onClick={step.onClick}
                aria-current={step.state === 'current' ? 'step' : undefined}
              >
                <Marker>
                  {step.state === 'completed' ? <RiCheckLine size={14} /> : index + 1}
                </Marker>
                <StepCopy>
                  <Text
                    size="2"
                    weight="strong"
                    color={step.state === 'upcoming' ? 'gray600' : 'gray900'}
                  >
                    {step.label}
                  </Text>
                  {step.description ? (
                    <Text size="1" color="gray600">
                      {step.description}
                    </Text>
                  ) : null}
                </StepCopy>
              </StepButton>
            </Step>
          ))}
        </Steps>
      </Rail>
      <Main>
        <Content>{children}</Content>
      </Main>
    </Body>
    {footer || footerStart ? (
      <Footer>
        <div>{footerStart}</div>
        <div>{footer}</div>
      </Footer>
    ) : null}
  </Root>
);
