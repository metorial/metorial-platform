import { Logo } from '@metorial/ui';
import * as Dialog from '@radix-ui/react-dialog';
import { RiArrowLeftLine, RiCloseLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { LandingButton } from '../button';
import { INav } from './types';

let fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

let fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

let Content = styled(Dialog.Content)`
  background-color: white;
  border-radius: 6px;
  box-shadow:
    hsl(206 22% 7% / 35%) 0px 10px 38px -10px,
    hsl(206 22% 7% / 20%) 0px 10px 20px -15px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;

  &[data-state='open'] {
    animation: ${fadeIn} 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  &[data-state='closed'] {
    animation: ${fadeOut} 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  &:focus {
    outline: none;
  }
`;

let Header = styled.header`
  padding: 20px 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

let LogoWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;

  h2 {
    font-size: 16px;
    font-weight: 600;
  }
`;

let StyledLink = styled.span`
  font-size: 14px;
  color: #777;
  font-weight: 500;
  transition: all 0.3s ease;
  padding: 0px;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  gap: 5px;

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover,
  &:focus {
    color: black;
  }
`;

let List = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 10px 15px;
`;

export let MobileNavInner = ({
  nav,
  isOpen,
  onOpenChange
}: {
  nav: INav;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  let [subMenu, setSubMenu] = useState<number>();

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Content>
          <Header>
            <LogoWrapper>
              <Logo size={22} />
              <Dialog.Title>Metorial</Dialog.Title>
            </LogoWrapper>

            <Dialog.Close asChild>
              <LandingButton rounded="soft" aria-label="Close" icon={<RiCloseLine />} />
            </Dialog.Close>
          </Header>

          <AnimatePresence>
            {subMenu === undefined && (
              <List key="list" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {nav.items.map((item, i) => {
                  if (item.type == 'link') {
                    return (
                      <StyledLink
                        key={i}
                        onClick={() => onOpenChange(false)}
                        as={Link}
                        href={item.href}
                      >
                        {item.label}
                      </StyledLink>
                    );
                  }

                  if (item.type == 'button') {
                    return (
                      <StyledLink
                        key={i}
                        onClick={() => {
                          onOpenChange(false);
                          item.onClick?.();
                        }}
                        as="button"
                      >
                        {item.label}
                      </StyledLink>
                    );
                  }

                  return (
                    <StyledLink key={i} onClick={() => setSubMenu(i)} as="button">
                      {item.label}
                    </StyledLink>
                  );
                })}
              </List>
            )}

            {subMenu !== undefined && (
              <List
                key={subMenu}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <StyledLink onClick={() => setSubMenu(undefined)} as="button">
                  <RiArrowLeftLine /> Back
                </StyledLink>

                {(nav.items[subMenu] as any).navs.flatMap(({ links }: any, i: number) =>
                  links.map((item: any, j: number) => (
                    <StyledLink
                      key={`${i}-${j}`}
                      onClick={() => onOpenChange(false)}
                      as={Link}
                      href={item.href}
                    >
                      {item.label}
                    </StyledLink>
                  ))
                )}
              </List>
            )}
          </AnimatePresence>
        </Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
