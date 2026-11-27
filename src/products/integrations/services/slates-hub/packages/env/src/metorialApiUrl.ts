import { env } from './env';

export let getMetorialApiUrl = () => {
  let value = env.service.METORIAL_API_URL;
  if (!value) return undefined;

  let protocol: string | undefined;
  try {
    protocol = new URL(value).protocol;
  } catch {}

  let allowed =
    protocol === 'https:' ||
    (protocol === 'http:' && env.service.METORIAL_ENV === 'development');
  if (!allowed) {
    throw new Error(`METORIAL_API_URL must be an absolute https URL, got: ${value}`);
  }

  return value;
};

export let checkMetorialApiUrl = () => {
  if (!getMetorialApiUrl() && env.service.METORIAL_ENV !== 'development') {
    console.warn(
      '[Hub]: METORIAL_API_URL is not set; slates will fall back to their default Metorial API URL.'
    );
  }
};
