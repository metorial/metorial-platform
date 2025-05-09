import React from 'react';
import { styled } from 'styled-components';
import { Text } from '../text';
import { theme } from '../theme';

let Wrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1px;

  background: ${theme.colors.gray300};
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  overflow: hidden;
`;

let Attribute = styled('div')`
  background: ${theme.colors.background};
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
  attributes
}: {
  attributes: {
    label: React.ReactNode;
    content: React.ReactNode;
  }[];
}) => {
  return (
    <Wrapper>
      {attributes.map((attr, i) => (
        <Attribute key={i}>
          <Inner>
            <Text weight="bold" size="1">
              {attr.label}
            </Text>
            <Text size="2" weight="medium" color="gray700">
              {attr.content}
            </Text>
          </Inner>
        </Attribute>
      ))}
    </Wrapper>
  );
};
