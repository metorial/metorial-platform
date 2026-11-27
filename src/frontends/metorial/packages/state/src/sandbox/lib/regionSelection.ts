import { useState } from 'react';

let storageKey = 'metorial:sandbox:last-region';

type Region = { id: string; isDefault?: boolean; availability: string };

let readRegion = () => {
  try {
    return window.localStorage.getItem(storageKey) ?? '';
  } catch {
    return '';
  }
};

export let resolveSandboxRegion = (regions: Region[], lastRegion: string) => {
  let available = regions.filter(region => region.availability === 'available');

  return (
    available.find(region => region.id === lastRegion)?.id ??
    available.find(region => region.isDefault)?.id ??
    available[0]?.id ??
    ''
  );
};

export let useSandboxRegionSelection = () => {
  let [lastRegion, setLastRegion] = useState(readRegion);

  return {
    getRegion: (regions: Region[]) => resolveSandboxRegion(regions, lastRegion),
    rememberRegion: (region: string) => {
      setLastRegion(region);

      try {
        window.localStorage.setItem(storageKey, region);
      } catch {}
    }
  };
};
