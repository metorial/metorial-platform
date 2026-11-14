import { beforeAll, describe, expect, test } from 'vitest';
import { Tokens } from './tokens';

describe('Tokens', () => {
  let privateKey: CryptoKey;
  let publicKey: CryptoKey;
  let tokens: Tokens;

  beforeAll(async () => {
    let pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-384' }, true, [
      'sign',
      'verify'
    ]);

    privateKey = pair.privateKey;
    publicKey = pair.publicKey;

    tokens = new Tokens({
      privateKey: async () => privateKey,
      publicKey: async () => publicKey
    });
  });

  test('should sign and verify tokens', async () => {
    let data = { foo: 'bar' };
    let type = 'test_token';
    let token = await tokens.sign({ type, data });
    let result = await tokens.verify({
      expectedType: type,
      token
    });
    expect(result.verified).toBe(true);
    expect(result.type).toBe(type);
    expect(result.data).toEqual(data);
  });

  test('should not verify tokens with wrong type', async () => {
    let data = { foo: 'bar' };
    let type = 'test_token';
    let token = await tokens.sign({ type, data });
    let result = await tokens.verify({
      expectedType: 'wrong',
      token
    });
    expect(result.verified).toBe(false);
  });

  test('should not verify tokens with wrong version', async () => {
    let data = { foo: 'bar' };
    let type = 'test_token';
    let token = await tokens.sign({ type, data });
    let parts = token.split('_');
    parts[parts.length - 2] = 'wrong';
    let modifiedToken = parts.join('_');
    let result = await tokens.verify({ expectedType: type, token: modifiedToken });
    expect(result.verified).toBe(false);
  });

  test('should not verify tokens with wrong signature', async () => {
    let data = { foo: 'bar' };
    let type = 'test_token';
    let token = await tokens.sign({ type, data });
    let parts = token.split('_');
    parts[parts.length - 1] = 'wrong';
    let modifiedToken = parts.join('_');
    let result = await tokens.verify({ expectedType: type, token: modifiedToken });
    expect(result.verified).toBe(false);
  });

  test('should not verify tokens with too few parts', async () => {
    let data = { foo: 'bar' };
    let type = 'test_token';
    let token = await tokens.sign({ type, data });
    let parts = token.split('_');
    parts.pop();
    let modifiedToken = parts.join('_');
    let result = await tokens.verify({ expectedType: type, token: modifiedToken });
    expect(result.verified).toBe(false);
  });

  test('should not verify expired tokens', async () => {
    let data = { foo: 'bar' };
    let type = 'test_token';
    let token = await tokens.sign({
      type,
      data,
      expiresAt: new Date(Date.now() - 1000)
    });
    let result = await tokens.verify({ expectedType: type, token });
    expect(result.verified).toBe(false);
  });
});
