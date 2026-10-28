import {
  FloatingMenu,
  type FloatingMenuItem,
  floatingSurface,
  theme,
  Tooltip
} from '@metorial/ui';
import { RiAddLine, RiArrowDownSLine, RiMoreLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import styled, { css } from 'styled-components';
import { workspaceEase } from './motion';

export type WorkspaceSectionVariant = 'floating' | 'sidebar' | 'flyout';

let Root = styled.section<{ $variant: WorkspaceSectionVariant }>`
  flex: 0 0 auto;
  overflow: hidden;

  ${({ $variant }) =>
    $variant == 'sidebar'
      ? css`
          border-radius: 0;
          background: transparent;
        `
      : css`
          ${floatingSurface};
          border-radius: 10px;
        `}
`;

let HeaderButton = styled.button`
  all: unset;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  height: 100%;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: -2px;
    border-radius: 6px;
  }
`;

let Header = styled.header<{ $variant: WorkspaceSectionVariant }>`
  display: flex;
  align-items: center;
  gap: 2px;
  height: ${({ $variant }) => ($variant == 'sidebar' ? '38px' : '40px')};
  padding: 0 6px 0 12px;
  user-select: none;

  > ${HeaderButton} > svg:first-child {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    color: ${theme.colors.gray700};
  }
`;

let Title = styled.span`
  overflow: hidden;
  color: ${theme.colors.foreground};
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let Count = styled.span`
  flex: 0 0 auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: ${theme.colors.gray250};
  color: ${theme.colors.gray700};
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  box-sizing: border-box;
`;

export let SectionIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${theme.colors.gray650};
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    background 0.15s ease;

  ${Root}:hover &,
  &:focus-visible,
  &[data-popup-open] {
    opacity: 1;
  }

  &:hover {
    background: ${theme.colors.gray250};
    color: ${theme.colors.foreground};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

let Chevron = styled(RiArrowDownSLine)<{ $collapsed: boolean }>`
  flex: 0 0 auto;
  width: 20px;
  margin-left: 2px;
  color: ${theme.colors.gray600};
  transform: rotate(${({ $collapsed }) => ($collapsed ? '-90deg' : '0deg')});
  transition: transform 0.32s ${workspaceEase};
`;

let Body = styled.div<{ $collapsed: boolean }>`
  display: grid;
  grid-template-rows: ${({ $collapsed }) => ($collapsed ? '0fr' : '1fr')};
  transition: grid-template-rows 0.32s ${workspaceEase};

  > div {
    min-height: 0;
    overflow: hidden;
    opacity: ${({ $collapsed }) => ($collapsed ? 0 : 1)};
    transition: opacity 0.22s ease;
  }
`;

let Spacer = styled.span`
  flex: 1;
`;

export let SectionList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 6px 6px;
`;

export let SectionEmpty = styled.div`
  padding: 4px 8px 8px;
  color: ${theme.colors.gray650};
  font-size: 12px;
  line-height: 1.5;
`;

export let SectionGroupLabel = styled.div`
  padding: 8px 8px 4px;
  color: ${theme.colors.gray600};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
`;

export let SectionFooter = styled.div`
  display: flex;
  padding: 0 6px 6px;
`;

export let SectionLinkButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${theme.colors.gray700};
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray200};
    color: ${theme.colors.foreground};
  }

  svg {
    width: 15px;
    height: 15px;
  }
`;

export let sectionRowStyles = css<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 32px;
  padding: 5px 8px;
  border: 0;
  border-radius: 6px;
  background: ${({ $active }) => ($active ? theme.colors.gray300 : 'transparent')};
  color: ${theme.colors.gray900};
  font-family: inherit;
  text-align: left;
  text-decoration: none;
  box-sizing: border-box;
  cursor: pointer;

  &:hover {
    background: ${({ $active }) => ($active ? theme.colors.gray300 : theme.colors.gray200)};
    text-decoration: none;
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: -2px;
  }
`;

export let SectionRow = styled.button<{ $active?: boolean }>`
  ${sectionRowStyles};
`;

export let SectionRowMain = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
`;

export let SectionRowTitle = styled.span`
  overflow: hidden;
  color: ${theme.colors.gray900};
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export let SectionRowMeta = styled.span`
  overflow: hidden;
  color: ${theme.colors.gray650};
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export type WorkspaceSectionAdd =
  { label: string; onClick: () => void } | { label: string; items: FloatingMenuItem[] };

export let WorkspaceSection = (p: {
  icon: ReactNode;
  title: string;
  count?: number;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  add?: WorkspaceSectionAdd | null;
  menu?: FloatingMenuItem[];
  variant: WorkspaceSectionVariant;
  children: ReactNode;
}) => {
  let collapsible = p.variant != 'flyout' && !!p.onCollapsedChange;
  let collapsed = collapsible && !!p.collapsed;

  let addButton = p.add ? (
    'items' in p.add ? (
      <FloatingMenu
        trigger={
          <SectionIconButton aria-label={p.add.label} type="button">
            <RiAddLine />
          </SectionIconButton>
        }
        items={p.add.items}
        align="end"
      />
    ) : (
      <Tooltip content={p.add.label}>
        <SectionIconButton aria-label={p.add.label} onClick={p.add.onClick} type="button">
          <RiAddLine />
        </SectionIconButton>
      </Tooltip>
    )
  ) : null;

  return (
    <Root $variant={p.variant}>
      <Header $variant={p.variant}>
        <HeaderButton
          aria-expanded={collapsible ? !collapsed : undefined}
          disabled={!collapsible}
          onClick={() => collapsible && p.onCollapsedChange?.(!collapsed)}
          type="button"
        >
          {p.icon}
          <Title>{p.title}</Title>
          {p.count ? <Count>{p.count}</Count> : null}
          <Spacer />
        </HeaderButton>

        {addButton}

        {p.menu?.length ? (
          <FloatingMenu
            trigger={
              <SectionIconButton aria-label={`${p.title} options`} type="button">
                <RiMoreLine />
              </SectionIconButton>
            }
            items={p.menu}
            align="end"
          />
        ) : null}

        {collapsible ? <Chevron $collapsed={collapsed} aria-hidden /> : null}
      </Header>

      <Body $collapsed={collapsed} aria-hidden={collapsed || undefined}>
        <div>{p.children}</div>
      </Body>
    </Root>
  );
};
