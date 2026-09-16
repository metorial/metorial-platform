import { describe, expect, it, vi } from 'vitest';

vi.mock('./attempt', () => ({ attemptDeliveryQueue: { addManyWithOps: vi.fn() } }));
vi.mock('@metorial/db', () => ({ db: {}, ID: {}, withTransaction: vi.fn() }));
vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(),
    addMany: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn(() => ({}))
  })),
  QueueRetryError: class extends Error {}
}));

let { matchesListener } = await import('./dispatch');

let event = (overrides: Record<string, any> = {}) =>
  ({
    source: 'resource',
    eventType: 'organization.created',
    callbackId: null,
    callbackTriggerKey: null,
    chatConnectionId: null,
    providerId: null,
    ...overrides
  }) as any;

let listener = (overrides: Record<string, any> = {}) =>
  ({
    type: 'event',
    eventTypes: [],
    triggers: [],
    callbackId: null,
    chatConnectionId: null,
    providerId: null,
    eventDestination: { status: 'active' },
    ...overrides
  }) as any;

describe('matchesListener', () => {
  it('skips an archived destination', () => {
    expect(
      matchesListener(
        event(),
        listener({
          eventTypes: ['organization.created'],
          eventDestination: { status: 'archived' }
        })
      )
    ).toBe(false);
  });

  describe('resource events', () => {
    it('matches a listener subscribed to the event type', () => {
      expect(
        matchesListener(event(), listener({ eventTypes: ['organization.created'] }))
      ).toBe(true);
    });

    it('does not match a listener subscribed to other event types', () => {
      expect(matchesListener(event(), listener({ eventTypes: ['session.created'] }))).toBe(
        false
      );
    });

    it('does not match a listener with no event types', () => {
      expect(matchesListener(event(), listener())).toBe(false);
    });

    it('does not match a callback or chat listener', () => {
      expect(
        matchesListener(
          event(),
          listener({ type: 'callback', callbackId: 'clb_1', triggers: [] })
        )
      ).toBe(false);
      expect(
        matchesListener(
          event(),
          listener({ type: 'chat', eventTypes: ['organization.created'] })
        )
      ).toBe(false);
    });
  });

  describe('callback events', () => {
    let callbackEvent = event({
      source: 'callback',
      eventType: 'callback.issue.created',
      callbackId: 'clb_1',
      callbackTriggerKey: 'issue.created'
    });

    it('matches every trigger when no trigger filter is set', () => {
      expect(
        matchesListener(
          callbackEvent,
          listener({ type: 'callback', callbackId: 'clb_1', triggers: [] })
        )
      ).toBe(true);
    });

    it('matches a listed trigger', () => {
      expect(
        matchesListener(
          callbackEvent,
          listener({ type: 'callback', callbackId: 'clb_1', triggers: ['issue.created'] })
        )
      ).toBe(true);
    });

    it('does not match an unlisted trigger', () => {
      expect(
        matchesListener(
          callbackEvent,
          listener({ type: 'callback', callbackId: 'clb_1', triggers: ['issue.closed'] })
        )
      ).toBe(false);
    });

    it('does not match another callback', () => {
      expect(
        matchesListener(
          callbackEvent,
          listener({ type: 'callback', callbackId: 'clb_2', triggers: [] })
        )
      ).toBe(false);
    });

    it('matches a provider-tier listener when the event carries that provider', () => {
      expect(
        matchesListener(
          event({
            source: 'callback',
            eventType: 'callback.issue.created',
            callbackId: 'clb_1',
            callbackTriggerKey: 'issue.created',
            providerId: 'prov_1'
          }),
          listener({ type: 'callback', providerId: 'prov_1', triggers: [] })
        )
      ).toBe(true);
    });

    it('does not match a provider-tier listener for another provider', () => {
      expect(
        matchesListener(
          event({
            source: 'callback',
            eventType: 'callback.issue.created',
            callbackId: 'clb_1',
            callbackTriggerKey: 'issue.created',
            providerId: 'prov_1'
          }),
          listener({ type: 'callback', providerId: 'prov_2', triggers: [] })
        )
      ).toBe(false);
    });

    it('never matches a provider-tier listener when the event has no resolvable provider', () => {
      expect(
        matchesListener(
          callbackEvent,
          listener({ type: 'callback', providerId: 'prov_1', triggers: [] })
        )
      ).toBe(false);
    });

    it('matches a pure ALL-tier listener regardless of callback or provider', () => {
      expect(
        matchesListener(callbackEvent, listener({ type: 'callback', triggers: [] }))
      ).toBe(true);
    });
  });

  describe('chat events', () => {
    let chatEvent = event({
      source: 'chat',
      eventType: 'chat.message.received',
      chatConnectionId: 'chi_1'
    });

    it('matches the right connection and event type', () => {
      expect(
        matchesListener(
          chatEvent,
          listener({
            type: 'chat',
            chatConnectionId: 'chi_1',
            eventTypes: ['chat.message.received']
          })
        )
      ).toBe(true);
    });

    it('does not match another connection', () => {
      expect(
        matchesListener(
          chatEvent,
          listener({
            type: 'chat',
            chatConnectionId: 'chi_2',
            eventTypes: ['chat.message.received']
          })
        )
      ).toBe(false);
    });

    it('does not match an unsubscribed event type', () => {
      expect(
        matchesListener(
          chatEvent,
          listener({
            type: 'chat',
            chatConnectionId: 'chi_1',
            eventTypes: ['chat.member.joined']
          })
        )
      ).toBe(false);
    });

    it('matches a provider-tier listener when the event carries that provider', () => {
      expect(
        matchesListener(
          event({
            source: 'chat',
            eventType: 'chat.message.received',
            chatConnectionId: 'chi_1',
            providerId: 'prov_1'
          }),
          listener({
            type: 'chat',
            providerId: 'prov_1',
            eventTypes: ['chat.message.received']
          })
        )
      ).toBe(true);
    });

    it('does not match a provider-tier listener for another provider', () => {
      expect(
        matchesListener(
          event({
            source: 'chat',
            eventType: 'chat.message.received',
            chatConnectionId: 'chi_1',
            providerId: 'prov_1'
          }),
          listener({
            type: 'chat',
            providerId: 'prov_2',
            eventTypes: ['chat.message.received']
          })
        )
      ).toBe(false);
    });

    it('never matches a provider-tier listener when the event has no resolvable provider', () => {
      expect(
        matchesListener(
          chatEvent,
          listener({
            type: 'chat',
            providerId: 'prov_1',
            eventTypes: ['chat.message.received']
          })
        )
      ).toBe(false);
    });

    it('matches a pure ALL-tier listener regardless of connection or provider', () => {
      expect(
        matchesListener(
          chatEvent,
          listener({ type: 'chat', eventTypes: ['chat.message.received'] })
        )
      ).toBe(true);
    });
  });
});
