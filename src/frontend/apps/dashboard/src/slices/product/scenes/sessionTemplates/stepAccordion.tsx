import * as RadixAccordion from '@radix-ui/react-accordion';
import { RiArrowDownSLine, RiCheckLine } from '@remixicon/react';
import React, { useState } from 'react';
import { keyframes, styled } from 'styled-components';
import { theme } from '@metorial/ui';

let slideDown = keyframes`
  from { height: 0 }
  to { height: var(--radix-accordion-content-height) }
`;

let slideUp = keyframes`
  from { height: var(--radix-accordion-content-height) }
  to { height: 0 }
`;

let Item = styled(RadixAccordion.Item)`
  border: solid 1px #e9e9e9;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s ease;
  background: #f6f6f6;

  &[data-state='open'] {
    background: #efefef;
  }

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

  &[data-before-open='true'] {
    border-bottom: solid 1px #e9e9e9;
  }
`;

let Trigger = styled(RadixAccordion.Trigger).attrs({
  type: 'button'
})`
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  outline: none;
  cursor: pointer;
  background: transparent;
  text-align: left;
  user-select: none;

  &[data-disabled] {
    color: ${theme.colors.gray700};
    cursor: not-allowed;
  }
`;

let TriggerTitle = styled.span`
  display: inline-flex;
  align-items: flex-start;
  gap: 10px;
`;

let TriggerTitleText = styled.span`
  display: inline-flex;
  flex-direction: column;
  gap: 3px;
`;

let TriggerDescription = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  line-height: 1.2;
`;

let NumberBadge = styled.span`
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: 999px;
  border: 1px solid ${theme.colors.gray400};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: ${theme.colors.gray600};
`;

let Content = styled(RadixAccordion.Content)`
  font-size: 14px;
  border-top: solid 1px #e9e9e9;
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

type SessionTemplateStepAccordionProps = {
  items: {
    title: React.ReactNode;
    description?: React.ReactNode;
    content: React.ReactNode;
    defaultOpen?: boolean;
    disabled?: boolean;
  }[];
  value?: string;
  onValueChange?: (value: string) => void;
  collapsible?: boolean;
};

export let SessionTemplateStepAccordion = (p: SessionTemplateStepAccordionProps) => {
  let [internalValue, setInternalValue] = useState<string | undefined>(() => {
    let initialIndex = p.items.findIndex(item => item.defaultOpen);
    return initialIndex >= 0 ? initialIndex.toString() : undefined;
  });
  let isControlled = 'value' in p;
  let resolvedValue = isControlled ? p.value : internalValue;

  let handleValueChange = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue || undefined);
    }
    p.onValueChange?.(nextValue);
  };

  return (
    <RadixAccordion.Root
      type="single"
      collapsible={p.collapsible}
      value={resolvedValue}
      onValueChange={handleValueChange}
    >
      {p.items.map((item, i) => {
        let afterOpen = resolvedValue === (i - 1).toString();
        let beforeOpen = resolvedValue === (i + 1).toString();
        let isOpen = resolvedValue === i.toString();
        let currentIndex =
          typeof resolvedValue === 'string' && resolvedValue !== ''
            ? Number(resolvedValue)
            : -1;
        let isCompleted = !Number.isNaN(currentIndex) && i < currentIndex;
        let parsedTitle =
          typeof item.title === 'string' ? item.title.match(/^(\d+)\.\s+(.*)$/) : null;
        let titleText = parsedTitle ? parsedTitle[2] : item.title;

        return (
          <Item
            value={i.toString()}
            key={i}
            disabled={item.disabled}
            data-before-open={beforeOpen && !isOpen}
            data-after-open={afterOpen && !isOpen}
          >
            <Trigger disabled={item.disabled}>
              <TriggerTitle>
                {parsedTitle ? (
                  <>
                    <NumberBadge>{parsedTitle[1]}</NumberBadge>
                    <TriggerTitleText>
                      <span>{titleText}</span>
                      {item.description ? (
                        <TriggerDescription>{item.description}</TriggerDescription>
                      ) : null}
                    </TriggerTitleText>
                  </>
                ) : (
                  <TriggerTitleText>
                    <span>{titleText}</span>
                    {item.description ? (
                      <TriggerDescription>{item.description}</TriggerDescription>
                    ) : null}
                  </TriggerTitleText>
                )}
              </TriggerTitle>

              {isCompleted ? (
                <RiCheckLine size={16} style={{ opacity: 0.55 }} />
              ) : (
                <RiArrowDownSLine
                  style={{
                    transform: `rotate(${isOpen ? 180 : 0}deg)`,
                    transition: 'transform 200ms ease',
                    opacity: 0.5
                  }}
                  size={16}
                />
              )}
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
