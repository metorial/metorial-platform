# @metorial/settings

Layered, validated configuration. Replaces `createValidatedEnv`.

```ts
import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';

export let env = defineSettings({
  service: {
    REDIS_URL: v.string(),

    TRUSTED_DOMAINS: setting.list(v.string(), {
      default: perEdition({ cloud: ['metorial.com'], 'on-prem': [] })
    }),

    LICENSE_KEY: setting(v.string(), { editions: ['on-prem'], secret: true })
  }
});
```

- Plain validators behave exactly like `createValidatedEnv` (the key is the env var name).
- Precedence: environment variable, then the config file (`METORIAL_CONFIG_FILE`, JSON or YAML under Bun, keys either flat or under their group), then `default`.
- `default` may be a function of the groups resolved so far.
- `setting.list` accepts comma separated or JSON values.
- `editions` scopes a setting to an edition; elsewhere it is not validated and reads as `undefined`.
- All invalid settings are reported in one `SETTINGS VALIDATION` error. `LOWERDECK_OFFLINE=1` still fills placeholders.
- Every declaration is registered: `describeSettings()` for schema/docs, `dumpSettings()` with secrets redacted.

Server only. Do not import it from browser code.
