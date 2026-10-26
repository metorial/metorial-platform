import { Datalist } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';
import { useDetailsLayout } from '../detailsLayoutContext';

let OverviewGrid = styled.div`
  width: 100%;
  display: grid;
  align-items: start;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  gap: 48px;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
`;

let OverviewContent = styled.div`
  min-width: 0;
`;

let OverviewAttributes = styled.aside`
  min-width: 0;

  a {
    color: ${theme.colors.gray700};
    text-decoration: none;
    border-bottom: 1px dashed ${theme.colors.gray400};
    transition: all 0.2s ease-in-out;
    font-weight: 500;

    strong {
      font-weight: 700;
    }

    &:hover,
    &:focus {
      color: ${theme.colors.foreground};
      border-bottom: 1px dashed ${theme.colors.foreground};
    }
  }
`;

export let DetailsOverviewLayout = ({ children }: { children: React.ReactNode }) => {
  let { attributes } = useDetailsLayout();

  return (
    <>
      <OverviewGrid>
        <OverviewContent>{children}</OverviewContent>
        <OverviewAttributes>
          <Datalist items={attributes} variant="large" />
        </OverviewAttributes>
      </OverviewGrid>
    </>
  );
};
