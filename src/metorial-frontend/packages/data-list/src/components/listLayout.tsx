import { Button, Menu, Text, theme } from '@metorial/ui';
import { RiArrowRightSLine, RiMore2Line } from '@remixicon/react';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import type { DataListController } from '../controller';

let List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  overflow: hidden;
  background: ${theme.colors.background};
`;

let Row = styled('li')<{ $interactive: boolean; $dimmed: boolean; $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  min-height: 56px;
  cursor: ${p => (p.$interactive ? 'pointer' : 'default')};
  opacity: ${p => (p.$dimmed ? 0.5 : 1)};
  background: ${p => (p.$selected ? theme.colors.gray100 : 'transparent')};
  transition: background 0.15s;

  &:not(:last-child) {
    border-bottom: 1px solid ${theme.colors.gray300};
  }

  &:hover {
    background: ${theme.colors.gray100};
  }
`;

let RowLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  color: inherit;
  text-decoration: none;
`;

let RowBody = styled('div')`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
`;

let Text_ = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;

  & > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let Side = styled('div')`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
`;

export let DataListListLayout = ({ controller }: { controller: DataListController }) => {
  let { config, props, ctx, items, getItemProps } = controller;
  let navigate = useNavigate();

  return (
    <List>
      {items.map(row => {
        let view = config.item!(row, props, ctx);
        let description =
          view.listDescription === undefined ? view.description : view.listDescription;
        let itemProps = getItemProps(row);
        let href = view.href === null ? undefined : (view.href ?? itemProps.href);
        let onClick = view.onClick ?? itemProps.onClick;

        let content = (
          <>
            {view.icon}

            <Text_>
              <Text size="2" weight="strong">
                {view.title}
              </Text>
              {description && (
                <Text size="1" color="gray600">
                  {description}
                </Text>
              )}
            </Text_>

            <Side>
              {view.meta && (
                <Text size="1" color="gray700">
                  {view.meta}
                </Text>
              )}
              {view.badges}
            </Side>
          </>
        );

        let menu = itemProps.menu;

        return (
          <Row
            key={row.id}
            $interactive={!!href || !!onClick}
            $dimmed={itemProps.isLoading}
            $selected={itemProps.isSelected}
            onClick={onClick && !href ? onClick : undefined}
          >
            {href ? <RowLink to={href}>{content}</RowLink> : <RowBody>{content}</RowBody>}

            <Side>
              {menu.length > 0 && (
                <Menu
                  items={[
                    ...(href ? [{ id: '$$open$$', label: 'Open' }] : []),
                    ...menu.map(item => ({ id: item.id, label: item.label }))
                  ]}
                  onItemClick={id => {
                    if (id == '$$open$$') return navigate(href!);
                    menu.find(item => item.id == id)?.onClick();
                  }}
                >
                  <Button size="1" variant="outline" iconLeft={<RiMore2Line />} />
                </Menu>
              )}

              {href && <RiArrowRightSLine size={16} color={theme.colors.gray600} />}
            </Side>
          </Row>
        );
      })}
    </List>
  );
};
