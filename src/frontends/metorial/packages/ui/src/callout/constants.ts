import { memo } from '@lowerdeck/memo';
import { theme } from '../theme';
import { ColorType, getColorKey } from '../theme/colors';

let calloutColor = memo((color: ColorType) => ({
  color: theme.colors[getColorKey(color, '900')],
  backgroundColor: theme.colors[getColorKey(color, '300')]
}));

let sizes = {
  '1': {
    padding: '12px 16px',
    fontSize: 12,
    borderRadius: 10,
    gap: 10,

    icon: {
      size: 16
    }
  },
  '2': {
    padding: '16px 24px',
    fontSize: 14,
    borderRadius: 12,
    gap: 14,

    icon: {
      size: 18
    }
  },
  '3': {
    padding: '20px 32px',
    fontSize: 16,
    borderRadius: 14,
    gap: 18,

    icon: {
      size: 20
    }
  }
};

export type CalloutSize = keyof typeof sizes;

export type CalloutStyleProps = {
  color: ColorType;
  size?: CalloutSize;
  variant?: 'default' | 'inline';
};

export let getCalloutStyles = ({
  color,
  size = '2',
  variant = 'default'
}: CalloutStyleProps) => ({
  ...calloutColor(color),
  ...sizes[size],
  ...(variant === 'inline' && {
    color: `color-mix(in srgb, ${calloutColor(color).color} 80%, ${theme.colors.black900})`,
    padding: 0,
    backgroundColor: 'transparent',
    fontWeight: 600
  })
});
