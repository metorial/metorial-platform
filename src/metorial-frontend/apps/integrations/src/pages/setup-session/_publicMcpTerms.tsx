import { Text } from '@metorial/ui';
import styled from 'styled-components';

let Wrapper = styled.div`
  a {
    color: inherit;
    text-decoration: underline;
  }
`;

export let PublicMcpTerms = () => (
  <Wrapper>
    <Text size="1" color="gray600">
      By continuing, you agree to Metorial&apos;s{' '}
      <a
        href="https://metorial.com/legal/terms-of-service"
        target="_blank"
        rel="noopener noreferrer"
      >
        terms of service
      </a>{' '}
      and{' '}
      <a
        href="https://metorial.com/legal/privacy-policy"
        target="_blank"
        rel="noopener noreferrer"
      >
        privacy policy
      </a>
      .
    </Text>
  </Wrapper>
);
