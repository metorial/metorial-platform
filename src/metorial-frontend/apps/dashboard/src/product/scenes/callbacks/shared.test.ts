import { describe, expect, it } from 'vitest';
import {
  canRetryEventDelivery,
  decodeDeliveryBody,
  getEventDeliveryActionLabel,
  getEventDeliveryStatusColor,
  getEventDeliveryStatusLabel
} from './shared';

describe('event delivery presentation', () => {
  it('maps delivery statuses to stable labels and colors', () => {
    expect(getEventDeliveryStatusLabel('delivered')).toBe('Delivered');
    expect(getEventDeliveryStatusLabel('retrying')).toBe('Retrying');
    expect(getEventDeliveryStatusColor('delivered')).toBe('blue');
    expect(getEventDeliveryStatusColor('failed')).toBe('red');
    expect(getEventDeliveryStatusColor('retrying')).toBe('orange');
    expect(getEventDeliveryStatusColor('cancelled')).toBe('gray');
  });

  it('only offers retry or resend for terminal deliveries', () => {
    expect(canRetryEventDelivery('pending')).toBe(false);
    expect(canRetryEventDelivery('retrying')).toBe(false);
    expect(canRetryEventDelivery('failed')).toBe(true);
    expect(canRetryEventDelivery('cancelled')).toBe(true);
    expect(canRetryEventDelivery('delivered')).toBe(true);
    expect(getEventDeliveryActionLabel('delivered')).toBe('Resend Webhook');
    expect(getEventDeliveryActionLabel('failed')).toBe('Retry Delivery');
  });

  it('formats JSON bodies and preserves plain text bodies', () => {
    expect(decodeDeliveryBody('{"ok":true}')).toEqual({
      json: '{\n  "ok": true\n}',
      text: '{"ok":true}'
    });
    expect(decodeDeliveryBody('plain text')).toEqual({
      json: null,
      text: 'plain text'
    });
    expect(decodeDeliveryBody(null)).toBeNull();
  });
});
