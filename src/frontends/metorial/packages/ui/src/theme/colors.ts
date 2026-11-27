import { memo } from '@lowerdeck/memo';
import { ThemeTokenFactory, createThemeToken } from './tokens';

export let colors = {
  gray100: '#fafafa',
  gray150: '#f8f8f8',
  gray200: '#f6f6f6',
  gray250: '#f3f3f3',
  gray300: '#efefef',
  gray350: '#e6e6e6',
  gray400: '#ddd',
  gray450: '#d5d5d5',
  gray500: '#ccc',
  gray550: '#b3b3b3',
  gray600: '#999',
  gray650: '#777',
  gray700: '#555',
  gray750: '#444',
  gray800: '#333',
  gray850: '#2b2b2b',
  gray900: '#222',

  blue100: '#fbfdff',
  blue150: '#f8fcff',
  blue200: '#f4faff',
  blue250: '#edf7ff',
  blue300: '#e6f4fe',
  blue350: '#def2ff',
  blue400: '#d5efff',
  blue450: '#cceaff',
  blue500: '#c2e5ff',
  blue550: '#b7dffe',
  blue600: '#acd8fc',
  blue650: '#9dd0f9',
  blue700: '#8ec8f6',
  blue750: '#76bdf3',
  blue800: '#5eb1ef',
  blue850: '#2fa1f7',
  blue900: '#0090ff',

  pink100: '#fffcfd',
  pink150: '#fffafb',
  pink200: '#fef7f9',
  pink250: '#fff0f5',
  pink300: '#ffe9f0',
  pink350: '#ffe3ec',
  pink400: '#fedce7',
  pink450: '#fcd5e2',
  pink500: '#facedd',
  pink550: '#f7c6d7',
  pink600: '#f3bed1',
  pink650: '#efb5ca',
  pink700: '#eaacc3',
  pink750: '#e5a0bb',
  pink800: '#e093b2',
  pink850: '#e5689a',
  pink900: '#e93d82',

  cyan100: '#fafdfe',
  cyan150: '#f6fcfd',
  cyan200: '#f2fafb',
  cyan250: '#e8f9fa',
  cyan300: '#def7f9',
  cyan350: '#d4f4f8',
  cyan400: '#caf1f6',
  cyan450: '#c0edf3',
  cyan500: '#b5e9f0',
  cyan550: '#a9e3ec',
  cyan600: '#9ddde7',
  cyan650: '#8dd6e2',
  cyan700: '#7dcedc',
  cyan750: '#5dc4d6',
  cyan800: '#3db9cf',
  cyan850: '#1faecb',
  cyan900: '#00a2c7',

  indigo100: '#fdfdfe',
  indigo150: '#fafbff',
  indigo200: '#f7f9ff',
  indigo250: '#f2f6ff',
  indigo300: '#edf2fe',
  indigo350: '#e7eeff',
  indigo400: '#e1e9ff',
  indigo450: '#dae4ff',
  indigo500: '#d2deff',
  indigo550: '#cad7ff',
  indigo600: '#c1d0ff',
  indigo650: '#b6c7fc',
  indigo700: '#abbdf9',
  indigo750: '#9cb1f4',
  indigo800: '#8da4ef',
  indigo850: '#6684e6',
  indigo900: '#3e63dd',

  iris100: '#fdfdff',
  iris150: '#fbfbff',
  iris200: '#f8f8ff',
  iris250: '#f4f5ff',
  iris300: '#f0f1fe',
  iris350: '#ebecff',
  iris400: '#e6e7ff',
  iris450: '#e0e2ff',
  iris500: '#dadcff',
  iris550: '#d3d5ff',
  iris600: '#cbcdff',
  iris650: '#c2c4fc',
  iris700: '#b8baf8',
  iris750: '#aaacf4',
  iris800: '#9b9ef0',
  iris850: '#7b7de3',
  iris900: '#5b5bd6',

  green100: '#fbfefd',
  green150: '#f8fdfa',
  green200: '#f4fbf7',
  green250: '#edf9f2',
  green300: '#e6f7ed',
  green350: '#def4e8',
  green400: '#d6f1e3',
  green450: '#cdeddd',
  green500: '#c3e9d7',
  green550: '#b8e4d0',
  green600: '#acdec8',
  green650: '#9cd6bf',
  green700: '#8bceb6',
  green750: '#71c4ab',
  green800: '#56ba9f',
  green850: '#40af91',
  green900: '#29a383',

  orange100: '#fefcfb',
  orange150: '#fffaf4',
  orange200: '#fff7ed',
  orange250: '#fff3e2',
  orange300: '#ffefd6',
  orange350: '#ffe7c6',
  orange400: '#ffdfb5',
  orange450: '#ffd8a8',
  orange500: '#ffd19a',
  orange550: '#ffc98e',
  orange600: '#ffc182',
  orange650: '#fab87b',
  orange700: '#f5ae73',
  orange750: '#f1a164',
  orange800: '#ec9455',
  orange850: '#f28035',
  orange900: '#f76b15',

  purple100: '#fefcfe',
  purple150: '#fdfafe',
  purple200: '#fbf7fe',
  purple250: '#f9f2fe',
  purple300: '#f7edfe',
  purple350: '#f5e8fd',
  purple400: '#f2e2fc',
  purple450: '#eedcfb',
  purple500: '#ead5f9',
  purple550: '#e5cdf7',
  purple600: '#e0c4f4',
  purple650: '#d9baf0',
  purple700: '#d1afec',
  purple750: '#c8a1e8',
  purple800: '#be93e4',
  purple850: '#a671d5',
  purple900: '#8e4ec6',

  red100: '#fffcfc',
  red150: '#fffafa',
  red200: '#fff7f7',
  red250: '#fff1f2',
  red300: '#feebec',
  red350: '#ffe3e4',
  red400: '#ffdbdc',
  red450: '#ffd4d5',
  red500: '#ffcdce',
  red550: '#f28b8e',
  red600: '#e5484d',
  red650: '#e5484d',
  red700: '#e5484d',
  red750: '#e5484d',
  red800: '#e5484d',
  red850: '#e5484d',
  red900: '#e5484d',

  violet100: '#fdfcfe',
  violet150: '#fcfaff',
  violet200: '#faf8ff',
  violet250: '#f7f4ff',
  violet300: '#f4f0fe',
  violet350: '#f0eaff',
  violet400: '#ebe4ff',
  violet450: '#e6dfff',
  violet500: '#e1d9ff',
  violet550: '#dbd2ff',
  violet600: '#d4cafe',
  violet650: '#cbc0fa',
  violet700: '#c2b5f5',
  violet750: '#b6a7f1',
  violet800: '#aa99ec',
  violet850: '#8c78de',
  violet900: '#6e56cf',

  yellow100: '#fefdfb',
  yellow150: '#fefcf2',
  yellow200: '#fefbe9',
  yellow250: '#fff9d6',
  yellow300: '#fff7c2',
  yellow350: '#fff3af',
  yellow400: '#ffee9c',
  yellow450: '#fdea8a',
  yellow500: '#fbe577',
  yellow550: '#f7de75',
  yellow600: '#f3d673',
  yellow650: '#eecc6b',
  yellow700: '#e9c162',
  yellow750: '#e6b24c',
  yellow800: '#e2a336',
  yellow850: '#f1b43a',
  yellow900: '#ffc53d',

  white100: '#fff',
  white150: '#fff',
  white200: '#fff',
  white250: '#fff',
  white300: '#fff',
  white350: '#fff',
  white400: '#fff',
  white450: '#fff',
  white500: '#fff',
  white550: '#fff',
  white600: '#fff',
  white650: '#fff',
  white700: '#fff',
  white750: '#fff',
  white800: '#fff',
  white850: '#fff',
  white900: '#fff',

  black100: '#000',
  black150: '#000',
  black200: '#000',
  black250: '#000',
  black300: '#000',
  black350: '#000',
  black400: '#000',
  black450: '#000',
  black500: '#000',
  black550: '#000',
  black600: '#000',
  black650: '#000',
  black700: '#000',
  black750: '#000',
  black800: '#000',
  black850: '#000',
  black900: '#000',

  primary100: '#b1e0ff',
  primary150: '#94d4ff',
  primary200: '#76c8ff',
  primary250: '#62c0ff',
  primary300: '#4eb8ff',
  primary350: '#3bb1ff',
  primary400: '#27a9ff',
  primary450: '#14a1ff',
  primary500: '#0099ff',
  primary550: '#008dec',
  primary600: '#0081d8',
  primary650: '#0076c5',
  primary700: '#006ab1',
  primary750: '#005e9d',
  primary800: '#005289',
  primary850: '#004776',
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

export type ColorFacet =
  | '100'
  | '150'
  | '200'
  | '250'
  | '300'
  | '350'
  | '400'
  | '450'
  | '500'
  | '550'
  | '600'
  | '650'
  | '700'
  | '750'
  | '800'
  | '850'
  | '900';

export let getColorKey = (color: ColorType, facet: ColorFacet): ColorKey => `${color}${facet}`;

export let getForegroundColor = memo((color: ColorKey) => {
  if (color.startsWith('white') || color.startsWith('yellow')) {
    return '#000';
  }

  let value = colors[color];
  if (value.length == 4) {
    value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }

  let r = parseInt(value.substr(1, 2), 16);
  let g = parseInt(value.substr(3, 2), 16);
  let b = parseInt(value.substr(5, 2), 16);
  let brightness = (r * 299 + g * 587 + b * 114) / 1000;

  if (Number.isNaN(brightness)) return '#fff';

  return brightness > 125 ? '#000' : '#fff';
});
