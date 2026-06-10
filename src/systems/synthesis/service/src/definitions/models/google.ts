import { gateway } from 'ai';
import { model, provider } from '../../lib/definitions';

let google = provider({
  name: 'Google',
  slug: 'google'
});

export let googleGemini3Flash = model({
  model: gateway('google/gemini-3-flash'),
  name: 'Gemini 3 Flash',
  slug: 'gemini-3-flash',
  provider: google
});

export let googleGemini3ProPreview = model({
  model: gateway('google/gemini-3-pro-preview'),
  name: 'Gemini 3 Pro Preview',
  slug: 'gemini-3-pro-preview',
  provider: google
});

export let googleGemini31FlashLitePreview = model({
  model: gateway('google/gemini-3.1-flash-lite-preview'),
  name: 'Gemini 3.1 Flash-Lite Preview',
  slug: 'gemini-3-1-flash-lite-preview',
  provider: google
});

export let googleGemini31ProPreview = model({
  model: gateway('google/gemini-3.1-pro-preview'),
  name: 'Gemini 3.1 Pro Preview',
  slug: 'gemini-3-1-pro-preview',
  provider: google
});

export let googleGemma426bA4bIt = model({
  model: gateway('google/gemma-4-26b-a4b-it'),
  name: 'Gemma 4 26B A4B IT',
  slug: 'gemma-4-26b-a4b-it',
  provider: google
});

export let googleGemma431bIt = model({
  model: gateway('google/gemma-4-31b-it'),
  name: 'Gemma 4 31B IT',
  slug: 'gemma-4-31b-it',
  provider: google
});
