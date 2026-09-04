import { describe, expect, it } from 'vitest';
import { getRetentionPolicy } from './retention';

describe('getRetentionPolicy', () => {
  it('fails safe to full for an unrecognized or missing level', () => {
    expect(getRetentionPolicy({ dataRetentionLevel: undefined } as any).level).toBe('full');
    expect(getRetentionPolicy({ dataRetentionLevel: 'nonsense' } as any).level).toBe('full');
    expect(getRetentionPolicy({ dataRetentionLevel: undefined } as any).storeContent).toBe(
      true
    );
  });

  it('forces attachments off under none, whatever the toggle says', () => {
    expect(
      getRetentionPolicy({
        dataRetentionLevel: 'none',
        storeToolCallAttachments: true,
        collectErrors: true
      }).storeToolCallAttachments
    ).toBe(false);
  });

  it('honors the attachment toggle at full and intent_only', () => {
    expect(
      getRetentionPolicy({
        dataRetentionLevel: 'intent_only',
        storeToolCallAttachments: false,
        collectErrors: true
      }).storeToolCallAttachments
    ).toBe(false);

    expect(
      getRetentionPolicy({
        dataRetentionLevel: 'intent_only',
        storeToolCallAttachments: true,
        collectErrors: true
      }).storeToolCallAttachments
    ).toBe(true);
  });

  it('forces error collection on at full, whatever the toggle says', () => {
    expect(
      getRetentionPolicy({
        dataRetentionLevel: 'full',
        storeToolCallAttachments: true,
        collectErrors: false
      }).collectErrors
    ).toBe(true);
  });

  it('honors the error collection toggle below full', () => {
    expect(
      getRetentionPolicy({
        dataRetentionLevel: 'intent_only',
        storeToolCallAttachments: true,
        collectErrors: false
      }).collectErrors
    ).toBe(false);

    expect(
      getRetentionPolicy({
        dataRetentionLevel: 'none',
        storeToolCallAttachments: true,
        collectErrors: true
      }).collectErrors
    ).toBe(true);
  });

  it('fails safe to collecting errors when the stored setting is missing', () => {
    expect(
      getRetentionPolicy({
        dataRetentionLevel: 'none',
        storeToolCallAttachments: true,
        collectErrors: undefined as any
      }).collectErrors
    ).toBe(true);
  });
});
