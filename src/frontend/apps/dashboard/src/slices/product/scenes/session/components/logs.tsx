import { SessionsEventsGetOutput } from '@metorial/generated';
import { RenderDate } from '@metorial/ui';
import Ansi from 'ansi-to-react';
import styled from 'styled-components';

let Wrapper = styled.div`
  border-radius: 8px;
  background: black;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  /* margin-left: -15px;
  margin-right: -15px; */
`;

let Header = styled.header`
  padding: 10px 15px;
  color: white;
  border-bottom: 1px solid #444;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

let Main = styled.main`
  padding: 15px;
  overflow: auto;
  max-height: 400px;
`;

let Pre = styled.pre`
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 12px;
  padding: 0px;
  margin: 0px;

  code {
    background: transparent;
    line-height: 1.5;
    font-size: 12px;
    color: white;
  }
`;

export let Logs = ({ event }: { event: SessionsEventsGetOutput }) => {
  return (
    <Wrapper>
      <Header>
        <p>Output</p>

        <RenderDate date={event.createdAt} />
      </Header>

      <Main>
        <Pre>
          <Ansi>{event.logLines.map(l => l.line).join('\n')}</Ansi>

          {/* {event.logLines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                <span data-type={line.type}>{line.line}</span>
              </Fragment>
            ))} */}
        </Pre>
      </Main>
    </Wrapper>
  );
};
