import { LinkTabs, Text, Title, theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';
import { Breadcrumbs } from '../components/breadcrumbs';

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  position: relative;
`;

let Header = styled('header')`
  position: sticky;
  top: 0;
  background: ${theme.colors.background};
  z-index: 45;
  flex-shrink: 0;
`;

let HeaderInner = styled('div')`
  padding: 20px 20px 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

let HeaderWrapperLine = styled('div')`
  border-bottom: 1px solid ${theme.colors.gray300};
  padding-bottom: 10px;
`;

let Content = styled('main')`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

let LinksWrapper = styled('div')``;

export let ContentPanelLayout = ({
  children,
  title,
  description,
  breadcrumbs,
  links,
  extra
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  links?: {
    current: string;
    items: {
      to: string;
      label: string;
    }[];
  };
  breadcrumbs?: {
    label: React.ReactNode;
    to: string;
  }[];
  extra?: React.ReactNode;
}) => {
  let headerContent = (
    <HeaderInner>
      {breadcrumbs && <Breadcrumbs breadcrumbs={breadcrumbs} />}

      {title && (
        <Title as="h1" size="3" weight="strong">
          {title}
        </Title>
      )}

      {description && (
        <Text size="1" color="gray600" weight="medium">
          {description}
        </Text>
      )}

      {extra}
    </HeaderInner>
  );

  if (links) {
    headerContent = (
      <>
        {headerContent}

        <LinksWrapper>
          <LinkTabs
            current={links.current}
            links={links.items}
            padding={{ bottom: 6, left: 20, right: 20 }}
            margin={{ bottom: 0 }}
          />
        </LinksWrapper>
      </>
    );
  } else {
    headerContent = <HeaderWrapperLine>{headerContent}</HeaderWrapperLine>;
  }

  return (
    <Wrapper>
      <Header>{headerContent}</Header>

      <Content>{children}</Content>
    </Wrapper>
  );
};

export let ContentPanelLayoutInner = styled('div')`
  padding: 25px 20px;
`;
