import React, { Fragment } from 'react';
import styled from 'styled-components';

let ListWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let ItemWrapper = styled.div`
  &[data-selected='true'] {
    scroll-margin-top: 16px;
    border-radius: 8px;
    outline: 2px solid rgba(59, 130, 246, 0.35);
    outline-offset: 6px;
  }
`;

export let ItemList = ({
  items,
  selectedItemId
}: {
  items: ({ id?: string; component: React.ReactNode; time: Date } | boolean | null)[];
  selectedItemId?: string | null;
}) => {
  return (
    <ListWrapper>
      {items
        .filter(e => typeof e !== 'boolean' && e !== null)
        .sort((a, b) => a.time.getTime() - b.time.getTime())
        .map((e, i) => (
          <ItemWrapper
            key={e.id ?? i}
            data-selected={e.id && selectedItemId === e.id ? 'true' : undefined}
            data-timeline-item-id={e.id}
          >
            <Fragment>{e.component}</Fragment>
          </ItemWrapper>
        ))}
    </ListWrapper>
  );
};
