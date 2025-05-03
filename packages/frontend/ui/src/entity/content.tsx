import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';

let Wrapper = styled('main')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-start;
  align-items: stretch;
  padding: 0px 20px;

  @media (max-width: 600px) {
    padding: 0px;
    flex-direction: column;
    flex-wrap: nowrap;
  }

  &:not(:first-child) {
    border-top: solid 1px ${theme.colors.gray300};
  }
`;

let ContentEntityWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
`;

let MobileBorderStyle = styled(ContentEntityWrapper)`
  @media (max-width: 600px) {
    border-bottom: 1px solid ${theme.colors.gray300};
  }
`;

let ContentEntity = ({ children, last }: { children: React.ReactNode; last: boolean }) => {
  let Element = last ? ContentEntityWrapper : MobileBorderStyle;

  return <Element>{children}</Element>;
};

export let EntityContent = ({ children }: { children: React.ReactNode }) => {
  let childArray = Array.isArray(children) ? children : [children];

  return (
    <Wrapper>
      {childArray.map((child, i) => (
        <ContentEntity key={i} last={i == childArray.length - 1}>
          {child}
        </ContentEntity>
      ))}
    </Wrapper>
  );
};
