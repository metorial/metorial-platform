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
  items: ({ component: React.ReactNode; time: Date; order?: number } | boolean | null | undefined)[];
}) => {
  return (
    <ListWrapper>
      {items
        .filter(e => e != null && typeof e !== 'boolean')
        .sort((a, b) => {
          if (a.order != null && b.order != null) return a.order - b.order;
          let timeDiff = a.time.getTime() - b.time.getTime();
          if (timeDiff !== 0) return timeDiff;
          return (a.order ?? 0) - (b.order ?? 0);
        })
        .map((e, i) => (
          <Fragment key={i}>{e.component}</Fragment>
        ))}
    </ListWrapper>
  );
};
