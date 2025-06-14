'use client';

import { useUser } from '@metorial/state';
import { Logo, theme } from '@metorial/ui';
import { RiArrowRightSLine, RiMenuLine } from '@remixicon/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMedia } from 'react-use';
import { styled } from 'styled-components';
import { ServerCategory } from '../../state/server';
import { LandingButton } from '../button';
import { UserMenu } from '../user/menu';
import { MobileNavInner } from './mobile';
import { NavRoot } from './root';
import { DESKTOP_NAV_MIN_WIDTH } from './variables';

let NavWrapper = styled('nav')`
  padding: 0px 15px;
  display: flex;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease-in-out;
  flex-direction: column;
  position: fixed;
  top: 40px;
  left: 0;
  right: 0;
`;

let NavInner = styled('main')`
  padding: 10px 0px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 20px;
  margin: 0 auto;
  max-width: 80rem;

  a {
    color: unset;
  }

  &.desktop {
    @media screen and (max-width: ${DESKTOP_NAV_MIN_WIDTH}px) {
      display: none;
    }
  }

  &.mobile {
    display: none;

    @media screen and (max-width: ${DESKTOP_NAV_MIN_WIDTH}px) {
      display: flex;
    }
  }
`;

let NavLogoText = styled('h1')`
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;

  svg {
    width: 16px;
    height: 16px;
    color: ${theme.colors.gray700};
  }
`;

let SearchInput = styled('input')`
  height: 42px;
  border: 1px solid ${theme.colors.gray400};
  background: rgba(0, 0, 0, 0.01);
  border-radius: 9999px;
  padding: 0px 20px;
  font-size: 14px;
  width: 400px;
  transition: all 0.2s ease-in-out;
  outline: none;

  &:focus,
  &:hover {
    border: 1px solid ${theme.colors.gray500};
    box-shadow: 0 2px 10px ${theme.colors.gray400};
    background: rgba(0, 0, 0, 0.05);
  }
`;

let NavSection = styled('section')`
  display: flex;
  align-items: center;
  gap: 20px;
`;

let NavLink = styled(Link)`
  color: ${theme.colors.gray700};
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s ease-in-out;
  padding: 0px 13px;
  height: 30px;
  border-radius: 99px;
  font-size: 14px;
  display: flex;
  align-items: center;

  &:hover {
    color: ${theme.colors.gray900};
    background: rgba(0, 0, 0, 0.05);
  }
`;

export let Nav = ({ categories }: { categories: ServerCategory[] }) => {
  let isMobile = useMedia(`(max-width: ${DESKTOP_NAV_MIN_WIDTH}px)`, false);
  let [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  let user = useUser();
  let router = useRouter();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [isMobile]);

  return (
    <>
      <MobileNavInner
        nav={{
          items: [
            {
              type: 'link',
              label: 'Metorial',
              href: 'https://metorial.com'
            },
            {
              type: 'link',
              label: 'GitHub',
              href: 'https://github.com/metorial/mcp-index'
            },
            {
              type: 'panel',
              label: 'Categories',

              navs: [
                {
                  links: categories.map(category => ({
                    label: category.name,
                    href: `/marketplace/servers?categories_ids=${category.id}`
                  }))
                }
              ]
            }
          ]
        }}
        isOpen={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
      />

      <NavRoot>
        <NavWrapper
          style={{
            color: 'black',
            background: 'rgba(255, 255, 255, 0.8)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <NavInner className="mobile">
            <Link
              href="/marketplace"
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              prefetch={false}
            >
              <Logo size={22} />
              <NavLogoText>Metorial</NavLogoText>
            </Link>

            <LandingButton
              rounded="soft"
              // variant={y > 50 ? 'primary' : 'white'}
              aria-label="Close"
              icon={<RiMenuLine />}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            />
          </NavInner>

          <NavInner className="desktop">
            <NavSection>
              <Link
                href="/marketplace"
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                prefetch={false}
              >
                <Logo size={22} />
                <NavLogoText>
                  <span
                    onClick={e => {
                      e.preventDefault();
                      window.location.href = 'https://metorial.com';
                    }}
                  >
                    Metorial
                  </span>
                  <RiArrowRightSLine />
                  <span>Index</span>
                </NavLogoText>
              </Link>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  let form = e.currentTarget;
                  let input = form.querySelector('input') as HTMLInputElement;
                  let value = input.value;
                  if (!value) return;

                  router.push(`/marketplace/servers?search=${value}`);
                }}
              >
                <SearchInput placeholder="Server MCP servers" />
              </form>
            </NavSection>

            <NavSection style={{ gap: 10 }}>
              <NavLink href="https://metorial.com" prefetch={false}>
                Metorial
              </NavLink>

              <NavLink
                href="https://github.com/metorial/mcp-index"
                prefetch={false}
                target="_blank"
              >
                GitHub
              </NavLink>

              {user.isLoading ? (
                <></>
              ) : user.error ? (
                <>
                  {/* <LandingButton
                    rounded="soft"
                    variant="soft"
                    onClick={() => redirectToAuth(window.location.href, { intent: 'login' })}
                  >
                    Login
                  </LandingButton>

                  <LandingButton
                    rounded="soft"
                    onClick={() => redirectToAuth(window.location.href, { intent: 'signup' })}
                  >
                    Get Started
                  </LandingButton> */}
                </>
              ) : (
                <div style={{ paddingLeft: 10 }}>
                  <UserMenu />
                </div>
              )}
            </NavSection>
          </NavInner>
        </NavWrapper>
      </NavRoot>
    </>
  );
};
