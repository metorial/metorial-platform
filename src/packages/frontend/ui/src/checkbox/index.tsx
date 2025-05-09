import * as RadixCheckbox from '@radix-ui/react-checkbox';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import clsx from 'clsx';
import React, { useEffect, useId, useState } from 'react';
import { Check } from 'react-feather';
import { keyframes, styled } from 'styled-components';
import { theme } from '..';
import { InputDescription, InputLabel } from '../input';

let fadeIn = keyframes`
  from {
    transform: scale(0) rotate(0deg);
    opacity: 0;
  }

  to {
    transform: scale(1) rotate(-10deg);
    opacity: 1;
  }
`;

let fadeOut = keyframes`
  from {
    transform: scale(1);
    opacity: 1;
  }

  to {
    transform: scale(0.5);
    opacity: 0;
  }
`;

let Wrapper = styled('div')`
  display: flex;
  align-items: center;
  cursor: pointer;
  width: 100%;
`;

let Root = styled(RadixCheckbox.Root)`
  display: flex;
  height: 20px;
  width: 20px;
  border: none;
  padding: 0px;
  justify-content: center;
  align-items: center;
  background: ${theme.colors.gray100};
  border: 1px solid ${theme.colors.gray300};
  border-radius: 5px;
  color: ${theme.colors.gray100};
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;

  &.disabled {
    opacity: 0.5;
  }

  &::before {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 0px;
    height: 0px;
    content: '';
    border-radius: 50%;
    background: ${theme.colors.gray800};
    transition: all 0.3s ease;
  }

  &[data-state='checked'] {
    box-shadow: ${theme.shadows.small};

    &::before {
      width: 30px;
      height: 30px;
    }
  }
`;

let Indicator = styled(RadixCheckbox.Indicator)`
  display: flex;
  justify-content: center;
  align-items: center;

  &[data-animate='true'][data-state='checked'] {
    animation: ${fadeIn} 0.4s ease forwards;
  }

  &[data-animate='true'][data-state='unchecked'] {
    animation: ${fadeOut} 0.3s ease forwards;
  }

  &[data-animate='false'][data-state='checked'] {
    transform: scale(1) rotate(-10deg) !important;
    opacity: 1 !important;
  }
`;

export let Checkbox = ({
  checked,
  onCheckedChange,
  description,
  label,
  disabled,
  hideLabel
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  hideLabel?: boolean;
}) => {
  let [animate, setAnimate] = useState(false);
  let [initialValue] = useState(() => checked);
  useEffect(() => {
    if (initialValue != checked) setAnimate(true);
  }, [checked, initialValue]);

  let id = useId();

  return (
    <>
      <Wrapper>
        <Root
          className={clsx({ disabled })}
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        >
          <Indicator data-animate={animate}>
            <Check size={12} strokeWidth={3} />
          </Indicator>
        </Root>

        {!hideLabel ? (
          <InputLabel
            htmlFor={id}
            style={{
              margin: 0,
              width: '100%',
              minHeight: 20,
              paddingLeft: 10,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            {label}
          </InputLabel>
        ) : (
          <VisuallyHidden.Root>
            <label htmlFor={id}>{label}</label>
          </VisuallyHidden.Root>
        )}
      </Wrapper>

      {description && (
        <InputDescription style={{ marginTop: 5, marginBottom: 0 }}>
          {description}
        </InputDescription>
      )}
    </>
  );
};
