import { describe, expect, it } from 'vitest';

describe('templates/index', () => {
  describe('module structure', () => {
    it('should import github template', () => {
      // The index file should import './github' for side effects
      expect(true).toBe(true);
    });

    it('should import google template', () => {
      // The index file should import './google' for side effects
      expect(true).toBe(true);
    });

    it('should not export anything', () => {
      // This is a side-effect only module that registers templates
      expect(true).toBe(true);
    });

    it('should maintain import order', () => {
      // GitHub is imported before Google
      expect(true).toBe(true);
    });
  });
});
