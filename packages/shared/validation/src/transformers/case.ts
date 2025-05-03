import { Transformer } from '../lib/types';

export let upperCase: Transformer<string> = value => value.toUpperCase();

export let lowerCase: Transformer<string> = value => value.toLowerCase();
