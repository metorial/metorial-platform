import { AnimatePresence, motion } from 'framer-motion';
import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { styled } from 'styled-components';

export interface SimpleSidebarGroup {
  title?: string;
  icon: React.ReactNode;
  items: SimpleSidebarItem[];
}

export type SimpleSidebarItem = {
  title: string;
} & (
  | { to: string }
  | { onClick: () => void }
  | {
      children: {
        title: string;
        to: string;
      }[];
    }
);

let Inner = styled('nav')`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

let Group = styled('section')`
  display: flex;
  gap: 5px;
  flex-direction: column;
`;

let GroupHeader = styled('header')`
  display: flex;
  align-items: center;
  gap: 10px;
`;

let GroupTitle = styled('h1')`
  font-size: 14px;
  font-weight: 600;
  color: #333;
`;

let GroupIcon = styled('span')`
  height: 28px;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    height: 20px;
    width: 20px;
  }
`;

let List = styled('ul')`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

let Item = styled('li')`
  display: flex;
  flex-direction: column;
`;

let ItemContent = styled('span')`
  height: 28px;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 0px 10px;
  cursor: pointer;
  border-radius: 7px;
  transition: all 0.2s;
  color: #666;
  font-size: 14px;
  font-weight: 500;

  &:hover,
  &:focus,
  &:active {
    background: #efefef;
    color: #555;
  }

  &[data-state='active'] {
    color: black;
    font-weight: 600;
  }
`;

let ItemText = styled('span')`
  font-size: 14px;
  color: inherit;
`;

let ItemLink = styled(Link)`
  outline: none;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  color: unset;
`;

let ItemButton = styled('button')`
  outline: none;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
`;

let ItemChildren = styled(motion.div)`
  padding-left: 36px;
  display: flex;
  flex-direction: column;
`;

export let SimpleSidebar = ({ groups }: { groups: SimpleSidebarGroup[] }) => {
  let [openItem, setOpenItem] = useState<string | null>(null);
  let pn = useLocation().pathname;

  let bestMatch = useMemo(
    () =>
      groups
        .flatMap(g => g.items)
        .filter(i => ('to' in i ? pn.startsWith(i.to) : false))
        .sort((a: any, b: any) => b.to.length - a.to.length)[0] as undefined | { to: string },
    [groups, pn]
  );

  return (
    <Inner>
      {groups.map((group, i) => (
        <Group key={i}>
          {group.title && (
            <GroupHeader>
              <GroupIcon>{group.icon}</GroupIcon>
              <GroupTitle>{group.title}</GroupTitle>
            </GroupHeader>
          )}

          <List
            style={{
              marginLeft: -10
            }}
          >
            {group.items.map((item, i) => (
              <Item key={i}>
                {'to' in item ? (
                  <ItemLink to={item.to}>
                    <ItemContent data-state={item.to == bestMatch?.to ? 'active' : ''}>
                      <ItemText>{item.title}</ItemText>
                    </ItemContent>
                  </ItemLink>
                ) : 'onClick' in item ? (
                  <ItemButton onClick={item.onClick}>
                    <ItemContent>
                      <ItemText>{item.title}</ItemText>
                    </ItemContent>
                  </ItemButton>
                ) : (
                  <>
                    <ItemContent
                      onClick={() =>
                        setOpenItem(openItem == item.title ? null : String(item.title))
                      }
                    >
                      <ItemText>{item.title}</ItemText>
                    </ItemContent>

                    <AnimatePresence>
                      {item.title == openItem && (
                        <ItemChildren
                          initial={{ opacity: 0, height: 0, filter: 'blur(5px)' }}
                          animate={{ opacity: 1, height: 'auto', filter: 'blur(0px)' }}
                          exit={{ opacity: 0, height: 0, filter: 'blur(5px)' }}
                        >
                          <List>
                            {item.children.map((child, i) => (
                              <Item key={i}>
                                <ItemContent data-state={pn == child.to ? 'active' : ''}>
                                  <ItemText>{child.title}</ItemText>
                                </ItemContent>
                              </Item>
                            ))}
                          </List>
                        </ItemChildren>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </Item>
            ))}
          </List>
        </Group>
      ))}
    </Inner>
  );
};
