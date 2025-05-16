import { Text, theme, Title } from '@metorial/ui';
import { RiArrowRightSLine } from '@remixicon/react';
import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { styled } from 'styled-components';

let Wrapper = styled.header`
  display: flex;
  gap: 20px;
  justify-content: space-between;
  margin-bottom: 20px;
`;

let Main = styled.main`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

let Nav = styled.nav`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

let PaginationList = styled.ul`
  display: flex;
  gap: 5px;
  list-style: none;
  padding: 0;
`;

let PaginationItem = styled.li`
  display: flex;
  color: ${theme.colors.gray600};
  font-size: 14px;
  font-weight: 500;
  align-items: center;

  a {
    color: inherit;
  }
`;

export let PageHeader = ({
  title,
  description,
  actions,
  pagination
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  pagination?: {
    href: string;
    label: React.ReactNode;
  }[];
}) => {
  return (
    <Wrapper>
      <Main>
        {pagination && (
          <PaginationList>
            {pagination.map((item, index) => (
              <Fragment key={index}>
                {index > 0 && (
                  <PaginationItem>
                    <RiArrowRightSLine size={14} />
                  </PaginationItem>
                )}

                <PaginationItem>
                  <Link to={item.href}>{item.label}</Link>
                </PaginationItem>
              </Fragment>
            ))}
          </PaginationList>
        )}

        <Title as="h1" size="7" weight="strong">
          {title}
        </Title>
        {description && (
          <Text size="2" weight="medium" color="gray700">
            {description}
          </Text>
        )}
      </Main>

      {actions && <Nav>{actions}</Nav>}
    </Wrapper>
  );
};
