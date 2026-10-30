import { defaultEdition, isEdition, type Edition } from '../edition';
import { transformEditionSource } from './transform';

let sourceFilter = /\.[cm]?[jt]sx?$/;

export let resolveBuildEdition = (): Edition => {
  let raw = process.env.METORIAL_EDITION;

  if (!raw) return defaultEdition;
  if (!isEdition(raw)) throw new Error(`Unknown METORIAL_EDITION "${raw}"`);

  return raw;
};

export let editionsVitePlugin = (edition: Edition = resolveBuildEdition()) => ({
  name: 'metorial-editions',
  enforce: 'pre' as const,

  config: () => ({
    define: { __METORIAL_EDITION__: JSON.stringify(edition) }
  }),

  transform: (code: string, id: string) => {
    let fileName = id.split('?')[0]!;
    if (!sourceFilter.test(fileName)) return null;

    let transformed = transformEditionSource(code, { edition, fileName });
    if (transformed == null) return null;

    return { code: transformed, map: null };
  }
});
