import {
  DEFAULT_SKILL_ICON_COLOR,
  isSkillIconColor,
  SKILL_ICON_COLORS,
  SKILL_ICON_PATHS
} from '@metorial/skill-icons';
import { theme } from '@metorial/ui';
import { RiFileTextLine } from '@remixicon/react';
import styled from 'styled-components';

export type SkillImageSelection = {
  type: 'file' | 'url' | 'icon' | 'default';
  icon?: string | null;
  color?: string | null;
};

let Image = styled.img<{ $size: number }>`
  display: block;
  flex: 0 0 auto;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 22%;
  object-fit: cover;
`;

let Placeholder = styled.span<{ $size: number }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 22%;
  background: ${theme.colors.gray250};
  color: ${theme.colors.gray800};

  svg {
    width: 56%;
    height: 56%;
  }
`;

export let SkillIconGlyph = (p: {
  icon: string;
  color: string;
  size: number;
  tile?: boolean;
}) => {
  let paths = SKILL_ICON_PATHS[p.icon];
  if (!paths) return null;

  let colors = isSkillIconColor(p.color)
    ? SKILL_ICON_COLORS[p.color]
    : SKILL_ICON_COLORS[DEFAULT_SKILL_ICON_COLOR];

  if (!p.tile) {
    return (
      <svg
        width={p.size}
        height={p.size}
        viewBox="0 0 24 24"
        fill={colors.foreground}
        aria-hidden
      >
        {paths.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </svg>
    );
  }

  return (
    <svg
      width={p.size}
      height={p.size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ flex: '0 0 auto' }}
    >
      <rect width="24" height="24" rx="5.28" fill={colors.background} />
      <g transform="translate(5.28 5.28) scale(0.56)" fill={colors.foreground}>
        {paths.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
    </svg>
  );
};

export let SkillIconTile = (p: {
  image?: SkillImageSelection | null;
  imageUrl?: string | null;
  size: number;
}) => {
  if (p.image?.type == 'icon' && p.image.icon && SKILL_ICON_PATHS[p.image.icon]) {
    return (
      <SkillIconGlyph
        icon={p.image.icon}
        color={p.image.color ?? DEFAULT_SKILL_ICON_COLOR}
        size={p.size}
        tile
      />
    );
  }

  if ((p.image?.type == 'file' || p.image?.type == 'url') && p.imageUrl) {
    return <Image $size={p.size} src={p.imageUrl} alt="" />;
  }

  return (
    <Placeholder $size={p.size}>
      <RiFileTextLine />
    </Placeholder>
  );
};
