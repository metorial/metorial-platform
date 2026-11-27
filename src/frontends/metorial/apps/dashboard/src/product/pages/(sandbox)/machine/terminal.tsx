import { renderWithLoader } from '@metorial/data-hooks';
import { createSandboxMachineAccess, useCurrentInstance } from '@metorial/state';
import { Terminal, type TerminalSession, type TerminalTransport } from '@metorial/terminal';
import { Button, Flex } from '@metorial/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  createBrowserShellSessionStore,
  createSandboxShellTransport
} from '../../../scenes/sandbox/access';
import {
  SandboxMachineToolGate,
  SandboxToolViewport
} from '../../../scenes/sandbox/terminal/toolGate';

let SessionPane = styled.div<{ $active: boolean }>`
  display: ${p => (p.$active ? 'flex' : 'none')};
  height: 100%;
  min-height: 0;
  flex-direction: column;
`;

type ShellTab = { id: string; number: number };

let MachineTerminal = ({
  instanceId,
  machineId
}: {
  instanceId: string;
  machineId: string;
}) => {
  let storageKey = `sandbox-shell-tabs:${instanceId}:${machineId}`;
  let [tabs, setTabs] = useState<ShellTab[]>(() => {
    try {
      let stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (
        Array.isArray(stored) &&
        stored.length &&
        stored.length <= 8 &&
        stored.every(t => typeof t.id == 'string' && Number.isInteger(t.number))
      )
        return stored;
    } catch {}
    return [{ id: crypto.randomUUID(), number: 1 }];
  });
  let [active, setActive] = useState(tabs[0].id);
  let sessions = useRef(new Map<string, TerminalSession>());
  let panes = useRef(new Map<string, HTMLDivElement>());

  let base = useMemo(
    () =>
      createSandboxShellTransport({
        getAccess: () => createSandboxMachineAccess({ instanceId, machineId, scope: 'shell' }),
        sessionStore: createBrowserShellSessionStore()
      }),
    [instanceId, machineId]
  );
  let transport = useMemo<TerminalTransport>(
    () => ({
      open: (opts, handlers) => {
        let session = base.open(opts, handlers);
        sessions.current.set(opts.sessionKey, session);
        return session;
      }
    }),
    [base]
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(tabs));
    } catch {}
  }, [storageKey, tabs]);

  useEffect(() => {
    panes.current
      .get(active)
      ?.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea')
      ?.focus();
  }, [active]);

  let close = (tab: ShellTab) => {
    sessions.current.get(`${storageKey}:${tab.id}`)?.close();
    sessions.current.delete(`${storageKey}:${tab.id}`);

    let remaining = tabs.filter(t => t.id != tab.id);
    if (!remaining.length) remaining = [{ id: crypto.randomUUID(), number: tab.number + 1 }];
    setTabs(remaining);
    if (active == tab.id) setActive(remaining[0].id);
  };

  let toolbar = (
    <Flex gap={5}>
      {tabs.map(tab => (
        <Flex key={tab.id} gap={2}>
          <Button
            size="1"
            variant={active == tab.id ? 'soft' : 'ghost'}
            aria-pressed={active == tab.id}
            onClick={() => setActive(tab.id)}
          >
            Session {tab.number}
          </Button>
          <Button
            size="1"
            variant="ghost"
            aria-label={`Close Session ${tab.number}`}
            onClick={() => close(tab)}
          >
            ×
          </Button>
        </Flex>
      ))}
      <Button
        size="1"
        variant="ghost"
        aria-label="New Session"
        disabled={tabs.length >= 8}
        onClick={() => {
          let tab = {
            id: crypto.randomUUID(),
            number: Math.max(...tabs.map(t => t.number)) + 1
          };
          setTabs([...tabs, tab]);
          setActive(tab.id);
        }}
      >
        +
      </Button>
    </Flex>
  );

  return (
    <SandboxMachineToolGate instanceId={instanceId} machineId={machineId} action="Connect">
      {tabs.map(tab => (
        <SessionPane
          key={tab.id}
          $active={active == tab.id}
          ref={element => {
            if (element) panes.current.set(tab.id, element);
            else panes.current.delete(tab.id);
          }}
        >
          <Terminal
            transport={transport}
            sessionKey={`${storageKey}:${tab.id}`}
            height="100%"
            toolbarStart={toolbar}
            autoFocus={active == tab.id}
            copyOnSelect
          />
        </SessionPane>
      ))}
    </SandboxMachineToolGate>
  );
};

export let SandboxMachineTerminalPage = () => {
  let instance = useCurrentInstance();
  let { machineId } = useParams();
  return renderWithLoader({ instance })(({ instance }) => (
    <SandboxToolViewport>
      {machineId && (
        <MachineTerminal key={machineId} instanceId={instance.data.id} machineId={machineId} />
      )}
    </SandboxToolViewport>
  ));
};
