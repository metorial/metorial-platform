import { CenteredSpinner, Text } from '@metorial/ui';
import { RiTerminalLine } from '@remixicon/react';
import { useMemo } from 'react';
import styled from 'styled-components';

let Wrapper = styled.div`
  border-radius: 8px;
  border: 1px solid #2a2a2a;
  background: #1a1a1a;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
`;

let Header = styled.header`
  padding: 10px 14px;
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

let Line = styled.div<{ $type?: string | null }>`
  display: grid;
  grid-template-columns: 80px 1fr;
  padding: 2px 14px;
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

let EmptyState = styled.div`
  padding: 24px 16px;
  text-align: center;
`;

export interface RunLogEntry {
  timestamp: Date | string;
  message: string;
  outputType?: string | null;
}

export let RunLogs = ({
  logs,
  isLoading = false,
  title = 'Output',
  emptyText = 'No output logs available.',
  hideWhenEmpty = false,
  bodyRef
}: {
  logs: RunLogEntry[];
  isLoading?: boolean;
  title?: string;
  emptyText?: string;
  hideWhenEmpty?: boolean;
  bodyRef?: React.Ref<HTMLDivElement>;
}) => {
  let normalized = useMemo(
    () =>
      logs.map(log => ({
        ...log,
        timestamp: log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp)
      })),
    [logs]
  );

  if (isLoading && normalized.length === 0) {
    return (
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
        <CenteredSpinner size={16} />
      </div>
    );
  }

  if (hideWhenEmpty && normalized.length === 0) return null;

  return (
    <Wrapper>
      <Header>
        <span>
          <RiTerminalLine size={14} />
          {title}
        </span>
        <span>
          {normalized.length} {normalized.length === 1 ? 'line' : 'lines'}
        </span>
      </Header>
      <Body ref={bodyRef}>
        {normalized.length === 0 ? (
          <EmptyState>
            <Text size="1" style={{ color: '#666' }}>
              {emptyText}
            </Text>
          </EmptyState>
        ) : (
          normalized.map((log, i) => (
            <Line key={i} $type={log.outputType}>
              <Ts>{log.timestamp.toLocaleTimeString()}</Ts>
              <Message>{log.message}</Message>
            </Line>
          ))
        )}
      </Body>
      <link rel="stylesheet" href="https://fonts.metorial.com/jetbrains-mono.css" />
    </Wrapper>
  );
};
