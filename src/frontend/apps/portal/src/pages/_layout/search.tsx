import { Logo } from '@metorial/ui';
import { Command } from 'cmdk';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';
import { useDebounced } from '../../hooks/useDebounced';
import { useServerListings } from '../../state/consumer/listings';
import { usePaths } from '../../state/portal/path';

let Global = createGlobalStyle`
  :root {
    --cmd-font-sans: 'Inter', --apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans,
      Droid Sans, Helvetica Neue, sans-serif;
    --cmd-app-bg: var(--cmd-gray1);
    --cmd-cmdk-shadow: 0 16px 70px rgb(0 0 0 / 20%);

    --cmd-lowContrast: #ffffff;
    --cmd-highContrast: #000000;

    --cmd-gray1: hsl(0, 0%, 99%);
    --cmd-gray2: hsl(0, 0%, 97.3%);
    --cmd-gray3: hsl(0, 0%, 95.1%);
    --cmd-gray4: hsl(0, 0%, 93%);
    --cmd-gray5: hsl(0, 0%, 90.9%);
    --cmd-gray6: hsl(0, 0%, 88.7%);
    --cmd-gray7: hsl(0, 0%, 85.8%);
    --cmd-gray8: hsl(0, 0%, 78%);
    --cmd-gray9: hsl(0, 0%, 56.1%);
    --cmd-gray10: hsl(0, 0%, 52.3%);
    --cmd-gray11: hsl(0, 0%, 43.5%);
    --cmd-gray12: hsl(0, 0%, 9%);
    --cmd-page-top: 20vh;


  }

  [cmdk-root] {
    width: 640px;
    max-width: calc(100vw - 40px);
    background: var(--cmd-gray1);
    border-radius: 12px;
    font-family: var(--cmd-font-sans);
    box-shadow: var(--cmd-cmdk-shadow);
    border: 1px solid var(--cmd-gray6);
    position: relative;
    outline: none;

    kbd {
      font-family: var(--cmd-font-sans);
      background: var(--cmd-gray3);
      color: var(--cmd-gray11);
      height: 20px;
      width: 20px;
      border-radius: 4px;
      padding: 0 4px;
      display: flex;
      align-items: center;
      justify-content: center;

      &:first-of-type {
        margin-left: 8px;
      }
    }
  }

  [cmdk-item] {
    content-visibility: auto;

    cursor: pointer;
    height: 40px;
    border-radius: 8px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 15px;
    color: var(--cmd-gray12);
    user-select: none;
    will-change: background, color;
    transition: all 150ms ease;
    transition-property: none;

    &[data-selected='true'] {
      background: var(--cmd-gray4);
      color: var(--cmd-gray12);
    }

    &[data-disabled='true'] {
      color: var(--cmd-gray8);
      cursor: not-allowed;
    }

    &:active {
      transition-property: background;
      background: var(--cmd-gray4);
    }

    &:first-child {
      margin-top: 8px;
    }

    & + [cmdk-item] {
      margin-top: 4px;
    }

    svg {
      width: 18px;
      height: 18px;
    }
  }

  [cmdk-separator] {
    height: 1px;
    width: 100%;
    background: var(--cmd-gray5);
    margin: 4px 0;
  }

  *:not([hidden]) + [cmdk-group] {
    margin-top: 8px;
  }

  [cmdk-group-heading] {
    user-select: none;
    font-size: 12px;
    color: var(--cmd-gray11);
    padding: 0 15px;
    display: flex;
    align-items: center;
  }

  [cmdk-dialog] {
    z-index: 9999;
    position: fixed;
    left: 50%;
    top: var(--cmd-page-top);
    transform: translateX(-50%);
    transform-origin: center;
    animation: dialogIn 100ms forwards;

    &[data-state='closed'] {
      animation: dialogOut 100ms forwards;
    }
  }

  [cmdk-overlay] {
    pointer-events: auto;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 9998;
    background: rgba(100, 100, 100, 0.1);
    backdrop-filter: blur(5px);

    animation: fadeIn 300ms forwards;

    &[data-state='closed'] {
      animation: fadeOut 500ms forwards;
    }
  }

  @keyframes dialogIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px) scale(0.95);
    }

    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }
  }

  @keyframes dialogOut {
    from {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }

    to {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px) scale(0.95);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }

    to {
      opacity: 0;
    }
  }
`;

let Header = styled.header`
  border-bottom: 1px solid var(--cmd-gray6);
  padding: 10px;
`;

let List = styled(Command.List)`
  padding: 0 8px;
  height: 400px;
  overflow: auto;
  overscroll-behavior: contain;
  scroll-padding-block-end: 40px;
  transition: 100ms ease;
  transition-property: height;
  padding-bottom: 10px;
  padding-top: 10px;
  margin-bottom: 40px;
`;

let Input = styled(Command.Input)`
  font-family: var(--cmd-font-sans);
  border: none;
  width: 100%;
  font-size: 15px;
  padding: 10px 13px;
  outline: none;
  border-radius: 8px;
  background: var(--cmd-gray3);
  color: var(--cmd-gray12);

  &::placeholder {
    color: var(--cmd-gray9);
  }
`;

let Empty = styled(Command.Empty)`
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  white-space: pre-wrap;
  color: var(--cmd-gray8);
`;

let Footer = styled.footer`
  display: flex;
  align-items: center;
  width: calc(100% - 20px);
  height: 40px;
  position: absolute;
  background: var(--cmd-gray1);
  bottom: 0;
  padding: 0px 10px;
  border-top: 1px solid var(--cmd-gray6);
  border-radius: 0 0 12px 12px;
  font-size: 12px;
  color: var(--cmd-gray11);

  svg {
    width: 20px;
    height: 20px;
    margin-right: auto;
  }

  hr {
    height: 12px;
    width: 1px;
    border: 0;
    background: var(--cmd-gray6);
    margin: 0 4px 0px 12px;
  }

  kbd {
    width: 30px;
    display: flex;
  }

  @media (prefers-color-scheme: dark) {
    background: var(--cmd-gray2);
  }
`;

export let SearchMenu = ({
  open,
  setOpen
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  let everOpenedRef = useRef(false);
  if (open) everOpenedRef.current = true;

  let [value, setValue] = useState('');
  let searchDebounced = useDebounced(value, 500);

  let Paths = usePaths();

  let servers = useServerListings({
    limit: 50,
    search: searchDebounced,
    orderByRank: true
  });

  useEffect(() => {
    let down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  let [items, setItems] = useState(() => servers.data?.items || []);
  useEffect(() => {
    if (servers.data?.items) setItems(servers.data.items);
  }, [servers.data?.items]);

  let [selected, setSelected] = useState<string>('');
  let navigate = useNavigate();

  return (
    <>
      {everOpenedRef.current && <Global />}

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Global Command Menu"
        title="Command Menu"
        loop
        value={selected}
        onValueChange={setSelected}
      >
        <Header>
          <Input
            placeholder="Type a command or search..."
            value={value}
            onValueChange={setValue}
          />
        </Header>

        <List>
          <Empty>No results found.</Empty>

          {items.map(server => (
            <Command.Item
              key={server.id}
              value={`${server.name} ${server.vendor?.name} ${server.slug}`}
              onSelect={() => {
                setOpen(false);
                navigate(Paths.server(server.server.id));
              }}
            >
              <img src={server?.imageUrl} alt={server.name} width={24} height={24} />
              {server.name}
            </Command.Item>
          ))}
        </List>

        <Footer>
          <Logo />
          <span>Metorial</span>
          <hr />
          <kbd>⌘K</kbd>
        </Footer>
      </Command.Dialog>
    </>
  );
};
