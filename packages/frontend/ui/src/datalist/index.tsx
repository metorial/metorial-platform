import React, { Fragment } from 'react';
import { styled } from 'styled-components';
import { theme } from '..';

let Wrapper = styled('div')``;

let DL = styled('dl')`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  margin: 0;
  padding: 0;
  font-size: 14px;
`;

let DT = styled('dt')`
  font-weight: 600;
  color: ${theme.colors.gray600};
`;

let DD = styled('dd')`
  font-weight: 400;
`;

export let Datalist = ({
  items
}: {
  items: {
    label: React.ReactNode;
    value: React.ReactNode;
  }[];
}) => {
  return (
    <Wrapper>
      <DL>
        {items.map((item, i) => (
          <Fragment key={i}>
            <DT>{item.label}</DT>
            <DD>{item.value}</DD>
          </Fragment>
        ))}
      </DL>
    </Wrapper>
  );
};
