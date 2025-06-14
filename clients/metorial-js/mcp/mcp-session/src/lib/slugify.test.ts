import { describe, expect, it } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  describe('basic functionality', () => {
    it('should convert simple text to lowercase slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should handle single words', () => {
      expect(slugify('Hello')).toBe('hello');
    });

    it('should preserve numbers', () => {
      expect(slugify('Test 123')).toBe('test-123');
    });

    it('should preserve underscores and hyphens', () => {
      expect(slugify('test_slug-already')).toBe('test_slug-already');
    });
  });

  describe('whitespace handling', () => {
    it('should replace multiple spaces with single hyphen', () => {
      expect(slugify('Multiple   Spaces   Here')).toBe('multiple-spaces-here');
    });

    it('should trim leading and trailing spaces', () => {
      expect(slugify('  Trimmed Spaces  ')).toBe('trimmed-spaces');
    });

    it('should handle tabs and newlines', () => {
      expect(slugify('Text\twith\ntabs')).toBe('text-with-tabs');
    });
  });

  describe('special character removal', () => {
    it('should remove special characters', () => {
      expect(slugify('Hello@#$%^&*()World')).toBe('helloworld');
    });

    it('should remove punctuation', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
    });

    it('should handle accented characters', () => {
      expect(slugify('Café & Résumé')).toBe('caf-rsum');
    });

    it('should remove emojis', () => {
      expect(slugify('Hello 👋 World 🌍')).toBe('hello-world');
    });
  });

  describe('hyphen normalization', () => {
    it('should replace multiple consecutive hyphens with single hyphen', () => {
      expect(slugify('test---multiple---hyphens')).toBe('test-multiple-hyphens');
    });

    it('should remove leading hyphens', () => {
      expect(slugify('---leading-hyphens')).toBe('leading-hyphens');
    });

    it('should remove trailing hyphens', () => {
      expect(slugify('trailing-hyphens---')).toBe('trailing-hyphens');
    });

    it('should handle combination of leading, trailing, and multiple hyphens', () => {
      expect(slugify('--test---slug--')).toBe('test-slug');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(slugify('')).toBe('');
    });

    it('should handle whitespace-only string', () => {
      expect(slugify('   ')).toBe('');
    });

    it('should handle string with only special characters', () => {
      expect(slugify('@#$%^&*()')).toBe('');
    });

    it('should handle string with only hyphens', () => {
      expect(slugify('-----')).toBe('');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000) + ' ' + 'b'.repeat(1000);
      const result = slugify(longString);
      expect(result).toBe('a'.repeat(1000) + '-' + 'b'.repeat(1000));
    });
  });

  describe('real-world examples', () => {
    it('should handle blog post titles', () => {
      expect(slugify('How to Build a React App in 2024')).toBe(
        'how-to-build-a-react-app-in-2024'
      );
    });

    it('should handle product names', () => {
      expect(slugify('iPhone 15 Pro Max (256GB)')).toBe('iphone-15-pro-max-256gb');
    });

    it('should handle article titles with quotes', () => {
      expect(slugify('"The Ultimate Guide" to Web Development')).toBe(
        'the-ultimate-guide-to-web-development'
      );
    });

    it('should handle names with apostrophes', () => {
      expect(slugify("O'Reilly's JavaScript Book")).toBe('oreillys-javascript-book');
    });

    it('should handle mixed case with numbers', () => {
      expect(slugify('API v2.5 Documentation')).toBe('api-v25-documentation');
    });
  });

  describe('consistency', () => {
    it('should produce identical results for identical inputs', () => {
      const input = 'Test String 123!';
      expect(slugify(input)).toBe(slugify(input));
    });

    it('should handle already slugified strings', () => {
      const slug = 'already-valid-slug';
      expect(slugify(slug)).toBe(slug);
    });
  });
});
