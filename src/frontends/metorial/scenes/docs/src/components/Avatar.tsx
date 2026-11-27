import { Avatar as MtrlAvatar } from '@metorial/ui';

export interface AvatarProps {
  name: string;
  imageUrl?: string;
  email?: string;
  size?: number;
  /** Disables the metorial-ui hover tooltip. Useful when the parent
   *  wants to control the tooltip content (e.g. show name + email). */
  noTooltip?: boolean;
  /** Pass-through to metorial Avatar `radius`. Number = px, "round" = circle. */
  radius?: number | 'round';
}

export function Avatar({
  name,
  imageUrl,
  size = 28,
  noTooltip,
  radius = 'round'
}: AvatarProps) {
  return (
    <MtrlAvatar
      entity={{ name, imageUrl }}
      size={size}
      noTooltip={noTooltip}
      radius={radius}
    />
  );
}
