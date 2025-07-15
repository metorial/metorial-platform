import fs from 'fs-extra';
import { join } from 'path';
import type { Env } from './types';

let envJson: Record<string, string> | null = null;

if (fs.existsSync(join(__dirname, '../../../../env.json'))) {
  envJson = fs.readJSONSync(join(__dirname, '../../../../env.json'));
}

if (fs.existsSync(join(__dirname, '../../../../../env.json'))) {
  envJson = fs.readJSONSync(join(__dirname, '../../../../../env.json'));
}

if (!envJson) {
  console.warn(
    'No env.json found. Please create one with the necessary environment variables.'
  );
}

export let getEnvValue = (key: string): string | undefined => {
  if (envJson && key in envJson) {
    return envJson[key];
  }
  return process.env[key];
};

export let getEnvRecord = ({
  env,
  type
}: {
  env: Env;
  type: 'oss' | 'enterprise';
}): Record<string, string> => {
  let out: Record<string, string> = {
    METORIAL_ENV: process.env.METORIAL_ENV || 'development',
    METORIAL_SOURCE: process.env.METORIAL_SOURCE || 'oss',
    IS_ENTERPRISE: process.env.IS_ENTERPRISE === 'true' ? 'true' : 'false',
    METORIAL_HOSTNAME: process.env.METORIAL_HOSTNAME || 'localhost',
    NODE_ENV: process.env.NODE_ENV || 'development'
  };

  for (let entry of env) {
    let value = getEnvValue(entry.key);
    if (value === undefined) {
      if (entry.isRequired) {
        throw new Error(`Missing required environment variable: ${entry.key}`);
      }
      value = entry.defaultValue;
    }

    if (value) {
      // if (entry.isEnterprise && type !== 'enterprise') {
      //   continue; // Skip enterprise variables for OSS
      // }

      out[entry.key] = value;
    }
  }

  return out;
};

export let getEnvString = ({
  env,
  type
}: {
  env: Env;
  type: 'oss' | 'enterprise';
}): string => {
  let record = getEnvRecord({ env, type });
  return Object.entries(record)
    .map(([key, value]) => `${key}="${value}"`)
    .join('\n');
};
