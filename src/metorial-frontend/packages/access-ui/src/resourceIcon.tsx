import {
  RiFlashlightLine,
  RiFolderLine,
  RiLayoutGridLine,
  RiLinksLine,
  RiPlugLine,
  RiStackLine,
  RiStore2Line,
  RiUserLine,
  RiTeamLine
} from '@remixicon/react';
import { theme } from '@metorial/ui';
import { ProviderImage } from '@metorial/ui-product';
import React from 'react';
import styled from 'styled-components';

export type AccessResourceKind =
  | 'integration'
  | 'magic_mcp_server'
  | 'skill'
  | 'skill_template'
  | 'skill_group'
  | 'skill_marketplace'
  | 'skill_plugin';

type Hue = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'gray';

let kinds: Record<AccessResourceKind, { hue: Hue; icon: React.ElementType; label: string }> = {
  integration: { hue: 'blue', icon: RiPlugLine, label: 'Integration' },
  magic_mcp_server: { hue: 'blue', icon: RiLinksLine, label: 'Magic MCP Server' },
  skill: { hue: 'purple', icon: RiFlashlightLine, label: 'Skill' },
  skill_template: { hue: 'purple', icon: RiStackLine, label: 'Skill Template' },
  skill_group: { hue: 'purple', icon: RiFolderLine, label: 'Skill Group' },
  skill_marketplace: { hue: 'orange', icon: RiStore2Line, label: 'Marketplace' },
  skill_plugin: { hue: 'orange', icon: RiLayoutGridLine, label: 'Plugin' }
};

let subjectHues: Hue[] = ['blue', 'purple', 'green', 'orange', 'red'];

export let accessResourceKindLabel = (kind: AccessResourceKind) => kinds[kind].label;

let Tile = styled.span<{ $hue: Hue; $size: number }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${p => p.$size}px;
  height: ${p => p.$size}px;
  border-radius: ${p => Math.round(p.$size / 4)}px;
  background: ${p => theme.colors[`${p.$hue}300`]};
  color: ${p => theme.colors[`${p.$hue}900`]};
  box-shadow: inset 0 0 0 1px ${p => theme.colors[`${p.$hue}500`]};
  font-size: ${p => Math.round(p.$size * 0.42)}px;
  font-weight: 600;
`;

let ImageTile = styled.span<{ $size: number }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${p => p.$size}px;
  height: ${p => p.$size}px;
  border-radius: ${p => Math.round(p.$size / 4)}px;
  background: ${theme.colors.background};
  box-shadow: inset 0 0 0 1px ${theme.colors.gray400};
`;

export let ResourceIcon = (p: {
  kind: AccessResourceKind | 'provider';
  name: string;
  imageUrl?: string | null;
  size?: number;
}) => {
  let size = p.size ?? 32;

  if (p.imageUrl || p.kind == 'provider') {
    return (
      <ImageTile $size={size}>
        <ProviderImage imageUrl={p.imageUrl} alt={p.name} size={Math.round(size * 0.62)} />
      </ImageTile>
    );
  }

  let kind = kinds[p.kind];
  let Icon = kind.icon;

  return (
    <Tile $hue={kind.hue} $size={size} aria-hidden>
      <Icon size={Math.round(size * 0.5)} />
    </Tile>
  );
};

let hueOf = (id: string) =>
  subjectHues[
    [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % subjectHues.length
  ]!;

let initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]!.toUpperCase())
    .join('');

let Round = styled(Tile)`
  border-radius: 999px;
`;

let Photo = styled.img<{ $size: number }>`
  width: ${p => p.$size}px;
  height: ${p => p.$size}px;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
`;

export type AccessSubjectKind = 'group' | 'person';

export let SubjectAvatar = (p: {
  kind: AccessSubjectKind;
  id: string;
  name: string;
  imageUrl?: string | null;
  isDefault?: boolean;
  size?: number;
}) => {
  let size = p.size ?? 32;

  if (p.kind == 'person') {
    if (p.imageUrl) return <Photo $size={size} src={p.imageUrl} alt="" />;

    return (
      <Round $hue={hueOf(p.id)} $size={size} aria-hidden>
        {initials(p.name) || <RiUserLine size={Math.round(size * 0.5)} />}
      </Round>
    );
  }

  return (
    <Tile $hue={p.isDefault ? 'gray' : hueOf(p.id)} $size={size} aria-hidden>
      <RiTeamLine size={Math.round(size * 0.5)} />
    </Tile>
  );
};
