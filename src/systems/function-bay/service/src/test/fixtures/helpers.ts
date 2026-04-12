type WithEncryptedEnv = {
  encryptedEnvironmentVariables?: unknown;
};

type EncryptionLike = {
  encrypt: (input: { secret: string; entityId: string }) => Promise<string> | string;
};

export const withoutEncryptedEnvOverrides = <T extends WithEncryptedEnv>(
  overrides?: T
): Omit<T, 'encryptedEnvironmentVariables'> => {
  if (!overrides) {
    return {} as Omit<T, 'encryptedEnvironmentVariables'>;
  }

  const { encryptedEnvironmentVariables: _unused, ...rest } = overrides;
  return rest as Omit<T, 'encryptedEnvironmentVariables'>;
};

export const resolveEncryptedEnvironmentVariables = async <T extends WithEncryptedEnv>(data: {
  overrides?: T;
  encryption: EncryptionLike;
  entityId: string;
  defaultValue?: Record<string, unknown>;
}): Promise<string> => {
  if (typeof data.overrides?.encryptedEnvironmentVariables === 'string') {
    return data.overrides.encryptedEnvironmentVariables;
  }

  return await data.encryption.encrypt({
    secret: JSON.stringify(data.defaultValue ?? {}),
    entityId: data.entityId
  });
};
