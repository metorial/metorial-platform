import { describe, expect, test } from 'vitest';
import { signature } from './sign';

describe('sign', () => {
  test('sign + verify', async () => {
    let key = 'Luw6icRYtGAiWuWp3Qen';
    let data = 'test';

    let sign = await signature({ prefix: 'abc_', expirationMs: 1000, key }).sign({
      data
    });

    expect(
      await signature({ prefix: 'abc_', expirationMs: 1000, key }).verify({
        data,
        signature: sign
      })
    ).toBeTruthy();
  });

  test('expired', async () => {
    let key = 'Luw6icRYtGAiWuWp3Qen';
    let data = 'test';

    let sign = await signature({ prefix: 'abc_', expirationMs: 1000, key }).sign({
      data
    });

    expect(
      await signature({ prefix: 'abc_', expirationMs: 1000, key }).verify({
        data,
        signature: sign
      })
    ).toBeTruthy();

    await new Promise(resolve => setTimeout(resolve, 1000 * 2));

    expect(
      await signature({ prefix: 'abc_', expirationMs: 1000, key }).verify({
        data,
        signature: sign
      })
    ).toBeFalsy();
  }, 10_000);

  test('acceptExpired', async () => {
    let key = 'Luw6icRYtGAiWuWp3Qen';
    let data = 'test';

    let sign = await signature({ prefix: 'abc_', expirationMs: 1000, key }).sign({
      data
    });

    expect(
      await signature({ prefix: 'abc_', expirationMs: 1000, key }).verify({
        data,
        signature: sign
      })
    ).toBeTruthy();

    await new Promise(resolve => setTimeout(resolve, 1000 * 2));

    expect(
      await signature({ prefix: 'abc_', expirationMs: 1000, key }).verify({
        data,
        signature: sign,
        acceptExpired: true
      })
    ).toBeTruthy();
    expect(
      await signature({ prefix: 'abc_', expirationMs: 1000, key }).verify({
        data,
        signature: sign
      })
    ).toBeFalsy();
  }, 10_000);

  test('start with prefix', async () => {
    let key = 'Luw6icRYtGAiWuWp3Qen';
    let data = 'test';

    let sign = await signature({ prefix: 'abc_', expirationMs: 1000, key }).sign({
      data
    });
    expect(sign.startsWith('abc_')).toBeTruthy();
  });
});
