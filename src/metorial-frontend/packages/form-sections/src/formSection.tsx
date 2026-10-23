import { Collapsible } from '@base-ui/react/collapsible';
import { Badge, theme } from '@metorial/ui';
import { RiArrowDownSLine, RiCheckLine } from '@remixicon/react';
import React, { type CSSProperties, type ReactNode } from 'react';
import styled, { css, keyframes } from 'styled-components';

export type FormSectionRequirement = 'required' | 'optional';

export type FormSectionState = FormSectionRequirement | 'completed' | 'error';

export type FormSectionProps = {
  title: ReactNode;
  description?: ReactNode;
  badge?: FormSectionRequirement | ReactNode;
  summary?: ReactNode;
  completed?: boolean;
  error?: boolean | ReactNode;
  hideIndicator?: boolean;
  collapsible?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
};

let headerDivider = '1px solid rgba(17, 17, 17, 0.08)';

let springEase = 'cubic-bezier(0.34, 1.36, 0.64, 1)';

let popIn = keyframes`
  from { opacity: 0; transform: translateY(-4px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

let glyphIn = keyframes`
  from { opacity: 0; transform: scale(0.65) rotate(-12deg); }
  to { opacity: 1; transform: scale(1) rotate(0deg); }
`;

export let FormSectionCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid ${theme.colors.gray400};
  box-shadow: ${theme.shadows.small};
`;

export let FormSectionList = styled.div<{ $gap?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $gap }) => $gap ?? 12}px;
`;

let Card = styled(FormSectionCard)`
  padding: 0;
  gap: 0;
  overflow: hidden;
`;

let headerLayout = css`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
  padding: 16px 16px 12px;
  border-bottom: ${headerDivider};
  transition:
    padding 0.3s ease,
    border-color 0.3s ease,
    background 0.2s ease;
`;

let Aside = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 24px;
  flex-shrink: 0;
  max-width: 45%;
  color: ${theme.colors.gray700};
`;

let Summary = styled.span`
  font-size: 13px;
  color: ${theme.colors.gray700};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let Chevron = styled(RiArrowDownSLine)`
  flex-shrink: 0;
  opacity: 0.5;
  transition: transform 0.2s ease;
`;

let StaticHeader = styled.div<{ $flush: boolean }>`
  ${headerLayout}

  ${({ $flush }) =>
    $flush &&
    css`
      padding-bottom: 16px;
      border-bottom-color: transparent;
    `}
`;

let TriggerHeader = styled(Collapsible.Trigger)`
  ${headerLayout}
  margin: 0;
  border-top: none;
  border-left: none;
  border-right: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &[data-panel-open] ${Summary} {
    display: none;
  }

  &[data-panel-open] ${Chevron} {
    transform: rotate(180deg);
  }

  &:not([data-panel-open]) {
    padding-bottom: 16px;
    border-bottom-color: transparent;
  }

  &:hover:not([data-disabled]),
  &:focus-visible {
    background: ${theme.colors.gray100};
    outline: none;
  }

  &[data-disabled] {
    cursor: not-allowed;
  }
`;

let TitleBlock = styled.span`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
`;

let TitleRow = styled.span`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
`;

let Title = styled.span`
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
`;

let Description = styled.span`
  font-size: 14px;
  line-height: 20px;
  color: ${theme.colors.gray700};
`;

let ErrorMessage = styled.span`
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  color: ${theme.colors.red900};
`;

let BadgeSlot = styled.span`
  display: inline-flex;
  animation: ${popIn} 0.2s ease-out;
`;

let indicatorStates: Record<
  FormSectionState,
  { background: string; border: string; borderStyle: string; shadow: string; scale: number }
> = {
  completed: {
    background: theme.colors.primary300,
    border: theme.colors.primary300,
    borderStyle: 'solid',
    shadow: `0 0 0 4px ${theme.colors.blue300}`,
    scale: 1.02
  },
  error: {
    background: theme.colors.red900,
    border: theme.colors.red900,
    borderStyle: 'solid',
    shadow: `0 0 0 4px ${theme.colors.red300}`,
    scale: 1.02
  },
  required: {
    background: 'rgba(255, 255, 255, 0.96)',
    border: 'rgba(17, 17, 17, 0.14)',
    borderStyle: 'solid',
    shadow: '0 1px 2px rgba(17, 17, 17, 0.05)',
    scale: 1
  },
  optional: {
    background: 'rgba(255, 255, 255, 0.96)',
    border: 'rgba(17, 17, 17, 0.18)',
    borderStyle: 'dashed',
    shadow: '0 1px 2px rgba(17, 17, 17, 0.05)',
    scale: 1
  }
};

let Indicator = styled.span<{ $state: FormSectionState }>`
  width: 22px;
  height: 22px;
  min-width: 22px;
  box-sizing: border-box;
  border-radius: 999px;
  border-width: 1.5px;
  border-style: ${({ $state }) => indicatorStates[$state].borderStyle};
  border-color: ${({ $state }) => indicatorStates[$state].border};
  background: ${({ $state }) => indicatorStates[$state].background};
  box-shadow: ${({ $state }) => indicatorStates[$state].shadow};
  transform: scale(${({ $state }) => indicatorStates[$state].scale});
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition:
    background-color 0.35s ${springEase},
    border-color 0.35s ${springEase},
    box-shadow 0.35s ${springEase},
    transform 0.35s ${springEase};
`;

let IndicatorGlyph = styled.span`
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  animation: ${glyphIn} 0.18s ease-out;
`;

let IndicatorDot = styled.span<{ $required: boolean }>`
  width: ${({ $required }) => ($required ? 8 : 6)}px;
  height: ${({ $required }) => ($required ? 8 : 6)}px;
  border-radius: 999px;
  background: ${({ $required }) =>
    $required ? 'rgba(17, 17, 17, 0.58)' : 'rgba(17, 17, 17, 0.22)'};
  opacity: ${({ $required }) => ($required ? 0.7 : 0.35)};
  animation: ${glyphIn} 0.18s ease-out;
`;

let Body = styled.div`
  padding: 16px;
`;

let Panel = styled(Collapsible.Panel)`
  height: var(--collapsible-panel-height);
  overflow: hidden;
  transition: height 0.3s ease;

  &[data-starting-style],
  &[data-ending-style] {
    height: 0;
  }
`;

let getRequirement = (badge: FormSectionProps['badge']): FormSectionRequirement | null => {
  if (badge == 'required') return 'required';
  if (badge == 'optional') return 'optional';
  return null;
};

export let getFormSectionState = (p: {
  badge?: FormSectionProps['badge'];
  completed?: boolean;
  error?: FormSectionProps['error'];
}): FormSectionState => {
  if (p.error) return 'error';
  if (p.completed) return 'completed';
  return getRequirement(p.badge) == 'required' ? 'required' : 'optional';
};

let SectionIndicator = ({ state }: { state: FormSectionState }) => (
  <Indicator $state={state} aria-hidden>
    {state == 'completed' && (
      <IndicatorGlyph key="completed">
        <RiCheckLine size={13} />
      </IndicatorGlyph>
    )}

    {state == 'error' && <IndicatorGlyph key="error">!</IndicatorGlyph>}

    {(state == 'required' || state == 'optional') && (
      <IndicatorDot key={state} $required={state == 'required'} />
    )}
  </Indicator>
);

let SectionBadge = ({
  state,
  badge
}: {
  state: FormSectionState;
  badge: FormSectionProps['badge'];
}) => {
  if (state == 'completed') {
    return (
      <BadgeSlot key="completed">
        <Badge color="blue" size="2">
          Completed
        </Badge>
      </BadgeSlot>
    );
  }

  if (state == 'error') {
    return (
      <BadgeSlot key="error">
        <Badge color="red" size="2">
          Error
        </Badge>
      </BadgeSlot>
    );
  }

  let requirement = getRequirement(badge);

  if (requirement) {
    return (
      <BadgeSlot key={requirement}>
        <Badge color={requirement == 'required' ? 'orange' : 'gray'} size="2">
          {requirement == 'required' ? 'Required' : 'Optional'}
        </Badge>
      </BadgeSlot>
    );
  }

  if (badge === undefined || badge === null || badge === false) return null;

  return <BadgeSlot key="custom">{badge as ReactNode}</BadgeSlot>;
};

export let FormSection = ({
  title,
  description,
  badge,
  summary,
  completed,
  error,
  hideIndicator,
  collapsible,
  open,
  defaultOpen,
  onOpenChange,
  disabled,
  children,
  style
}: FormSectionProps) => {
  let state = getFormSectionState({ badge, completed, error });
  let errorMessage = error && error !== true ? (error as ReactNode) : null;

  let headerContent = (
    <TitleBlock>
      <TitleRow>
        {!hideIndicator && <SectionIndicator state={state} />}
        <Title>{title}</Title>
        <SectionBadge state={state} badge={badge} />
      </TitleRow>

      {description && <Description>{description}</Description>}
      {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
    </TitleBlock>
  );

  if (!collapsible) {
    return (
      <Card style={style}>
        <StaticHeader $flush={children === undefined}>{headerContent}</StaticHeader>
        {children !== undefined && <Body>{children}</Body>}
      </Card>
    );
  }

  return (
    <Card style={style}>
      <Collapsible.Root
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={nextOpen => onOpenChange?.(nextOpen)}
        disabled={disabled}
      >
        <TriggerHeader>
          {headerContent}

          <Aside>
            {summary && <Summary>{summary}</Summary>}
            <Chevron size={16} />
          </Aside>
        </TriggerHeader>

        <Panel keepMounted>
          <Body>{children}</Body>
        </Panel>
      </Collapsible.Root>
    </Card>
  );
};
