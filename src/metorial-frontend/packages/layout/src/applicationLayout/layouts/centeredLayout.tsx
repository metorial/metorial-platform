import React from 'react';
import styled from 'styled-components';

let Wrapper = styled('div')`
  height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;

let Inner = styled('div')`
  max-width: 100%;
  max-height: calc(100% - 40px);
  padding: 0 20px;

  display: flex;
  text-align: center;
  flex-direction: column;
`;

export let CenteredLayout = ({
  children,
  width
}: {
  children: React.ReactNode;
  width?: string;
}) => {
  return (
    <Wrapper>
      <Inner style={{ width: width ?? 400 }}>{children}</Inner>
    </Wrapper>
  );
};
