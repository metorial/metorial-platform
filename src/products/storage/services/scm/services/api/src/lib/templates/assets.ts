import { perEdition } from '@metorial/editions';

let neutralIcon = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#e4e4e7"/></svg>'
)}`;

export let assets = perEdition({
  cloud: {
    logo: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg',
    favicon96: 'https://metorial.com/favicon-96x96.png',
    faviconSvg: 'https://metorial.com/favicon.svg',
    faviconIco: 'https://metorial.com/favicon.ico',
    appleTouchIcon: 'https://metorial.com/apple-touch-icon.png',
    providerLogo: (name: string) => `https://provider-logos.metorial-cdn.com/${name}`
  },
  'on-prem': {
    logo: neutralIcon,
    favicon96: neutralIcon,
    faviconSvg: neutralIcon,
    faviconIco: neutralIcon,
    appleTouchIcon: neutralIcon,
    providerLogo: (_name: string) => neutralIcon
  }
});
