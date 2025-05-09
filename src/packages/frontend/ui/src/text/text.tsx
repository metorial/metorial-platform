import React from 'react';
import Balancer from 'react-wrap-balancer';
import { styled } from 'styled-components';
import { TextProps, getTextStyles } from './constants';

let Element = styled('div')`
  font-size: var(--font-size);
  letter-spacing: var(--letter-spacing);
  line-height: var(--line-height);

  @media (max-width: 768px) {
    font-size: calc(var(--font-size) * var(--mobile-scale));
    line-height: calc(var(--line-height) * var(--mobile-scale));
  }
`;

export let Text = (
  props: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    as?: 'p' | 'span' | 'div' | 'label' | 'time' | 'pre';
    balance?: boolean;
  } & TextProps
) => {
  let styles = getTextStyles(props);

  return React.createElement(
    Element,
    {
      style: { ...styles, ...props.style },
      // @ts-ignore
      as: props.as ?? 'p'
    },
    props.balance ? (
      <Balancer style={{ textAlign: props.align }}>{props.children}</Balancer>
    ) : (
      props.children
    )
  );
};

export let Title = (
  props: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    balance?: boolean;
  } & TextProps
) => {
  let styles = getTextStyles(props);

  return React.createElement(
    Element,
    {
      style: { ...styles, ...props.style },
      // @ts-ignore
      as: props.as ?? 'h1'
    },
    props.balance ? (
      <Balancer style={{ textAlign: props.align }}>{props.children}</Balancer>
    ) : (
      props.children
    )
  );
};
