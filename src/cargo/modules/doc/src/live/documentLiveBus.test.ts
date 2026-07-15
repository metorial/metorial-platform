import { describe, expect, it } from 'vitest';
import {
  type DocumentLiveBusMessage,
  isDocumentLiveBusMessage,
  shouldDeliverBusMessage
} from './documentLiveBusProtocol';

describe('document live bus helpers', () => {
  let message: DocumentLiveBusMessage = {
    originInstanceId: 'cargo-a',
    originSessionId: 'session-a',
    documentId: 'doc_123',
    type: 'yjs_update',
    data: {
      update: 'AAAA'
    }
  };

  it('does not deliver messages from the same Cargo instance', () => {
    expect(shouldDeliverBusMessage(message, 'cargo-a')).toBe(false);
  });

  it('delivers messages from another Cargo instance', () => {
    expect(shouldDeliverBusMessage(message, 'cargo-b')).toBe(true);
  });

  it('delivers authoritative resets back to the originating instance', () => {
    expect(
      shouldDeliverBusMessage(
        {
          ...message,
          type: 'collaboration_reset',
          deliverToOriginInstance: true
        },
        'cargo-a'
      )
    ).toBe(true);
  });

  it('validates the expected live bus envelope shape', () => {
    expect(isDocumentLiveBusMessage(message)).toBe(true);
    expect(
      isDocumentLiveBusMessage({
        ...message,
        documentId: undefined
      })
    ).toBe(false);
  });
});
