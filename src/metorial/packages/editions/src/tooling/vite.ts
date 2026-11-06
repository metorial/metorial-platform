import { resolveReleaseChannel, type ReleaseChannel } from '../channel';
import { defaultEdition, isEdition, type Edition } from '../edition.ts';
import { transformEditionSource } from './transform.ts';

let sourceFilter = /\.[cm]?[jt]sx?$/;

export let resolveBuildEdition = (): Edition => {
  let raw = process.env.METORIAL_EDITION;

  if (!raw) return defaultEdition;
  if (!isEdition(raw)) throw new Error(`Unknown METORIAL_EDITION "${raw}"`);

  return raw;
};

export let editionsVitePlugin = (
  edition: Edition = resolveBuildEdition(),
  channel: ReleaseChannel = resolveReleaseChannel(process.env.METORIAL_RELEASE_CHANNEL)
) => ({
  name: 'metorial-editions',
  enforce: 'pre' as const,

  config: () => ({
    define: {
      __METORIAL_EDITION__: JSON.stringify(edition),
      __METORIAL_RELEASE_CHANNEL__: JSON.stringify(channel)
    }
  }),

  transform: (code: string, id: string) => {
    let fileName = id.split('?')[0]!;
    if (!sourceFilter.test(fileName)) return null;

    let transformed = transformEditionSource(code, { edition, channel, fileName });
    if (transformed == null) return null;

    return { code: transformed, map: null };
  }
});
