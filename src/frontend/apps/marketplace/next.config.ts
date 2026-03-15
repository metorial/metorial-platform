import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true
  },
  env: {
    MARKETPLACE_API_URL:
      process.env.MARKETPLACE_API_URL ?? process.env.VITE_MARKETPLACE_API_URL,
    CORE_API_URL: process.env.CORE_API_URL ?? process.env.VITE_CORE_API_URL,
    DASHBOARD_FRONTEND_URL:
      process.env.DASHBOARD_FRONTEND_URL ?? process.env.VITE_DASHBOARD_FRONTEND_URL,
    LANDING_FRONTEND_URL:
      process.env.LANDING_FRONTEND_URL ?? process.env.VITE_LANDING_FRONTEND_URL,
    DOCS_FRONTEND_URL: process.env.DOCS_FRONTEND_URL ?? process.env.VITE_DOCS_FRONTEND_URL,
    API_DOCS_FRONTEND_URL:
      process.env.API_DOCS_FRONTEND_URL ?? process.env.VITE_API_DOCS_FRONTEND_URL,
    METORIAL_ENV: process.env.METORIAL_ENV ?? process.env.VITE_METORIAL_ENV
  },

  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/marketplace',
        permanent: true
      },
      {
        source: '/index/:path*',
        destination: '/marketplace/:path*',
        permanent: false
      },
      {
        source: '/index',
        destination: '/marketplace',
        permanent: false
      }
    ];
  },

  assetPrefix: process.env.ASSET_PREFIX
};

export default nextConfig;
