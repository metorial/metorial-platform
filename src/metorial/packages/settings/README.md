# @metorial/settings

Layered, validated configuration. Replaces `createValidatedEnv`.

## Grouped style (use this for new settings)

```ts
import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';

export let linkSettings = defineSettings('links', {
  firstPartyDomains: setting.list(v.string(), {
    env: 'MARKDOWN_FIRST_PARTY_DOMAINS',
    audience: 'customer',
    description: 'Domains whose links open in the same tab',
    default: perEdition({ cloud: ['metorial.com'], 'on-prem': [] })
  })
});

linkSettings.firstPartyDomains;
```

- The first argument is the group, the keys are camelCase, `env` is the environment variable.
- Config file: `{ "links": { "firstPartyDomains": ["acme.corp"] } }` (`METORIAL_CONFIG_FILE`, JSON, or YAML under Bun). The env var name is accepted as a key too.
- Precedence: environment variable, then config file, then `default`.
- `default` may be a value, a function of the groups resolved so far, or `perEdition(...)`. `undefined` means no default.

## Legacy style

`defineSettings({ service: { REDIS_URL: v.string() } })` keeps working: the key is the env var and the accessor. Plain validators and `setting(...)` definitions can be mixed. Shared definitions from `@metorial/shared-settings` work in both styles.

## Options

| Option        | Meaning                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env`         | environment variable (required in the grouped style)                                                                                               |
| `default`     | value, `(resolved) => value`, or `perEdition(...)`                                                                                                 |
| `audience`    | `customer` (the operator must provide it), `derived` (computed from other settings), `deployment` (set by the installer/Helm/Compose, the default) |
| `secret`      | redacted in dumps (keys containing SECRET, PASSWORD, TOKEN, ... are redacted automatically)                                                        |
| `description` | shown in the generated example and schema                                                                                                          |
| `editions`    | the setting only exists in these editions; elsewhere it is not validated and reads as `undefined`                                                  |
| `requiredIn`  | required in these editions, optional elsewhere (reads as `T \| undefined`)                                                                         |

All invalid settings are reported together (`SettingsValidationError` with `issues`). `LOWERDECK_OFFLINE=1` still fills placeholders.

## Tooling

Every declaration is registered: `describeSettings()`, `dumpSettings()` (secrets redacted, shows where each value came from), `exportSettingsSchema()`, `renderExampleConfig()`.

```sh
metorial-settings check   --edition on-prem [--config config.yaml] <module...>
metorial-settings schema  --edition on-prem [--audience customer] <module...>
metorial-settings example --edition on-prem <module...>
```

`<module>` is any file that declares settings when imported. `check` groups problems by who has to fix them. Settings declared twice under the same env var are listed once.

Server only. Do not import it from browser code.
