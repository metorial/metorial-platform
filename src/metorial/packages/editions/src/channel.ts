export let releaseChannels = ['dev', 'release'] as const;

export type ReleaseChannel = (typeof releaseChannels)[number];

export let defaultReleaseChannel: ReleaseChannel = 'release';

declare let __METORIAL_RELEASE_CHANNEL__: string | undefined;

export let isReleaseChannel = (value: unknown): value is ReleaseChannel =>
  releaseChannels.includes(value as ReleaseChannel);

export let resolveReleaseChannel = (value: unknown): ReleaseChannel => {
  if (value == null) return defaultReleaseChannel;

  if (!isReleaseChannel(value)) {
    throw new Error(
      `Unknown METORIAL_RELEASE_CHANNEL "${value}", expected one of: ${releaseChannels.join(', ')}`
    );
  }

  return value;
};

export let getReleaseChannel = (): ReleaseChannel =>
  resolveReleaseChannel(
    typeof __METORIAL_RELEASE_CHANNEL__ != 'undefined'
      ? __METORIAL_RELEASE_CHANNEL__
      : typeof process != 'undefined'
        ? process.env?.METORIAL_RELEASE_CHANNEL
        : undefined
  );

export let checkReleaseChannel = (
  ...allowed: [ReleaseChannel, ...ReleaseChannel[]]
): boolean => allowed.includes(getReleaseChannel());
