'use client';

import { Button, Spacer, theme } from '@metorial/ui';
import Link from 'next/link';
import { useState } from 'react';
import styled from 'styled-components';
import { ServerCategory } from '../../../../state/server';

let Wrapper = styled.div`
  max-width: 80rem;
  padding: 0 20px;
  display: grid;
  grid-template-columns: 280px calc(100% - 300px);
  gap: 20px;
  margin: 0 auto;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 0;
  }
`;

let CategoriesWrapper = styled.aside`
  display: flex;
  flex-direction: column;

  @media (max-width: 900px) {
    display: none;
  }
`;

let CategoriesList = styled.ul`
  display: flex;
  flex-direction: column;
  list-style: none;
  padding: 0;
  margin: 0;
  gap: 5px;
`;

let CategoryItem = styled.li`
  font-size: 14px;
  font-weight: 500;
  height: 30px;
  line-height: 20px;
  padding: 0;
  display: flex;
  align-items: center;
  padding: 0 10px;
  transition: all 0.2s ease;
  border-radius: 5px;

  a {
    color: ${theme.colors.gray600};
    transition: all 0.2s ease;
  }

  &:hover,
  &:focus {
    a {
      color: ${theme.colors.primary};
    }

    background: ${theme.colors.gray100};
  }

  &[data-active='true'] {
    a {
      color: ${theme.colors.primary};
    }
  }
`;

let Main = styled.main``;

export let Categories = ({
  categories,
  children,
  currentCategoryIds
}: {
  categories: ServerCategory[];
  children: React.ReactNode;
  currentCategoryIds?: string[];
}) => {
  let [firstCategories, setFirstCategories] = useState(10);

  return (
    <Wrapper>
      <CategoriesWrapper>
        <CategoriesList>
          {categories.slice(0, firstCategories).map(category => (
            <CategoryItem
              key={category.id}
              data-active={
                currentCategoryIds?.includes(category.id) ||
                currentCategoryIds?.includes(category.slug)
              }
            >
              <Link
                prefetch={false}
                href={`/marketplace/servers/?category_ids=${category.slug}`}
              >
                {category.name}
              </Link>
            </CategoryItem>
          ))}
        </CategoriesList>

        {firstCategories < categories.length && (
          <div>
            <Spacer height={20} />
            <Button onClick={() => setFirstCategories(Infinity)} size="2">
              Show more
            </Button>
          </div>
        )}
      </CategoriesWrapper>

      <Main>{children}</Main>
    </Wrapper>
  );
};
