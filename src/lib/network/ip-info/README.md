# `@lowerdeck/ip-info`

Get geolocation information for IP addresses. Retrieves country, city, timezone, coordinates, ASN, and organization data from the geojs.io API.

## Installation

```bash
npm install @lowerdeck/ip-info
yarn add @lowerdeck/ip-info
bun add @lowerdeck/ip-info
pnpm add @lowerdeck/ip-info
```

## Usage

```typescript
import { ipInfo } from '@lowerdeck/ip-info';

// Get info for single IP
const info = await ipInfo.get('8.8.8.8');
console.log(info);
// {
//   country: 'US',
//   city: 'Mountain View',
//   timezone: 'America/Los_Angeles',
//   latitude: '37.386',
//   longitude: '-122.0838',
//   asn: 'AS15169',
//   organization: 'Google LLC'
// }

// Get info for multiple IPs
const infos = await ipInfo.getMany(['8.8.8.8', '1.1.1.1']);

// Safe get with error handling
const safeInfo = await ipInfo.getSafe('invalid-ip');
console.log(safeInfo); // null on error
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
