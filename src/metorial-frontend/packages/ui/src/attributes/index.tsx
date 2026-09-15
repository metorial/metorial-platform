import React from 'react';
import { styled } from 'styled-components';
import { Text, Title } from '../text';
import { theme } from '../theme';

let Wrapper = styled('div')`
  border: 1px solid ${theme.colors.gray400};
  box-shadow: ${theme.shadows.small};
  background: ${theme.colors.gray100};
  border-radius: 8px;
`;

let Header = styled('header')`
  margin-bottom: 6px;
  padding: 6px 18px 0 18px;
`;

let Content = styled('div')<{ $columns?: number }>`
  display: grid;
  grid-template-columns: ${({ $columns }) =>
    $columns
      ? `repeat(${$columns}, minmax(0, 1fr))`
      : 'repeat(auto-fill, minmax(var(--width), 1fr))'};
  gap: 1px;

  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  overflow: hidden;

  margin-left: -1px;
  margin-right: -1px;
  margin-bottom: -1px;

  ${({ $columns }) =>
    $columns
      ? `
    @media (max-width: 720px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 520px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `
      : ''}
`;

let Attribute = styled('div')`
  background: ${theme.colors.background};
  box-shadow: 0 0 0 1px ${theme.colors.gray400};
  padding: 15px;
  /* border-radius: 10px; */
  display: flex;
  align-items: center;
`;

let Inner = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

export let Attributes = ({
  attributes,
  title = 'Attributes',
  itemWidth = '300px',
  columns
}: {
  attributes: {
    label: React.ReactNode;
    content: React.ReactNode;
  }[];
  title?: React.ReactNode;
  itemWidth?: string;
  columns?: number;
}) => {
  return (
    <Wrapper>
      <Header>
        <Title as="h2" size="2" weight="strong">
          {title}
        </Title>
      </Header>
      <Content
        $columns={columns}
        style={
          {
            '--width': itemWidth
          } as any
        }
      >
        {attributes.map((attr, i) => (
          <Attribute key={i}>
            <Inner>
              <Text weight="bold" size="1">
                {attr.label}
              </Text>
              <Text size="2" weight="medium" color="gray700" as="div">
                {attr.content}
              </Text>
            </Inner>
          </Attribute>
        ))}
      </Content>
    </Wrapper>
  );
};
