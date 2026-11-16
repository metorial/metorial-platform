import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { Tooltip } from '../tooltip';
import { floatingSurface } from './tokens';

export let FloatingBar = styled.div`
  ${floatingSurface};
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 40px;
  padding: 3px;
  border-radius: 10px;
  box-sizing: border-box;
  max-width: 100%;
`;

export let FloatingBarSeparator = styled.span`
  flex: 0 0 auto;
  width: 1px;
  height: 18px;
  margin: 0 3px;
  background: ${theme.colors.gray350};
`;

let NavButtonBase = styled.button<{ $iconOnly?: boolean; $active?: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 0 0 auto;
  min-width: 32px;
  width: ${({ $iconOnly }) => ($iconOnly ? '32px' : 'auto')};
  height: 32px;
  padding: ${({ $iconOnly }) => ($iconOnly ? '0' : '0 8px')};
  border: 0;
  border-radius: 7px;
  background: ${({ $active }) => ($active ? theme.colors.gray300 : 'transparent')};
  color: ${({ $active }) => ($active ? theme.colors.foreground : theme.colors.gray800)};
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;

  &:hover:not(:disabled) {
    background: ${({ $active }) => ($active ? theme.colors.gray300 : theme.colors.gray250)};
    color: ${theme.colors.foreground};
  }

  &[aria-expanded='true'],
  &[data-popup-open] {
    background: ${theme.colors.gray300};
    color: ${theme.colors.foreground};
  }

  &:disabled {
    color: ${theme.colors.gray550};
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 1px;
  }

  svg {
    flex: 0 0 auto;
    width: 17px;
    height: 17px;
  }
`;

let Badge = styled.span<{ $over?: boolean }>`
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: ${theme.colors.foreground};
  color: ${theme.colors.background};
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  box-sizing: border-box;

  ${({ $over }) =>
    $over &&
    `
      position: absolute;
      top: -1px;
      right: -3px;
      min-width: 18px;
      height: 18px;
      border: 2px solid #fff;
      font-size: 9px;
      line-height: 14px;
    `}
`;

type NavButtonOwnProps = {
  tooltip?: React.ReactNode;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
  active?: boolean;
  badge?: React.ReactNode;
};

export type NavIconButtonProps = NavButtonOwnProps & {
  icon: React.ReactNode;
  label: string;
} & Omit<React.ComponentPropsWithoutRef<'button'>, 'children'>;

export let NavIconButton = React.forwardRef<HTMLButtonElement, NavIconButtonProps>(
  ({ icon, label, tooltip, tooltipSide, active, badge, ...rest }, ref) => {
    let content = (
      <>
        {icon}
        {badge !== undefined && badge !== null && badge !== 0 && <Badge $over>{badge}</Badge>}
      </>
    );

    let baseProps = {
      type: 'button' as const,
      'aria-label': label,
      'aria-pressed': active === undefined ? undefined : active,
      $iconOnly: true,
      $active: active
    };

    if (tooltip === null) {
      return (
        <NavButtonBase ref={ref} {...baseProps} {...rest}>
          {content}
        </NavButtonBase>
      );
    }

    return (
      <Tooltip content={tooltip ?? label} side={tooltipSide} ref={ref} {...rest}>
        <NavButtonBase {...baseProps}>{content}</NavButtonBase>
      </Tooltip>
    );
  }
);

export type NavButtonProps = NavButtonOwnProps & {
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
} & React.ComponentPropsWithoutRef<'button'>;

export let NavButton = React.forwardRef<HTMLButtonElement, NavButtonProps>(
  ({ icon, iconRight, children, tooltip, tooltipSide, active, badge, ...rest }, ref) => {
    let content = (
      <>
        {icon}
        {children}
        {badge !== undefined && badge !== null && badge !== 0 && <Badge>{badge}</Badge>}
        {iconRight}
      </>
    );

    let baseProps = {
      type: 'button' as const,
      'aria-pressed': active === undefined ? undefined : active,
      $active: active
    };

    if (!tooltip) {
      return (
        <NavButtonBase ref={ref} {...baseProps} {...rest}>
          {content}
        </NavButtonBase>
      );
    }

    return (
      <Tooltip content={tooltip} side={tooltipSide} ref={ref} {...rest}>
        <NavButtonBase {...baseProps}>{content}</NavButtonBase>
      </Tooltip>
    );
  }
);

let TextButtonBase = styled.button`
  ${floatingSurface};
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  color: ${theme.colors.foreground};
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.12s ease;

  &:hover:not(:disabled) {
    background: ${theme.colors.gray150};
  }

  &:disabled {
    color: ${theme.colors.gray550};
    cursor: default;
  }

  svg {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    color: ${theme.colors.gray700};
  }
`;

export type NavTextButtonProps = {
  icon?: React.ReactNode;
  tooltip?: React.ReactNode;
  children?: React.ReactNode;
} & React.ComponentPropsWithoutRef<'button'>;

export let NavTextButton = React.forwardRef<HTMLButtonElement, NavTextButtonProps>(
  ({ icon, tooltip, children, ...rest }, ref) => {
    let content = (
      <>
        {icon}
        {children}
      </>
    );

    if (!tooltip) {
      return (
        <TextButtonBase ref={ref} type="button" {...rest}>
          {content}
        </TextButtonBase>
      );
    }

    return (
      <Tooltip content={tooltip} ref={ref} {...rest}>
        <TextButtonBase type="button">{content}</TextButtonBase>
      </Tooltip>
    );
  }
);

export let NavShareButton = styled.button`
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  height: 26px;
  margin: 0 4px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: ${theme.colors.foreground};
  color: ${theme.colors.background};
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #000;
  }
`;
