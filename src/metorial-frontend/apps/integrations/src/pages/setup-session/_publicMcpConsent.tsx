import { checkEdition } from '@metorial/editions';
import { Callout, theme } from '@metorial/ui';
import styled from 'styled-components';
import type { PublicMcpContext } from '../../state/types';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
`;

let Text = styled.p`
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.gray700};
`;

export let PublicMcpConsent = ({ publicMcp }: { publicMcp: PublicMcpContext }) => (
  <Wrapper>
    <Text>
      <strong>{publicMcp.clientName}</strong> wants to connect to{' '}
      <strong>{publicMcp.serverName}</strong>. Your credentials are protected by{' '}
      {checkEdition('cloud') ? (
        <a
          href="https://www.metorial.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'unset', textDecoration: 'underline' }}
        >
          Metorial
        </a>
      ) : (
        'Metorial'
      )}
      .
    </Text>

    {!publicMcp.isClientVerified && (
      <Callout color="orange">
        You'll be sent to <strong>{publicMcp.redirectHost}</strong> afterwards. Only continue
        if you trust it.
      </Callout>
    )}
  </Wrapper>
);
