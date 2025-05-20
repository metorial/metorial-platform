'use client';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import { encode } from 'qss';
import React from 'react';
import styled from 'styled-components';
import { cn } from '../lib/utils';

let HiddenImageContainer = styled.div`
  display: none;
`;

let StyledTrigger = styled(HoverCardPrimitive.Trigger)`
  color: black;
`;

let HoverContent = styled(HoverCardPrimitive.Content)`
  transform-origin: var(--radix-hover-card-content-transform-origin);
`;

let MotionCard = styled(motion.div)`
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -4px rgba(0, 0, 0, 0.1);
  border-radius: 0.75rem;
`;

let PreviewLink = styled.a`
  display: block;
  padding: 0.25rem;
  background-color: #fafafa;
  border: 2px solid transparent;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  border-radius: 0.75rem;
  font-size: 0;
  transition: border-color 0.2s ease-in-out;

  &:hover {
    border-color: #e5e5e5;
  }
`;

let PreviewImage = styled.img`
  border-radius: 0.5rem;
`;

type LinkPreviewProps = {
  children: React.ReactNode;
  url: string;
  className?: string;
  width?: number;
  height?: number;
  quality?: number;
  layout?: string;
} & ({ isStatic: true; imageSrc: string } | { isStatic?: false; imageSrc?: never });

export let LinkPreview = ({
  children,
  url,
  className,
  width = 200,
  height = 125,
  quality = 50,
  layout = 'fixed',
  isStatic = false,
  imageSrc = ''
}: LinkPreviewProps) => {
  let src;
  if (!isStatic) {
    let params = encode({
      url,
      screenshot: true,
      meta: false,
      embed: 'screenshot.url',
      'viewport.isMobile': true,
      'viewport.deviceScaleFactor': 1,
      'viewport.width': width * 3,
      'viewport.height': height * 3
    });
    src = `https://api.microlink.io/?${params}`;
  } else {
    src = imageSrc;
  }

  let [isOpen, setOpen] = React.useState(false);
  let [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  let springConfig = { stiffness: 100, damping: 15 };
  let x = useMotionValue(0);
  let translateX = useSpring(x, springConfig);

  let handleMouseMove = (event: any) => {
    let targetRect = event.target.getBoundingClientRect();
    let eventOffsetX = event.clientX - targetRect.left;
    let offsetFromCenter = (eventOffsetX - targetRect.width / 2) / 2;
    x.set(offsetFromCenter);
  };

  return (
    <>
      {isMounted ? (
        <HiddenImageContainer>
          <img src={src} width={width} height={height} alt="hidden image" />
        </HiddenImageContainer>
      ) : null}

      <HoverCardPrimitive.Root
        openDelay={50}
        closeDelay={100}
        onOpenChange={open => {
          setOpen(open);
        }}
      >
        <StyledTrigger onMouseMove={handleMouseMove} className={cn(className)} href={url}>
          {children}
        </StyledTrigger>

        <HoverContent side="top" align="center" sideOffset={10}>
          <AnimatePresence>
            {isOpen && (
              <MotionCard
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: 'spring',
                    stiffness: 260,
                    damping: 20
                  }
                }}
                exit={{ opacity: 0, y: 20, scale: 0.6 }}
                style={{
                  x: translateX
                }}
              >
                <PreviewLink href={url} style={{ fontSize: 0 }}>
                  <PreviewImage
                    src={isStatic ? imageSrc : src}
                    width={width}
                    height={height}
                    alt="preview image"
                  />
                </PreviewLink>
              </MotionCard>
            )}
          </AnimatePresence>
        </HoverContent>
      </HoverCardPrimitive.Root>
    </>
  );
};
