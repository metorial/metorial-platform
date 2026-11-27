import { AnimateHeight, Button, Checkbox, theme } from '@metorial/ui';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiErrorWarningLine,
  RiInformationLine
} from '@remixicon/react';
import React from 'react';
import styled, { keyframes } from 'styled-components';

export type PickerRowTone = 'done' | 'needs' | 'failed';

let Item = styled.div<{ $failed: boolean }>`
  border-top: 1px solid ${theme.colors.gray300};
  background: ${p => (p.$failed ? theme.colors.red200 : 'transparent')};

  &:first-child {
    border-top: none;
  }
`;

let Head = styled.div<{ $clickable: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px var(--access-inline, 16px);
  cursor: ${p => (p.$clickable ? 'pointer' : 'default')};
  outline: none;

  &:hover {
    background: ${p => (p.$clickable ? theme.colors.gray100 : 'transparent')};
  }

  &:focus-visible {
    background: ${theme.colors.gray100};
    box-shadow: inset 2px 0 0 ${theme.colors.gray800};
  }
`;

let Lead = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  flex-shrink: 0;
`;

let Text = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

let Title = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${theme.colors.foreground};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let toneColors: Record<PickerRowTone | 'default', string> = {
  default: theme.colors.gray600,
  done: theme.colors.foreground,
  needs: theme.colors.orange900,
  failed: theme.colors.red900
};

let Subtitle = styled.span<{ $tone: PickerRowTone | 'default' }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${p => toneColors[p.$tone]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let Right = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 12px;
  color: ${theme.colors.gray600};
`;

let Chevron = styled(RiArrowDownSLine)<{ $open: boolean }>`
  transition: transform 160ms ease;
  transform: rotate(${p => (p.$open ? 180 : 0)}deg);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

let toneIcons: Partial<Record<PickerRowTone, React.ReactNode>> = {
  needs: <RiInformationLine size={12} />,
  failed: <RiErrorWarningLine size={12} />
};

let Body = styled.div`
  padding: 4px var(--access-inline, 16px) 16px calc(var(--access-inline, 16px) + 38px);

  @media (max-width: 640px) {
    padding-left: var(--access-inline, 16px);
  }
`;

export let PickerRow = (p: {
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  status?: { tone: PickerRowTone; text: React.ReactNode };
  right?: React.ReactNode;
  expandable?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  back?: { label: string; onBack: () => void };
  rowKey?: string;
  children?: React.ReactNode;
}) => {
  let canToggle = !!p.expandable && p.selected && !p.back;
  let showBody = !!p.expandable && p.selected && !!p.open;
  let subtitle = p.status && (!p.open || p.status.tone == 'failed') ? p.status : null;

  let activate = () => {
    if (p.back) return;
    if (canToggle) p.onOpenChange?.(!p.open);
    else p.onSelectedChange(!p.selected);
  };

  return (
    <Item $failed={p.status?.tone == 'failed'}>
      <Head
        $clickable={!p.back}
        tabIndex={p.back ? -1 : 0}
        aria-expanded={canToggle ? !!p.open : undefined}
        data-picker-row={p.rowKey ?? p.title}
        onClick={activate}
        onKeyDown={e => {
          if (e.target != e.currentTarget || e.metaKey || e.ctrlKey) return;

          if (e.key == ' ') {
            e.preventDefault();
            if (!p.back) p.onSelectedChange(!p.selected);
          }

          if (e.key == 'Enter') {
            e.preventDefault();
            activate();
          }
        }}
      >
        <Lead onClick={e => e.stopPropagation()}>
          {p.back ? (
            <Button
              type="button"
              variant="ghost"
              size="1"
              aria-label={p.back.label}
              title={p.back.label}
              icon={<RiArrowLeftLine />}
              onClick={p.back.onBack}
            />
          ) : (
            <Checkbox
              label={`Select ${p.title}`}
              hideLabel
              checked={p.selected}
              onCheckedChange={p.onSelectedChange}
            />
          )}
        </Lead>

        {p.icon}

        <Text>
          <Title>{p.title}</Title>
          {subtitle ? (
            <Subtitle $tone={subtitle.tone}>
              {toneIcons[subtitle.tone] ?? null}
              {subtitle.text}
            </Subtitle>
          ) : p.subtitle ? (
            <Subtitle $tone="default">{p.subtitle}</Subtitle>
          ) : null}
        </Text>

        {p.back ? null : (
          <Right>
            {p.right}
            {canToggle ? <Chevron size={16} $open={!!p.open} /> : null}
          </Right>
        )}
      </Head>

      <AnimateHeight>{showBody ? <Body>{p.children}</Body> : null}</AnimateHeight>
    </Item>
  );
};

let SectionRoot = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px var(--access-inline, 16px) 6px;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  border-top: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;

export let PickerSectionLabel = (p: { icon?: React.ReactNode; children: React.ReactNode }) => (
  <SectionRoot>
    {p.icon}
    {p.children}
  </SectionRoot>
);

let NewRoot = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 8px var(--access-inline, 16px);
  border: none;
  border-bottom: 1px solid ${theme.colors.gray300};
  background: transparent;
  font-size: 14px;
  color: ${theme.colors.gray800};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${theme.colors.gray100};
    color: ${theme.colors.foreground};
  }
`;

let NewIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-left: 38px;
  border-radius: 8px;
  border: 1px dashed ${theme.colors.gray500};
  color: ${theme.colors.gray700};

  @media (max-width: 640px) {
    margin-left: 0;
  }
`;

export let PickerCreateRow = (p: { children: React.ReactNode; onClick: () => void }) => (
  <NewRoot type="button" onClick={p.onClick}>
    <NewIcon>
      <RiAddLine size={16} />
    </NewIcon>
    {p.children}
  </NewRoot>
);

let NoteRoot = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px var(--access-inline, 16px);
  font-size: 12px;
  color: ${theme.colors.gray600};
  border-top: 1px solid ${theme.colors.gray300};
`;

export let PickerNote = (p: { icon?: React.ReactNode; children: React.ReactNode }) => (
  <NoteRoot>
    {p.icon}
    {p.children}
  </NoteRoot>
);

let OptionGroupRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;

  &:first-child {
    padding-top: 0;
  }
`;

let OptionGroupHead = styled.div`
  display: flex;
  gap: 8px;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${theme.colors.gray700};
  }
`;

let OptionGroupTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  b {
    font-size: 13px;
    font-weight: 600;
    color: ${theme.colors.foreground};
  }

  span {
    font-size: 12px;
    color: ${theme.colors.gray600};
  }
`;

export let PickerOptionGroup = (p: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <OptionGroupRoot>
    <OptionGroupHead>
      {p.icon}
      <OptionGroupTitle>
        <b>{p.title}</b>
        {p.description ? <span>{p.description}</span> : null}
      </OptionGroupTitle>
    </OptionGroupHead>
    {p.children}
  </OptionGroupRoot>
);

let FooterRoot = styled.div`
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: auto -20px -15px;
  padding: 12px 20px;
  border-top: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.background};
`;

let FooterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  & > .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: ${theme.colors.gray700};
  }
`;

export let PickerFooter = (p: {
  status?: React.ReactNode;
  tray?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <FooterRoot>
    {p.tray}

    <FooterRow>
      <span className="status">{p.status}</span>
      {p.children}
    </FooterRow>
  </FooterRoot>
);

let pulse = keyframes`
  50% {
    opacity: 0.5;
  }
`;

let SkeletonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px var(--access-inline, 16px);
  border-top: 1px solid ${theme.colors.gray300};

  &:first-child {
    border-top: none;
  }
`;

let SkeletonBlock = styled.span<{ $width: string; $height: number; $radius: number }>`
  display: block;
  flex-shrink: 0;
  width: ${p => p.$width};
  height: ${p => p.$height}px;
  border-radius: ${p => p.$radius}px;
  background: ${theme.colors.gray300};
  animation: ${pulse} 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

let skeletonWidths = ['48%', '34%', '42%', '28%', '38%', '31%'];

export let PickerSkeletonRows = (p: { count?: number }) => (
  <div aria-busy="true" aria-label="Loading">
    {skeletonWidths.slice(0, p.count ?? skeletonWidths.length).map((width, i) => (
      <SkeletonRow key={i}>
        <Lead>
          <SkeletonBlock $width="16px" $height={16} $radius={4} />
        </Lead>
        <SkeletonBlock $width="32px" $height={32} $radius={8} />
        <SkeletonBlock $width={width} $height={12} $radius={6} />
      </SkeletonRow>
    ))}
  </div>
);
