import type { DashboardInstanceSkillsListOutput } from '@metorial/dashboard-sdk';
import { SkillIconTile } from '@metorial/scene-skills';
import { Button, Menu, Text, theme } from '@metorial/ui';
import { RiMore2Fill, RiPushpinFill } from '@remixicon/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { styled } from 'styled-components';
import { SkillMarkdownPreview } from './skillMarkdownPreview';

type Skill = DashboardInstanceSkillsListOutput['items'][number];

let Actions = styled.div`
  display: none;
  flex: 0 0 auto;
`;

let PinnedIndicator = styled.span`
  display: flex;
  flex: 0 0 auto;
  color: ${theme.colors.gray600};

  svg {
    width: 14px;
    height: 14px;
  }
`;

let Card = styled(Link)<{ $menuOpen: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 280px;
  overflow: hidden;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  color: inherit;
  text-decoration: none;
  transition: all 0.2s;

  &:hover,
  &:focus-visible {
    box-shadow: ${theme.shadows.medium};
  }

  &:hover ${Actions}, &:focus-within ${Actions} {
    display: flex;
  }

  &:hover ${PinnedIndicator}, &:focus-within ${PinnedIndicator} {
    display: none;
  }

  ${p =>
    p.$menuOpen &&
    `
    ${Actions} { display: flex; }
    ${PinnedIndicator} { display: none; }
  `}
`;

let Header = styled.header`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 10px 0 16px;
  flex: 0 0 auto;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let Name = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export let SkillPreviewCard = (p: {
  skill: Skill;
  content: string | null | undefined;
  href: string;
  isPinned: boolean;
  menu: { label: string; onClick: () => void }[];
}) => {
  let [menuOpen, setMenuOpen] = useState(false);

  return (
    <Card to={p.href} $menuOpen={menuOpen}>
      <Header>
        <SkillIconTile image={p.skill.image} imageUrl={p.skill.imageUrl} size={22} />

        <Name>
          <Text size="2" weight="strong" as="span">
            {p.skill.name}
          </Text>
        </Name>

        {p.isPinned && (
          <PinnedIndicator title="Pinned">
            <RiPushpinFill />
          </PinnedIndicator>
        )}

        <Actions
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Menu
            items={p.menu.map((item, index) => ({ id: String(index), label: item.label }))}
            onItemClick={id => p.menu[Number(id)]?.onClick()}
            setIsOpen={setMenuOpen}
          >
            <Button size="1" variant="ghost" iconLeft={<RiMore2Fill />} title="More" />
          </Menu>
        </Actions>
      </Header>

      <SkillMarkdownPreview content={p.content} />
    </Card>
  );
};
