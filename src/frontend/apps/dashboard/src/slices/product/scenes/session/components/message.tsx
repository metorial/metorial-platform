import { CodeBlock } from '@metorial/code';
import { DashboardInstanceSessionsMessagesGetOutput } from '@metorial/dashboard-sdk';
import { RenderDate, theme } from '@metorial/ui';
import styled from 'styled-components';
import { AggregatedMessages } from '../hooks/useAggregatedMessages';

let Output = styled.div`
  display: flex;

  &[data-position='server'] {
    justify-content: flex-end;
  }
`;

let Wrapper = styled.div`
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.08);
  border: 1px solid ${theme.colors.gray400};
  width: 80%;
`;

let Header = styled.header`
  padding: 10px 15px 10px 10px;
  border-bottom: 1px solid ${theme.colors.gray400};
  font-size: 12px;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

let HeaderSection = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

let ID = styled.span`
  height: 18px;
  min-width: 18px;
  border-radius: 3px;
  background: ${theme.colors.gray300};
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0px 3px;
`;

let Main = styled.main`
  padding: 15px;
  overflow: auto;
  max-height: 400px;
`;

let MessageGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let ErrorSection = styled.div`
  padding: 10px 15px;
  background: ${theme.colors.red100};
  border-top: 1px solid ${theme.colors.red300};
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

let ErrorRow = styled.div`
  display: flex;
  gap: 8px;
`;

let ErrorLabel = styled.span`
  font-weight: 600;
  color: ${theme.colors.red700};
  min-width: 60px;
  flex-shrink: 0;
`;

let ErrorValue = styled.span`
  color: ${theme.colors.red800};
  word-break: break-word;
`;

let shorten = (id: string | number, length = 15) => {
  let s = String(id);
  if (s.length <= length) return s;
  return `${s.substring(0, length)}...`;
};

let MessageCard = ({
  id,
  label,
  payload,
  date,
  position,
  error
}: {
  id?: string;
  label: string;
  payload: Record<string, any>;
  date: Date;
  position: string;
  error?: DashboardInstanceSessionsMessagesGetOutput['error'];
}) => (
  <Output data-position={position}>
    <Wrapper>
      <Header>
        <HeaderSection>
          {id && <ID>{shorten(id)}</ID>}
          <p>{label}</p>
        </HeaderSection>
        <RenderDate date={date} />
      </Header>

      <Main>
        <CodeBlock
          code={JSON.stringify(payload, null, 2)}
          language="json"
          lineNumbers={false}
          variant="seamless"
        />
      </Main>

      {error && (
        <ErrorSection>
          <ErrorRow>
            <ErrorLabel>Code</ErrorLabel>
            <ErrorValue>{error.code}</ErrorValue>
          </ErrorRow>
          <ErrorRow>
            <ErrorLabel>Message</ErrorLabel>
            <ErrorValue>{error.message}</ErrorValue>
          </ErrorRow>
          {error.data && Object.keys(error.data).length > 0 && (
            <ErrorRow>
              <ErrorLabel>Data</ErrorLabel>
              <ErrorValue>
                <CodeBlock
                  code={JSON.stringify(error.data, null, 2)}
                  language="json"
                  lineNumbers={false}
                  variant="seamless"
                />
              </ErrorValue>
            </ErrorRow>
          )}
        </ErrorSection>
      )}
    </Wrapper>
  </Output>
);

export let Message = ({
  message,
  aggregatedMessages
}: {
  message: DashboardInstanceSessionsMessagesGetOutput;
  aggregatedMessages: Map<string, AggregatedMessages>;
}) => {
  let transportMcp = message.transport?.mcp;
  if (!transportMcp) return null;

  let agg = aggregatedMessages.get(String(transportMcp.id));
  let input = message.input as Record<string, any> | null | undefined;
  let output = message.output as Record<string, any> | null | undefined;
  let payload = (input ?? output ?? {}) as Record<string, any>;
  let method =
    agg?.method ??
    (typeof payload.method === 'string' ? payload.method : (message.type ?? 'message'));
  let resolvedId = agg?.originalId ?? payload.id ?? transportMcp.id;

  // Message has both input and output — render as two separate cards
  if (input && output) {
    return (
      <MessageGroup>
        <MessageCard
          id={String(resolvedId)}
          label={method}
          payload={{ ...input, id: resolvedId }}
          date={message.createdAt}
          position={message.senderParticipant?.type ?? 'client'}
        />
        <MessageCard
          id={String(resolvedId)}
          label={`${method} (response)`}
          payload={{ ...output, id: resolvedId }}
          date={message.createdAt}
          position="server"
          error={message.error ?? undefined}
        />
      </MessageGroup>
    );
  }

  // Message has only input or only output
  let isResponse = !payload.method;

  return (
    <MessageCard
      id={agg?.originalId ? String(agg.originalId) : undefined}
      label={`${method}${isResponse ? ' (response)' : ''}`}
      payload={{ ...payload, id: resolvedId }}
      date={message.createdAt}
      position={isResponse ? 'server' : (message.senderParticipant?.type ?? 'server')}
      error={message.error ?? undefined}
    />
  );
};
