import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({}));

import {
  toPlatformSelectableTriggerGroups,
  toPlatformSelectionSchema,
  toPlatformTriggerOutputSchema
} from './schemaMarkers';

let linked = { slate: '@google/drive', optionList: 'spreadsheets', params: {} };

describe('toPlatformSelectionSchema', () => {
  it('marks fields with an own or a linked list as having options', () => {
    let schema = {
      type: 'object',
      required: ['spreadsheetId'],
      properties: {
        spreadsheetId: { type: 'string', 'x-slates-options': true },
        folderId: { type: 'string', 'x-slates-options-linked': linked },
        sheetId: {
          type: 'string',
          'x-slates-options': true,
          'x-slates-options-linked': linked
        },
        note: { type: 'string', description: 'Free text' }
      }
    };

    expect(toPlatformSelectionSchema(schema)).toEqual({
      type: 'object',
      required: ['spreadsheetId'],
      properties: {
        spreadsheetId: { type: 'string', 'x-metorial-options': true },
        folderId: { type: 'string', 'x-metorial-options': true },
        sheetId: { type: 'string', 'x-metorial-options': true },
        note: { type: 'string', description: 'Free text' }
      }
    });
  });

  it('drops disabled, malformed and unknown markers without marking the field', () => {
    expect(
      toPlatformSelectionSchema({
        properties: {
          a: { type: 'string', 'x-slates-options': false },
          b: { type: 'string', 'x-slates-options-linked': { slate: '@google/drive' } },
          c: { type: 'string', 'x-slates-options-linked': null },
          d: { type: 'string', 'x-slates-something-else': { secret: true } },
          e: { type: 'string', 'x-metorial-options': true }
        }
      })
    ).toEqual({
      properties: {
        a: { type: 'string' },
        b: { type: 'string' },
        c: { type: 'string' },
        d: { type: 'string' },
        e: { type: 'string' }
      }
    });
  });

  it('does not change the input', () => {
    let schema = { properties: { id: { type: 'string', 'x-slates-options': true } } };
    let copy = structuredClone(schema);

    toPlatformSelectionSchema(schema);

    expect(schema).toEqual(copy);
  });

  it('keeps schemas without object properties as they are', () => {
    expect(toPlatformSelectionSchema({ type: 'object' })).toEqual({ type: 'object' });
    expect(toPlatformSelectionSchema({ properties: { flag: true } })).toEqual({
      properties: { flag: true }
    });
    expect(toPlatformSelectionSchema(null)).toBeNull();
  });
});

describe('toPlatformTriggerOutputSchema', () => {
  it('renames the event attribute marker and drops other internal markers', () => {
    let schema = {
      type: 'object',
      properties: {
        fileId: { type: 'string', 'x-slates-event-attribute': true },
        mimeType: { type: 'string', 'x-slates-event-attribute': 'yes' },
        name: { type: 'string', 'x-slates-other': 1, 'x-metorial-event-attribute': true },
        parents: { type: 'array', items: { type: 'string' } }
      }
    };
    let copy = structuredClone(schema);

    expect(toPlatformTriggerOutputSchema(schema)).toEqual({
      type: 'object',
      properties: {
        fileId: { type: 'string', 'x-metorial-event-attribute': true },
        mimeType: { type: 'string' },
        name: { type: 'string' },
        parents: { type: 'array', items: { type: 'string' } }
      }
    });
    expect(schema).toEqual(copy);
  });

  it('keeps a missing schema missing', () => {
    expect(toPlatformTriggerOutputSchema(undefined)).toBeUndefined();
  });
});

describe('toPlatformSelectableTriggerGroups', () => {
  it('converts the selection schema of every group and keeps the rest', () => {
    expect(
      toPlatformSelectableTriggerGroups([
        {
          key: 'new_rows',
          name: 'New rows',
          description: null,
          status: 'active' as const,
          selectionSchema: {
            type: 'object',
            properties: { spreadsheetId: { 'x-slates-options-linked': linked } }
          }
        }
      ])
    ).toEqual([
      {
        key: 'new_rows',
        name: 'New rows',
        description: null,
        status: 'active',
        selectionSchema: {
          type: 'object',
          properties: { spreadsheetId: { 'x-metorial-options': true } }
        },
        linkedOptionProviders: { spreadsheetId: '@google/drive' }
      }
    ]);
    expect(toPlatformSelectableTriggerGroups(undefined)).toBeUndefined();
  });
});

describe('hub schema cleanup', () => {
  it('removes hub and platform-prefixed keys at every depth and ignores an incomplete linked marker', () => {
    let schema = {
      type: 'object',
      'x-slates-root': 1,
      properties: {
        folderIds: {
          type: 'array',
          'x-metorial-event-attribute': true,
          'x-slates-options-linked': { slate: 'incomplete' },
          items: { type: 'string', 'x-slates-options-linked': linked, 'x-order': 1 }
        }
      }
    };
    let copy = structuredClone(schema);

    expect(
      toPlatformSelectableTriggerGroups([{ key: 'folders', selectionSchema: schema }])
    ).toEqual([
      {
        key: 'folders',
        selectionSchema: {
          type: 'object',
          properties: { folderIds: { type: 'array', items: { type: 'string', 'x-order': 1 } } }
        },
        linkedOptionProviders: {}
      }
    ]);
    expect(schema).toEqual(copy);
  });
});
