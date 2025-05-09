import { generateCode, generatePlainId } from '@metorial/id';
import _slugify from 'slugify';

export let slugify = (slug: string) =>
  _slugify(slug, {
    lower: true,
    strict: true,
    replacement: '-',
    remove: /[*+~.()'"!:@]/g
  });

export let createSlugGenerator =
  <Opts = void>(cb: (slug: string, opts: Opts) => Promise<boolean>) =>
  async (d: { input: string; current?: string }, opts: Opts) => {
    let slug = slugify(d.input);

    for (let i = 0; i < 10; i++) {
      if (d.current && slug == d.current) return slug;

      let ok = false;

      try {
        ok = await cb(slug, opts);
      } catch (e) {}

      if (ok) return slug;

      slug = `${slug}${i == 0 ? '-' : ''}${generateCode(2)}`;
    }

    slug = generatePlainId(20);
    return slug;
  };

export let createShortIdGenerator =
  <Opts = void>(cb: (id: string, opts: Opts) => Promise<boolean>) =>
  async (opts: Opts) => {
    let id = generatePlainId(6).toLowerCase();

    for (let i = 0; i < 10; i++) {
      let ok = false;

      try {
        ok = await cb(id, opts);
      } catch (e) {}

      if (ok) return id;

      id = generatePlainId(6).toLowerCase();
    }

    id = generatePlainId(20).toLowerCase();

    return id;
  };
