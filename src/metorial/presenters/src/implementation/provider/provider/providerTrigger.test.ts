import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({}));

import { v1ProviderTriggerPresenter } from './providerTrigger';

let outputJsonSchema = {
  type: 'object',
  required: ['fileId'],
  properties: {
    fileId: { type: 'string', 'x-slates-event-attribute': true },
    mimeType: { type: 'string', 'x-metorial-event-attribute': true },
    name: { type: 'string', description: 'File name' }
  }
};

let rawTrigger = {
  id: 'ptr_1',
  key: 'file_changed',
  name: 'File changed',
  description: null,
  value: {
    inputJsonSchema: {
      type: 'object',
      properties: { folderId: { type: 'string', 'x-slates-options': true } }
    },
    outputJsonSchema,
    invocation: { type: 'polling', intervalSeconds: 60 }
  },
  provider: { id: 'pro_1' },
  specification: { id: 'psp_1' },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
} as any;

let present = (trigger: any) =>
  v1ProviderTriggerPresenter
    .present(
      { trigger },
      { apiVersion: 'mt_2026_01_01_magnetar', accessType: 'user_auth_token' }
    )
    .run();

describe('provider trigger presentation', () => {
  it.each([
    ['a stored trigger', rawTrigger],
    [
      'an already presented trigger',
      {
        id: 'ptr_1',
        key: 'file_changed',
        name: 'File changed',
        description: null,
        inputJsonSchema: rawTrigger.value.inputJsonSchema,
        outputJsonSchema,
        invocation: { type: 'polling', intervalSeconds: 60 },
        providerId: 'pro_1',
        specificationId: 'psp_1',
        createdAt: rawTrigger.createdAt,
        updatedAt: rawTrigger.updatedAt
      }
    ]
  ])('presents the schemas of %s with platform markers only', async (_, trigger) => {
    let presented = await present(trigger);

    expect(presented.input_schema).toEqual({
      type: 'json_schema',
      schema: { type: 'object', properties: { folderId: { type: 'string' } } }
    });
    expect(presented.output_schema).toEqual({
      type: 'json_schema',
      schema: {
        type: 'object',
        required: ['fileId'],
        properties: {
          fileId: { type: 'string' },
          mimeType: { type: 'string', 'x-metorial-event-attribute': true },
          name: { type: 'string', description: 'File name' }
        }
      }
    });
  });
});
