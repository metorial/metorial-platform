import { atom, useAtom } from '@metorial/data-hooks';
import { Tooltip, theme } from '@metorial/ui';
import { RiAddLine, RiArrowDownSLine } from '@remixicon/react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import React, { Fragment, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

export interface ISidebarItem {
  icon: React.ReactNode;
  label: string;
  to?: string;
  onClick?: () => void;
  getProps?: (props: { pathname: string; to: string }) => { isActive: boolean };
  children?: {
    label: string;
    to: string;
    getProps?: (props: { pathname: string; to: string }) => { isActive: boolean };
  }[];
}

export interface ISidebarGroup {
  label?: string;
  collapsible?: boolean;
  onCreate?: () => void;
  items: ISidebarItem[];
}

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 6px;

  &:not(:last-of-type) {
    margin-bottom: 15px;
  }
`;

let LabelBarButton = styled('button')`
  margin-left: 5px;
  padding: 3px 5px;
  min-height: 22px;
  border-radius: 4px;
  background: none;
  cursor: pointer;
  outline: none;
  border: none;
  text-align: left;
  transition: all 0.2s;
  width: fit-content;
  display: flex;
  gap: 5px;
  align-items: center;
  color: ${theme.colors.gray700};

  p {
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s;
  }

  &.collapsible {
    &:hover,
    &:focus {
      background: ${theme.colors.gray400};
      color: ${theme.colors.foreground};
    }
  }
`;

let LabelBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

let Items = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

let Item = styled('div').withConfig({
  shouldForwardProp: prop => !['activeBackground', 'activeBar', 'activeColor'].includes(prop)
})<{
  activeBackground?: boolean;
  activeBar?: boolean;
  activeColor?: boolean;
}>`
  height: 32px;
  padding: 0px 10px;
  display: flex;
  align-items: center;
  border-radius: 7px;
  cursor: pointer;
  gap: 12px;
  position: relative;
  transition: all 0.2s;
  background: ${p => (p.activeBackground ? String(theme.colors.gray400) : 'none')};
  color: ${p =>
    p.activeColor ? String(theme.colors.foreground) : String(theme.colors.gray700)};
  font-weight: ${p => (p.activeColor ? 600 : 450)};

  &:hover,
  &:focus {
    background: ${theme.colors.gray400};
  }

  &::after {
    content: '';
    position: absolute;
    left: -2px;
    top: 6px;
    bottom: 6px;
    width: 4px;
    border-radius: 7px;
    transition: all 0.2s;
    background: ${theme.colors.blue800};
    opacity: ${p => (p.activeBar ? 1 : 0)};
    transform: ${p => (p.activeBar ? 'scaleY(1)' : 'scaleY(0)')};
  }
`;

let Icon = styled('span')`
  display: flex;
  align-items: center;

  svg {
    height: 16px;
    width: 16px;
  }
`;

let Text = styled('p')`
  font-size: 14px;
  flex-grow: 1;
  text-align: left;
`;

let SidebarGroup = ({
  label,
  collapsible,
  items: _items,
  onCreate,

  isCollapsed,
  setCollapse
}: {
  label?: string;
  collapsible?: boolean;
  onCreate?: () => void;
  items: {
    icon: React.ReactNode;
    label: string;
    to?: string;
    onClick?: () => void;
    getProps?: (props: { pathname: string; to: string }) => { isActive: boolean };
    children?: {
      label: string;
      to: string;
      getProps?: (props: { pathname: string; to: string }) => { isActive: boolean };
    }[];
  }[];

  isCollapsed?: boolean;
  setCollapse?: (value: boolean) => void;
}) => {
  let [initial, setInitial] = useState(true);
  useEffect(() => {
    let to = setTimeout(() => setInitial(false), 500);
    return () => clearTimeout(to);
  }, []);

  useLocation(); // Force re-render on location change

  let items = _items.map(({ getProps, ...item }) => {
    let children =
      item.children?.map(child => {
        let isActive = child.getProps?.({
          pathname: window.location.pathname,
          to: child.to
        }).isActive;
        return { ...child, isActive };
      }) ?? [];

    let childrenActive = children?.some(child => child.isActive);

    let isActive =
      getProps?.({ pathname: window.location.pathname, to: item.to ?? '' }).isActive ||
      childrenActive;

    return { ...item, isActive, children, childrenActive };
  });

  return (
    <Wrapper>
      {label && (
        <LabelBar>
          {label && (
            <LabelBarButton
              as={collapsible ? 'button' : 'div'}
              onClick={() => collapsible && setCollapse?.(!isCollapsed)}
              className={clsx({ collapsible })}
            >
              <p>{label}</p>
              {collapsible && (
                <RiArrowDownSLine
                  size={14}
                  style={{
                    transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                    transition: 'transform 0.2s'
                  }}
                />
              )}
            </LabelBarButton>
          )}

          {onCreate && (
            <Tooltip content="Create new" side="right">
              <LabelBarButton
                onClick={onCreate}
                style={{ justifyContent: 'center', padding: 0, width: 22 }}
                className="collapsible"
              >
                <RiAddLine size={14} />
              </LabelBarButton>
            </Tooltip>
          )}
        </LabelBar>
      )}

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={initial ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden', padding: '0px 2px' }}
          >
            <Items>
              {items.map((item, index) => (
                <Fragment key={index}>
                  {item.to ? (
                    <Link to={item.to} key={index} onClick={item.onClick}>
                      <Item
                        activeBackground={item.isActive && !item.childrenActive}
                        activeBar={item.isActive && !item.childrenActive}
                        activeColor={item.isActive && !item.childrenActive}
                      >
                        <Icon>{item.icon}</Icon>
                        <Text>{item.label}</Text>
                      </Item>
                    </Link>
                  ) : (
                    <button
                      onClick={item.onClick}
                      key={index}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        outline: 'none'
                      }}
                    >
                      <Item
                        activeBackground={item.isActive && !item.childrenActive}
                        activeBar={item.isActive && !item.childrenActive}
                        activeColor={item.isActive && !item.childrenActive}
                      >
                        <Icon>{item.icon}</Icon>
                        <Text>{item.label}</Text>
                      </Item>
                    </button>
                  )}

                  <AnimatePresence>
                    {item.isActive && item.children.length && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, x: -10 }}
                        animate={{ opacity: 1, height: 'auto', x: 0 }}
                        exit={{ opacity: 0, height: 0, x: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        {item.children?.map((child, index) => (
                          <Link to={child.to} key={index}>
                            <Item
                              activeBackground={child.isActive}
                              activeBar={child.isActive}
                              activeColor={child.isActive}
                              style={{ marginLeft: 24 }}
                            >
                              <Text>{child.label}</Text>
                            </Item>
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Fragment>
              ))}
            </Items>
          </motion.div>
        )}
      </AnimatePresence>
    </Wrapper>
  );
};

let collapsedAtom = atom<string[]>([]);

export let SidebarItems = ({ groups, id }: { groups: ISidebarGroup[]; id: string }) => {
  // let [collapsibleState, setCollapsibleState] = useConfig<{ collapsedItems: string[] }>(
  //   'layout_sidebar_1',
  //   `sidebar-${id}`
  // );

  let collapsibleState = useAtom(collapsedAtom);

  return (
    <div>
      {groups.map((group, index) => (
        <SidebarGroup
          key={index}
          {...group}
          isCollapsed={collapsibleState.includes(index.toString())}
          setCollapse={value => {
            collapsedAtom.set(
              value
                ? [...collapsibleState, index.toString()]
                : collapsibleState.filter(i => i != index.toString())
            );
          }}
        />
      ))}
    </div>
  );
};
