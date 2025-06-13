import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true
  },
  env: {
    ADMIN_API_URL: process.env.ADMIN_API_URL,
    AUTH_API_URL: process.env.AUTH_API_URL,
    LANDING_API_URL: process.env.LANDING_API_URL,
    TEAM_API_URL: process.env.TEAM_API_URL,
    USER_API_URL: process.env.USER_API_URL,
    MARKETPLACE_API_URL: process.env.MARKETPLACE_API_URL,
    CORE_API_URL: process.env.CORE_API_URL,
    DASHBOARD_FRONTEND_URL: process.env.DASHBOARD_FRONTEND_URL,
    AUTH_FRONTEND_URL: process.env.AUTH_FRONTEND_URL,
    ACCOUNT_FRONTEND_URL: process.env.ACCOUNT_FRONTEND_URL,
    TEAM_FRONTEND_URL: process.env.TEAM_FRONTEND_URL,
    LANDING_FRONTEND_URL: process.env.LANDING_FRONTEND_URL,
    DOCS_FRONTEND_URL: process.env.DOCS_FRONTEND_URL,
    API_DOCS_FRONTEND_URL: process.env.API_DOCS_FRONTEND_URL,
    METORIAL_ENV: process.env.METORIAL_ENV,
    SHOW_EARLY_ACCESS_BAR: process.env.SHOW_EARLY_ACCESS_BAR
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
