interface IPInfoRaw {
  country?: string;
  timezone?: string;
  organization?: string;
  ip: string;
  asn?: number;
  area_code?: string;
  organization_name?: string;
  country_code?: string;
  country_code3?: string;
  continent_code?: string;
  latitude?: string;
  region?: string;
  city?: string;
  longitude?: string;
}

let normalizeIpInfo = (info: IPInfoRaw) => {
  return {
    ip: info.ip,
    country: info.country_code,
    countryName: info.country,
    city: info.city,
    region: info.region,
    asn: info.asn ? `AS${info.asn}` : undefined,
    organization: info.organization_name,
    timezone: info.timezone,

    latitude: info.latitude ? parseFloat(info.latitude) : undefined,
    longitude: info.longitude ? parseFloat(info.longitude) : undefined
  };
};

export type IPInfo = ReturnType<typeof normalizeIpInfo>;

export let ipInfo = {
  getMany: async (ips: string[]): Promise<IPInfo[]> => {
    try {
      let res = await fetch(`https://get.geojs.io/v1/ip/geo.json?ip=${ips.join(',')}`);
      let data = (await res.json()) as IPInfoRaw[];

      return data.map(normalizeIpInfo);
    } catch (err) {
      return [];
    }
  },

  get: async (ip: string) => {
    return (await ipInfo.getMany([ip]))[0];
  },

  getSafe: async (ip: string) => {
    try {
      return await ipInfo.get(ip);
    } catch (err) {
      return undefined;
    }
  }
};
