import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';
import { once } from './once';

export let publicUrl = setting(v.string({ modifiers: [v.url()] }), {
  env: 'METORIAL_PUBLIC_URL',
  audience: 'customer',
  requiredIn: ['on-prem'],
  description: 'Public base URL of this installation, for example https://metorial.example.com'
});

let load = once(() => defineSettings('installation', { publicUrl }));

export let installationSettings = () => ({
  publicUrl: load().publicUrl?.replace(/\/+$/, '')
});
