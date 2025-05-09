import React from 'react';
import { TextProps } from './constants';
import { Text } from './text';

export let Bold = (
  props: { children: React.ReactNode; style?: React.CSSProperties } & TextProps
) => {
  return <Text {...props} weight="bold" as="span" />;
};

export let Italic = (
  props: { children: React.ReactNode; style?: React.CSSProperties } & TextProps
) => {
  return <Text {...props} style={{ fontStyle: 'italic' }} as="span" />;
};
