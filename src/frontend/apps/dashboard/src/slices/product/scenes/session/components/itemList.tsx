import React, { Fragment } from 'react';
import styled from 'styled-components';

let ListWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let ItemList = ({
  items
}: {
  items: ({ component: React.ReactNode; time: Date } | boolean | null)[];
}) => {
  return (
    <ListWrapper>
      {items
        .filter(e => typeof e !== 'boolean' && e !== null)
        .sort((a, b) => a.time.getTime() - b.time.getTime())
        .map((e, i) => (
          <Fragment key={i}>{e.component}</Fragment>
        ))}
    </ListWrapper>
  );
};
