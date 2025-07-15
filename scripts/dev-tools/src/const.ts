import fs from 'fs-extra';
import { join } from 'path';

export let IS_ENTERPRISE = process.env.IS_ENTERPRISE === 'true';
export let METORIAL_SOURCE = process.env.METORIAL_SOURCE || 'oss';
export let OSS_DIR = process.env.OSS_DIR || join(__dirname, '../../../..');
export let ROOT_DIR = process.env.ROOT_DIR || OSS_DIR;

let config: { hostname?: string } = {};

if (fs.existsSync(join(__dirname, '../config.json'))) {
  config = fs.readJSONSync(join(__dirname, '../config.json'));
}

export let HOSTNAME = config.hostname ?? process.env.METORIAL_HOSTNAME ?? 'localhost';
