import { Datalist } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

let Grid = styled.div`
  display: grid;
  grid-template-columns: calc(100% - 350px) 300px;
  gap: 50px;

  @media (max-width: 1300px) {
    grid-template-columns: 100%;
    gap: 30px;
  }
`;

let Main = styled.main``;

let Aside = styled.aside``;

export let AttributesLayout = ({
  children,
  items
}: {
  children: React.ReactNode;
  items: {
    label: React.ReactNode;
    value: React.ReactNode;
  }[];
}) => {
  return (
    <Grid>
      <Main>{children}</Main>

      <Aside>
        <Datalist items={items} />
      </Aside>
    </Grid>
  );
};
