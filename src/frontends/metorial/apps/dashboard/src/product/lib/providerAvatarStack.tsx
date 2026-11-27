import { Avatar, theme } from '@metorial/ui';
import { styled } from 'styled-components';

let Stack = styled.div`
  display: flex;
  align-items: center;
`;

let StackItem = styled.div<{ $index: number }>`
  position: relative;
  z-index: ${p => 10 - p.$index};
  margin-left: ${p => (p.$index === 0 ? '0' : '-8px')};
  border-radius: 999px;
  box-shadow: 0 0 0 2px ${theme.colors.background};
`;

export type ProviderAvatarStackEntry = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

export let ProviderAvatarStack = (p: {
  providers: ProviderAvatarStackEntry[];
  leading?: { name: string; imageUrl?: string | null };
  limit?: number;
  size?: number;
}) => {
  let size = p.size ?? 30;
  let visible = p.providers.slice(0, p.limit ?? 5);
  let offset = p.leading ? 1 : 0;

  return (
    <Stack>
      {p.leading && (
        <StackItem $index={0}>
          <Avatar
            entity={{ name: p.leading.name, imageUrl: p.leading.imageUrl }}
            size={size}
            noTooltip
            imageFit="contain"
          />
        </StackItem>
      )}

      {visible.map((provider, idx) => (
        <StackItem key={provider.id} $index={idx + offset}>
          <Avatar
            entity={{ name: provider.name, photoUrl: provider.imageUrl ?? undefined }}
            size={size}
            noTooltip
            imageFit="contain"
          />
        </StackItem>
      ))}
    </Stack>
  );
};
