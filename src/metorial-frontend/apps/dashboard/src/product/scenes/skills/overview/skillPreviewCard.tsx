import { SkillIconTile, type SkillImageSelection } from '@metorial/scene-skills';
import { Button, Menu, Text, theme } from '@metorial/ui';
import { RiMore2Fill, RiStarFill } from '@remixicon/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { shleemy } from 'shleemy';
import { styled } from 'styled-components';
import { SkillMarkdownPreview } from './skillMarkdownPreview';

export type SkillPreviewCardItem = {
  name: string;
  image?: SkillImageSelection | null;
  imageUrl?: string | null;
  updatedAt: Date;
};

let paperVisibleHeight = 142;
let paperOverflow = 12;

let Actions = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  display: none;
  border-radius: 6px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};

  button svg {
    width: 14px;
    height: 14px;
  }
`;

let FavoriteIndicator = styled.span`
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  display: flex;
  color: ${theme.colors.gray600};

  svg {
    width: 14px;
    height: 14px;
  }
`;

let Stage = styled.div`
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 172px;
  overflow: hidden;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  background: ${theme.colors.gray200};
  transition:
    background 0.2s,
    border-color 0.2s;
`;

let Paper = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 78%;
  height: ${paperVisibleHeight + paperOverflow}px;
  margin-bottom: -${paperOverflow}px;
  overflow: hidden;
  border: 1px solid ${theme.colors.gray300};
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  transition: transform 0.2s;
`;

let Card = styled(Link)<{ $menuOpen: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: inherit;
  text-decoration: none;

  &:hover ${Stage}, &:focus-visible ${Stage} {
    border-color: ${theme.colors.gray400};
    background: ${theme.colors.gray300};
  }

  &:hover ${Paper}, &:focus-visible ${Paper} {
    transform: translateY(-3px);
  }

  &:hover ${Actions}, &:focus-within ${Actions} {
    display: flex;
  }

  &:hover ${FavoriteIndicator}, &:focus-within ${FavoriteIndicator} {
    display: none;
  }

  ${p =>
    p.$menuOpen &&
    `
    ${Actions} { display: flex; }
    ${FavoriteIndicator} { display: none; }
  `}
`;

let Meta = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
  padding: 0 2px;
`;

let MetaText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

let Name = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export let SkillPreviewCard = (p: {
  item: SkillPreviewCardItem;
  content: string | null | undefined;
  href: string;
  isFavorite?: boolean;
  menu: { label: string; onClick: () => void }[];
}) => {
  let [menuOpen, setMenuOpen] = useState(false);

  return (
    <Card to={p.href} $menuOpen={menuOpen}>
      <Stage>
        {p.isFavorite && (
          <FavoriteIndicator title="Favorite">
            <RiStarFill />
          </FavoriteIndicator>
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
            <Button
              size="1"
              variant="ghost"
              icon={<RiMore2Fill />}
              title="More"
              aria-label="More"
            />
          </Menu>
        </Actions>

        <Paper>
          <SkillMarkdownPreview content={p.content} />
        </Paper>
      </Stage>

      <Meta>
        <SkillIconTile image={p.item.image} imageUrl={p.item.imageUrl} size={20} />

        <MetaText>
          <Name>
            <Text size="2" weight="strong" as="span">
              {p.item.name}
            </Text>
          </Name>

          <Text size="1" color="gray600" as="span">
            Edited {shleemy(p.item.updatedAt).forHumans}
          </Text>
        </MetaText>
      </Meta>
    </Card>
  );
};
