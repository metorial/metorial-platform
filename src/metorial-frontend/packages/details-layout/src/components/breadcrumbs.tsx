import { Skeleton, theme } from '@metorial/ui';
import { RiArrowRightSLine } from '@remixicon/react';
import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components';

export type DetailsBreadcrumb = {
  label?: React.ReactNode;
  to?: string;
};

let BreadcrumbNav = styled.nav`
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

let BreadcrumbList = styled.ol`
  display: flex;
  align-items: center;
  gap: 7px;
  list-style: none;
  margin: 0;
  padding: 0;
  white-space: nowrap;
`;

let BreadcrumbItem = styled.li`
  display: flex;
  align-items: center;
  min-width: 0;
  color: ${theme.colors.gray650};
  font-size: 14px;
  font-weight: 600;
`;

let breadcrumbContentStyles = css`
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: 28px;
  padding: 3px 5px;
  line-height: 18px;
`;

let BreadcrumbLink = styled(Link)`
  ${breadcrumbContentStyles}
  border-radius: 5px;
  color: inherit;
  text-decoration: none;
  transition:
    color 0.2s ease,
    background 0.2s ease;

  &:hover,
  &:focus-visible {
    color: ${theme.colors.gray900};
    background: ${theme.colors.gray300};
    outline: none;
  }
`;

let CurrentBreadcrumb = styled.span`
  ${breadcrumbContentStyles}
  max-width: min(55vw, 520px);
  overflow: hidden;
  color: ${theme.colors.gray900};
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
`;

let BreadcrumbSeparator = styled.span`
  display: flex;
  flex-shrink: 0;
  color: ${theme.colors.gray600};

  svg {
    width: 16px;
    height: 16px;
  }
`;

export let DetailsBreadcrumbs = ({
  breadcrumbs,
  currentLabel,
  skeleton
}: {
  breadcrumbs: DetailsBreadcrumb[];
  currentLabel: React.ReactNode;
  skeleton?: boolean;
}) => (
  <BreadcrumbNav aria-label="Breadcrumb">
    <BreadcrumbList>
      {breadcrumbs.map((breadcrumb, index) => {
        let isCurrent = index == breadcrumbs.length - 1;
        let label = isCurrent ? (breadcrumb.label ?? currentLabel) : breadcrumb.label;

        return (
          <Fragment key={`${breadcrumb.to ?? 'current'}-${index}`}>
            {index > 0 && (
              <BreadcrumbSeparator aria-hidden="true">
                <RiArrowRightSLine />
              </BreadcrumbSeparator>
            )}

            <BreadcrumbItem>
              <Skeleton
                active={skeleton}
                borderRadius={5}
                style={skeleton ? { width: 80 } : undefined}
              >
                {isCurrent || !breadcrumb.to ? (
                  <CurrentBreadcrumb aria-current={isCurrent ? 'page' : undefined}>
                    {label}
                  </CurrentBreadcrumb>
                ) : (
                  <BreadcrumbLink to={breadcrumb.to}>{label}</BreadcrumbLink>
                )}
              </Skeleton>
            </BreadcrumbItem>
          </Fragment>
        );
      })}
    </BreadcrumbList>
  </BreadcrumbNav>
);
