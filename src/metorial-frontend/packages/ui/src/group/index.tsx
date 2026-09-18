import React, { useContext } from 'react';
import { styled } from 'styled-components';
import { Text, Title } from '../text';
import { theme } from '../theme';

let GroupWrapper = styled('div')`
  border: 1px solid ${theme.colors.gray400};
  box-shadow: ${theme.shadows.small};
  background: ${theme.colors.gray100};
  border-radius: 8px;
  overflow: hidden;
`;

let IsGroupContext = React.createContext(false);
export let useIsGroup = () => useContext(IsGroupContext);

export let Group = {
  Wrapper: (props: { children: React.ReactNode }) => (
    <IsGroupContext.Provider value={true}>
      <GroupWrapper>{props.children}</GroupWrapper>
    </IsGroupContext.Provider>
  ),
  Header: (props: {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <Group.HeaderRow>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Title as="h2" size="2" weight="strong">
            {props.title}
          </Title>
          {props.description && (
            <Text size="1" weight="strong" color="gray600">
              {props.description}
            </Text>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10
          }}
        >
          {props.actions}
        </div>
      </div>
    </Group.HeaderRow>
  ),
  HeaderRow: styled('header')`
    padding: 10px 20px;
    display: flex;
    flex-direction: column;
  `,
  Row: styled('main')`
    display: flex;
    flex-direction: column;
    border-top: 1px solid ${theme.colors.gray400};
  `,
  Content: styled('div')`
    padding: 12px 17px;
    display: flex;
    flex-direction: column;
    background: ${theme.colors.background};
    border-radius: 8px;
    border: 1px solid ${theme.colors.gray400};
    margin-left: -1px;
    margin-right: -1px;
    margin-bottom: -1px;
    overflow: hidden;
  `,
  Footer: styled('footer')`
    padding: 10px 15px;
    display: flex;
    align-items: center;
  `
};
