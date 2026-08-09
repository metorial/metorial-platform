import { Text, theme, Title } from '@metorial/ui';
import React from 'react';
import { styled } from 'styled-components';
import type { BoxProps } from './box';
import { Table, type TableProps } from './table';

let Wrapper = styled.div`
  border: 1px solid ${theme.colors.gray400};
  border-radius: 12px;
  overflow: hidden;
`;

let Header = styled.header`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
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

export type TableBoxProps = Omit<BoxProps, 'children'> &
  TableProps & {
    children?: React.ReactNode;
  };

export let TableBox = ({
  title,
  description,
  rightActions,
  children,
  ...tableProps
}: TableBoxProps) => (
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

    <Table {...tableProps} />
    {children}
  </Wrapper>
);
