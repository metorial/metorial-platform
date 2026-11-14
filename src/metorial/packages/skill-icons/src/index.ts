import { SKILL_ICON_PATHS } from './paths';

export { SKILL_ICON_PATHS };

export let SKILL_ICON_COLORS = {
  gray: { background: '#f1f1f1', foreground: '#444444' },
  blue: { background: '#e5f4ff', foreground: '#0077cc' },
  green: { background: '#e6f6ec', foreground: '#1f8a4c' },
  yellow: { background: '#fdf5d8', foreground: '#9a6b00' },
  orange: { background: '#fdeee3', foreground: '#c2541a' },
  red: { background: '#fdeaea', foreground: '#c4302b' },
  purple: { background: '#f1ecfd', foreground: '#6a43c7' }
} as const;

export type SkillIconColor = keyof typeof SKILL_ICON_COLORS;

export type SkillIcon = { icon: string; color: SkillIconColor };

export let SKILL_ICON_IDS = Object.keys(SKILL_ICON_PATHS);

export let SKILL_ICON_COLOR_IDS = Object.keys(SKILL_ICON_COLORS) as SkillIconColor[];

export let DEFAULT_SKILL_ICON_COLOR: SkillIconColor = 'blue';

let hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export let isSkillIconId = (icon: string) => hasOwn(SKILL_ICON_PATHS, icon);

export let isSkillIconColor = (color: string): color is SkillIconColor =>
  hasOwn(SKILL_ICON_COLORS, color);

export let isSkillIcon = (value: { icon: string; color: string }): value is SkillIcon =>
  isSkillIconId(value.icon) && isSkillIconColor(value.color);

export let getSkillIconKeywords = (icon: string) =>
  icon
    .split('-')
    .filter(part => part != 'line' && !/^\d+$/.test(part))
    .join(' ');

export let renderSkillIconSvg = (d: { icon: string; color: string; size?: number }) => {
  let paths = SKILL_ICON_PATHS[d.icon];
  if (!paths) throw new Error(`Unknown skill icon: ${d.icon}`);

  let colors = isSkillIconColor(d.color)
    ? SKILL_ICON_COLORS[d.color]
    : SKILL_ICON_COLORS[DEFAULT_SKILL_ICON_COLOR];

  let size = d.size ?? 128;
  let radius = Math.round(size * 0.22);
  let glyphSize = size * 0.56;
  let offset = (size - glyphSize) / 2;
  let scale = glyphSize / 24;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${colors.background}"/>`,
    `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="${colors.foreground}">`,
    ...paths.map(path => `<path d="${path}"/>`),
    `</g>`,
    `</svg>`
  ].join('');
};

let toBase64 = (value: string) => {
  if (typeof Buffer != 'undefined') return Buffer.from(value, 'utf8').toString('base64');

  let bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export let renderSkillIconDataUrl = (d: { icon: string; color: string; size?: number }) =>
  `data:image/svg+xml;base64,${toBase64(renderSkillIconSvg(d))}`;
