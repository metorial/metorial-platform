import { SessionsEventsGetOutput } from '@metorial/core';
import { Fragment } from 'react/jsx-runtime';
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

  span[data-type='stdout'] {
    color: #aaa;
  }

  span[data-type='stderr'] {
    color: white;
  }
`;

export let Logs = ({ event }: { event: SessionsEventsGetOutput }) => {
  return (
    <Wrapper>
      <Header>
        <p>Output</p>
      </Header>

      <Main>
        <Pre>
          {event.logLines.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              <span data-type={line.type}>{line.line}</span>
            </Fragment>
          ))}
        </Pre>
      </Main>
    </Wrapper>
  );
};
