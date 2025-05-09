import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'react-feather';
import { styled } from 'styled-components';
import _useDelayed from 'use-delayed';
import { Spinner } from '../spinner';
import { ButtonStyleProps, buttonTheme, getButtonStyles } from './constants';

export type { ButtonSize, ButtonVariant } from './constants';
export * from './linkButton';

let useDelayed = _useDelayed;

// @ts-ignore FUCK NEXTJS'S BROKEN IMPORT LOGIC. FUCK IT!!
if (useDelayed.default) useDelayed = useDelayed.default;

let Wrapper = styled('button')`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  position: relative;
  cursor: pointer;
  color: ${buttonTheme.passive_color};
  background: ${buttonTheme.passive_background};
  border: solid 1px ${buttonTheme.passive_border};
  box-shadow: ${buttonTheme.passive_shadow};
  transition: all 0.2s;
  user-select: none;

  &:hover,
  &:focus {
    color: ${buttonTheme.active_color};
    background: ${buttonTheme.active_background};
    border: solid 1px ${buttonTheme.active_border};
    box-shadow: ${buttonTheme.active_shadow};
  }

  &:active {
    transform: ${buttonTheme.active_transform};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

let Overlay = styled(motion.div)`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

let OverlayInner = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

let Inner = styled('div')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  flex-shrink: 0;
  gap: 6px;
`;

let Icon = styled('span')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    height: 16px;
    width: 16px;
  }
`;

let Content = styled('span')`
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
  font-weight: 500;
`;

export let Button = React.forwardRef(
  (
    {
      children,
      iconLeft,
      iconRight,
      loading,
      success,
      fullWidth,
      variant,
      color,
      size,
      onHover,
      as = 'button',
      ...props
    }: {
      children?: React.ReactNode;
      iconLeft?: React.ReactNode;
      iconRight?: React.ReactNode;
      loading?: boolean;
      success?: boolean;
      fullWidth?: boolean;
      onHover?: () => void;
      as?: 'button' | 'span' | 'div';
    } & ButtonStyleProps &
      React.ButtonHTMLAttributes<HTMLButtonElement>,
    ref
  ) => {
    let [isHovered, setIsHovered] = useState(false);
    useEffect(() => onHover?.(), [isHovered]);
    let isMouseOverRef = useRef(false);

    let style = getButtonStyles({
      color,
      variant,
      size
    });

    let loadingVisible = useDelayed(loading, 200, [false]);
    let successVisible = useDelayed(success, 200, [false]);
    let contentVisible = useDelayed(!loading && !success, 200);

    return (
      <Wrapper
        as={as}
        ref={ref as any}
        {...props}
        style={{
          ...style,
          ...props.style,

          width: fullWidth ? '100%' : undefined,

          ...(!children && {
            width: style.height,
            padding: 0
          })
        }}
        disabled={props.disabled}
        onClick={(e: any) => {
          if (loading || success) e.preventDefault();
          else props.onClick?.(e);
        }}
        onMouseEnter={() => {
          isMouseOverRef.current = true;

          setTimeout(() => {
            if (isMouseOverRef.current) setIsHovered(true);
          }, 100);
        }}
        onMouseLeave={() => {
          isMouseOverRef.current = false;
          setIsHovered(false);
        }}
      >
        <AnimatePresence>
          {loadingVisible && !successVisible && (
            <Overlay
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                backgroundColor: variant == 'outline' ? undefined : 'rgba(0, 0, 0, 0.1)'
              }}
              transition={{
                duration: 0.2,
                ease: 'easeInOut'
              }}
            >
              <OverlayInner>
                <Spinner
                  size={16}
                  foreground={buttonTheme.spinner_foreground}
                  background={buttonTheme.spinner_background}
                />
              </OverlayInner>
            </Overlay>
          )}

          {successVisible && (
            <Overlay
              key="success"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              style={{
                backgroundColor: variant == 'outline' ? undefined : 'rgba(0, 0, 0, 0.1)'
              }}
              transition={{
                duration: 0.3,
                ease: 'easeInOut'
              }}
            >
              <OverlayInner
                initial={{ scale: 0.5, rotate: -15 }}
                animate={{ scale: 1, rotate: -10 }}
                transition={{ delay: 0.1 }}
              >
                <Icon>
                  <Check size={16} strokeWidth={3} />
                </Icon>
              </OverlayInner>
            </Overlay>
          )}
        </AnimatePresence>

        <Inner
          style={{
            opacity: contentVisible ? 1 : 0,
            transition: 'opacity 0.25s ease',

            textAlign: fullWidth || !children ? 'center' : 'left',
            justifyContent: fullWidth || !children ? 'center' : 'flex-start'
          }}
          aria-hidden={loading || success}
        >
          {iconLeft && <Icon>{iconLeft}</Icon>}
          {children && <Content>{children}</Content>}
          {iconRight && <Icon>{iconRight}</Icon>}
        </Inner>
      </Wrapper>
    );
  }
);
