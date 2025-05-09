import { Title, theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';
import { Breadcrumbs } from '../components/breadcrumbs';

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  position: relative;
`;

let Header = styled('header')`
  border-bottom: 1px solid ${theme.colors.gray300};
  padding: 20px 20px;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: ${theme.colors.background};
  z-index: 45;
`;

let Content = styled('main')``;

export let ContentPanelLayout = ({
  children,
  title,
  breadcrumbs
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  breadcrumbs?: {
    label: React.ReactNode;
    to: string;
  }[];
}) => {
  return (
    <Wrapper>
      <Header>
        {breadcrumbs && <Breadcrumbs breadcrumbs={breadcrumbs} />}

        {title && (
          <Title as="h1" size="3" weight="strong">
            {title}
          </Title>
        )}
      </Header>

      <Content>{children}</Content>
    </Wrapper>
  );
};

export let ContentPanelLayoutInner = styled('div')`
  padding: 25px 20px;
`;
