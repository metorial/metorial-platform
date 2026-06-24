import { describe, expect, it } from 'vitest';
import { Service } from './index';

describe('Service', () => {
  it('keeps class prototype methods', async () => {
    class ExampleService {
      async getValue() {
        return 'ok';
      }
    }

    let service = Service.create('example', () => new ExampleService()).build();

    expect(service.getValue).toBeTypeOf('function');
    await expect(service.getValue()).resolves.toBe('ok');
  });

  it('keeps own methods from plain object services', async () => {
    let service = Service.create('plain-object', () => ({
      async get() {
        return 'get';
      },
      async list() {
        return ['list'];
      }
    })).build();

    expect(service.get).toBeTypeOf('function');
    expect(service.list).toBeTypeOf('function');
    await expect(service.get()).resolves.toBe('get');
    await expect(service.list()).resolves.toEqual(['list']);
  });
});
