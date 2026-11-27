import { Button, Menu, Skeleton } from '@metorial/ui';
import type { MenuItem, MenuProps } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import React from 'react';
import styled from 'styled-components';

type ButtonProps = React.ComponentProps<typeof Button>;

export type DetailsLayoutButtonAction = {
  type?: 'button';
  label: React.ReactNode;
} & Omit<ButtonProps, 'children' | 'menu' | 'skeleton' | 'type'>;

export type DetailsLayoutMenuAction = {
  type: 'menu';
  label: React.ReactNode;
  items: MenuItem[];
  menuLabel?: string;
  menuTitle?: string;
  onItemClick?: MenuProps['onItemClick'];
} & Omit<ButtonProps, 'children' | 'menu' | 'skeleton' | 'type'>;

export type DetailsLayoutCustomAction = {
  type: 'custom';
  render: () => React.ReactNode;
};

export type DetailsLayoutAction =
  | DetailsLayoutButtonAction
  | DetailsLayoutMenuAction
  | DetailsLayoutCustomAction;

let Actions = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
`;

export let DetailsActions = ({
  actions,
  skeleton
}: {
  actions: DetailsLayoutAction[];
  skeleton?: boolean;
}) => (
  <Actions>
    {actions.map((action, index) => {
      if (action.type == 'custom') {
        return (
          <Skeleton key={index} active={skeleton}>
            {action.render()}
          </Skeleton>
        );
      }

      if (action.type == 'menu') {
        let { type, items, label, menuLabel, menuTitle, onItemClick, ...buttonProps } = action;

        return (
          <Skeleton key={index} active={skeleton}>
            <Menu
              items={items}
              label={menuLabel ?? (typeof label == 'string' ? label : 'Open action menu')}
              title={menuTitle}
              onItemClick={onItemClick}
            >
              <Button
                type="button"
                size="2"
                variant="outline"
                iconRight={<RiArrowDownSLine />}
                {...buttonProps}
                disabled={skeleton || buttonProps.disabled}
              >
                {label}
              </Button>
            </Menu>
          </Skeleton>
        );
      }

      let { type, label, ...buttonProps } = action;

      return (
        <Button key={index} type="button" size="2" skeleton={skeleton} {...buttonProps}>
          {label}
        </Button>
      );
    })}
  </Actions>
);
