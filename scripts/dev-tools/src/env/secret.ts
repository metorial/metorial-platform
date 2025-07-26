import { $ } from 'bun';
import { subtle } from 'crypto';
import os from 'os';

let gitEmail = await $`git config user.email`.text();
let hostname = os.hostname();
let username = os.userInfo().username;

let base = `${gitEmail}-${hostname}-${username}`;

let sha256 = async (input: string) => {
  let bytes = await subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export let getStaticSecret = (key: string) => {
  return sha256(`${base}-${key}`);
};
