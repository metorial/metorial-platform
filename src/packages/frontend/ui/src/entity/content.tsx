import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { useEntityContext } from './context';

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

let ContentEntityWrapper = styled('div').withConfig({
  shouldForwardProp: prop => prop !== '$aligned'
})<{ $aligned?: boolean }>`
  display: flex;
  ${({ $aligned }) =>
    $aligned
      ? `
        flex: 1 1 0;
        min-width: 0;
      `
      : `
        flex-grow: 1;
      `}
`;

let MobileBorderStyle = styled(ContentEntityWrapper)`
  @media (max-width: 600px) {
    border-bottom: 1px solid ${theme.colors.gray300};
  }
`;

let ContentEntity = ({
  children,
  last,
  aligned
}: {
  children: React.ReactNode;
  last: boolean;
  aligned: boolean;
}) => {
  let Element = last ? ContentEntityWrapper : MobileBorderStyle;

  return <Element $aligned={aligned}>{children}</Element>;
};

export let EntityContent = ({
  children,
  aligned
}: {
  children: React.ReactNode;
  aligned?: boolean;
}) => {
  let context = useEntityContext();
  let isAligned = aligned ?? context.aligned;

  let childArray = Array.isArray(children) ? children : [children];

  return (
    <Wrapper>
      {childArray.map((child, i) => (
        <ContentEntity
          key={i}
          last={i == childArray.length - 1}
          aligned={isAligned}
        >
          {child}
        </ContentEntity>
      ))}
    </Wrapper>
  );
};
