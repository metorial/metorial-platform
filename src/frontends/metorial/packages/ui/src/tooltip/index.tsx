import * as RadixTooltip from '@radix-ui/react-tooltip';
import React, { useEffect, useState } from 'react';
import Balancer from 'react-wrap-balancer';
import { keyframes, styled } from 'styled-components';
import { theme } from '..';
import {
  TooltipSuppressorProvider,
  useIsInsideOpenOverlay,
  useTooltipSuppressor
} from './state';

export * from './state';

let fadeInTop = keyframes`
  from { opacity: 0; transform: translateY(-15px) scale(0.75); filter: blur(2px) }
  to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px) }
`;

let fadeOutTop = keyframes`
  from { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px) }
  to { opacity: 0; transform: translateY(-15px) scale(0.75); filter: blur(2px) }
`;

let fadeInBottom = keyframes`
  from { opacity: 0; transform: translateY(15px) scale(0.75); filter: blur(2px) }
  to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px) }
`;

let fadeOutBottom = keyframes`
  from { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px) }
  to { opacity: 0; transform: translateY(15px) scale(0.75); filter: blur(2px) }
`;

let fadeInLeft = keyframes`
  from { opacity: 0; transform: translateX(15px) scale(0.75); filter: blur(2px) }
  to { opacity: 1; transform: translateX(0) scale(1); filter: blur(0px) }
`;

let fadeOutLeft = keyframes`
  from { opacity: 1; transform: translateX(0) scale(1); filter: blur(0px) }
  to { opacity: 0; transform: translateX(15px) scale(0.75); filter: blur(2px) }
`;

let fadeInRight = keyframes`
  from { opacity: 0; transform: translateX(-15px) scale(0.75); filter: blur(2px) }
  to { opacity: 1; transform: translateX(0) scale(1); filter: blur(0px) }
`;

let fadeOutRight = keyframes`
  from { opacity: 1; transform: translateX(0) scale(1); filter: blur(0px) }
  to { opacity: 0; transform: translateX(-15px) scale(0.75); filter: blur(2px) }
`;

let Content = styled(RadixTooltip.Content)`
  display: flex;
  gap: 10px;
  align-items: center;
  cursor: default;
  background: ${theme.colors.foreground};
  color: ${theme.colors.background};
  border-radius: 7px;
  box-shadow: ${theme.shadows.medium};
  will-change: transform, opacity;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 500;
  max-width: 400px;
  z-index: 99999;

  &[data-state='instant-open'][data-side='top'] {
    animation: ${fadeInBottom} 0.2s ease forwards;
  }

  &[data-state='delayed-open'][data-side='top'] {
    animation: ${fadeInBottom} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='top'] {
    animation: ${fadeOutBottom} 0.2s ease forwards;
  }

  &[data-state='instant-open'][data-side='bottom'] {
    animation: ${fadeInTop} 0.2s ease forwards;
  }

  &[data-state='delayed-open'][data-side='bottom'] {
    animation: ${fadeInTop} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='bottom'] {
    animation: ${fadeOutTop} 0.2s ease forwards;
  }

  &[data-state='instant-open'][data-side='left'] {
    animation: ${fadeInLeft} 0.2s ease forwards;
  }

  &[data-state='delayed-open'][data-side='left'] {
    animation: ${fadeInLeft} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='left'] {
    animation: ${fadeOutLeft} 0.2s ease forwards;
  }

  &[data-state='instant-open'][data-side='right'] {
    animation: ${fadeInRight} 0.2s ease forwards;
  }

  &[data-state='delayed-open'][data-side='right'] {
    animation: ${fadeInRight} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='right'] {
    animation: ${fadeOutRight} 0.2s ease forwards;
  }
`;

let Arrow = styled(RadixTooltip.Arrow)`
  fill: ${theme.colors.foreground};
`;

let SUPPRESSION_LINGER = 300;

export type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  arrow?: boolean;
  delayDuration?: number;
  enabled?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
} & Omit<React.ComponentPropsWithoutRef<'button'>, 'content' | 'children'>;

export let Tooltip = React.forwardRef<HTMLButtonElement, TooltipProps>(
  (
    {
      content,
      children,
      arrow,
      delayDuration,
      enabled,
      side = 'bottom',
      align = 'center',
      ...triggerProps
    },
    ref
  ) => {
    let [isOpen, setIsOpen] = useState(false);

    let [isSuppressed, setIsSuppressed] = useState(true);

    let { isHeld, suppressor } = useTooltipSuppressor();
    let isInsideOpenOverlay = useIsInsideOpenOverlay();
    let shouldSuppress = enabled === false || isHeld || isInsideOpenOverlay;

    useEffect(() => {
      if (shouldSuppress) {
        setIsSuppressed(true);
        setIsOpen(false);
        return;
      }

      let timeout = setTimeout(() => setIsSuppressed(false), SUPPRESSION_LINGER);
      return () => clearTimeout(timeout);
    }, [shouldSuppress]);

    return (
      <RadixTooltip.Provider delayDuration={delayDuration}>
        <RadixTooltip.Root
          open={isOpen && !isSuppressed}
          onOpenChange={open => {
            if (open && isSuppressed) return;
            setIsOpen(open);
          }}
        >
          <TooltipSuppressorProvider value={suppressor}>
            <RadixTooltip.Trigger asChild {...triggerProps} ref={ref}>
              {children}
            </RadixTooltip.Trigger>
          </TooltipSuppressorProvider>

          <RadixTooltip.Portal>
            <Content sideOffset={5} side={side} align={align} hideWhenDetached>
              {typeof content == 'string' ? (
                <>
                  <Balancer>{content}</Balancer>
                </>
              ) : (
                <>{content}</>
              )}

              {arrow && <Arrow />}
            </Content>
          </RadixTooltip.Portal>
        </RadixTooltip.Root>
      </RadixTooltip.Provider>
    );
  }
);
