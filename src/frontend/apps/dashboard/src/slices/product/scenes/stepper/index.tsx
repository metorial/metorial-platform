import { AnimatePanes, Tooltip, theme } from '@metorial/ui';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import React, { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let Header = styled.header`
  display: grid;
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

let Main = styled.main`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

let PillsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  min-height: 0;
`;

let PillsHeader = styled.header`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
`;

let PillSlot = styled.button<{ $state: 'past' | 'active' | 'future' }>`
  position: relative;
  border: none;
  background: transparent;
  padding: 0 14px;
  height: 42px;
  box-sizing: border-box;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: visible;
  cursor: pointer;

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: none;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 4px 0;
    border-radius: 999px;
    z-index: 1;
    background: ${({ $state }) =>
      $state === 'past' ? theme.colors.gray300 : theme.colors.gray200};
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

let ActivePillBackground = styled(motion.div)`
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  border-radius: 999px;
  background: #111111;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    ${theme.shadows.small};
  z-index: 2;
  pointer-events: none;
`;

let PillLabel = styled.span<{ $state: 'past' | 'active' | 'future' }>`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  box-sizing: border-box;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.1;
  transition: color 0.18s ease;

  ${({ $state }) =>
    $state === 'past'
      ? `
    color: ${theme.colors.gray900};
  `
      : `
    color: ${theme.colors.gray700};
  `}
`;

let PillSizer = styled.span`
  visibility: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  box-sizing: border-box;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.1;
  pointer-events: none;
`;

let PillLabelOverlay = styled(motion.span)`
  position: absolute;
  inset: 0;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  box-sizing: border-box;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.1;
  color: white;
  pointer-events: none;
`;

let PillStepItem = ({
  step,
  index,
  currentStep,
  maxSeen,
  isDisabled,
  disabledReason,
  setCurrentStep,
  slotRef,
  rect,
  activeX,
  activeWidth
}: {
  step: { title: string };
  index: number;
  currentStep: number;
  maxSeen: number;
  isDisabled?: boolean;
  disabledReason?: React.ReactNode;
  setCurrentStep: (step: number) => void;
  slotRef: (node: HTMLButtonElement | null) => void;
  rect?: { x: number; width: number };
  activeX: ReturnType<typeof useSpring>;
  activeWidth: ReturnType<typeof useSpring>;
}) => {
  let clipPath = useTransform([activeX, activeWidth], ([x, width]) => {
    if (!rect) return 'inset(0 100% 0 0)';

    let overlap = Math.max(0, Math.min(x + width, rect.x + rect.width) - Math.max(x, rect.x));

    if (overlap <= 0) return 'inset(0 100% 0 0)';

    let left = Math.max(0, Math.max(x, rect.x) - rect.x);
    let right = Math.max(0, rect.width - (Math.min(x + width, rect.x + rect.width) - rect.x));

    return `inset(0 ${right}px 0 ${left}px)`;
  });

  let button = (
    <PillSlot
      ref={slotRef}
      type="button"
      onClick={() => setCurrentStep(index)}
      disabled={index > maxSeen || isDisabled}
      $state={index === currentStep ? 'active' : index < currentStep ? 'past' : 'future'}
    >
      <PillSizer>{step.title}</PillSizer>
      <PillLabel $state={index < currentStep ? 'past' : 'future'}>{step.title}</PillLabel>
      {rect ? <PillLabelOverlay style={{ clipPath }}>{step.title}</PillLabelOverlay> : null}
    </PillSlot>
  );

  if (disabledReason) {
    return (
      <Tooltip content={disabledReason} enabled={!!disabledReason} delayDuration={0}>
        <span style={{ display: 'inline-flex' }}>{button}</span>
      </Tooltip>
    );
  }

  return button;
};

export let Stepper = ({
  steps,
  currentStep,
  setCurrentStep
}: {
  steps: { title: string; subtitle?: string; render: () => React.ReactNode }[];
  currentStep: number;
  setCurrentStep: (step: number) => void;
}) => {
  let currentStepContent = steps[currentStep] ?? steps[steps.length - 1];
  let children = currentStepContent ? currentStepContent.render() : null;

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
              } as CSSProperties
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

export let PillStepper = ({
  steps,
  currentStep,
  setCurrentStep,
  isStepDisabled,
  getStepDisabledReason
}: {
  steps: { title: string; render: () => React.ReactNode }[];
  currentStep: number;
  setCurrentStep: (step: number) => void;
  isStepDisabled?: (step: number) => boolean;
  getStepDisabledReason?: (step: number) => React.ReactNode;
}) => {
  let currentStepContent = steps[currentStep] ?? steps[steps.length - 1];
  let children = currentStepContent ? currentStepContent.render() : null;
  let headerRef = useRef<HTMLElement | null>(null);
  let slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  let [slotRects, setSlotRects] = useState<{ x: number; width: number }[]>([]);
  let activeX = useMotionValue(0);
  let activeWidth = useMotionValue(0);
  let springX = useSpring(activeX, {
    stiffness: 240,
    damping: 30,
    mass: 0.95
  });
  let springWidth = useSpring(activeWidth, {
    stiffness: 240,
    damping: 30,
    mass: 0.95
  });

  let [maxSeen, setMaxSeen] = useState(currentStep);
  useEffect(() => {
    if (currentStep > maxSeen) setMaxSeen(currentStep);
  }, [currentStep]);

  useLayoutEffect(() => {
    let measure = () => {
      let header = headerRef.current;
      if (!header) return;

      let headerRect = header.getBoundingClientRect();
      let nextRects = slotRefs.current.map(slot => {
        if (!slot) return { x: 0, width: 0 };
        let rect = slot.getBoundingClientRect();
        return {
          x: rect.left - headerRect.left,
          width: rect.width
        };
      });

      setSlotRects(nextRects);
    };

    measure();
    let resizeObserver = new ResizeObserver(measure);
    if (headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }
    for (let slot of slotRefs.current) {
      if (slot) resizeObserver.observe(slot);
    }
    window.addEventListener('resize', measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [steps.length, steps.map(step => step.title).join('|')]);

  useEffect(() => {
    let rect = slotRects[currentStep];
    if (!rect) return;
    activeX.set(rect.x);
    activeWidth.set(rect.width);
  }, [slotRects, currentStep, activeX, activeWidth]);

  return (
    <PillsWrapper>
      <PillsHeader ref={headerRef}>
        {slotRects[currentStep] ? (
          <ActivePillBackground
            style={{
              x: springX,
              width: springWidth
            }}
          />
        ) : null}
        {steps.map((step, index) => (
          <PillStepItem
            key={index}
            slotRef={ref => {
              slotRefs.current[index] = ref;
            }}
            step={step}
            index={index}
            currentStep={currentStep}
            maxSeen={maxSeen}
            isDisabled={isStepDisabled?.(index)}
            disabledReason={getStepDisabledReason?.(index)}
            setCurrentStep={setCurrentStep}
            rect={slotRects[index]}
            activeX={springX}
            activeWidth={springWidth}
          />
        ))}
      </PillsHeader>

      <Main>
        <AnimatePanes orderedIdentifier={currentStep}>{children}</AnimatePanes>
      </Main>
    </PillsWrapper>
  );
};
