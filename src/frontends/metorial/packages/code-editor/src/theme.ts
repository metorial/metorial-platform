import { tags as t } from '@lezer/highlight';
import { createTheme, CreateThemeOptions } from '@uiw/codemirror-themes';

export let defaultSettingsSpark: CreateThemeOptions['settings'] = {
  background: '#ffffff',
  foreground: '#333333',
  caret: '#000000',
  selection: '#caddff',
  selectionMatch: '#efefef',
  gutterBackground: '#ffffff',
  gutterForeground: '#888888',
  gutterBorder: '#dddddd',
  lineHighlight: '#0000000a'
};

export let sparkInit = (options?: Partial<CreateThemeOptions>) => {
  let { theme = 'light', settings = {}, styles = [] } = options || {};
  return createTheme({
    theme: theme,
    settings: {
      ...defaultSettingsSpark,
      ...settings
    },
    styles: [
      {
        tag: [
          t.function(t.variableName),
          t.function(t.propertyName),
          t.url,
          t.processingInstruction
        ],
        color: '#EE5A24'
      },
      { tag: [t.tagName, t.heading], color: '#3867d6' },
      { tag: t.comment, color: '#54636D' },
      { tag: [t.propertyName], color: '#3867d6' },
      { tag: [t.attributeName, t.number], color: '#3867d6' },
      { tag: t.className, color: '#4dbf99' },
      { tag: t.keyword, color: '#4dbf99' },
      { tag: [t.string, t.regexp, t.special(t.propertyName)], color: '#4dbf99' },
      ...styles
    ]
  });
};

export let sparkTheme = sparkInit();
