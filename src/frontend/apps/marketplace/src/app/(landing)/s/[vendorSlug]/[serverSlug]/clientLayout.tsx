'use client';

import styled from 'styled-components';
import { ServerListing } from '../../../../../state/server';
import { ServerAside } from './components/aside';
import { ExplorerContextProvider } from './components/explorer/context';
import { ServerHeader } from './components/header';

let Wrapper = styled.div`
  padding: 60px 20px;
`;

let Inner = styled.div`
  width: 1000px;
  max-width: 100%;
  margin: 0 auto;
`;

let Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 50px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 20px;
  }
`;

let Main = styled.main`
  max-width: min(calc(100vw - 60px), 550px);
`;

export let ClientLayout = ({
  children,
  server
}: {
  children: React.ReactNode;
  server: ServerListing;
}) => {
  return (
    <ExplorerContextProvider>
      <ServerHeader server={server} />

      <Wrapper>
        <Inner>
          <Grid>
            <Main>{children}</Main>

            <div>
              <ServerAside server={server} />
            </div>
          </Grid>
        </Inner>
      </Wrapper>

      {/* <ExplorerRoot server={server} /> */}
    </ExplorerContextProvider>
  );
};
