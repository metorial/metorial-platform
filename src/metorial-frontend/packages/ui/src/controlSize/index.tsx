import React, { createContext, type CSSProperties, type ReactNode, useContext } from 'react';
import { styled } from 'styled-components';
import { ControlSize } from './scale';

export * from './scale';

let ControlSizeContext = createContext<ControlSize | undefined>(undefined);

export let ControlSizeProvider = ControlSizeContext.Provider;

export let useControlSize = (explicit?: ControlSize, fallback: ControlSize = '3'): ControlSize => {
  let inherited = useContext(ControlSizeContext);
  return explicit ?? inherited ?? fallback;
};

let Row = styled('div')`
  display: flex;
  align-items: stretch;
  gap: 8px;
  width: 100%;

  @media (max-width: 720px) {
    flex-wrap: wrap;
  }
`;

export let Toolbar = ({
  size = '3',
  children,
  style
}: {
  size?: ControlSize;
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <ControlSizeProvider value={size}>
    <Row style={style}>{children}</Row>
  </ControlSizeProvider>
);
