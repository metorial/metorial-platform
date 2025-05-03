import { memo } from '@metorial/memo';
import { ThemeTokenFactory, createThemeToken } from './tokens';

export let colors = {
  gray100: '#fafafa',
  gray200: '#f6f6f6',
  gray300: '#efefef',
  gray400: '#ddd',
  gray500: '#ccc',
  gray600: '#999',
  gray700: '#555',
  gray800: '#333',
  gray900: '#222',

  blue100: '#fbfdff',
  blue200: '#f4faff',
  blue300: '#e6f4fe',
  blue400: '#d5efff',
  blue500: '#c2e5ff',
  blue600: '#acd8fc',
  blue700: '#8ec8f6',
  blue800: '#5eb1ef',
  blue900: '#0090ff',

  pink100: '#fffcfd',
  pink200: '#fef7f9',
  pink300: '#ffe9f0',
  pink400: '#fedce7',
  pink500: '#facedd',
  pink600: '#f3bed1',
  pink700: '#eaacc3',
  pink800: '#e093b2',
  pink900: '#e93d82',

  cyan100: '#fafdfe',
  cyan200: '#f2fafb',
  cyan300: '#def7f9',
  cyan400: '#caf1f6',
  cyan500: '#b5e9f0',
  cyan600: '#9ddde7',
  cyan700: '#7dcedc',
  cyan800: '#3db9cf',
  cyan900: '#00a2c7',

  indigo100: '#fdfdfe',
  indigo200: '#f7f9ff',
  indigo300: '#edf2fe',
  indigo400: '#e1e9ff',
  indigo500: '#d2deff',
  indigo600: '#c1d0ff',
  indigo700: '#abbdf9',
  indigo800: '#8da4ef',
  indigo900: '#3e63dd',

  iris100: '#fdfdff',
  iris200: '#f8f8ff',
  iris300: '#f0f1fe',
  iris400: '#e6e7ff',
  iris500: '#dadcff',
  iris600: '#cbcdff',
  iris700: '#b8baf8',
  iris800: '#9b9ef0',
  iris900: '#5b5bd6',

  green100: '#fbfefd',
  green200: '#f4fbf7',
  green300: '#e6f7ed',
  green400: '#d6f1e3',
  green500: '#c3e9d7',
  green600: '#acdec8',
  green700: '#8bceb6',
  green800: '#56ba9f',
  green900: '#29a383',

  orange100: '#fefcfb',
  orange200: '#fff7ed',
  orange300: '#ffefd6',
  orange400: '#ffdfb5',
  orange500: '#ffd19a',
  orange600: '#ffc182',
  orange700: '#f5ae73',
  orange800: '#ec9455',
  orange900: '#f76b15',

  purple100: '#fefcfe',
  purple200: '#fbf7fe',
  purple300: '#f7edfe',
  purple400: '#f2e2fc',
  purple500: '#ead5f9',
  purple600: '#e0c4f4',
  purple700: '#d1afec',
  purple800: '#be93e4',
  purple900: '#8e4ec6',

  red100: '#fffcfc',
  red200: '#fff7f7',
  red300: '#feebec',
  red400: '#ffdbdc',
  red500: '#ffcdce',
  red600: '#e5484d',
  red700: '#e5484d',
  red800: '#e5484d',
  red900: '#e5484d',

  violet100: '#fdfcfe',
  violet200: '#faf8ff',
  violet300: '#f4f0fe',
  violet400: '#ebe4ff',
  violet500: '#e1d9ff',
  violet600: '#d4cafe',
  violet700: '#c2b5f5',
  violet800: '#aa99ec',
  violet900: '#6e56cf',

  yellow100: '#fefdfb',
  yellow200: '#fefbe9',
  yellow300: '#fff7c2',
  yellow400: '#ffee9c',
  yellow500: '#fbe577',
  yellow600: '#f3d673',
  yellow700: '#e9c162',
  yellow800: '#e2a336',
  yellow900: '#ffc53d',

  white100: '#fff',
  white200: '#fff',
  white300: '#fff',
  white400: '#fff',
  white500: '#fff',
  white600: '#fff',
  white700: '#fff',
  white800: '#fff',
  white900: '#fff',

  black100: '#000',
  black200: '#000',
  black300: '#000',
  black400: '#000',
  black500: '#000',
  black600: '#000',
  black700: '#000',
  black800: '#000',
  black900: '#000',

  primary100: '#b1e0ff',
  primary200: '#76c8ff',
  primary300: '#4eb8ff',
  primary400: '#27a9ff',
  primary500: '#0099ff',
  primary600: '#0081d8',
  primary700: '#006ab1',
  primary800: '#005289',
  primary900: '#003b62',

  primary: '#0099ff'
};

export let colorThemeVars: {
  [key in keyof typeof colors]: ThemeTokenFactory;
} = Object.fromEntries(
  Object.entries(colors).map(([key, value]) => [key, createThemeToken(value)])
) as any;

export type ColorKey = keyof typeof colors;
export type ColorType =
  | 'gray'
  | 'blue'
  | 'pink'
  | 'cyan'
  | 'indigo'
  | 'iris'
  | 'green'
  | 'orange'
  | 'purple'
  | 'red'
  | 'violet'
  | 'yellow'
  | 'white'
  | 'black';

export type ColorFacet = '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

export let getColorKey = (color: ColorType, facet: ColorFacet): ColorKey => `${color}${facet}`;

export let getForegroundColor = memo((color: ColorKey) => {
  if (color.startsWith('white') || color.startsWith('yellow')) {
    return '#000';
  }

  let value = colors[color];
  let r = parseInt(value.substr(1, 2), 16);
  let g = parseInt(value.substr(3, 2), 16);
  let b = parseInt(value.substr(5, 2), 16);
  let brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 125 ? '#000' : '#fff';
});
