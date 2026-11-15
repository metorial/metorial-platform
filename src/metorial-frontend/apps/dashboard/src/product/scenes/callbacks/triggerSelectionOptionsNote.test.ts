import { describe, expect, it } from 'vitest';
import { getSelectionOptionsNote } from './triggerSelectionOptionsNote';

let provider = {
  object: 'provider#preview' as const,
  id: 'pro_linked',
  name: 'Linked Files',
  description: null,
  slug: 'linked-files',
  createdAt: new Date(0),
  updatedAt: new Date(0)
};

let linkedProvider = (connectionStatus: 'connected' | 'not_connected') => ({
  object: 'callback.trigger_selection_linked_provider' as const,
  provider,
  connectionStatus
});

describe('selection options note', () => {
  it('shows nothing without a linked provider', () => {
    expect(getSelectionOptionsNote(undefined)).toBeNull();
    expect(getSelectionOptionsNote({ source: 'callback', linkedProvider: null })).toBeNull();
  });

  it('names the connection the list came through without claiming it is the viewer’s', () => {
    expect(
      getSelectionOptionsNote({
        source: 'linked_provider',
        linkedProvider: linkedProvider('connected')
      })
    ).toEqual({
      kind: 'listed_through',
      text: 'Listed through the Linked Files connection for this account.'
    });
  });

  it('offers to connect the linked provider when it is not connected', () => {
    let note = getSelectionOptionsNote({
      source: 'callback',
      linkedProvider: linkedProvider('not_connected')
    });

    expect(note).toEqual({
      kind: 'not_connected',
      provider,
      text: 'Only items this connection can open are listed.',
      linkLabel: 'Connect Linked Files',
      linkSuffix: ' with the same account to see all of them, or paste a value.'
    });
  });

  it('shows nothing when the own list was used although the linked provider is connected', () => {
    expect(
      getSelectionOptionsNote({
        source: 'callback',
        linkedProvider: linkedProvider('connected')
      })
    ).toBeNull();
  });
});
