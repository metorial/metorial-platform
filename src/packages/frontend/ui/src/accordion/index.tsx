import * as RadixAccordion from '@radix-ui/react-accordion';
import { RiArrowDownSLine } from '@remixicon/react';
import React, { useState } from 'react';
import { keyframes, styled } from 'styled-components';
import { theme } from '../theme';

let slideDown = keyframes`
  from { height: 0 }
  to { height: var(--radix-accordion-content-height) }
`;

let slideUp = keyframes`
  from { height: var(--radix-accordion-content-height) }
  to { height: 0 }
`;

let Item = styled(RadixAccordion.Item)`
  border: solid 1px ${theme.colors.gray200};
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;

  &:focus-within {
    background: ${theme.colors.gray100};
  }

  &:not(:last-child) {
    border-bottom: solid 1px transparent;
  }

  &:first-child {
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
  }

  &:last-child {
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
  }

  &[data-state='open'][data-type='multiple'] {
    margin-bottom: 20px;
    border-radius: 10px;
    box-shadow: ${theme.shadows.medium};
    border: solid 1px ${theme.colors.gray800};
    background: transparent;
  }

  &:not(:first-child)[data-state='open'] {
    margin-top: 10px;
  }

  &[data-before-open='true'] {
    border-bottom: solid 1px ${theme.colors.gray200};
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
  }

  &[data-after-open='true'] {
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
  }
`;

let Trigger = styled(RadixAccordion.Trigger)`
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  outline: none;
  cursor: pointer;
  background: transparent;
  text-align: left;
  user-select: none;
`;

let Content = styled(RadixAccordion.Content)`
  font-size: 14px;
  border-top: solid 1px ${theme.colors.gray200};
  overflow: hidden;

  &[data-state='open'] {
    animation: ${slideDown} 0.3s ease forwards;
  }

  &[data-state='closed'] {
    animation: ${slideUp} 0.3s ease forwards;
  }
`;

export let Accordion = ({
  items,
  type = 'single',
  disabled
}: {
  items: {
    title: React.ReactNode;
    content: React.ReactNode;
    defaultOpen?: boolean;
  }[];
  type?: 'single' | 'multiple';
  disabled?: boolean;
}) => {
  let [value, setValue] = useState<string | string[] | undefined>(() =>
    type == 'single'
      ? items.findIndex(item => item.defaultOpen).toString()
      : items.filter(item => item.defaultOpen).map((_, i) => i.toString())
  );

  return (
    <RadixAccordion.Root
      type={type}
      disabled={disabled}
      value={value as any}
      onValueChange={setValue}
    >
      {items.map((item, i) => {
        let afterOpen = Array.isArray(value)
          ? value.includes((i - 1).toString())
          : value == (i - 1).toString();
        let beforeOpen = Array.isArray(value)
          ? value.includes((i + 1).toString())
          : value == (i + 1).toString();
        let isOpen = Array.isArray(value)
          ? value.includes(i.toString())
          : value == i.toString();

        return (
          <Item
            value={i.toString()}
            key={i}
            data-before-open={beforeOpen && !isOpen}
            data-after-open={afterOpen && !isOpen}
            data-type={type}
          >
            <Trigger>
              <span>{item.title}</span>

              <RiArrowDownSLine
                style={{
                  transform: `rotate(${isOpen ? 180 : 0}deg)`,
                  transition: 'transform 200ms ease',
                  opacity: 0.5
                }}
                size={16}
              />
            </Trigger>
            <Content>
              <div style={{ padding: '15px 20px' }}>{item.content}</div>
            </Content>
          </Item>
        );
      })}
    </RadixAccordion.Root>
  );
};

export let AccordionSingle = ({
  title,
  children,
  disabled,
  defaultOpen
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  defaultOpen?: boolean;
}) => {
  return (
    <Accordion
      items={[
        {
          title,
          content: children,
          defaultOpen
        }
      ]}
      disabled={disabled}
      type="multiple"
    />
  );
};
