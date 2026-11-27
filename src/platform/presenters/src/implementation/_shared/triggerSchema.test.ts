import { describe, expect, it } from 'vitest';
import { presentTriggerSchema } from './triggerSchema';

describe('presentTriggerSchema', () => {
  it('drops provider extension keys at every depth and keeps platform markers, field names and data', () => {
    let schema = {
      type: 'object',
      required: ['fileId'],
      'x-root': true,
      properties: {
        fileId: {
          type: 'string',
          description: 'The file',
          'x-slates-event-attribute': true,
          'x-metorial-event-attribute': true
        },
        folderId: {
          type: 'string',
          'x-slates-options-linked': { slate: '@google/drive', optionList: 'folders' },
          'x-metorial-options': true
        },
        tags: { type: 'array', items: { type: 'string', 'x-nested': 1 }, 'x-order': 2 },
        'x-named': { type: 'object', default: { 'x-data': 1 } },
        flag: true
      }
    };
    let copy = structuredClone(schema);

    expect(presentTriggerSchema(schema)).toEqual({
      type: 'object',
      required: ['fileId'],
      properties: {
        fileId: {
          type: 'string',
          description: 'The file',
          'x-metorial-event-attribute': true
        },
        folderId: { type: 'string', 'x-metorial-options': true },
        tags: { type: 'array', items: { type: 'string' } },
        'x-named': { type: 'object', default: { 'x-data': 1 } },
        flag: true
      }
    });
    expect(schema).toEqual(copy);
  });

  it('keeps schemas without object properties as they are', () => {
    expect(presentTriggerSchema({ type: 'object' })).toEqual({ type: 'object' });
    expect(presentTriggerSchema(null)).toBeNull();
  });
});
