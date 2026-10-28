// @vitest-environment node
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseHtmlBody } from './htmlDom';

let window = new JSDOM('<!doctype html><html><body></body></html>').window;

let schemaProperties = [
  'font-weight',
  'font-style',
  'text-decoration',
  'vertical-align',
  'text-align'
];

let values: Record<string, string[]> = {
  'font-weight': [
    'bold',
    'BOLD',
    'Bold',
    'normal',
    '100',
    '400',
    '700',
    '1000',
    '1001',
    '0',
    '-100',
    '450',
    'bolder',
    'lighter',
    '600 ',
    'inherit',
    'INHERIT',
    'initial',
    'unset',
    'bold !important',
    'bold ! important',
    'foo',
    '',
    '</p> bold',
    '<b>',
    '"bold"',
    'bold bold',
    '1e3'
  ],
  'font-style': [
    'italic',
    'ITALIC',
    'normal',
    'oblique',
    'oblique 10deg',
    'oblique 0.5turn',
    'foo',
    'italic bold',
    'italics',
    '</p> italic',
    'inherit'
  ],
  'text-decoration': [
    'underline',
    'UNDERLINE',
    'line-through',
    'none',
    'overline',
    'underline line-through',
    'underline overline line-through',
    'underline red',
    'underline solid red',
    'underline #fff',
    'underline #ffffff',
    'underline rgb(1, 2, 3)',
    'underline dotted',
    'underline wavy blue',
    'foo',
    '</p> underline',
    'underline <b>',
    'underline;',
    '"underline"',
    'inherit',
    'initial'
  ],
  'vertical-align': [
    'sub',
    'super',
    'SUB',
    'Super',
    'baseline',
    'top',
    'middle',
    'bottom',
    'text-top',
    'text-bottom',
    '10px',
    '-2em',
    '50%',
    '0',
    'foo',
    'sub super',
    '</p> sub',
    'inherit'
  ],
  'text-align': [
    'center',
    'CENTER',
    'Center',
    'left',
    'right',
    'justify',
    'start',
    'end',
    'match-parent',
    'foo',
    '',
    'center !important',
    '</p> center',
    'justify-all',
    'inherit'
  ]
};

let jsdomValue = (property: string, value: string) => {
  let element = window.document.createElement('span');
  element.setAttribute('style', `${property}: ${value}`);
  let style = element.style as any;

  return { length: style.length as number, value: style.getPropertyValue(property) as string };
};

let ourValue = (property: string, value: string) => {
  let html = `<span style="${`${property}: ${value}`.replaceAll('"', '&quot;')}">x</span>`;
  let style = parseHtmlBody(html).querySelector('span')!.style;

  return { length: style.length as number, value: style.getPropertyValue(property) as string };
};

describe('inline style parsing matches a browser dom for the properties the schema reads', () => {
  for (let property of schemaProperties) {
    for (let value of values[property]!) {
      it(`${property}: ${JSON.stringify(value)}`, () => {
        expect(ourValue(property, value)).toEqual(jsdomValue(property, value));
      });
    }
  }
});

describe('inline style parsing', () => {
  let styleOf = (css: string) =>
    parseHtmlBody(`<span style="${css}">x</span>`).querySelector('span')!.style;

  it('keeps the last declaration of a repeated property', () => {
    expect(styleOf('font-weight: bold; font-weight: normal').fontWeight).toBe('normal');
  });

  it('drops an invalid later declaration without removing an earlier valid one', () => {
    expect(styleOf('font-weight: bold; font-weight: nonsense').fontWeight).toBe('bold');
  });

  it('ignores declarations without a property or value', () => {
    let style = styleOf(';;: bold; font-weight:; : ; color');

    expect(style.length).toBe(0);
  });

  it('exposes camel-cased property access', () => {
    expect(styleOf('text-align: center').textAlign).toBe('center');
    expect(styleOf('vertical-align: sub').verticalAlign).toBe('sub');
  });

  it('keeps unrelated properties without interpreting them', () => {
    let style = styleOf('color: red; margin: 0 auto');

    expect(style.getPropertyValue('color')).toBe('red');
    expect(style.getPropertyValue('margin')).toBe('0 auto');
  });
});
