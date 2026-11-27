import {
  RiArrowDownSLine,
  RiCheckLine,
  RiKeyLine,
  RiLockLine,
  RiMore2Line,
  RiPencilLine,
  RiPlayLine,
  RiTeamLine,
  RiUserLine
} from '@remixicon/react';
import {
  Button,
  getControlSize,
  getFieldFontSize,
  Menu,
  OptionToggle,
  Text,
  theme,
  type MenuItem
} from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

export type AccessLevel = 'use' | 'edit' | 'manage';

let levelIcons: Record<AccessLevel, React.ReactNode> = {
  use: <RiPlayLine size={12} />,
  edit: <RiPencilLine size={12} />,
  manage: <RiKeyLine size={12} />
};

let levelLabels: Record<AccessLevel, string> = {
  use: 'Can use',
  edit: 'Can edit',
  manage: 'Can edit and share'
};

let LevelRoot = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
`;

export let AccessLevelBadge = (p: { level: AccessLevel }) => (
  <LevelRoot style={{ ...getControlSize('1'), fontSize: getFieldFontSize('1') }}>
    {levelIcons[p.level]}
    {levelLabels[p.level]}
  </LevelRoot>
);

let LevelButton = styled.button.attrs({ type: 'button' })`
  display: flex;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};
  outline: none;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
  border: none;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;

  &:focus {
    background: ${theme.colors.gray300};
    outline: none;
  }

  &:focus-visible {
    background: ${theme.colors.gray300};
    outline: 1px solid ${theme.colors.gray600};
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`;

export type AccessLevelOption = { level: AccessLevel; description?: React.ReactNode };

export let AccessLevelPicker = (p: {
  level: AccessLevel;
  options: AccessLevelOption[];
  onChange: (level: AccessLevel) => void;
  disabled?: boolean;
}) => (
  <Menu
    items={p.options.map(option => ({
      id: option.level,
      label: levelLabels[option.level],
      description: option.description,
      icon: option.level == p.level ? <RiCheckLine /> : <span />
    }))}
    onItemClick={id => {
      if (id != p.level) p.onChange(id as AccessLevel);
    }}
  >
    <LevelButton
      disabled={p.disabled}
      aria-label={`Access level: ${levelLabels[p.level]}`}
      style={{ ...getControlSize('1'), fontSize: getFieldFontSize('1') }}
    >
      {levelIcons[p.level]}
      {levelLabels[p.level]}
      <RiArrowDownSLine size={14} style={{ opacity: 0.5 }} />
    </LevelButton>
  </Menu>
);

let SourceRoot = styled.span<{ $direct: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 12px;
  color: ${p => (p.$direct ? theme.colors.foreground : theme.colors.gray700)};
  background: ${theme.colors.background};
  box-shadow: inset 0 0 0 1px ${theme.colors.gray400};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export let AccessSourceTag = (p: { direct?: boolean; name?: string }) => (
  <SourceRoot
    $direct={!!p.direct}
    title={p.direct ? 'Granted directly' : `Inherited from ${p.name}`}
  >
    {p.direct ? <RiUserLine size={12} /> : <RiTeamLine size={12} />}
    {p.direct ? 'Direct' : p.name}
  </SourceRoot>
);

let DetailRoot = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 13px;
  color: ${theme.colors.gray800};
  background: transparent;
  border: none;
  white-space: nowrap;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  svg {
    flex-shrink: 0;
    color: ${theme.colors.gray600};
  }
`;

let DetailButton = styled(DetailRoot).attrs({ as: 'button', type: 'button' })`
  justify-content: space-between;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};
  outline: none;
  transition: all 0.3s ease;
  font-weight: 500;
  cursor: pointer;

  &:focus {
    background: ${theme.colors.gray300};
    outline: none;
  }

  &:focus-visible {
    background: ${theme.colors.gray300};
    outline: 1px solid ${theme.colors.gray600};
  }
`;

export let AccessDetail = (p: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) =>
  p.onClick ? (
    <DetailButton
      onClick={p.onClick}
      title={p.title}
      style={{ ...getControlSize('1'), fontSize: getFieldFontSize('1') }}
    >
      {p.icon}
      <span>{p.children}</span>
      <RiArrowDownSLine size={14} style={{ opacity: 0.5 }} />
    </DetailButton>
  ) : (
    <DetailRoot title={p.title}>
      {p.icon}
      <span>{p.children}</span>
    </DetailRoot>
  );

export let AccessList = styled.div`
  display: flex;
  flex-direction: column;
`;

let RowRoot = styled.div<{ $inherited: boolean; $withSource: boolean }>`
  display: grid;
  grid-template-columns: ${p =>
    p.$withSource
      ? 'minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1fr) 150px 32px'
      : 'minmax(0, 2fr) minmax(0, 1.4fr) 150px 32px'};
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px var(--access-inline, 16px);
  border-top: 1px solid ${theme.colors.gray300};
  opacity: ${p => (p.$inherited ? 0.62 : 1)};

  &:first-child {
    border-top: none;
  }

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr) 32px;

    & > :nth-child(2),
    & > :nth-child(3) {
      grid-column: 1 / -1;
    }
  }
`;

let Cell = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
`;

let ActionCell = styled.div`
  display: flex;
  justify-content: flex-end;
  color: ${theme.colors.gray600};
`;

export let AccessRow = (p: {
  lead: React.ReactNode;
  detail?: React.ReactNode;
  sources?: React.ReactNode;
  level?: AccessLevel;
  levelControl?: React.ReactNode;
  actions?: React.ReactNode;
  inherited?: { from: string };
}) => (
  <RowRoot $inherited={!!p.inherited} $withSource={p.sources !== undefined}>
    {p.lead}
    <Cell>{p.detail}</Cell>
    {p.sources !== undefined ? <Cell>{p.sources}</Cell> : null}
    <Cell>{p.levelControl ?? (p.level ? <AccessLevelBadge level={p.level} /> : null)}</Cell>
    <ActionCell>
      {p.inherited ? (
        <span title={`Inherited from ${p.inherited.from}`}>
          <RiLockLine size={14} />
        </span>
      ) : (
        p.actions
      )}
    </ActionCell>
  </RowRoot>
);

let EntityRoot = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

let EntityText = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  & > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let EntityTitle = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: ${theme.colors.foreground};
`;

let EntitySubtitle = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray600};
`;

export let AccessEntityCell = (p: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
}) => (
  <EntityRoot>
    {p.icon}
    <EntityText>
      <EntityTitle>
        {p.title}
        {p.badge}
      </EntityTitle>
      {p.subtitle ? <EntitySubtitle>{p.subtitle}</EntitySubtitle> : null}
    </EntityText>
  </EntityRoot>
);

export let AccessToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--access-toolbar-top, 12px) var(--access-inline, 16px) 12px;
  border-bottom: 1px solid ${theme.colors.gray300};

  & > .grow {
    flex: 1 1 auto;
    min-width: 0;
  }

  @media (max-width: 720px) {
    flex-wrap: wrap;
  }
`;

export let AccessFlat = styled.div`
  --access-inline: 0px;
  --access-toolbar-top: 0px;
`;

export let AccessSection = styled.div`
  border-radius: 10px;
  background: ${theme.colors.background};
  box-shadow: inset 0 0 0 1px ${theme.colors.gray400};
  overflow: hidden;
`;

let SeparatorRoot = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px var(--access-inline, 16px);
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  background: ${theme.colors.gray200};
  border-top: 1px solid ${theme.colors.gray300};
`;

export let AccessListSeparator = (p: { children: React.ReactNode; count?: number }) => (
  <SeparatorRoot>
    {p.children}
    {p.count !== undefined ? (
      <Text size="1" color="gray600">
        {p.count}
      </Text>
    ) : null}
  </SeparatorRoot>
);

let MoreRoot = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px var(--access-inline, 16px);
  border: none;
  border-top: 1px solid ${theme.colors.gray300};
  background: transparent;
  font-size: 13px;
  color: ${theme.colors.gray700};
  cursor: pointer;

  &:hover:not(:disabled) {
    color: ${theme.colors.foreground};
  }

  &:disabled {
    cursor: default;
  }
`;

export let AccessListMore = (p: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
}) => (
  <MoreRoot type="button" onClick={p.onClick} disabled={p.loading}>
    {p.icon ?? <RiArrowDownSLine size={14} />}
    {p.loading ? 'Loading…' : p.children}
  </MoreRoot>
);

let EmptyRoot = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 16px;
  text-align: center;
`;

export let AccessEmpty = (p: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <EmptyRoot>
    <Text size="2" weight="strong">
      {p.title}
    </Text>
    {p.description ? (
      <Text size="2" color="gray600">
        {p.description}
      </Text>
    ) : null}
    {p.action ? <div style={{ marginTop: 6 }}>{p.action}</div> : null}
  </EmptyRoot>
);

export type AccessKindFilterValue = 'all' | 'integrations' | 'skills' | 'marketplaces';

export let AccessKindFilter = (p: {
  value: AccessKindFilterValue;
  onChange: (value: AccessKindFilterValue) => void;
  counts?: Partial<Record<AccessKindFilterValue, number>>;
  kinds?: AccessKindFilterValue[];
}) => {
  let labels: Record<AccessKindFilterValue, string> = {
    all: 'All',
    integrations: 'Integrations',
    skills: 'Skills',
    marketplaces: 'Marketplaces'
  };

  return (
    <OptionToggle
      size="2"
      itemMinWidth={0}
      ariaLabel="Filter by kind"
      value={p.value}
      onChange={value => p.onChange(value as AccessKindFilterValue)}
      items={(p.kinds ?? ['all', 'integrations', 'skills', 'marketplaces']).map(kind => ({
        id: kind,
        label:
          p.counts?.[kind] !== undefined ? (
            <>
              {labels[kind]}{' '}
              <span style={{ opacity: 0.55, fontWeight: 400 }}>{p.counts[kind]}</span>
            </>
          ) : (
            labels[kind]
          )
      }))}
    />
  );
};

export let AccessRowMenu = (p: { items: MenuItem[]; onItemClick?: (id: string) => void }) => (
  <Menu items={p.items} onItemClick={p.onItemClick}>
    <Button
      variant="ghost"
      size="1"
      aria-label="Access options"
      title="Access options"
      icon={<RiMore2Line />}
    />
  </Menu>
);
