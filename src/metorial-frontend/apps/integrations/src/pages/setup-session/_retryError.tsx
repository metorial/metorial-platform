import { Button, Error } from '@metorial/ui';
import styled from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 0;
`;

export let RetryError = ({ message }: { message: string }) => (
  <Wrapper>
    <Error>{message}</Error>

    <Button variant="outline" size="2" onClick={() => window.location.reload()}>
      Try Again
    </Button>
  </Wrapper>
);
