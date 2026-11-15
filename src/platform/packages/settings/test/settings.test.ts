import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  defineSettings,
  describeSettings,
  listSettingIssues,
  dumpSettings,
  resetSettingsRegistry,
  setting
} from '../src';
import { resetConfigFileCache } from '../src/file';

let touched = [
  'SETTINGS_TEST_STRING',
  'SETTINGS_TEST_NUMBER',
  'SETTINGS_TEST_LIST',
  'SETTINGS_TEST_SECRET_TOKEN',
  'SETTINGS_TEST_DOMAINS',
  'SETTINGS_TEST_ON_PREM',
  'METORIAL_EDITION',
  'METORIAL_CONFIG_FILE',
  'LOWERDECK_OFFLINE',
  'METORIAL_SETTINGS_MODE'
];

beforeEach(() => {
  resetSettingsRegistry();
  resetConfigFileCache();
});

afterEach(() => {
  for (let key of touched) delete process.env[key];
});

describe('defineSettings (grouped)', () => {
  it('reads camelCase keys from the mapped env var', () => {
    process.env.SETTINGS_TEST_STRING = 'hello';

    let settings = defineSettings('service', {
      greeting: setting(v.string(), { env: 'SETTINGS_TEST_STRING' }),
      count: setting(v.number(), { env: 'SETTINGS_TEST_NUMBER', default: 3 })
    });

    expect(settings.greeting).toBe('hello');
    expect(settings.count).toBe(3);
  });

  it('reads the config file by group and camelCase key', () => {
    let dir = mkdtempSync(join(tmpdir(), 'settings-'));
    let path = join(dir, 'config.json');
    writeFileSync(path, JSON.stringify({ service: { greeting: 'from-file' } }));
    process.env.METORIAL_CONFIG_FILE = path;

    let settings = defineSettings('service', {
      greeting: setting(v.string(), { env: 'SETTINGS_TEST_STRING' })
    });

    expect(settings.greeting).toBe('from-file');
  });

  it('requires an env mapping', () => {
    expect(() => defineSettings('service', { greeting: setting(v.string()) })).toThrow(
      'needs an env option'
    );
  });

  it('exposes issues with env, audience and message', () => {
    try {
      defineSettings('service', {
        greeting: setting(v.string(), { env: 'SETTINGS_TEST_STRING', audience: 'customer' })
      });
      expect.unreachable();
    } catch (error: any) {
      expect(error.issues).toEqual([
        expect.objectContaining({
          group: 'service',
          key: 'greeting',
          env: 'SETTINGS_TEST_STRING',
          audience: 'customer'
        })
      ]);
    }
  });
});

describe('registry', () => {
  it('lists a setting declared in two places once, preferring the grouped style', () => {
    process.env.SETTINGS_TEST_STRING = 'x';

    defineSettings({ legacy: { SETTINGS_TEST_STRING: v.string() } });
    defineSettings('grouped', {
      greeting: setting(v.string(), { env: 'SETTINGS_TEST_STRING', audience: 'customer' })
    });

    let described = describeSettings();

    expect(described).toHaveLength(1);
    expect(described[0]).toMatchObject({ group: 'grouped', key: 'greeting' });
  });

  it('collects issues instead of throwing in collect mode', () => {
    process.env.METORIAL_SETTINGS_MODE = 'collect';

    let settings = defineSettings('service', {
      greeting: setting(v.string(), { env: 'SETTINGS_TEST_STRING', audience: 'customer' }),
      other: setting(v.string(), { env: 'SETTINGS_TEST_NUMBER', default: 'fine' })
    });

    expect(settings.greeting).toBeUndefined();
    expect(settings.other).toBe('fine');
    expect(listSettingIssues()).toEqual([
      expect.objectContaining({ env: 'SETTINGS_TEST_STRING', audience: 'customer' })
    ]);
  });
});

describe('requiredIn', () => {
  let define = () =>
    defineSettings('service', {
      licenseKey: setting(v.string(), { env: 'SETTINGS_TEST_STRING', requiredIn: ['on-prem'] })
    });

  it('is optional in other editions', () => {
    expect(define().licenseKey).toBeUndefined();
    expect(describeSettings()[0]?.required).toBe(false);
  });

  it('is required in the listed editions', () => {
    process.env.METORIAL_EDITION = 'on-prem';

    expect(() => define()).toThrow('SETTINGS_TEST_STRING');

    resetSettingsRegistry();
    process.env.SETTINGS_TEST_STRING = 'abc';

    expect(define().licenseKey).toBe('abc');
    expect(describeSettings()[0]?.required).toBe(true);
  });
});

describe('defineSettings', () => {
  it('reads plain validators from the environment like createValidatedEnv', () => {
    process.env.SETTINGS_TEST_STRING = 'hello';
    process.env.SETTINGS_TEST_NUMBER = '42';

    let settings = defineSettings({
      service: { SETTINGS_TEST_STRING: v.string(), SETTINGS_TEST_NUMBER: v.number() }
    });

    expect(settings.service.SETTINGS_TEST_STRING).toBe('hello');
    expect(settings.service.SETTINGS_TEST_NUMBER).toBe(42);
  });

  it('reports every invalid setting in one error', () => {
    expect(() =>
      defineSettings({
        service: { SETTINGS_TEST_STRING: v.string(), SETTINGS_TEST_NUMBER: v.number() }
      })
    ).toThrow(/SETTINGS VALIDATION:\n {2}SETTINGS_TEST_STRING.*\n {2}SETTINGS_TEST_NUMBER/);
  });

  it('fills placeholders in offline mode', () => {
    process.env.LOWERDECK_OFFLINE = '1';

    let settings = defineSettings({ service: { SETTINGS_TEST_STRING: v.string() } });

    expect(settings.service.SETTINGS_TEST_STRING).toBe('offline-SETTINGS_TEST_STRING');
  });

  it('applies defaults when nothing else is set', () => {
    let settings = defineSettings({
      service: { SETTINGS_TEST_STRING: setting(v.string(), { default: 'fallback' }) }
    });

    expect(settings.service.SETTINGS_TEST_STRING).toBe('fallback');
  });

  it('prefers env over config file over default', () => {
    let dir = mkdtempSync(join(tmpdir(), 'settings-'));
    let path = join(dir, 'config.json');
    writeFileSync(path, JSON.stringify({ service: { SETTINGS_TEST_STRING: 'from-file' } }));
    process.env.METORIAL_CONFIG_FILE = path;

    let schema = {
      service: { SETTINGS_TEST_STRING: setting(v.string(), { default: 'fallback' }) }
    };

    expect(defineSettings(schema).service.SETTINGS_TEST_STRING).toBe('from-file');

    process.env.SETTINGS_TEST_STRING = 'from-env';

    expect(defineSettings(schema).service.SETTINGS_TEST_STRING).toBe('from-env');
  });

  it('accepts flat and non-string values from the config file', () => {
    let dir = mkdtempSync(join(tmpdir(), 'settings-'));
    let path = join(dir, 'config.json');
    writeFileSync(
      path,
      JSON.stringify({ SETTINGS_TEST_NUMBER: 7, SETTINGS_TEST_LIST: ['a', 'b'] })
    );
    process.env.METORIAL_CONFIG_FILE = path;

    let settings = defineSettings({
      service: {
        SETTINGS_TEST_NUMBER: v.number(),
        SETTINGS_TEST_LIST: setting.list(v.string())
      }
    });

    expect(settings.service.SETTINGS_TEST_NUMBER).toBe(7);
    expect(settings.service.SETTINGS_TEST_LIST).toEqual(['a', 'b']);
  });

  it('parses list settings from comma separated and JSON env values', () => {
    let schema = { service: { SETTINGS_TEST_LIST: setting.list(v.string()) } };

    process.env.SETTINGS_TEST_LIST = 'a, b ,c';
    expect(defineSettings(schema).service.SETTINGS_TEST_LIST).toEqual(['a', 'b', 'c']);

    process.env.SETTINGS_TEST_LIST = '["x","y"]';
    expect(defineSettings(schema).service.SETTINGS_TEST_LIST).toEqual(['x', 'y']);

    process.env.SETTINGS_TEST_LIST = '';
    expect(defineSettings(schema).service.SETTINGS_TEST_LIST).toEqual([]);
  });

  it('resolves per edition defaults', () => {
    let define = () =>
      defineSettings({
        links: {
          SETTINGS_TEST_DOMAINS: setting.list(v.string(), {
            default: perEdition({ cloud: ['metorial.com'], 'on-prem': [] })
          })
        }
      });

    expect(define().links.SETTINGS_TEST_DOMAINS).toEqual(['metorial.com']);

    process.env.METORIAL_EDITION = 'on-prem';

    expect(define().links.SETTINGS_TEST_DOMAINS).toEqual([]);
  });

  it('computes defaults from settings resolved earlier', () => {
    process.env.SETTINGS_TEST_STRING = 'https://app.example.com';

    let settings = defineSettings({
      urls: { SETTINGS_TEST_STRING: v.string() },
      assets: {
        SETTINGS_TEST_DOMAINS: setting(v.string(), {
          default: resolved => `${resolved.urls!.SETTINGS_TEST_STRING}/assets`
        })
      }
    });

    expect(settings.assets.SETTINGS_TEST_DOMAINS).toBe('https://app.example.com/assets');
  });

  it('skips settings scoped to another edition', () => {
    let schema = {
      service: {
        SETTINGS_TEST_ON_PREM: setting(v.string(), { editions: ['on-prem'] })
      }
    };

    expect(defineSettings(schema).service.SETTINGS_TEST_ON_PREM).toBeUndefined();

    process.env.METORIAL_EDITION = 'on-prem';

    expect(() => defineSettings(schema)).toThrow('SETTINGS_TEST_ON_PREM');
  });

  it('describes active settings and redacts secrets in dumps', () => {
    process.env.SETTINGS_TEST_STRING = 'visible';
    process.env.SETTINGS_TEST_SECRET_TOKEN = 'hunter2';

    defineSettings({
      service: {
        SETTINGS_TEST_STRING: v.string(),
        SETTINGS_TEST_SECRET_TOKEN: v.string(),
        SETTINGS_TEST_ON_PREM: setting(v.string(), { editions: ['on-prem'] })
      }
    });

    expect(describeSettings().map(setting => setting.key)).toEqual([
      'SETTINGS_TEST_SECRET_TOKEN',
      'SETTINGS_TEST_STRING'
    ]);

    expect(dumpSettings()).toEqual({
      SETTINGS_TEST_STRING: { value: 'visible', source: 'env' },
      SETTINGS_TEST_SECRET_TOKEN: { value: '[redacted]', source: 'env' }
    });

    expect(dumpSettings({ reveal: true }).SETTINGS_TEST_SECRET_TOKEN?.value).toBe('hunter2');
  });
});
