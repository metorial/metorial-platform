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
  gap: 8px;
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
  border-radius: 22px;
  background: ${theme.colors.gray100};
  overflow: hidden;
  box-shadow: inset 0 0 0 1px ${theme.colors.gray300};
`;

let MethodItem = styled(RadixToggleGroup.Item)`
  display: flex;
  width: 100%;
  align-items: flex-start;
  text-align: left;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 18px 22px;
  cursor: pointer;
  outline: none;
  box-shadow: none;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;

  &:first-child {
    border-top-left-radius: 21px;
    border-top-right-radius: 21px;
  }

  &:last-child {
    border-bottom-left-radius: 21px;
    border-bottom-right-radius: 21px;
  }

  & + & {
    border-top: 1px solid ${theme.colors.gray300};
  }

  &:hover {
    background: rgba(255, 255, 255, 0.22);
  }

  &:focus-visible {
    outline: none;
  }

  &[data-state='on'] {
    position: relative;
    z-index: 1;
    background: ${theme.colors.background};
    box-shadow:
      inset 3px 0 0 ${theme.colors.primary},
      inset 0 0 0 1px ${theme.colors.gray300};
  }

  &[data-state='on']:not(:first-child) {
    margin-top: -1px;
  }

  &[data-state='on'] + & {
    border-top-color: transparent;
  }
`;

let MethodContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

let MethodTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  color: ${theme.colors.gray900};
`;

let MethodDescription = styled.div`
  font-size: 14px;
  line-height: 1.35;
  color: ${theme.colors.gray600};
`;

export let AuthMethodPicker = (p: {
  items: AuthMethodPickerItem[];
  value: string;
  onChange: (id: string) => void;
  name?: string;
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
            onFocus={() => {
              if (p.value == method.id) return;
              p.onChange(method.id);
            }}
            onKeyDown={e => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (p.value != method.id) {
                p.onChange(method.id);
              }
              requestAnimationFrame(() => {
                e.currentTarget.form?.requestSubmit();
              });
            }}
          >
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
