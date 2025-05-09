import { memo } from '@metorial/memo';
import { theme } from '../theme';
import { ColorType, getColorKey, getForegroundColor } from '../theme/colors';
import { linearGradient } from '../theme/gradient';
import { createTheme, createThemeToken } from '../theme/tokens';

let coloredButtonVariants = memo((color: ColorType) => ({
  solid: {
    passive: {
      color: getForegroundColor(getColorKey(color, '900')),
      background: theme.colors[getColorKey(color, '700')],
      border: theme.colors[getColorKey(color, '700')],
      shadow: theme.shadows.small
    },

    active: {
      color: getForegroundColor(getColorKey(color, '900')),
      background: theme.colors[getColorKey(color, '700')],
      border: theme.colors[getColorKey(color, '700')],
      shadow: theme.shadows.medium
    },

    spinner: {
      foreground: theme.colors.background,
      background: theme.colors[getColorKey(color, '400')]
    },

    animateClickScale: true
  },

  outline: {
    passive: {
      color: theme.colors[getColorKey(color, '800')],
      background: 'transparent',
      border: theme.colors[getColorKey(color, '600')],
      shadow: 'none'
    },

    active: {
      color: theme.colors[getColorKey(color, '800')],
      background: 'transparent',
      border: theme.colors[getColorKey(color, '700')],
      shadow: 'none'
    },

    spinner: {
      foreground: theme.colors[getColorKey(color, '900')],
      background: theme.colors[getColorKey(color, '200')]
    },

    animateClickScale: false
  },

  soft: {
    passive: {
      color: theme.colors[getColorKey(color, '800')],
      background: theme.colors[getColorKey(color, '100')],
      border: theme.colors[getColorKey(color, '100')],
      shadow: 'none'
    },

    active: {
      color: theme.colors[getColorKey(color, '800')],
      background: theme.colors[getColorKey(color, '200')],
      border: theme.colors[getColorKey(color, '200')],
      shadow: 'none'
    },

    spinner: {
      foreground: theme.colors[getColorKey(color, '900')],
      background: theme.colors[getColorKey(color, '200')]
    },

    animateClickScale: false
  },

  ghost: {
    passive: {
      color: theme.colors[getColorKey(color, '800')],
      background: 'transparent',
      border: 'transparent',
      shadow: 'none'
    },

    active: {
      color: theme.colors[getColorKey(color, '900')],
      background: 'transparent',
      border: 'transparent',
      shadow: 'none'
    },

    spinner: {
      foreground: theme.colors[getColorKey(color, '900')],
      background: theme.colors[getColorKey(color, '200')]
    },

    animateClickScale: false
  }
}));

let monoChromeButtonVariants = {
  solid: {
    passive: {
      color: theme.colors.background,
      background: linearGradient(0, theme.colors.gray800, theme.colors.gray900),
      border: 'transparent',
      shadow: theme.shadows.small
    },

    active: {
      color: theme.colors.background,
      background: linearGradient(0, theme.colors.gray800, theme.colors.gray900),
      border: 'transparent',
      shadow: theme.shadows.medium
    },

    spinner: {
      foreground: theme.colors.background,
      background: theme.colors.gray700
    },

    animateClickScale: true
  },

  outline: {
    passive: {
      color: theme.colors.foreground,
      background: 'transparent',
      border: theme.colors.gray300,
      shadow: 'none'
    },

    active: {
      color: theme.colors.foreground,
      background: 'transparent',
      border: theme.colors.gray400,
      shadow: 'none'
    },

    spinner: {
      foreground: theme.colors.foreground,
      background: theme.colors.gray100
    },

    animateClickScale: false
  },

  soft: {
    passive: {
      color: theme.colors.foreground,
      background: theme.colors.gray200,
      border: theme.colors.gray100,
      shadow: 'none'
    },

    active: {
      color: theme.colors.foreground,
      background: theme.colors.gray300,
      border: theme.colors.gray200,
      shadow: 'none'
    },

    spinner: {
      foreground: theme.colors.foreground,
      background: theme.colors.gray200
    },

    animateClickScale: false
  },

  ghost: {
    passive: {
      color: theme.colors.gray600,
      background: 'transparent',
      border: 'transparent',
      shadow: 'none'
    },

    active: {
      color: theme.colors.gray700,
      background: 'transparent',
      border: 'transparent',
      shadow: 'none'
    },

    spinner: {
      foreground: theme.colors.foreground,
      background: theme.colors.gray200
    },

    animateClickScale: false
  }
};

export type ButtonVariant = 'solid' | 'outline' | 'soft' | 'ghost';

let sizes = {
  '1': {
    gap: '6px',
    height: '26px',
    padding: '0 8px',
    borderRadius: '6px',
    fontSize: '12px'
  },

  '2': {
    gap: '8px',
    height: '30px',
    padding: '0 10px',
    borderRadius: '8px',
    fontSize: '14px'
  },

  '3': {
    gap: '10px',
    height: '36px',
    padding: '0 12px',
    borderRadius: '10px',
    fontSize: '16px'
  },

  '4': {
    gap: '12px',
    height: '42px',
    padding: '0 14px',
    borderRadius: '12px',
    fontSize: '18px'
  },

  '5': {
    gap: '14px',
    height: '48px',
    padding: '0 16px',
    borderRadius: '14px',
    fontSize: '20px'
  }
};

export type ButtonSize = keyof typeof sizes;

export type ButtonStyleProps = {
  color?: ColorType;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export let buttonTheme = createTheme({
  passive_color: createThemeToken(),
  passive_background: createThemeToken(),
  passive_border: createThemeToken(),
  passive_shadow: createThemeToken(),

  active_color: createThemeToken(),
  active_background: createThemeToken(),
  active_border: createThemeToken(),
  active_shadow: createThemeToken(),
  active_transform: createThemeToken(),

  spinner_foreground: createThemeToken(),
  spinner_background: createThemeToken()
});

let getColorButtonTheme = memo((color: ColorType | undefined, variant: ButtonVariant) => {
  let v = (color ? coloredButtonVariants(color) : monoChromeButtonVariants)[variant];

  return buttonTheme.setRootStyles({
    passive_color: v.passive.color,
    passive_background: v.passive.background,
    passive_border: v.passive.border,
    passive_shadow: v.passive.shadow,

    active_color: v.active.color,
    active_background: v.active.background,
    active_border: v.active.border,
    active_shadow: v.active.shadow,

    active_transform: v.animateClickScale ? 'scale(0.98)' : 'none',

    spinner_foreground: v.spinner.foreground,
    spinner_background: v.spinner.background
  });
});

export let getButtonStyles = (props: ButtonStyleProps) => {
  let size = sizes[props.size ?? '3'];

  if (props.variant == 'ghost') {
    size = {
      ...size,
      padding: '0',
      height: 'auto'
    };
  }

  return {
    margin: 0,
    fontFamily: 'inherit',

    ...size,

    ...getColorButtonTheme(props.color, props.variant ?? 'solid')
  };
};

export let getButtonSize = (size: ButtonSize) => sizes[size];
