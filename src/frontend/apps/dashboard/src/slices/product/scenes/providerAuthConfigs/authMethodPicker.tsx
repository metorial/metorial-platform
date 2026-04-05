import * as RadixToggleGroup from '@radix-ui/react-toggle-group';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Text, theme } from '@metorial/ui';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import styled from 'styled-components';

type AuthMethodPickerItem = {
  id: string;
  name: string;
  description?: string | null;
};

let PickerBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
`;

let PickerLabel = styled.div`
  margin: 0;
`;

let PickerDescription = styled.div`
  margin: 0;
`;

let MethodsRoot = styled(RadixToggleGroup.Root)`
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 0;
  border-radius: 20px;
  background: ${theme.colors.gray200};
  overflow: hidden;
  box-shadow: inset 0 0 0 1px ${theme.colors.gray300};
`;

let MethodItem = styled(RadixToggleGroup.Item)`
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  column-gap: 12px;
  width: 100%;
  position: relative;
  align-items: flex-start;
  text-align: left;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 16px 20px;
  cursor: pointer;
  outline: none;
  box-shadow: none;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;

  &:first-child {
    border-top-left-radius: 19px;
    border-top-right-radius: 19px;
  }

  &:last-child {
    border-bottom-left-radius: 19px;
    border-bottom-right-radius: 19px;
  }

  & + & {
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: ${theme.colors.gray300};
    }
  }

  &:hover {
    background: rgba(255, 255, 255, 0.16);
  }

  &:focus-visible {
    outline: none;
  }

  &[data-state='on'] {
    position: relative;
    z-index: 1;
    background: ${theme.colors.background};
    box-shadow: inset 0 0 0 1px ${theme.colors.gray300};
  }

  &[data-state='on']::before {
    opacity: 0;
  }

  &[data-state='on'] + & {
    &::before {
      opacity: 0;
    }
  }
`;

let MethodIndicator = styled.span`
  width: 16px;
  height: 16px;
  margin-top: 2px;
  border-radius: 999px;
  border: 1.5px solid ${theme.colors.gray500};
  background: ${theme.colors.background};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;

  &::after {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: ${theme.colors.primary};
    opacity: 0;
    transform: scale(0.6);
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
  }

  ${MethodItem}[data-state='on'] & {
    border-color: ${theme.colors.primary};
  }

  ${MethodItem}[data-state='on'] &::after {
    opacity: 1;
    transform: scale(1);
  }
`;

let MethodContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`;

let MethodTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  color: ${theme.colors.gray900};
`;

let MethodDescription = styled.div`
  font-size: 12px;
  line-height: 1.35;
  color: ${theme.colors.gray600};
`;

export let AuthMethodPicker = (p: {
  items: AuthMethodPickerItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  ariaLabel?: string;
  description?: ReactNode;
  hideLabel?: boolean;
  focusOnMount?: boolean;
}) => {
  let id = useId();
  let labelId = `${id}-label`;
  let descriptionId = `${id}-description`;
  let itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  let hasAutoFocused = useRef(false);

  useEffect(() => {
    if (!p.focusOnMount) return;
    if (hasAutoFocused.current) return;

    let targetId = p.value || p.items[0]?.id;
    if (!targetId) return;

    let frame = requestAnimationFrame(() => {
      itemRefs.current[targetId]?.focus();
      hasAutoFocused.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [p.focusOnMount, p.value, p.items]);

  return (
    <PickerBox>
      {p.label ? (
        p.hideLabel ? (
          <VisuallyHidden>
            <PickerLabel id={labelId}>{p.label}</PickerLabel>
          </VisuallyHidden>
        ) : (
          <PickerLabel id={labelId}>
            <Text size="1" weight="strong">
              {p.label}
            </Text>
          </PickerLabel>
        )
      ) : null}

      <MethodsRoot
        type="single"
        orientation="vertical"
        value={p.value}
        onValueChange={nextValue => {
          if (!nextValue || nextValue == p.value) return;
          p.onChange(nextValue);
        }}
        aria-label={!p.label ? p.ariaLabel : undefined}
        aria-labelledby={p.label ? labelId : undefined}
        aria-describedby={p.description ? descriptionId : undefined}
      >
        {p.items.map(method => (
          <MethodItem
            key={method.id}
            value={method.id}
            ref={element => {
              itemRefs.current[method.id] = element;
            }}
          >
            <MethodIndicator aria-hidden />
            <MethodContent>
              <MethodTitle>{method.name}</MethodTitle>
              {!!method.description?.trim() && (
                <MethodDescription>{method.description.trim()}</MethodDescription>
              )}
            </MethodContent>
          </MethodItem>
        ))}
      </MethodsRoot>

      {p.description ? (
        <PickerDescription id={descriptionId}>
          <Text size="1" color="gray600">
            {p.description}
          </Text>
        </PickerDescription>
      ) : null}
    </PickerBox>
  );
};
