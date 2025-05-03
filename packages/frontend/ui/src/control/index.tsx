import * as RadixToggle from '@radix-ui/react-toggle-group';
import React, { memo, useEffect, useReducer, useState } from 'react';
import { styled } from 'styled-components';
import { theme } from '..';

let Root = styled(RadixToggle.Root)`
  background: ${theme.colors.gray300};
  border-radius: 10px;
  width: fit-content;
  padding: 3px;
`;

let List = styled('div')`
  display: flex;
  position: relative;
`;

let Item = styled(RadixToggle.Item)`
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  padding: 0px;
  font-size: 14px;
  color: ${theme.colors.gray600};
  transition: all 0.3s ease;
  position: relative;
  z-index: 2;
  font-weight: 500;

  &:hover {
    color: ${theme.colors.blue900};
  }

  &:focus {
    color: ${theme.colors.blue900};
  }

  &[data-state='active'] {
    color: ${theme.colors.gray100};
  }
`;

let ItemInner = styled('div')`
  height: 30px;
  padding: 0px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let Indicator = styled('div')`
  position: absolute;
  border-radius: 7px;
  z-index: 1;
  background: ${theme.colors.blue900};
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
`;

export let Control = memo(
  ({
    items,
    value,
    onChange
  }: {
    onChange?: (value: string) => void;
    value: string;
    items: {
      id: string;
      label: string;
    }[];
  }) => {
    let [elements, setElements] = useState<HTMLElement[]>([]);
    let currentItemIndex = items.findIndex(item => item.id == value);

    let [, rerender] = useReducer(s => s + 1, 0);

    useEffect(() => {
      setTimeout(() => {
        rerender();

        setTimeout(() => {
          rerender();
        }, 400);
      }, 100);
    }, []);

    return (
      <Root
        value={value}
        onValueChange={v => {
          if (v == value || !v) return;
          onChange?.(v);
        }}
        type="single"
      >
        <List>
          {items.map((item, i) => (
            <Item
              value={item.id}
              key={i}
              data-state={item.id == value ? 'active' : 'inactive'}
              ref={el => {
                if (el) {
                  setElements(e => {
                    e[i] = el;
                    return e;
                  });
                }
              }}
            >
              <ItemInner>{item.label}</ItemInner>
            </Item>
          ))}

          {elements[currentItemIndex] && (
            <Indicator
              style={{
                height: 30,
                top: 0,
                left: elements[currentItemIndex].offsetLeft,
                width: elements[currentItemIndex].offsetWidth
              }}
            />
          )}
        </List>
      </Root>
    );
  }
);
