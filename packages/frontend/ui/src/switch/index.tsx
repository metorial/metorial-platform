import * as RadixSwitch from '@radix-ui/react-switch';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import clsx from 'clsx';
import React, { createRef, useId } from 'react';
import { styled } from 'styled-components';
import { theme } from '..';
import { InputDescription, InputLabel } from '../input';

let Wrapper = styled('div')`
  display: flex;
  gap: 10px;
  align-items: center;
  cursor: pointer;
`;

let Root = styled(RadixSwitch.Root)`
  display: flex;
  height: 20px;
  width: 30px;
  padding: 0;
  justify-content: center;
  align-items: center;
  border-radius: 50px;
  background: ${theme.colors.gray300};
  border: solid 1px ${theme.colors.gray300};
  position: relative;
  transition: all 0.3s ease;

  &:focus {
    border: solid 1px ${theme.colors.blue900};
  }

  &[data-state='checked'] {
    background: ${theme.colors.blue900};
  }

  &.disabled {
    opacity: 0.5;
  }
`;

let Thumb = styled(RadixSwitch.Thumb)`
  display: flex;
  height: 14px;
  width: 14px;
  border-radius: 500;
  background: ${theme.colors.background};
  box-shadow: none;
  position: absolute;
  transition: all 0.3s ease;
  border-radius: 50px;
  top: 2px;

  ${Root}[data-state='checked'] & {
    left: 12px;
  }

  ${Root}[data-state='unchecked'] & {
    left: 2px;
  }
`;

export let Switch = ({
  checked,
  onCheckedChange,
  label,
  disabled,
  description,
  hideLabel
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: React.ReactNode;
  disabled?: boolean;
  description?: React.ReactNode;
  hideLabel?: boolean;
}) => {
  let id = useId();
  let root = createRef<HTMLDivElement>();

  return (
    <>
      <Wrapper>
        <Root
          className={clsx({ disabled })}
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          ref={root as any}
        >
          <Thumb />
        </Root>

        <div onClick={e => root.current?.click()}>
          {hideLabel ? (
            <VisuallyHidden>
              <label htmlFor={id}>{label}</label>
            </VisuallyHidden>
          ) : (
            <InputLabel htmlFor={id} style={{ margin: 0 }} onClick={e => e.stopPropagation()}>
              {label}
            </InputLabel>
          )}

          {description && (
            <InputDescription style={{ marginTop: 0, marginBottom: 0 }}>
              {description}
            </InputDescription>
          )}
        </div>
      </Wrapper>
    </>
  );
};
