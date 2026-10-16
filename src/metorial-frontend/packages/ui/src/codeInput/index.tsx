import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from 'input-otp';
import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';

let Wrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
`;

let Group = styled.div`
  display: flex;
`;

let SlotWrapper = styled.div<{ $active: boolean }>`
  height: 55px;
  width: 40px;
  border: 1px solid ${theme.colors.gray500};
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

let Slot = (slot: SlotProps) => (
  <SlotWrapper $active={slot.isActive}>
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
      <Wrapper>
        <Group>
          {slots.slice(0, 3).map((slot, index) => (
            <Slot key={index} {...slot} />
          ))}
        </Group>
        <Dash />
        <Group>
          {slots.slice(3).map((slot, index) => (
            <Slot key={index} {...slot} />
          ))}
        </Group>
      </Wrapper>
    )}
  />
);
