import { Text, theme, Title } from '@metorial/ui';
import React, { createContext, useContext } from 'react';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  border: 1px solid ${theme.colors.gray400};
  box-shadow: ${theme.shadows.small};
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

let GroupWrapper = styled.div`
  border: 1px solid ${theme.colors.gray400};
  box-shadow: ${theme.shadows.small};
  border-radius: 12px;
  display: flex;
  flex-direction: column;
`;

let GroupItem = styled.div`
  padding: 20px;

  & + & {
    border-top: 1px solid ${theme.colors.gray400};
  }
`;

let Header = styled.header`
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;

  @media (max-width: 600px) {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
`;

let HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

let Main = styled.main`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let SideBoxGroupContext = createContext(false);

export let SideBoxGroup = ({ children }: { children: React.ReactNode }) => {
  return (
    <SideBoxGroupContext.Provider value={true}>
      <GroupWrapper>{children}</GroupWrapper>
    </SideBoxGroupContext.Provider>
  );
};

export let SideBox = ({
  title,
  description,
  children
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) => {
  let isGrouped = useContext(SideBoxGroupContext);
  let Container = isGrouped ? GroupItem : Wrapper;

  return (
    <Container>
      <Header>
        <HeaderContent>
          <Title as="h2" size="3" weight="strong">
            {title}
          </Title>
          {description && (
            <Text size="2" weight="medium" color="gray600" balance>
              {description}
            </Text>
          )}
        </HeaderContent>

        <Main>{children}</Main>
      </Header>
    </Container>
  );
};
