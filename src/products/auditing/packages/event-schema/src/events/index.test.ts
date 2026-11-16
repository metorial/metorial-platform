import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/presenters', () => ({
  chatEventPresenter: {},
  organizationPresenter: {}
}));

import { chatEvents, webhookEvents } from '.';

describe('webhookEvents', () => {
  it('declares a description for every event type', () => {
    for (let definition of Object.values(webhookEvents)) {
      expect(definition.description).toEqual(expect.any(String));
      expect(definition.description.length).toBeGreaterThan(0);
    }
  });

  it('only exposes system events', () => {
    expect(Object.keys(webhookEvents)).toContain('organization.created');
    expect(Object.keys(webhookEvents)).not.toContain('chat.message.received');
  });
});

describe('chatEvents', () => {
  it('retains chat events in their own catalog', () => {
    expect(Object.keys(chatEvents)).toContain('chat.message.received');
  });
});
