import { theme } from '@metorial/ui';
import { RiArrowRightSLine } from '@remixicon/react';
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

let Wrapper = styled('nav')`
  overflow-x: auto;
  white-space: nowrap;
  margin-left: -5px;

  &::-webkit-scrollbar {
    display: none;
  }

  scrollbar-width: none;
`;

let BreadcrumbList = styled('ul')`
  display: flex;
  gap: 5px;
  list-style: none;
  padding: 0;
  margin: 0;
`;

let BreadcrumbItem = styled('li')`
  font-size: 14px;
  color: ${theme.colors.gray600};
  display: flex;
  align-items: center;
  gap: 5px;
`;

let BreadcrumbLink = styled(Link)`
  color: ${theme.colors.gray600};
  text-decoration: none;
  transition: all 0.2s;
  font-weight: 500;
  font-size: 12px;
  padding: 3px 5px;
  border-radius: 4px;

  &:hover,
  &:focus {
    color: ${theme.colors.gray800};
    background: ${theme.colors.gray300};
  }
`;

let BreadcrumbSeparator = styled('span')`
  color: ${theme.colors.gray600};
  display: flex;

  svg {
    height: 14px;
    width: 14px;
  }
`;

export let Breadcrumbs = ({
  breadcrumbs
}: {
  breadcrumbs: {
    label: React.ReactNode;
    to: string;
  }[];
}) => {
  return (
    <Wrapper>
      <BreadcrumbList>
        {breadcrumbs.map(({ label, to }, index) => (
          <BreadcrumbItem key={index}>
            <BreadcrumbLink to={to}>{label}</BreadcrumbLink>
            {index < breadcrumbs.length - 1 && (
              <BreadcrumbSeparator>
                <RiArrowRightSLine />
              </BreadcrumbSeparator>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Wrapper>
  );
};
