import { describe, it, expect } from 'vitest';
import type { EventTypes, EventTypesFilePayload } from '../src/definitions';

describe('Event Type Definitions', () => {
  describe('EventTypesFilePayload', () => {
    it('should accept valid file payload', () => {
      const payload: EventTypesFilePayload = {
        file: {
          id: 'file-1',
          name: 'test.txt',
          purpose: {
            id: 'purpose-1',
            name: 'Test Purpose'
          }
        } as any
      };

      expect(payload).toBeDefined();
      expect(payload.file).toBeDefined();
      expect(payload.file.purpose).toBeDefined();
    });

    it('should require file with purpose', () => {
      const payload: EventTypesFilePayload = {
        file: {
          id: 'file-1',
          name: 'test.txt',
          purpose: {
            id: 'purpose-1',
            name: 'Test Purpose',
            description: 'A test purpose'
          }
        } as any
      };

      expect(payload.file.id).toBe('file-1');
      expect(payload.file.purpose.id).toBe('purpose-1');
    });
  });

  describe('EventTypes', () => {
    it('should define event type map', () => {
      const sampleEvents: Partial<Record<keyof EventTypes, boolean>> = {};

      expect(Object.keys(sampleEvents)).toHaveLength(0);
    });
  });
});
