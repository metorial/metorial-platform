import { describe, expect, it } from 'vitest';
import { McpUriTemplate } from './mcpUri';

describe('McpUriTemplate', () => {
  describe('parseTemplate and getKeys', () => {
    it('should extract keys from template', () => {
      const tpl = new McpUriTemplate('/foo/{bar}/baz/{/qux*}');
      expect(tpl.getKeys()).toEqual(['bar', 'qux']);
    });

    it('should handle templates with no variables', () => {
      const tpl = new McpUriTemplate('/static/path');
      expect(tpl.getKeys()).toEqual([]);
    });

    it('should handle templates with only one variable', () => {
      const tpl = new McpUriTemplate('/foo/{bar}');
      expect(tpl.getKeys()).toEqual(['bar']);
    });

    it('should handle templates with explode modifier', () => {
      const tpl = new McpUriTemplate('/foo/{bar*}');
      expect(tpl.getKeys()).toEqual(['bar']);
    });

    it('should handle templates with optional modifier', () => {
      const tpl = new McpUriTemplate('/foo/{/bar}');
      expect(tpl.getKeys()).toEqual(['bar']);
    });
  });

  describe('expand', () => {
    it('should expand simple template', () => {
      const tpl = new McpUriTemplate('/foo/{bar}/baz');
      expect(tpl.expand({ bar: 'abc' })).toBe('/foo/abc/baz');
    });

    it('should encode values', () => {
      const tpl = new McpUriTemplate('/foo/{bar}');
      expect(tpl.expand({ bar: 'a b/c' })).toBe('/foo/a%20b%2Fc');
    });

    it('should expand with array and explode', () => {
      const tpl = new McpUriTemplate('/foo/{bar*}/baz');
      expect(tpl.expand({ bar: ['a', 'b', 'c'] })).toBe('/foo/a/b/c/baz');
    });

    it('should expand with array and optional', () => {
      const tpl = new McpUriTemplate('/foo{/bar*}');
      expect(tpl.expand({ bar: ['x', 'y'] })).toBe('/foo/x/y');
    });

    it('should expand with optional and missing value', () => {
      const tpl = new McpUriTemplate('/foo{/bar}');
      expect(tpl.expand({})).toBe('/foo');
    });

    it('should throw if required value is missing', () => {
      const tpl = new McpUriTemplate('/foo/{bar}');
      expect(() => tpl.expand({})).toThrow('Missing value for required key: bar');
    });

    it('should expand multiple variables', () => {
      const tpl = new McpUriTemplate('/{foo}/{bar}');
      expect(tpl.expand({ foo: 'a', bar: 'b' })).toBe('/a/b');
    });

    it('should expand with trailing static text', () => {
      const tpl = new McpUriTemplate('/foo/{bar}baz');
      expect(tpl.expand({ bar: 'x' })).toBe('/foo/xbaz');
    });

    it('should expand with multiple optional variables', () => {
      const tpl = new McpUriTemplate('/foo{/bar}{/baz}');
      expect(tpl.expand({ bar: 'x', baz: 'y' })).toBe('/foo/x/y');
      expect(tpl.expand({ bar: 'x' })).toBe('/foo/x');
      expect(tpl.expand({})).toBe('/foo');
    });

    it('should handle array with one element', () => {
      const tpl = new McpUriTemplate('/foo/{bar*}');
      expect(tpl.expand({ bar: ['only'] })).toBe('/foo/only');
    });

    it('should handle empty array for optional explode', () => {
      const tpl = new McpUriTemplate('/foo{/bar*}');
      expect(tpl.expand({ bar: [] })).toBe('/foo/');
    });

    it('should throw for null value for required key', () => {
      const tpl = new McpUriTemplate('/foo/{bar}');
      expect(() => tpl.expand({ bar: null as any })).toThrow(
        'Missing value for required key: bar'
      );
    });

    it('should skip optional variable if value is null or undefined', () => {
      const tpl = new McpUriTemplate('/foo{/bar}');
      expect(tpl.expand({ bar: null as any })).toBe('/foo');
      expect(tpl.expand({ bar: undefined as any })).toBe('/foo');
    });
  });
});
