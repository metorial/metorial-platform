import { useCurrentInstance, useProviderRunLogs } from '@metorial/state';
import { CenteredSpinner, Text } from '@metorial/ui';
import { RiTerminalLine } from '@remixicon/react';
import { useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

let Wrapper = styled.div`
  border-radius: 8px;
  border: 1px solid #2a2a2a;
  background: #1a1a1a;
  overflow: hidden;
`;

let Header = styled.header`
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #2a2a2a;
  background: #222;

  span {
    font-size: 12px;
    font-weight: 500;
    color: #aaa;
    display: flex;
    align-items: center;
    gap: 6px;
  }
`;

let Body = styled.div`
  max-height: 500px;
  overflow-y: auto;
  padding: 8px 0;
  font-family:
    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
`;

let Line = styled.div<{ $type?: string }>`
  display: grid;
  grid-template-columns: 80px 1fr;
  padding: 2px 16px;
  cursor: default;

  &:hover {
    background: #222;
  }

  color: ${p =>
    p.$type === 'stderr' || p.$type === 'debug.error'
      ? '#f87171'
      : p.$type === 'debug.warning'
        ? '#fbbf24'
        : '#d4d4d4'};
`;

let Ts = styled.span`
  color: #666;
  font-size: 11px;
  user-select: none;
`;

let Message = styled.span`
  white-space: pre-wrap;
  word-break: break-word;
`;

export let ProviderRunLogs = ({
  providerRunId,
  lazy = false
}: {
  providerRunId: string;
  lazy?: boolean;
}) => {
  let ref = useRef<HTMLDivElement>(null);
  let inView = useInView(ref, {});
  let [canFetch, setCanFetch] = useState(!lazy);

  useEffect(() => {
    if (inView) setCanFetch(true);
  }, [inView]);

  let instance = useCurrentInstance();
  let logs = useProviderRunLogs(
    canFetch ? instance.data?.id : undefined,
    canFetch ? providerRunId : undefined
  );
  let bodyRef = useRef<HTMLDivElement>(null);
  let prevCountRef = useRef(0);

  useEffect(() => {
    let count = logs.data?.logs?.length ?? 0;
    if (count > prevCountRef.current && bodyRef.current) {
      bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    }
    prevCountRef.current = count;
  }, [logs.data?.logs?.length]);

  let logItems = logs.data?.logs ?? [];

  // When used inline (lazy), don't render anything if there are no logs
  if (lazy && canFetch && !logs.isLoading && logItems.length === 0) {
    return <div ref={ref} />;
  }

  return (
    <div ref={ref}>
      {!canFetch ? null : logItems.length === 0 && logs.isLoading ? (
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
          <CenteredSpinner size={16} />
        </div>
      ) : logItems.length > 0 ? (
        <Wrapper>
          <Header>
            <span>
              <RiTerminalLine size={14} />
              Output
            </span>
            <span>{logItems.length} lines</span>
          </Header>
          <Body ref={bodyRef}>
            {logItems.map((log, i) => (
              <Line key={i} $type={log.outputType}>
                <Ts>{log.timestamp?.toLocaleTimeString() ?? '--:--:--'}</Ts>
                <Message>{log.message}</Message>
              </Line>
            ))}
          </Body>
          <link rel="stylesheet" href="https://fonts.metorial.com/jetbrains-mono.css" />
        </Wrapper>
      ) : (
        <Wrapper>
          <Header>
            <span>
              <RiTerminalLine size={14} />
              Output
            </span>
            <span>0 lines</span>
          </Header>
          <Body>
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <Text size="1" style={{ color: '#666' }}>
                No output logs available for this run.
              </Text>
            </div>
          </Body>
        </Wrapper>
      )}
    </div>
  );
};
