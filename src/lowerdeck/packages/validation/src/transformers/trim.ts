import { Transformer } from '../lib/types';

export let trim: Transformer<string> = value => value.trim();

export let trimStart: Transformer<string> = value => value.trimStart();

export let trimEnd: Transformer<string> = value => value.trimEnd();
