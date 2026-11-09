import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';

export let hostSettings = defineSettings('hosts', {
  publicHostRewriteSuffixes: setting.list(v.string(), {
    env: 'PUBLIC_HOST_REWRITE_SUFFIXES',
    description:
      'Host suffixes where api-, connect- and mcp- hosts map to their bare subdomain',
    default: perEdition({ cloud: ['.metorial.com'], 'on-prem': [] })
  })
});
