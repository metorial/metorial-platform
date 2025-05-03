import { memo } from '@metorial/memo';
import { theme } from '..';
import { ColorType, getColorKey } from '../theme/colors';

let badgeColor = memo((color: ColorType) => ({
  color: theme.colors[getColorKey(color, '900')],
  backgroundColor: theme.colors[getColorKey(color, '300')]
}));

let sizes = {
  '1': {
    padding: '2px 6px',
    fontSize: 10,
    borderRadius: 4
  },
  '2': {
    padding: '4px 10px',
    fontSize: 14,
    borderRadius: 6
  },
  '3': {
    padding: '8px 16px',
    fontSize: 20,
    borderRadius: 8
  }
};

export type BadgeSize = keyof typeof sizes;

export type BadgeStyleProps = {
  color: ColorType;
  size?: BadgeSize;
};

export let getBadgeStyles = ({ color, size = '2' }: BadgeStyleProps) => ({
  ...badgeColor(color),
  ...sizes[size]
});
