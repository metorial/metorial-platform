import { Text, theme, Title } from '@metorial/ui';
import React from 'react';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  padding: 20px;
`;

let Header = styled.header`
  display: flex;
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 15px;
`;

let HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

let RightActions = styled.nav`
  display: flex;
  gap: 10px;
`;

export let Box = ({
  title,
  description,
  children,
  rightActions
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  rightActions?: React.ReactNode;
}) => {
  return (
    <Wrapper>
      <Header>
        <HeaderContent>
          <Title as="h2" size="3" weight="strong">
            {title}
          </Title>
          {description && (
            <Text size="2" weight="medium" color="gray600">
              {description}
            </Text>
          )}
        </HeaderContent>
        {rightActions && <RightActions>{rightActions}</RightActions>}
      </Header>
      <main>{children}</main>
    </Wrapper>
  );
};
