import { theme } from '../theme';
import { ColorType, getColorKey } from '../theme/colors';

let sizes = {
  '1': {
    padding: '2px 6px',
    fontSize: 8,
    borderRadius: '50px',
    dotSize: 6
  },
  '2': {
    padding: '4px 10px',
    fontSize: 12,
    borderRadius: '50px',
    dotSize: 7
  },
  '3': {
    padding: '8px 16px',
    fontSize: 16,
    borderRadius: '50px',
    dotSize: 8
  }
};

export type BadgeSize = keyof typeof sizes;

export type BadgeStyleProps = {
  color: ColorType;
  size?: BadgeSize;
};

export let getBadgeStyles = ({ color, size = '2' }: BadgeStyleProps) => {
  let sizeStyles = sizes[size];

  return {
    outer: sizeStyles,

    dot: {
      backgroundColor: theme.colors[getColorKey(color, '800')],
      width: `${sizeStyles.dotSize}px`,
      height: `${sizeStyles.dotSize}px`,
      borderRadius: '50px'
    }
  };
};

let iconSizes: Record<BadgeSize, { height: number; fontSize: number; paddingRight: number }> =
  {
    '1': { height: 20, fontSize: 10, paddingRight: 6 },
    '2': { height: 28, fontSize: 14, paddingRight: 10 },
    '3': { height: 40, fontSize: 18, paddingRight: 16 }
  };

export let getIconBadgeStyles = ({ color, size = '2' }: BadgeStyleProps) => {
  let { height, fontSize, paddingRight } = iconSizes[size];
  let iconCircleSize = height - 6;

  return {
    outer: {
      height: `${height}px`,
      padding: `0 ${paddingRight}px 0 3px`,
      fontSize,
      borderRadius: '50px'
    },

    iconCircle: {
      backgroundColor: theme.colors[getColorKey(color, '800')],
      color: theme.colors.white300,
      width: `${iconCircleSize}px`,
      height: `${iconCircleSize}px`,
      borderRadius: '50px'
    },

    iconSize: Math.round(iconCircleSize * 0.6)
  };
};
