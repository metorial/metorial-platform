import { renderWithLoader } from '@metorial/data-hooks';
import { FileBrowser, createMemoryFileSystem } from '@metorial/file-browser';
import { useSandboxMachine } from '@metorial/state';
import { Terminal, createEchoTransport } from '@metorial/terminal';
import { Button, Callout, Spacer, Text, theme } from '@metorial/ui';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { isSandboxMachineTransitional } from '../shared/statusBadges';

let ToolViewport = styled.div`
  height: max(390px, calc(100dvh - 315px));
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

export let SandboxToolViewport = ({ children }: { children: React.ReactNode }) => {
  let element = useRef<HTMLDivElement>(null);
  let [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    let measure = () => {
      if (element.current)
        setHeight(
          Math.max(390, window.innerHeight - element.current.getBoundingClientRect().top - 54)
        );
    };
    measure();
    window.addEventListener('resize', measure);

    let observer = new ResizeObserver(measure);
    if (element.current?.parentElement) observer.observe(element.current.parentElement);

    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, []);

  return (
    <ToolViewport ref={element} style={{ height }}>
      {children}
    </ToolViewport>
  );
};

let PreviewFrame = styled.div<{ $shell: boolean }>`
  background: ${({ $shell }) => ($shell ? theme.colors.gray900 : theme.colors.gray200)};
  position: relative;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
  border-radius: 8px;
`;

let Preview = styled.div`
  height: 100%;
  filter: blur(5px);
  opacity: 0.55;
  pointer-events: none;
  user-select: none;
`;

let PreviewAction = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let ActionCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0px;
  max-width: 420px;
  text-align: left;
  padding: 24px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.medium};
`;

let ToolPreview = ({ action }: { action: 'Connect' | 'Browse' }) => {
  let files = useMemo(
    () =>
      createMemoryFileSystem({
        directories: ['/bin', '/etc', '/home', '/root', '/tmp', '/usr', '/var'],
        files: { '/README.md': 'Machine workspace' }
      }),
    []
  );
  let transport = useMemo(
    () =>
      createEchoTransport({
        banner:
          'Welcome to your machine.\r\n\r\n$ ls\r\nbin  etc  home  root  tmp  usr  var\r\n',
        prompt: '$ ',
        connectDelayMs: 0
      }),
    []
  );

  return (
    <Preview aria-hidden inert>
      {action === 'Browse' ? (
        <FileBrowser adapter={files} height="100%" />
      ) : (
        <Terminal transport={transport} sessionKey="preview" height="100%" autoFocus={false} />
      )}
    </Preview>
  );
};

export let SandboxMachineToolGate = ({
  instanceId,
  machineId,
  action,
  children
}: {
  instanceId: string;
  machineId: string;
  action: 'Connect' | 'Browse';
  children: React.ReactNode;
}) => {
  let [requested, setRequested] = useState(false);
  let machine = useSandboxMachine(instanceId, machineId, {
    pollInterval: data =>
      requested || (data && isSandboxMachineTransitional(data.status)) ? 1000 : 15000
  });
  let start = machine.useStartMutator();
  let observedTransition = useRef(false);

  useEffect(() => {
    if (machine.data && isSandboxMachineTransitional(machine.data.status))
      observedTransition.current = true;
    if (
      machine.data?.status === 'running' ||
      machine.data?.status === 'terminated' ||
      start.error ||
      (observedTransition.current && machine.data?.status === 'failed')
    ) {
      setRequested(false);
      observedTransition.current = false;
    }
  }, [machine.data?.status, start.error]);

  return renderWithLoader({ machine })(({ machine }) => {
    let status = machine.data.status;
    if (status === 'running') return children;

    let paused = status === 'paused' || status === 'hibernated';
    let transitional = isSandboxMachineTransitional(status);
    let loading = start.isLoading || requested || transitional;

    return (
      <PreviewFrame $shell={action === 'Connect'}>
        <ToolPreview action={action} />
        <PreviewAction>
          <ActionCard>
            {status === 'terminated' ? (
              <Text size="2">This machine has been deleted.</Text>
            ) : (
              <>
                <Text size="4" weight="strong">
                  {loading
                    ? 'Preparing machine'
                    : status === 'paused'
                      ? 'Machine is paused'
                      : status === 'hibernated'
                        ? 'Machine is hibernated'
                        : 'Machine is stopped'}
                </Text>
                <Text size="2" color="gray600">
                  {loading
                    ? 'Connecting automatically when the machine is ready.'
                    : `${paused ? 'Resume' : 'Start'} the machine to ${action === 'Connect' ? 'connect to a terminal' : 'browse its files'}.`}
                </Text>
                <Spacer size="10px" />
                <Button
                  size="2"
                  loading={loading}
                  onClick={async () => {
                    setRequested(true);
                    let [result] = await start.mutate();
                    if (!result) setRequested(false);
                  }}
                >
                  {loading
                    ? 'Preparing Machine…'
                    : paused
                      ? 'Resume Machine'
                      : 'Start Machine'}
                </Button>
                {status === 'failed' && !loading && machine.data.failure && (
                  <Callout color="red">{machine.data.failure.message}</Callout>
                )}
                <start.RenderError />
              </>
            )}
          </ActionCard>
        </PreviewAction>
      </PreviewFrame>
    );
  });
};
