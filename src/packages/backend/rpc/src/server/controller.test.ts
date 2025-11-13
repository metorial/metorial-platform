import { v } from '@metorial/validation';
import { describe, expect, test } from 'vitest';
import { Group } from './controller';

describe('controller', () => {
  test('should create group', () => {
    let group = new Group();
    expect(group).toBeDefined();
  });

  test('should register middleware', async () => {
    let group = new Group();

    let group1 = group.use(async ctx => {
      expect(typeof ctx).toBe('object');
      expect(ctx.body).toBe('body');

      return {
        test: 'test' as const
      };
    });

    let group2 = group1.use(async ctx => {
      expect(ctx.test).toBe('test');

      return {
        hello: 'world' as const
      };
    });

    let handler = group2.handler().do(async ctx => {
      expect(ctx.hello).toBe('world');
      expect(ctx.test).toBe('test');

      return ctx;
    });

    expect(
      await handler.run(
        {
          body: 'body',
          query: new URLSearchParams(),
          headers: new Headers(),
          rawBody: '',
          sharedMiddlewareMemo: new Map(),
          beforeSend: () => {},
          appendHeaders: () => {},
          url: ''
        } as any,
        {}
      )
    ).toEqual({
      response: {
        hello: 'world',
        test: 'test',
        input: 'body',
        query: new URLSearchParams(),
        headers: new Headers(),
        rawBody: '',
        sharedMiddlewareMemo: new Map(),
        appendHeaders: expect.any(Function),
        beforeSend: expect.any(Function),
        body: undefined,
        url: ''
      }
    });
  });

  test('should register handler middleware', async () => {
    let group = new Group().use(async ctx => {
      expect(typeof ctx).toBe('object');
      expect(ctx.body).toBe('body');

      return {
        test: 'test' as const
      };
    });

    let handler = group
      .handler()
      .use(async ctx => {
        expect(ctx.test).toBe('test');

        return {
          hello: 'world' as const
        };
      })
      .do(async ctx => {
        expect(ctx.hello).toBe('world');
        expect(ctx.test).toBe('test');

        return ctx;
      });

    expect(
      await handler.run(
        {
          body: 'body',
          query: new URLSearchParams(),
          headers: new Headers(),
          rawBody: '',
          sharedMiddlewareMemo: new Map(),
          beforeSend: () => {},
          appendHeaders: () => {},
          url: ''
        } as any,
        {}
      )
    ).toMatchObject({
      response: {
        hello: 'world',
        test: 'test',
        input: 'body',
        query: new URLSearchParams(),
        headers: new Headers(),
        rawBody: '',
        sharedMiddlewareMemo: new Map(),
        appendHeaders: expect.any(Function),
        beforeSend: expect.any(Function),
        body: undefined,
        url: ''
      }
    });
  });

  test('should run validation', async () => {
    let group = new Group().use(async ctx => {
      expect(typeof ctx).toBe('object');
      expect(ctx.body).toEqual({ hello: 'world' });

      return {
        test: 'test' as const
      };
    });

    let handler = group
      .handler()
      .input(
        v.object({
          hello: v.string()
        })
      )
      .do(async ctx => {
        expect(ctx.test).toBe('test');
        expect(ctx.input).toEqual({ hello: 'world' });

        return ctx;
      });

    expect(
      await handler.run(
        {
          query: new URLSearchParams(),
          headers: new Headers(),
          rawBody: '',
          sharedMiddlewareMemo: new Map(),
          beforeSend: () => {},
          appendHeaders: () => {},
          url: '',
          body: { hello: 'world', other: false }
        } as any,
        {}
      )
    ).toEqual({
      response: {
        test: 'test',
        input: { hello: 'world' },
        query: new URLSearchParams(),
        headers: new Headers(),
        rawBody: '',
        sharedMiddlewareMemo: new Map(),
        appendHeaders: expect.any(Function),
        beforeSend: expect.any(Function),
        body: undefined,
        url: ''
      }
    });

    try {
      await handler.run(
        {
          query: new URLSearchParams(),
          headers: new Headers(),
          rawBody: '',
          sharedMiddlewareMemo: new Map(),
          beforeSend: () => {},
          appendHeaders: () => {},
          url: '',
          body: { hello: 42 }
        } as any,
        {}
      );
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('should group handlers to controller', async () => {
    let group = new Group();

    let controller = group.controller({
      first: group
        .handler()
        .input(
          v.object({
            hello: v.string()
          })
        )
        .do(async ctx => {
          return ctx;
        }),

      second: group.handler().do(async ctx => {
        return { cool: true };
      }),

      sub: group.controller({
        third: group
          .handler()
          .input(
            v.object({
              hello: v.string()
            })
          )
          .do(async ctx => {
            return { sub: true };
          })
      })
    });

    expect(
      await controller.sub.third.run(
        {
          query: new URLSearchParams(),
          headers: new Headers(),
          rawBody: '',
          sharedMiddlewareMemo: new Map(),
          beforeSend: () => {},
          appendHeaders: () => {},
          url: '',
          body: { hello: 'world' }
        } as any,
        {}
      )
    ).toEqual({
      response: {
        sub: true
      }
    });
  });
});
