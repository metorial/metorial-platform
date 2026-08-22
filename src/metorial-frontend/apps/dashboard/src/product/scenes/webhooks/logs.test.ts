import { describe, expect, it } from 'vitest';
import {
  getCallbackFilterItems,
  getWebhookDestinationDisplay,
  getWebhookSourceDisplay
} from './webhookDisplay';

let callbacks = [
  { id: 'cbk_active', name: 'Active callback', status: 'active' as const },
  { id: 'cbk_archived', name: 'Archived callback', status: 'archived' as const }
];

describe('webhook log labels', () => {
  it('resolves active and archived callback sources without dropping history', () => {
    expect(
      getWebhookSourceDisplay({ type: 'callback', callbackId: 'cbk_active' }, callbacks)
    ).toEqual({ label: 'Active callback', archived: false });
    expect(
      getWebhookSourceDisplay({ type: 'callback', callbackId: 'cbk_archived' }, callbacks)
    ).toEqual({ label: 'Archived callback', archived: true });
  });

  it('keeps archived callbacks visible but disabled in filters', () => {
    expect(getCallbackFilterItems(callbacks)).toEqual([
      { id: 'all', label: 'All callbacks' },
      { id: 'cbk_active', label: 'Active callback', disabled: false },
      {
        id: 'cbk_archived',
        label: 'Archived callback (archived)',
        disabled: true
      }
    ]);
  });

  it('renders an unrecognized future source variant neutrally', () => {
    expect(getWebhookSourceDisplay({ type: 'schedule' }, callbacks)).toEqual({
      label: 'schedule source',
      archived: false
    });
  });

  it('renders a nullable delivery destination neutrally', () => {
    expect(getWebhookDestinationDisplay(null)).toEqual({
      name: 'Unknown destination',
      description: 'The destination is no longer available.'
    });
  });
});
