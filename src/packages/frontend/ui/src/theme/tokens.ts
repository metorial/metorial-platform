import React from 'react';

let toDashCase = (str: string) => {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replaceAll('_', '-');
};

export let createThemeToken =
  (defaultValue?: string) =>
  (name: string): ThemeTokenValue => {
    let id = toDashCase(name);
    let value = `var(--${id}${defaultValue ? `, ${defaultValue}` : ''})`;

    return Object.assign(value, {
      id,
      name,
      value,
      defaultValue,
      varName: `--${id}`
    });
  };

export type ThemeTokenFactory = (name: string) => ThemeTokenValue;

export type ThemeTokenValue = string & {
  id: string;
  name: string;
  value: string;
  varName: string;
  defaultValue?: string;
};

export type ThemeTokens = {
  [key: string]: ThemeTokenFactory | ThemeTokens;
};

type InferThemeTokenValues<Tokens> = Tokens extends ThemeTokens
  ? {
      [K in keyof Tokens]: Tokens[K] extends ThemeTokenFactory
        ? ThemeTokenValue
        : InferThemeTokenValues<Tokens[K]>;
    }
  : never;

type InferThemeTokenStringValue<Tokens> = Tokens extends ThemeTokens
  ? {
      [K in keyof Tokens]: Tokens[K] extends ThemeTokenFactory
        ? string
        : InferThemeTokenStringValue<Tokens[K]>;
    }
  : never;

let recursivelyCallThemeTokenFactory = <Tokens extends ThemeTokens>(
  tokens: Tokens
): InferThemeTokenValues<Tokens> => {
  let result: any = {};

  for (let key in tokens) {
    let token = tokens[key];

    if (typeof token === 'function') {
      result[key] = token(key);
    } else {
      result[key] = recursivelyCallThemeTokenFactory(token);
    }
  }

  return result;
};

export let createTheme = <Tokens extends ThemeTokens>(tokens: Tokens) => {
  let values = recursivelyCallThemeTokenFactory(tokens);

  let setBodyStyles = (theme: InferThemeTokenValues<ThemeTokens>) => {
    for (let value of Object.values(theme) as any) {
      if ('value' in value) {
        if (value.defaultValue) {
          document.body.style.setProperty(value.varName, value.defaultValue);
        }
      } else if (typeof value === 'object') {
        setBodyStyles(value);
      }
    }
  };

  return {
    ...values,

    setRootStyles: (theme: InferThemeTokenStringValue<Tokens>) => {
      let styles: React.CSSProperties = {};

      let recurse = (theme: any, values: any) => {
        for (let key in theme) {
          let value = theme[key];

          if (typeof value == 'string' || value.value) {
            let cssKey = values[key]?.varName;

            if (value.value) value = value.value;

            if (value && cssKey) {
              // @ts-ignore
              styles[cssKey] = value;
            }
          } else {
            recurse(theme[key], values[key]);
          }
        }
      };

      recurse(theme, values);

      return styles;
    },

    setBodyStyles: () => setBodyStyles(values)
  };
};
