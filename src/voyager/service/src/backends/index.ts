import { AlgoliaBackend } from './algolia';
import { PgBackend } from './pg';

let algolia = new AlgoliaBackend();
export let defaultBackend = algolia.isEnabled() ? algolia : new PgBackend();
