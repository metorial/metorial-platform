import { defaultConfig } from './defaultConfig';
import { MetorialConfig } from './types';

if (typeof window !== 'undefined') {
  throw new Error(
    'CANNOT IMPORT @metorial/config IN THE BROWSER. THIS IS A SERVER-ONLY PACKAGE.'
  );
}

let config = { ...defaultConfig };

export let setConfig = (newConfig: Partial<MetorialConfig>) => {
  config = Object.assign(config, newConfig);
};

export let getConfig = () => config;
