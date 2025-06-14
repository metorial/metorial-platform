import React from 'react';
import { styled } from 'styled-components';
import { getLink } from '../link';
import { theme } from '../theme';

let LinkWrapper = styled('span')`
  padding: 20px;
  border-radius: 10px;
  border: solid 1px ${theme.colors.gray400};
  display: flex;
  gap: 10px;
  transition: all 0.2s;
  flex-grow: 1;
  cursor: pointer;
  box-shadow: ${theme.shadows.small};
  background: ${theme.colors.background};

  &:hover,
  &:focus {
    border-color: ${theme.colors.primary} !important;
    transform: scale(1.02);
    box-shadow: ${theme.shadows.medium};
  }

  &:active {
    transform: scale(0.98);
  }
`;

let LinkContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let LinkTitle = styled('p')`
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.foreground};
`;

let LinkDescription = styled('p')`
  font-size: 12px;
  font-weight: 400;
  color: ${theme.colors.gray600};
`;

let Icon = styled('div')`
  height: 40px;
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.gray300};
  border-radius: 5px;
  flex-shrink: 0;
  transform: rotate(5deg);

  svg {
    height: 20px;
    width: 20px;
    transform: rotate(-5deg);
  }
`;

export let CardLinks = {
  Items: styled('div')`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  `,
  Group: styled('div')`
    display: flex;
    flex-direction: column;
  `,
  GroupPanel: styled('div')`
    display: flex;
    flex-direction: column;
    padding: 13px 10px 10px 10px;
    border-radius: 10px;
    background: ${theme.colors.gray200};
    box-shadow: ${theme.shadows.small};

    .link {
      border: solid 1px transparent;
    }

    & > h2 {
      font-weight: 700 !important;
      padding: 0 4px;
    }

    & > p {
      font-weight: 600;
      color: ${theme.colors.gray700};
      padding: 0 4px;
    }
  `,
  GroupTitle: styled('h2')`
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 10px;
  `,
  GroupPreTitle: styled('p')`
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
    color: ${theme.colors.gray700};
  `,
  Link: ({
    to,
    title,
    description
  }: {
    to: string;
    title: React.ReactNode;
    description: React.ReactNode;
  }) => {
    let Link = getLink();

    return (
      <Link
        to={to}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <LinkWrapper className="link">
          <LinkContent>
            <LinkTitle>{title}</LinkTitle>
            <LinkDescription>{description}</LinkDescription>
          </LinkContent>
        </LinkWrapper>
      </Link>
    );
  }
};
