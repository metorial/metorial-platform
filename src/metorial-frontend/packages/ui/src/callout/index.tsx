import { RiAlertLine } from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import { CalloutStyleProps, getCalloutStyles } from './constants';

let Wrapper = styled('div')`
  display: flex;
  align-items: center;
`;

let Icon = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    height: 100%;
    aspect-ratio: 1;
  }
`;

let Content = styled('div')`
  display: flex;
  align-items: center;
  flex-grow: 1;
`;

let ContentInner = styled('div')`
  flex-grow: 1;
  width: 100%;
`;

export let Callout = ({
  children,
  color,
  size,
  variant,
  style
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
} & CalloutStyleProps) => {
  let { icon, ...styles } = getCalloutStyles({ color, size, variant });

  return (
    <Wrapper style={{ ...styles, ...style, display: 'flex', alignItems: 'center' }}>
      <Icon
        style={{
          width: icon.size,
          height: icon.size
        }}
      >
        <RiAlertLine />
      </Icon>
      <Content>
        <ContentInner>{children}</ContentInner>
      </Content>
    </Wrapper>
  );
};
