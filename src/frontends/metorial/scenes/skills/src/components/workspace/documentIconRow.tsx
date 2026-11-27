import { theme } from '@metorial/ui';
import { RiImageAddLine } from '@remixicon/react';
import styled from 'styled-components';
import { IconPicker, type SkillImageChange } from './iconPicker';
import { SkillIconTile, type SkillImageSelection } from './skillIconTile';

let Row = styled.div`
  display: flex;
  align-items: flex-end;
  min-height: 30px;
  margin-bottom: 8px;
`;

let TileButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 15px;
  background: transparent;
  line-height: 1;
  cursor: pointer;
  transition: box-shadow 0.15s ease;

  &:hover:not(:disabled),
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${theme.colors.gray300};
  }

  &:disabled {
    cursor: default;
  }
`;

let AddButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${theme.colors.gray600};
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;

  ${Row}:hover &,
  &:focus-visible,
  &[data-popup-open] {
    opacity: 1;
  }

  &:hover {
    background: ${theme.colors.gray250};
    color: ${theme.colors.gray800};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

export let DocumentIconRow = (p: {
  image: SkillImageSelection | null | undefined;
  imageUrl: string | null | undefined;
  readOnly?: boolean;
  compact?: boolean;
  onChange: (change: SkillImageChange) => Promise<void>;
}) => {
  let hasImage = !!p.image && p.image.type != 'default';
  let size = p.compact ? 52 : 64;

  if (p.readOnly) {
    return hasImage ? (
      <Row>
        <SkillIconTile image={p.image} imageUrl={p.imageUrl} size={size} />
      </Row>
    ) : null;
  }

  return (
    <Row contentEditable={false}>
      <IconPicker
        image={p.image}
        onChange={p.onChange}
        trigger={
          hasImage ? (
            <TileButton aria-label="Change icon" type="button">
              <SkillIconTile image={p.image} imageUrl={p.imageUrl} size={size} />
            </TileButton>
          ) : (
            <AddButton type="button">
              <RiImageAddLine />
              Add icon
            </AddButton>
          )
        }
      />
    </Row>
  );
};
