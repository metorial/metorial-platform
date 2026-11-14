# @metorial/shared-settings

Pre-defined setting definitions for values many packages need. Use them instead of redeclaring the same env var.

```ts
import { defineSettings } from '@metorial/settings';
import { redisUrl, objectStorageUrl, serviceUrl } from '@metorial/shared-settings';

// legacy style: the accessor stays env.service.REDIS_URL
export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    OBJECT_STORAGE_URL: objectStorageUrl,
    VOYAGER_URL: serviceUrl('voyager')
  }
});

// grouped style
export let urlSettings = defineSettings('urls', publicUrls);
```

- `redisUrl`, `objectStorageUrl`: deployment values in cloud, customer values on-prem.
- `installationSettings()`: `publicUrl` (`METORIAL_PUBLIC_URL`), required on-prem, optional in cloud. Other derived defaults hang off it.
- `postgresServerUrl` / `postgresSettings()`: the customer's Postgres server on-prem. `databaseUrl(env, databaseName)` derives a per-service database URL from it.
- `metorialEnv` (`production` by default on-prem), `metorialRegion`.
- `publicUrls`: api, files, portals, app (derived from the installation URL on-prem) and public MCP (cloud only).
- `emailName`, `emailAddress`: the sender emails go out as (`EMAIL_NAME`, `EMAIL_ADDRESS`). The address is a customer setting on-prem; the name defaults to `Metorial` there.
- `domainSettings()`: domain lists by role instead of per-package copies. `apps` (first party web apps, trusted for CORS), `owned` (everything operated by the installation, trusted for links and images), `assets` (CDN/file hosts) and `dev` (`localhost`, only when `METORIAL_ENV=development`). Cloud keeps the Metorial domains; on-prem uses the host of the public URL. Operators can extend each list with `METORIAL_APP_DOMAINS`, `METORIAL_OWNED_DOMAINS`, `METORIAL_ASSET_DOMAINS` and `METORIAL_DEV_HOSTS`. Use `matchesDomain(hostname, domains)` to test a host (exact match or subdomain).
- `serviceUrl(name)`: internal service endpoints (`voyager`, `nebula`, `relay`, `shuttle`, `origin`, `functionBay`, `slatesHub`).

Settings that are specific to one module stay in that module.
