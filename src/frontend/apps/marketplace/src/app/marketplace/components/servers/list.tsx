'use client';

import { styled } from 'styled-components';
import { ServerListing } from '../../../../state/server';
import { ServerEntry } from './entry';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (min-width: 800px) {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
`;

export let ServerList = ({ servers }: { servers: ServerListing[] }) => {
  return (
    <Wrapper>
      {servers.map(server => (
        <ServerEntry key={server.id} server={server} />
      ))}
    </Wrapper>
  );
};
