import * as RadixTooltip from '@radix-ui/react-tooltip';
import React, { useEffect, useState } from 'react';
import Balancer from 'react-wrap-balancer';
import { keyframes, styled } from 'styled-components';
import { theme } from '..';

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

export let Tooltip = ({
  content,
  children,
  arrow,
  delayDuration,
  enabled,
  side = 'bottom',
  align = 'center'
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  arrow?: boolean;
  delayDuration?: number;
  enabled?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}) => {
  // We disable the trigger for a single render to prevent
  // the tooltip from showing in dialogs
  let [disabled, setDisabled] = useState(true);

  useEffect(() => {
    setDisabled(false);
  }, []);

  if (enabled === false) return <>{children}</>;

  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild disabled={disabled}>
          {children}
        </RadixTooltip.Trigger>

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
};
