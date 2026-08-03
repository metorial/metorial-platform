import { AnimatePanes, Tooltip, theme } from '@metorial/ui';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue
} from 'framer-motion';
import { RiCheckLine } from '@remixicon/react';
import React, { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  min-height: 0;
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
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

let PillsWrapper = styled.div<{ $gap?: number }>`
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
  height: 100%;
`;

let PaneFill = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  > * {
    flex: 1;
    min-height: 0;
  }
`;

let PillsHeader = styled.header`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  padding: 2px 4px;
`;

let PillsRailTrack = styled.div`
  position: absolute;
  top: 50%;
  left: 18px;
  right: 18px;
  height: 3px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  z-index: 0;
  pointer-events: none;
`;

let PillsRailProgress = styled(motion.div)`
  position: absolute;
  top: 50%;
  height: 3px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: #111111;
  z-index: 0;
  pointer-events: none;
`;

let PillSlot = styled.button<{ $state: 'past' | 'active' | 'future' }>`
  position: relative;
  border: none;
  background: transparent;
  padding: 0 9px;
  height: 34px;
  box-sizing: border-box;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: visible;
  cursor: pointer;
  z-index: 3;
  transition: transform 0.18s ease;

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: none;
    transform: translateY(-1px);
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 999px;
    z-index: 1;
    border: 1px solid
      ${({ $state }) =>
        $state === 'active'
          ? 'transparent'
          : $state === 'future'
            ? theme.colors.gray300
            : 'rgba(17, 17, 17, 0.08)'};
    background: ${({ $state }) =>
      $state === 'active' ? 'transparent' : $state === 'past' ? '#eeeeee' : '#ffffff'};
    box-shadow: ${({ $state }) =>
      $state === 'active' ? 'none' : '0 1px 2px rgba(17, 17, 17, 0.04)'};
  }

  &:not(:disabled):hover {
    transform: translateY(-1px);
  }

  &:focus-visible::before {
    box-shadow:
      0 0 0 4px rgba(17, 17, 17, 0.08),
      0 1px 2px rgba(17, 17, 17, 0.04);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.56;
    transform: none;
  }
`;

let ActivePillBackground = styled(motion.div)`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: 999px;
  background: #111111;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 6px 16px rgba(17, 17, 17, 0.16);
  z-index: 2;
  pointer-events: none;
`;

let PillLabel = styled.span`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 9px;
  box-sizing: border-box;
  white-space: nowrap;
`;

let PillSizer = styled.span`
  visibility: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 9px;
  box-sizing: border-box;
  white-space: nowrap;
  pointer-events: none;
`;

let PillLabelOverlay = styled(motion.span)`
  position: absolute;
  inset: 0;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 9px;
  box-sizing: border-box;
  white-space: nowrap;
  pointer-events: none;
`;

let PillContent = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
`;

let getPillIndexBadgeStyle = ({
  state,
  overlay
}: {
  state: 'past' | 'active' | 'future';
  overlay?: boolean;
}): CSSProperties => ({
  width: 15,
  height: 15,
  minWidth: 15,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 9,
  fontWeight: 700,
  lineHeight: 1,
  border: `1px solid ${
    overlay
      ? 'rgba(255, 255, 255, 0.16)'
      : state === 'active'
        ? 'rgba(255, 255, 255, 0.18)'
        : state === 'future'
          ? theme.colors.gray400
          : 'rgba(17, 17, 17, 0.08)'
  }`,
  background: overlay
    ? 'rgba(255, 255, 255, 0.18)'
    : state === 'active'
      ? 'rgba(255, 255, 255, 0.14)'
      : state === 'past'
        ? '#111111'
        : '#ffffff',
  color: overlay
    ? '#ffffff'
    : state === 'active' || state === 'past'
      ? '#ffffff'
      : theme.colors.gray700,
  boxShadow: 'none'
});

let getPillTitleStyle = ({
  state,
  overlay
}: {
  state: 'past' | 'active' | 'future';
  overlay?: boolean;
}): CSSProperties => ({
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.1,
  color: overlay
    ? '#ffffff'
    : state === 'active'
      ? '#ffffff'
      : state === 'past'
        ? theme.colors.gray900
        : theme.colors.gray700
});

let PillLabelContent = (p: {
  index: number;
  title: string;
  state: 'past' | 'active' | 'future';
  overlay?: boolean;
}) => (
  <PillContent>
    <span style={getPillIndexBadgeStyle({ state: p.state, overlay: p.overlay })}>
      {p.state === 'past' && !p.overlay ? <RiCheckLine size={12} /> : p.index + 1}
    </span>
    <span style={getPillTitleStyle({ state: p.state, overlay: p.overlay })}>{p.title}</span>
  </PillContent>
);

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
  activeX: MotionValue<number>;
  activeWidth: MotionValue<number>;
}) => {
  let state: 'past' | 'active' | 'future' =
    index === currentStep ? 'active' : index < currentStep ? 'past' : 'future';
  let clipPath = useTransform([activeX, activeWidth], (latest: number[]) => {
    let [x = 0, width = 0] = latest;

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
      $state={state}
    >
      <PillSizer>
        <PillLabelContent index={index} title={step.title} state={state} />
      </PillSizer>
      <PillLabel>
        <PillLabelContent index={index} title={step.title} state={state} />
      </PillLabel>
      {rect ? (
        <PillLabelOverlay style={{ clipPath }}>
          <PillLabelContent index={index} title={step.title} state={state} overlay />
        </PillLabelOverlay>
      ) : null}
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
              if (i === 0) return `calc(${100 / steps.length}% - 20px)`;
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
        <PaneFill>
          <AnimatePanes orderedIdentifier={currentStep}>{children}</AnimatePanes>
        </PaneFill>
      </Main>
    </Wrapper>
  );
};

export let PillStepper = ({
  steps,
  currentStep,
  setCurrentStep,
  isStepDisabled,
  getStepDisabledReason,
  paneAnimationDelayMs
}: {
  steps: { title: string; render: () => React.ReactNode }[];
  currentStep: number;
  setCurrentStep: (step: number) => void;
  isStepDisabled?: (step: number) => boolean;
  getStepDisabledReason?: (step: number) => React.ReactNode;
  paneAnimationDelayMs?: number;
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
  let railProgressWidth = useTransform([springX, springWidth], (latest: number[]) => {
    let [x = 0, width = 0] = latest;
    let firstRect = slotRects[0];
    if (!firstRect) return 0;

    let railStart = firstRect.x + firstRect.width / 2;
    let railEnd = x + width / 2;
    return Math.max(0, railEnd - railStart);
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

  let railLeft = slotRects[0] ? slotRects[0]!.x + slotRects[0]!.width / 2 : 0;

  return (
    <PillsWrapper>
      <PillsHeader ref={headerRef}>
        {steps.length > 1 ? <PillsRailTrack /> : null}
        {slotRects[0] ? (
          <PillsRailProgress
            style={{
              left: railLeft,
              width: railProgressWidth
            }}
          />
        ) : null}
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
        <PaneFill>
          <AnimatePanes orderedIdentifier={currentStep} delayMs={paneAnimationDelayMs}>
            {children}
          </AnimatePanes>
        </PaneFill>
      </Main>
    </PillsWrapper>
  );
};
