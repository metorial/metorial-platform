import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetorialMapper } from '../types';
import { arrayMapper } from './array';

describe('arrayMapper', () => {
  const mockMapper: MetorialMapper<number> = {
    transformFrom: vi.fn(input => input + 1),
    transformTo: vi.fn(input => input - 1)
  };

  const mapper = arrayMapper<number>(mockMapper);

  beforeEach(() => {
    (mockMapper.transformFrom as any).mockClear();
    (mockMapper.transformTo as any).mockClear();
  });

  describe('transformFrom', () => {
    it('returns input as-is if not an array', () => {
      expect(mapper.transformFrom('foo')).toBe('foo');
      expect(mapper.transformFrom(123)).toBe(123);
      expect(mapper.transformFrom({})).toEqual({});
    });

    it('returns input as-is if array is empty', () => {
      const arr: number[] = [];
      expect(mapper.transformFrom(arr)).toBe(arr);
    });

    it('maps each item using mapper.transformFrom', () => {
      const arr = [1, 2, 3];
      const result = mapper.transformFrom(arr);
      expect(result).toEqual([2, 3, 4]);
      expect(mockMapper.transformFrom).toHaveBeenCalledTimes(3);
      expect(mockMapper.transformFrom).toHaveBeenCalledWith(1);
      expect(mockMapper.transformFrom).toHaveBeenCalledWith(2);
      expect(mockMapper.transformFrom).toHaveBeenCalledWith(3);
    });
  });

  describe('transformTo', () => {
    it('returns input as-is if not an array', () => {
      expect(mapper.transformTo('foo')).toBe('foo');
      expect(mapper.transformTo(123)).toBe(123);
      expect(mapper.transformTo({})).toEqual({});
    });

    it('returns input as-is if array is empty', () => {
      const arr: number[] = [];
      expect(mapper.transformTo(arr)).toBe(arr);
    });

    it('maps each item using mapper.transformTo', () => {
      const arr = [2, 3, 4];
      const result = mapper.transformTo(arr);
      expect(result).toEqual([1, 2, 3]);
      expect(mockMapper.transformTo).toHaveBeenCalledTimes(3);
      expect(mockMapper.transformTo).toHaveBeenCalledWith(2);
      expect(mockMapper.transformTo).toHaveBeenCalledWith(3);
      expect(mockMapper.transformTo).toHaveBeenCalledWith(4);
    });
  });
});
