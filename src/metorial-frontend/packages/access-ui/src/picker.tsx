import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiInformationLine
} from '@remixicon/react';
import { AnimateHeight, Button, Checkbox, theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

let Item = styled.div<{ $selected: boolean }>`
  border-top: 1px solid ${theme.colors.gray300};
  background: ${p => (p.$selected ? theme.colors.gray100 : theme.colors.background)};

  &:first-child {
    border-top: none;
  }
`;

let Head = styled.div<{ $clickable: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px 16px;
  cursor: ${p => (p.$clickable ? 'pointer' : 'default')};

  &:hover {
    background: ${p => (p.$clickable ? theme.colors.gray200 : 'transparent')};
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

let Subtitle = styled.span<{ $tone: 'default' | 'done' | 'needs' }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${p =>
    p.$tone == 'needs'
      ? theme.colors.orange900
      : p.$tone == 'done'
        ? theme.colors.foreground
        : theme.colors.gray600};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let Right = styled.span`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  font-size: 12px;
  color: ${theme.colors.gray600};
`;

let Chevron = styled(RiArrowDownSLine)<{ $open: boolean }>`
  transition: transform 160ms ease;
  transform: rotate(${p => (p.$open ? 180 : 0)}deg);
`;

let Body = styled.div`
  padding: 4px 16px 16px 54px;

  @media (max-width: 640px) {
    padding-left: 16px;
  }
`;

export let PickerRow = (p: {
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  status?: { tone: 'done' | 'needs'; text: React.ReactNode };
  right?: React.ReactNode;
  expandable?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  back?: { label: string; onBack: () => void };
  children?: React.ReactNode;
}) => {
  let canToggle = !!p.expandable && p.selected && !p.back;
  let showBody = !!p.expandable && p.selected && !!p.open;
  let subtitle = p.status && !p.open ? p.status : null;

  return (
    <Item $selected={p.selected}>
      <Head
        $clickable={!p.back}
        onClick={() => {
          if (p.back) return;
          if (canToggle) p.onOpenChange?.(!p.open);
          else p.onSelectedChange(!p.selected);
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
              {subtitle.tone == 'needs' ? <RiInformationLine size={12} /> : null}
              {subtitle.text}
            </Subtitle>
          ) : p.subtitle ? (
            <Subtitle $tone="default">{p.subtitle}</Subtitle>
          ) : null}
        </Text>

        {canToggle ? (
          <Right>
            <Chevron size={16} $open={!!p.open} />
          </Right>
        ) : p.back ? null : (
          <Right>{p.right}</Right>
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
  padding: 10px 16px 6px;
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
  padding: 8px 16px;
  border: none;
  border-bottom: 1px solid ${theme.colors.gray300};
  background: transparent;
  font-size: 14px;
  color: ${theme.colors.gray800};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${theme.colors.gray200};
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
  padding: 10px 16px;
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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0 0;

  & > .status {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: ${theme.colors.gray700};
  }
`;

export let PickerFooter = (p: { status: React.ReactNode; children: React.ReactNode }) => (
  <FooterRoot>
    <span className="status">{p.status}</span>
    {p.children}
  </FooterRoot>
);
