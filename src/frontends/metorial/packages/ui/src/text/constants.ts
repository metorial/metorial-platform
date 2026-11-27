import { theme } from '../theme';

export let textSizeSteps = {
  '1': {
    '--font-size': '12px',
    '--letter-spacing': '0.0025em',
    '--line-height': '16px',

    '--mobile-scale': '1'
  },

  '2': {
    '--font-size': '14px',
    '--letter-spacing': '0em',
    '--line-height': '20px',

    '--mobile-scale': '1'
  },

  '3': {
    '--font-size': '16px',
    '--letter-spacing': '0em',
    '--line-height': '24px',

    '--mobile-scale': '1'
  },

  '4': {
    '--font-size': '18px',
    '--letter-spacing': '-0.0025em',
    '--line-height': '26px',

    '--mobile-scale': '1'
  },

  '5': {
    '--font-size': '20px',
    '--letter-spacing': '-0.005em',
    '--line-height': '28px',

    '--mobile-scale': '0.95'
  },

  '6': {
    '--font-size': '24px',
    '--letter-spacing': '-0.00625em',
    '--line-height': '30px',

    '--mobile-scale': '0.95'
  },

  '7': {
    '--font-size': '28px',
    '--letter-spacing': '-0.0075em',
    '--line-height': '36px',

    '--mobile-scale': '0.9'
  },

  '8': {
    '--font-size': '35px',
    '--letter-spacing': '-0.01em',
    '--line-height': '40px',

    '--mobile-scale': '0.8'
  },

  '9': {
    '--font-size': '60px',
    '--letter-spacing': '-0.025em',
    '--line-height': '60px',

    '--mobile-scale': '0.7'
  }
};

export type TextSize = keyof typeof textSizeSteps;

export let textWeights = {
  light: {
    fontWeight: 300
  },
  regular: {
    fontWeight: 400
  },
  medium: {
    fontWeight: 500
  },
  strong: {
    fontWeight: 600
  },
  bold: {
    fontWeight: 700
  }
};

export type TextWeight = keyof typeof textWeights;

export let textAlignments = {
  left: {
    textAlign: 'left' as const
  },
  center: {
    textAlign: 'center' as const
  },
  right: {
    textAlign: 'right' as const
  }
};

export type TextAlign = keyof typeof textAlignments;

export let textWrap = {
  wrap: {
    whiteSpace: 'normal'
  },
  nowrap: {
    whiteSpace: 'nowrap'
  },
  balance: {
    textWrap: 'balance' as const
  }
};

export type TextWrap = keyof typeof textWrap;

let textTransforms = {
  uppercase: {
    textTransform: 'uppercase' as const
  },
  lowercase: {
    textTransform: 'lowercase' as const
  },
  capitalize: {
    textTransform: 'capitalize' as const
  }
};

export type TextTransform = keyof typeof textTransforms;

export type TextProps = {
  size?: TextSize;
  weight?: TextWeight;
  align?: TextAlign;
  wrap?: TextWrap;
  truncate?: boolean;
  color?: keyof typeof theme.colors;
  transform?: TextTransform;
};

let truncateStyles = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

export let getTextStyles = (props: TextProps): React.CSSProperties => ({
  margin: 0,
  padding: 0,

  fontFamily: 'inherit',

  ...textSizeSteps[props.size || '2'],
  ...textWeights[props.weight || 'regular'],
  ...textAlignments[props.align || 'left'],
  ...textWrap[props.wrap || 'wrap'],

  ...(props.transform && textTransforms[props.transform]),
  ...(props.truncate && truncateStyles),

  color: props.color ? theme.colors[props.color] : theme.colors.foreground
});
