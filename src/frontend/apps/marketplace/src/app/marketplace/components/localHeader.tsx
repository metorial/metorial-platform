'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import styled from 'styled-components';

let Wrapper = styled.header`
  min-height: 500px;
  padding-top: 120px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;

  @media screen and (max-width: 500px) {
    min-height: 350px;
  }
`;

let Inner = styled.div`
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 100%);
  padding: 50px 20px 30px 20px;
  color: white;
`;

let Nav = styled.nav`
  width: 80rem;
  max-width: 100%;
  margin: 0 auto;
  padding: 30px 0;

  @media screen and (max-width: 500px) {
    overflow-x: auto;
    padding: 30px 20px;
  }

  ul {
    display: flex;
    gap: 10px;
    list-style: none;
    padding: 0;
    margin: 0;
    margin-left: -15px;

    li {
      a {
        color: rgb(255, 255, 255, 0.8);
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 500;
        padding: 8px 15px;
        border-radius: 7px;
        transition: background-color 0.3s ease;
        cursor: pointer;

        &:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        &.active {
          background-color: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
        }
      }
    }
  }
`;

let MainContent = styled.main`
  width: 80rem;
  max-width: 100%;
  margin: 0 auto;
`;

let Extra = styled.p`
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  gap: 10px;
`;

let Title = styled.h1`
  font-size: 4rem;
  font-weight: 600;

  @media screen and (max-width: 800px) {
    font-size: 3rem;
  }

  @media screen and (max-width: 500px) {
    font-size: 2rem;
  }
`;

export let LocalHeader = ({
  items,
  headerImageHash,
  basePath,
  extra,
  title
}: {
  items: {
    label: React.ReactNode;
    href?: string;
    onClick?: () => void;
  }[];
  basePath: string;
  headerImageHash: string;
  extra?: React.ReactNode;
  title: string;
}) => {
  let pathname = usePathname();
  let isActive = (page: string) => pathname === `${basePath}${page}`;

  return (
    <Wrapper
      style={{
        backgroundImage: `url(https://avatar-cdn.metorial.com/${headerImageHash})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        height: '200px',
        width: '100%',
        position: 'relative'
      }}
    >
      <Inner>
        <MainContent>
          {extra && <Extra>{extra}</Extra>}
          <Title>{title}</Title>
        </MainContent>

        <Nav>
          <ul>
            {items.map((item, index) => (
              <li key={index}>
                {typeof item.href == 'string' ? (
                  <Link
                    className={clsx({ active: isActive(item.href) })}
                    href={`${basePath}${item.href}`}
                    prefetch={false}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    onClick={item.onClick}
                    onKeyDown={item.onClick}
                    tabIndex={0}
                    role="button"
                  >
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Nav>
      </Inner>
    </Wrapper>
  );
};
