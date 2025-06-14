import React, { Fragment } from 'react';
import { styled } from 'styled-components';
import { theme } from '..';

let Wrapper = styled('div')``;

let DL = styled('dl')`
  display: grid;
  margin: 0;
  padding: 0;
  font-size: 14px;

  &[data-variant='default'] {
    gap: 10px;
    grid-template-columns: auto 1fr;
  }

  &[data-variant='large'] {
    gap: 30px;
    grid-template-columns: 1fr;

    div {
      gap: 7px;
      display: grid;
      grid-template-columns: 1fr;
    }
  }
`;

let DT = styled('dt')`
  font-weight: 600;
  color: ${theme.colors.gray600};
  margin: 0 !important;
`;

let DD = styled('dd')`
  font-weight: 400;
  margin: 0 !important;
`;

export let Datalist = ({
  items,
  variant = 'default'
}: {
  items: {
    label: React.ReactNode;
    value: React.ReactNode;
  }[];
  variant?: 'default' | 'large';
}) => {
  return (
    <Wrapper>
      <DL data-variant={variant}>
        {items.map((item, i) =>
          variant == 'default' ? (
            <Fragment key={i}>
              <DT>{item.label}</DT>
              <DD>{item.value}</DD>
            </Fragment>
          ) : (
            <div key={i}>
              <DT>{item.label}</DT>
              <DD>{item.value}</DD>
            </div>
          )
        )}
      </DL>
    </Wrapper>
  );
};
