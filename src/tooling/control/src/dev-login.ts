import { v } from '@lowerdeck/validation';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from './schema';

let secretFile = '.control/dev-login-secret';
let requestTimeoutMs = 30_000;

let loginResponse = v.object({
  url: v.string(),
  expires_at: v.string(),
  user: v.object({ id: v.string(), email: v.string(), name: v.string() })
});

let userFields = {
  id: v.string(),
  email: v.string(),
  name: v.string(),
  status: v.string(),
  created_at: v.string(),
  last_login_at: v.optional(v.string()),
  last_active_at: v.optional(v.string())
};

let userResponse = v.object(userFields);

let userDetailResponse = v.object({
  ...userFields,
  emails: v.array(v.object({ email: v.string(), primary: v.boolean(), verified: v.boolean() }))
});

let usersResponse = v.object({ items: v.array(userResponse), total: v.number() });

let secretPath = (root: string) => join(root, secretFile);

let readSecret = (path: string) => {
  if (!existsSync(path)) return;

  return readFileSync(path, 'utf8').trim() || undefined;
};

// Concurrent control processes may race to create the secret; `wx` lets exactly one write it
// and the others read what it wrote.
export let ensureDevLoginSecret = (root: string) => {
  let path = secretPath(root);
  let existing = readSecret(path);
  if (existing) return existing;

  mkdirSync(dirname(path), { recursive: true });

  try {
    writeFileSync(path, `${randomBytes(32).toString('hex')}\n`, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }

  let secret = readSecret(path);
  if (!secret) throw new Error(`could not read the dev login secret at ${path}`);

  return secret;
};

let request = async (
  base: string,
  root: string,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {}
) => {
  let secret = readSecret(secretPath(root));
  if (!secret)
    throw new Error(
      `no dev login secret at ${secretPath(root)}; restart the workspace so control can create it`
    );

  let url = new URL(`${base.replace(/\/$/, '')}${path}`);
  for (let [key, value] of Object.entries(init.query ?? {}))
    if (value !== undefined) url.searchParams.set(key, value);

  let result = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${secret}`,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(requestTimeoutMs)
  }).catch(error => {
    throw new Error(`could not reach the dev login endpoint at ${url.origin}`, {
      cause: error
    });
  });

  if (result.status === 401)
    throw new Error('the dev login endpoint rejected the secret; restart the service');

  return result;
};

let failure = async (result: Response) =>
  new Error(
    `dev login endpoint returned HTTP ${result.status}: ${(await result.text()).slice(0, 500)}`
  );

export let login = async (
  base: string,
  root: string,
  input: { email: string; create: boolean; redirect?: string }
) => {
  let result = await request(base, root, '/login', { method: 'POST', body: input });

  if (result.status === 404 && (await result.clone().text()).includes('user_not_found'))
    throw new Error(`no user with the email ${input.email}; pass --create to create one`);

  if (!result.ok) throw await failure(result);

  return parse(loginResponse, await result.json(), 'invalid dev login response');
};

export let listUsers = async (
  base: string,
  root: string,
  input: { search?: string; limit?: string }
) => {
  let result = await request(base, root, '/users', { query: input });
  if (!result.ok) throw await failure(result);

  return parse(usersResponse, await result.json(), 'invalid user list response');
};

export let getUser = async (base: string, root: string, user: string) => {
  let result = await request(base, root, '/users/get', { query: { user } });

  if (result.status === 404) throw new Error(`no user matches ${JSON.stringify(user)}`);
  if (!result.ok) throw await failure(result);

  return parse(userDetailResponse, await result.json(), 'invalid user response');
};
