import React, { useContext } from 'react';
import { styled } from 'styled-components';
import { Text, Title } from '../text';
import { theme } from '../theme';

let GroupWrapper = styled('div')`
  border: solid 1px ${theme.colors.gray300};
  border-radius: 10px;
  overflow: hidden;

  & > *:not(:last-child) {
    border-bottom: solid 1px ${theme.colors.gray300};
  }
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
            flexDirection: 'column',
            gap: 4
          }}
        >
          <Title as="h2" size="3" weight="strong">
            {props.title}
          </Title>
          {props.description && (
            <Text size="2" weight="medium" color="gray600">
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
    padding: 10px 15px;
    display: flex;
    flex-direction: column;

    &:not(:last-child) {
      border-bottom: solid 1px ${theme.colors.gray300};
    }
  `,
  Row: styled('main')`
    display: flex;
    flex-direction: column;
  `,
  Content: styled('div')`
    padding: 15px;
    display: flex;
    flex-direction: column;
  `,
  Footer: styled('footer')`
    padding: 10px 15px;
    display: flex;
    align-items: center;
  `
};
