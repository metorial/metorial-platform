import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from 'input-otp';
import React from 'react';
import { css, keyframes, styled } from 'styled-components';
import { theme } from '../theme';

let shake = keyframes`
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
`;

let Wrapper = styled.div<{ $error: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;

  ${({ $error }) =>
    $error &&
    css`
      animation: ${shake} 360ms ease-in-out;
    `}
`;

let Group = styled.div`
  display: flex;
`;

let SlotWrapper = styled.div<{ $active: boolean; $error: boolean }>`
  height: 55px;
  width: 40px;
  border: 1px solid ${({ $error }) => ($error ? theme.colors.red550 : theme.colors.gray500)};
  position: relative;
  font-size: 20px;
  font-weight: 500;
  color: ${theme.colors.gray900};
  background: ${({ $active }) => ($active ? theme.colors.gray100 : theme.colors.background)};
  display: flex;
  justify-content: center;
  align-items: center;

  &:first-child {
    border-top-left-radius: 10px;
    border-bottom-left-radius: 10px;
  }

  &:last-child {
    border-top-right-radius: 10px;
    border-bottom-right-radius: 10px;
  }

  &:not(:last-child) {
    border-right: none;
  }
`;

let Caret = styled.div`
  position: absolute;
  pointer-events: none;
  height: 30px;
  width: 1px;
  background: ${theme.colors.gray900};
`;

let Dash = styled.div`
  width: 40px;
  display: flex;
  justify-content: center;

  &::after {
    content: '';
    width: 12px;
    height: 2px;
    background: ${theme.colors.gray500};
  }
`;

let Slot = ({ error, ...slot }: SlotProps & { error: boolean }) => (
  <SlotWrapper $active={slot.isActive} $error={error}>
    {slot.char !== null && <div>{slot.char}</div>}
    {slot.hasFakeCaret && <Caret />}
  </SlotWrapper>
);

export let CodeInput = (p: {
  onComplete: (code: string) => void;
  onChange?: (code: string) => void;
  value?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: boolean;
}) => (
  <OTPInput
    maxLength={6}
    value={p.value}
    disabled={p.disabled}
    autoFocus={p.autoFocus}
    autoComplete="one-time-code"
    aria-label="Verification Code"
    inputMode="numeric"
    pattern={REGEXP_ONLY_DIGITS}
    pasteTransformer={pasted => pasted.replace(/[^0-9]/g, '')}
    onChange={code => {
      p.onChange?.(code);
      if (code.length == 6) p.onComplete(code);
    }}
    render={({ slots }) => (
      <Wrapper $error={!!p.error}>
        <Group>
          {slots.slice(0, 3).map((slot, index) => (
            <Slot key={index} {...slot} error={!!p.error} />
          ))}
        </Group>
        <Dash />
        <Group>
          {slots.slice(3).map((slot, index) => (
            <Slot key={index} {...slot} error={!!p.error} />
          ))}
        </Group>
      </Wrapper>
    )}
  />
);
