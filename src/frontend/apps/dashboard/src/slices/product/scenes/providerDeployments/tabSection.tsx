import React from 'react';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 20px;
  flex-wrap: wrap;
`;

let Intro = styled.div`
  max-width: 760px;
`;

let ToolbarRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  flex-wrap: wrap;
`;

let SearchWrap = styled.div`
  flex: 1 1 360px;
  min-width: 280px;
`;

let ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
`;

let EmptyState = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 10px;
`;

export let ProviderDeploymentTabSection = ({
  intro,
  actions,
  search,
  children,
  emptyState
}: {
  intro?: React.ReactNode;
  actions?: React.ReactNode;
  search?: React.ReactNode;
  children: React.ReactNode;
  emptyState?: React.ReactNode;
}) => {
  return (
    <Wrapper>
      {search ? (
        <>
          {intro ? (
            <HeaderRow>
              <Intro>{intro}</Intro>
              {actions ? <ActionRow>{actions}</ActionRow> : null}
            </HeaderRow>
          ) : null}
          <ToolbarRow>
            <SearchWrap>{search}</SearchWrap>
            {!intro && actions ? <ActionRow>{actions}</ActionRow> : null}
          </ToolbarRow>
        </>
      ) : intro || actions ? (
        <HeaderRow>
          {intro ? <Intro>{intro}</Intro> : <div />}
          {actions ? <ActionRow>{actions}</ActionRow> : null}
        </HeaderRow>
      ) : null}

      <div>{children}</div>

      {emptyState ? <EmptyState>{emptyState}</EmptyState> : null}
    </Wrapper>
  );
};
