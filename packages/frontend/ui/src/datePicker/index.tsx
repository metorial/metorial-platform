import * as RadixPopover from '@radix-ui/react-popover';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { RiArrowLeftSFill, RiArrowRightSLine } from '@remixicon/react';
import React, { useState } from 'react';
import { keyframes, styled } from 'styled-components';
import { Button, InputDescription, InputLabel } from '..';
import { AnimateContent } from '../animateContent';
import { AnimatePanes } from '../animatePanes';
import { ButtonSize, getButtonSize } from '../button/constants';
import { Title } from '../text';
import { theme } from '../theme';
import { Tooltip } from '../tooltip';
import { DatePickerProps, useDatePickerState } from './state';

let fadeIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
`;

let fadeOut = keyframes`
  from {
    opacity: 1;
    transform: scale(1);
  }

  to {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
`;

let Trigger = styled(RadixPopover.Trigger)`
  display: flex;
  outline: 1px solid transparent;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};
  outline: none;
  width: 100%;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
  border: none;
  font-weight: 500;

  &:focus-within,
  &:focus {
    background: ${theme.colors.gray300};
    outline: 1px solid ${theme.colors.gray600};
  }

  & [data-placeholder] {
    font-weight: 500;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

let Content = styled(RadixPopover.Content)`
  background: ${theme.colors.gray100};
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  box-shadow: ${theme.shadows.medium};
  overflow: hidden;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  pointer-events: auto;

  &[data-state='open'] {
    animation: ${fadeIn} 0.15s ease-in-out;
  }

  &[data-state='closed'] {
    animation: ${fadeOut} 0.15s ease-in-out;
  }
`;

let Header = styled('header')`
  display: flex;
  justify-content: space-between;
  padding: 10px;
  align-items: center;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let Month = styled('div')`
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 2px;
`;

let Week = styled('div')`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
`;

let Day = styled('button')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 5px;
  cursor: pointer;
  background: transparent;
  color: ${theme.colors.gray800};
  border: none;
  transition: all 0.3s ease;
  font-weight: 500;
  font-size: 14px;

  &[data-today='true'] {
    background: ${theme.colors.blue100};
    color: ${theme.colors.blue700};
  }

  &[data-in-range='true'] {
    background: ${theme.colors.blue100};
    color: ${theme.colors.blue800};
  }

  &[data-selected='true'] {
    background: ${theme.colors.blue400};
    color: ${theme.colors.blue900};
  }

  &[data-not-in-month='true'] {
    opacity: 0.5;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

let Footer = styled('footer')`
  display: flex;
  justify-content: flex-end;
  padding: 0px 10px 10px 10px;
  gap: 10px;
`;

let WeekDay = styled('div')`
  text-align: center;
  font-size: 12px;
  padding-bottom: 5px;
  color: ${theme.colors.gray600};
  font-weight: 500;
`;

export let DatePicker = (
  props: DatePickerProps & {
    placeholder?: string;
    size?: ButtonSize;
    label: string;
    hideLabel?: boolean;
    description?: string;
    resettable?: boolean;
    maxDate?: Date;
    minDate?: Date;
    disabled?: boolean;
  }
) => {
  let state = useDatePickerState(props);
  let [open, setOpen] = useState(false);
  let sizeStyles = getButtonSize(props.size ?? '3');

  return (
    <div>
      <RadixPopover.Root open={open} onOpenChange={setOpen}>
        {props.hideLabel ? (
          <VisuallyHidden>
            <label>{props.label}</label>
          </VisuallyHidden>
        ) : (
          <InputLabel>{props.label}</InputLabel>
        )}

        {props.description && <InputDescription>{props.description}</InputDescription>}

        <Trigger
          style={{
            ...sizeStyles,
            fontSize: 14
          }}
          disabled={props.disabled}
        >
          {state.stringValue || <span data-placeholder>{props.placeholder}</span>}
        </Trigger>

        <RadixPopover.Portal>
          <Content sideOffset={5} side="bottom">
            <Header>
              <Tooltip content="Previous Month">
                <Button
                  size="2"
                  variant="soft"
                  iconLeft={<RiArrowLeftSFill />}
                  onClick={state.prevMonth}
                  disabled={!state.prevMonthEnabled}
                />
              </Tooltip>
              <AnimateContent identifier={state.currentMonth.getTime()}>
                <Title as="h1" weight="bold" size="2" align="center">
                  {state.currentMonth.toLocaleDateString('en', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </Title>
              </AnimateContent>
              <Tooltip content="Next Month">
                <Button
                  size="2"
                  variant="soft"
                  iconLeft={<RiArrowRightSLine />}
                  onClick={state.nextMonth}
                  disabled={!state.nextMonthEnabled}
                />
              </Tooltip>
            </Header>

            <AnimatePanes orderedIdentifier={state.currentMonth.getTime()}>
              <Month>
                <Week>
                  {state.days[0].days.map(day => (
                    <WeekDay key={day.id}>
                      {day.date.toLocaleDateString('en', { weekday: 'short' })}
                    </WeekDay>
                  ))}
                </Week>

                {state.days.map(week => (
                  <Week key={week.id}>
                    {week.days.map(day => (
                      <Day
                        key={day.id}
                        data-today={day.isToday}
                        data-in-range={day.isInSelectedRange}
                        data-selected={day.isSelected}
                        data-not-in-month={!day.isCurrentMonth}
                        onClick={() => state.selectDate(day.date)}
                        disabled={
                          (props.maxDate && day.date > props.maxDate) ||
                          (props.minDate && day.date < props.minDate)
                        }
                      >
                        {day.date.getDate()}
                      </Day>
                    ))}
                  </Week>
                ))}
              </Month>
            </AnimatePanes>

            <Footer>
              {props.resettable && (
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => {
                    state.reset();
                  }}
                >
                  Reset
                </Button>
              )}

              <RadixPopover.Close asChild>
                <Button
                  size="2"
                  variant="soft"
                  autoFocus
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  Done
                </Button>
              </RadixPopover.Close>
            </Footer>
          </Content>
        </RadixPopover.Portal>
      </RadixPopover.Root>
    </div>
  );
};
