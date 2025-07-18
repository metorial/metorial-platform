import { CodeBlock } from '@metorial/code';
import { SessionsMessagesGetOutput } from '@metorial/generated';
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

// let Code = styled.pre`
//   color: ${theme.colors.gray800};
//   font-size: 12px;

//   white-space: pre-wrap;
//   word-wrap: break-word;
//   word-break: break-word;
//   overflow-wrap: break-word;
// `;

let shorten = (id: string, length = 15) => {
  if (id.length <= length) return id;
  return `${id.substring(0, length)}...`;
};

export let Message = ({
  message,
  aggregatedMessages
}: {
  message: SessionsMessagesGetOutput;
  aggregatedMessages: Map<string, AggregatedMessages>;
}) => {
  let agg = aggregatedMessages.get(message.mcpMessage.id);
  let isResponse = !message.mcpMessage.method;

  return (
    <Output data-position={message.sender.type}>
      <Wrapper>
        <Header>
          <HeaderSection>
            {agg?.originalId && <ID>{shorten(agg?.originalId)}</ID>}
            <p>
              {agg?.method} {isResponse && '(response)'}
            </p>
          </HeaderSection>

          <RenderDate date={message.createdAt} />
        </Header>

        <Main>
          <CodeBlock
            code={JSON.stringify(
              {
                ...message.mcpMessage.payload,
                id: agg?.originalId
              },
              null,
              2
            )}
            language="json"
            lineNumbers={false}
            variant="seamless"
          />
        </Main>
      </Wrapper>
    </Output>
  );
};
