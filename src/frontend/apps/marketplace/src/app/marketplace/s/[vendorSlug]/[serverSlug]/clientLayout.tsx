'use client';

import styled from 'styled-components';
import { ProviderListing } from '../../../../../state/provider';
import { ProviderAside } from './components/aside';
import { ProviderHeader } from './components/header';

let Wrapper = styled.div`
  padding: 60px 20px;
`;

let Inner = styled.div`
  width: 80rem;
  max-width: 100%;
  margin: 0 auto;
`;

let Grid = styled.div`
  display: flex;
  grid-template-columns: 1fr 400px;
  gap: 50px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 20px;
  }
`;

let Main = styled.main`
  max-width: min(calc(100vw - 60px), calc(80rem - 450px));
  width: 100%;
`;

let AsideWrapper = styled.aside`
  max-width: min(390px, calc(100vw - 80px - min(calc(100vw - 60px), calc(80rem - 450px))));
  width: 100%;
`;

export let ClientLayout = ({
  children,
  providerListing
}: {
  children: React.ReactNode;
  providerListing: ProviderListing;
}) => {
  return (
    <>
      <ProviderHeader providerListing={providerListing} />

      <Wrapper>
        <Inner>
          <Grid>
            <Main>{children}</Main>

            <AsideWrapper>
              <ProviderAside providerListing={providerListing} />
            </AsideWrapper>
          </Grid>
        </Inner>
      </Wrapper>
    </>
  );
};
