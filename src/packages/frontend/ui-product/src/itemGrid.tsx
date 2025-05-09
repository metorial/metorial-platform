import { Button, Menu, Spacer, Text, theme, Title, toast } from '@metorial/ui';
import { RiMore2Fill } from '@remixicon/react';
import copy from 'copy-to-clipboard';
import React from 'react';
import { styled } from 'styled-components';

let Grid = styled.ul.withConfig({ shouldForwardProp: p => p !== 'width' })<{ width?: string }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${p => p.width ?? '300px'}, 1fr));
  gap: 20px;
  list-style: none;
  padding: 0;
  margin: 0;
`;

let Wrapper = styled.li`
  display: flex;
  flex-direction: column;
  padding: 15px;
  border: solid 1px ${theme.colors.gray300};
  border-radius: 15px;
  transition: all 0.2s;

  &[data-button='true'] {
    cursor: pointer;

    &:hover,
    &:focus {
      box-shadow: ${theme.shadows.medium};
    }
  }
`;

let Header = styled.header`
  display: flex;
  gap: 10px;
  justify-content: space-between;
`;

let HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

let getButtonProps = (onClick: () => void) => ({
  onClick,
  role: 'button',
  tabIndex: 0,
  onKeyPress: (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onClick();
    }
  },
  'data-button': 'true'
});

export let ItemGrid = {
  Root: Grid,
  Item: ({
    title,
    description,
    icon,
    entity,
    menu,
    onClick,
    bottom,
    small
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    entity?: { id: string; hasUsage?: boolean };
    menu?: { label: string; onClick: () => void }[];
    onClick?: () => void;
    bottom?: React.ReactNode;
    small?: boolean;
  }) => {
    let menuItems = [
      ...(entity ? [{ id: 'id', label: 'Copy ID' }] : []),
      ...(menu?.map((item, i) => ({ id: String(i), label: item.label })) ?? [])
    ];

    return (
      <Wrapper
        {...(onClick ? getButtonProps(onClick) : {})}
        style={{
          minHeight: small ? 'unset' : 200
        }}
      >
        <Header>
          <HeaderContent>
            {icon && <div>{icon}</div>}

            <Title as="h2" size={small ? '3' : '4'} weight="strong">
              {title}
            </Title>
            {description && (
              <Text size="1" weight="medium" color="gray700">
                {description}
              </Text>
            )}
          </HeaderContent>

          {menuItems.length > 0 && (
            <div onClick={e => e.stopPropagation()}>
              <Menu
                onItemClick={id => {
                  if (id == 'id' && entity) {
                    copy(entity.id);
                    toast.success('Copied to clipboard');
                  } else {
                    menu?.find((_, i) => String(i) === id)?.onClick();
                  }
                }}
                items={menuItems}
              >
                <Button size="2" iconLeft={<RiMore2Fill />} title="More" variant="outline" />
              </Menu>
            </div>
          )}
        </Header>

        {bottom && (
          <>
            <Spacer />
            {bottom}
          </>
        )}
      </Wrapper>
    );
  },
  CenteredItem: ({
    title,
    description,
    icon,
    onClick
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon: React.ReactNode;
    onClick?: () => void;
  }) => {
    return (
      <Wrapper
        {...(onClick ? getButtonProps(onClick) : {})}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 15,
          minHeight: 200
        }}
      >
        <div>{icon}</div>

        <Title as="h3" size="4" weight="strong">
          {title}
        </Title>

        {description && (
          <Text size="1" weight="medium" color="gray700">
            {description}
          </Text>
        )}
      </Wrapper>
    );
  },
  RawItem: Wrapper
};
