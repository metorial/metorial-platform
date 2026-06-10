import { memo } from '@lowerdeck/memo';
import { theme } from '../theme';
import {
  ColorFacet,
  ColorKey,
  ColorType,
  colors,
  getColorKey,
  getForegroundColor
} from '../theme/colors';
import { linearGradient } from '../theme/gradient';
import { createTheme, createThemeToken } from '../theme/tokens';

export type ButtonColor = ColorType | ColorKey;

type ButtonVariantState = {
  color: string;
  background: string;
  border: string;
  shadow: string;
  physicalShadow?: string;
  transform?: string;
};

let physicalButtonShadow = {
  offset: '2.8px',
  defaultColor: 'rgba(0, 0, 0, 0.18)'
};

let createPhysicalButtonShadowColor = (color: string, amount = 55) =>
  `color-mix(in srgb, ${color} ${amount}%, transparent)`;

let createPhysicalButtonShadow = (color = physicalButtonShadow.defaultColor) =>
  `0 ${physicalButtonShadow.offset} 0 ${color}`;

let composeButtonShadow = (...shadows: string[]) => {
  let enabledShadows = shadows.filter(shadow => shadow && shadow != 'none');
  return enabledShadows.length ? enabledShadows.join(', ') : 'none';
};

let getButtonStateTransform = (state: { [key: string]: unknown; transform?: string }, fallback = 'none') =>
  state.transform ?? fallback;

let getButtonStatePhysicalShadow = (state: { [key: string]: unknown; physicalShadow?: string }) =>
  state.physicalShadow ?? 'none';

let createPhysicalSolidButtonStates = (
  state: Omit<ButtonVariantState, 'shadow' | 'transform'>,
  physicalShadowColor?: string
) => ({
  passive: {
    ...state,
    shadow: theme.shadows.small,
    transform: 'translateY(0)'
  },

  active: {
    ...state,
    shadow: theme.shadows.medium,
    physicalShadow: createPhysicalButtonShadow(physicalShadowColor),
    transform: `translateY(-${physicalButtonShadow.offset})`
  },

  pressed: {
    ...state,
    shadow: theme.shadows.small,
    transform: 'translateY(0)'
  }
});

let colorTypes: ColorType[] = [
  'gray',
  'blue',
  'pink',
  'cyan',
  'indigo',
  'iris',
  'green',
  'orange',
  'purple',
  'red',
  'violet',
  'yellow',
  'white',
  'black'
];

let colorFacets: ColorFacet[] = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

let isColorType = (color: ButtonColor): color is ColorType => colorTypes.includes(color as ColorType);
let isColorKey = (color: ButtonColor): color is ColorKey => color in colors;

let parseColorKey = (color: ColorKey) => {
  for (let facet of colorFacets) {
    if (color.endsWith(facet)) {
      let colorName = color.slice(0, -facet.length);

      return { colorName, facet };
    }
  }

  return null;
};

let getColorKeyByFacet = (
  parsed: ReturnType<typeof parseColorKey> | null,
  facet: ColorFacet
): ColorKey | null => {
  if (!parsed) return null;

  let colorKey = `${parsed.colorName}${facet}` as ColorKey;
  return colorKey in colors ? colorKey : null;
};

let getThemeColorByFacet = (
  parsed: ReturnType<typeof parseColorKey> | null,
  facet: ColorFacet,
  fallback: string
) => {
  let colorKey = getColorKeyByFacet(parsed, facet);
  return colorKey ? theme.colors[colorKey] : fallback;
};

let getShiftedThemeColor = (
  parsed: ReturnType<typeof parseColorKey> | null,
  offset: number,
  fallback: string
) => {
  if (!parsed) return fallback;

  let index = colorFacets.indexOf(parsed.facet);
  let shiftedFacet = colorFacets[Math.min(Math.max(index + offset, 0), colorFacets.length - 1)];

  return getThemeColorByFacet(parsed, shiftedFacet, fallback);
};

let getPhysicalButtonShadowColorForType = (color: ColorType) => {
  if (color == 'black') return physicalButtonShadow.defaultColor;
  if (color == 'white') return createPhysicalButtonShadowColor(theme.colors.gray400);
  if (color == 'gray') return createPhysicalButtonShadowColor(theme.colors.gray900, 30);

  return createPhysicalButtonShadowColor(theme.colors[getColorKey(color, '900')]);
};

let getPhysicalButtonShadowColorForKey = (
  parsed: ReturnType<typeof parseColorKey> | null,
  fallback: string
) => {
  if (parsed?.colorName == 'black') return physicalButtonShadow.defaultColor;
  if (parsed?.colorName == 'white') return createPhysicalButtonShadowColor(theme.colors.gray400);
  if (parsed?.colorName == 'gray') return createPhysicalButtonShadowColor(theme.colors.gray900, 30);

  return createPhysicalButtonShadowColor(getShiftedThemeColor(parsed, 2, fallback));
};

let coloredButtonVariants = memo((color: ColorType) => ({
  solid: {
    ...createPhysicalSolidButtonStates({
      color: getForegroundColor(getColorKey(color, '900')),
      background: theme.colors[getColorKey(color, '700')],
      border: theme.colors[getColorKey(color, '700')]
    }, getPhysicalButtonShadowColorForType(color)),

    spinner: {
      foreground: theme.colors.background,
      background: theme.colors[getColorKey(color, '400')]
    },

    animateClickScale: true
  },

  outline: {
    passive: {
      color: theme.colors[getColorKey(color, '800')],
      background: theme.colors.background,
      border: theme.colors[getColorKey(color, '600')],
      shadow: 'none'
    },

    active: {
      color: theme.colors[getColorKey(color, '800')],
      background: theme.colors.background,
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
    ...createPhysicalSolidButtonStates({
      color: theme.colors.background,
      background: linearGradient(0, theme.colors.gray800, theme.colors.gray900),
      border: 'transparent'
    }),

    spinner: {
      foreground: theme.colors.background,
      background: theme.colors.gray700
    },

    animateClickScale: true
  },

  outline: {
    passive: {
      color: theme.colors.foreground,
      background: theme.colors.background,
      border: theme.colors.gray300,
      shadow: 'none'
    },

    active: {
      color: theme.colors.foreground,
      background: theme.colors.background,
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

let concreteButtonVariants = memo((color: ColorKey) => {
  let parsed = parseColorKey(color);
  let baseColor = theme.colors[color];
  let softBackground = getThemeColorByFacet(parsed, '100', monoChromeButtonVariants.soft.passive.background);
  let softActiveBackground = getThemeColorByFacet(
    parsed,
    '200',
    monoChromeButtonVariants.soft.active.background
  );
  let spinnerBackground = getThemeColorByFacet(parsed, '200', monoChromeButtonVariants.soft.spinner.background);

  return {
    solid: {
      ...createPhysicalSolidButtonStates({
        color: getForegroundColor(color),
        background: baseColor,
        border: baseColor
      }, getPhysicalButtonShadowColorForKey(parsed, baseColor)),

      spinner: {
        foreground: getForegroundColor(color),
        background: getShiftedThemeColor(parsed, -3, baseColor)
      },

      animateClickScale: true
    },

    outline: {
      passive: {
        color: baseColor,
        background: theme.colors.background,
        border: baseColor,
        shadow: 'none'
      },

      active: {
        color: baseColor,
        background: theme.colors.background,
        border: baseColor,
        shadow: 'none'
      },

      spinner: {
        foreground: baseColor,
        background: spinnerBackground
      },

      animateClickScale: false
    },

    soft: {
      passive: {
        color: baseColor,
        background: softBackground,
        border: softBackground,
        shadow: 'none'
      },

      active: {
        color: baseColor,
        background: softActiveBackground,
        border: softActiveBackground,
        shadow: 'none'
      },

      spinner: {
        foreground: baseColor,
        background: spinnerBackground
      },

      animateClickScale: false
    },

    ghost: {
      passive: {
        color: baseColor,
        background: 'transparent',
        border: 'transparent',
        shadow: 'none'
      },

      active: {
        color: baseColor,
        background: 'transparent',
        border: 'transparent',
        shadow: 'none'
      },

      spinner: {
        foreground: baseColor,
        background: spinnerBackground
      },

      animateClickScale: false
    }
  };
});

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
  color?: ButtonColor;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shadow?: boolean;
};

export let buttonTheme = createTheme({
  passive_color: createThemeToken(),
  passive_background: createThemeToken(),
  passive_border: createThemeToken(),
  passive_shadow: createThemeToken(),
  passive_transform: createThemeToken(),

  active_color: createThemeToken(),
  active_background: createThemeToken(),
  active_border: createThemeToken(),
  active_shadow: createThemeToken(),
  active_transform: createThemeToken(),

  pressed_shadow: createThemeToken(),
  pressed_transform: createThemeToken(),

  spinner_foreground: createThemeToken(),
  spinner_background: createThemeToken()
});

let getColorButtonTheme = memo((color: ButtonColor | undefined, variant: ButtonVariant, shadow = true) => {
  let v = (
    color
      ? isColorType(color)
        ? coloredButtonVariants(color)
        : isColorKey(color)
          ? concreteButtonVariants(color)
          : monoChromeButtonVariants
      : monoChromeButtonVariants
  )[variant];
  let pressed = 'pressed' in v ? v.pressed : v.active;

  return buttonTheme.setRootStyles({
    passive_color: v.passive.color,
    passive_background: v.passive.background,
    passive_border: v.passive.border,
    passive_shadow: shadow ? v.passive.shadow : 'none',
    passive_transform: getButtonStateTransform(v.passive),

    active_color: v.active.color,
    active_background: v.active.background,
    active_border: v.active.border,
    active_shadow: composeButtonShadow(
      shadow ? v.active.shadow : 'none',
      getButtonStatePhysicalShadow(v.active)
    ),
    active_transform: getButtonStateTransform(v.active),

    pressed_shadow: shadow ? pressed.shadow : 'none',
    pressed_transform: getButtonStateTransform(pressed, v.animateClickScale ? 'scale(0.98)' : 'none'),

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

    ...getColorButtonTheme(props.color, props.variant ?? 'solid', props.shadow)
  };
};

export let getButtonSize = (size: ButtonSize) => sizes[size];
