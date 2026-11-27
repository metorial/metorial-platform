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
  border: 1px solid ${theme.colors.gray300};
  display: flex;
  flex-direction: column;
  background: ${theme.colors.background};
  overflow: hidden;
  border-radius: 10px;
  transition: border-color 0.2s ease;

  &:focus-within {
    border-color: ${theme.colors.gray500};
  }

  &:not(:first-child) {
    margin-top: 10px;
  }
`;

let Trigger = styled(RadixAccordion.Trigger).attrs({
  type: 'button'
})`
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  outline: none;
  cursor: pointer;
  background: transparent;
  text-align: left;
  user-select: none;
  color: ${theme.colors.gray900};

  &[data-disabled] {
    color: ${theme.colors.gray600};
    cursor: not-allowed;
  }
`;

let TriggerTitleText = styled.span`
  display: inline-flex;
  flex-direction: column;
  gap: 3px;
`;

let TriggerDescription = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray600};
  line-height: 1.2;
`;

let Content = styled(RadixAccordion.Content)`
  font-size: 14px;
  border-top: 1px solid ${theme.colors.gray300};
  overflow: hidden;
  background: ${theme.colors.background};

  &[data-state='open'] {
    animation: ${slideDown} 0.3s ease;
    height: auto;
  }

  &[data-state='closed'] {
    animation: ${slideUp} 0.3s ease forwards;
  }
`;

type AccordionProps = {
  items: {
    title: React.ReactNode;
    description?: React.ReactNode;
    content: React.ReactNode;
    defaultOpen?: boolean;
    disabled?: boolean;
  }[];
  type?: 'single' | 'multiple';
  disabled?: boolean;
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  collapsible?: boolean;
};

export let Accordion = (p: AccordionProps) => {
  let [internalValue, setInternalValue] = useState<string | string[] | undefined>(() => {
    if (p.type === 'multiple') {
      return p.items.flatMap((item, i) => (item.defaultOpen ? [i.toString()] : []));
    }

    let initialIndex = p.items.findIndex(item => item.defaultOpen);
    return initialIndex >= 0 ? initialIndex.toString() : undefined;
  });
  let isControlled = p.value !== undefined;
  let resolvedValue = isControlled ? p.value : internalValue;

  let handleValueChange = (nextValue: string | string[]) => {
    if (!isControlled) {
      if (Array.isArray(nextValue)) {
        setInternalValue(nextValue);
      } else {
        setInternalValue(nextValue || undefined);
      }
    }
    p.onValueChange?.(nextValue);
  };

  return (
    <RadixAccordion.Root
      type={p.type ?? 'single'}
      collapsible={(p.type ?? 'single') === 'single' ? p.collapsible : undefined}
      disabled={p.disabled}
      value={resolvedValue as any}
      onValueChange={handleValueChange as any}
    >
      {p.items.map((item, i) => {
        let isOpen = Array.isArray(resolvedValue)
          ? resolvedValue.includes(i.toString())
          : resolvedValue == i.toString();

        return (
          <Item value={i.toString()} key={i} disabled={item.disabled}>
            <Trigger disabled={item.disabled}>
              <TriggerTitleText>
                <span>{item.title}</span>
                {item.description ? (
                  <TriggerDescription>{item.description}</TriggerDescription>
                ) : null}
              </TriggerTitleText>

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
              <div style={{ padding: '16px' }}>{item.content}</div>
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
          disabled,
          content: children,
          defaultOpen
        }
      ]}
      type="multiple"
    />
  );
};
