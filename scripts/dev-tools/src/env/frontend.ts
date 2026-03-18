import { HOSTNAME } from '../const';
import type { Env } from './type';

export let frontendEnv: Env = [
  {
    key: 'VITE_METORIAL_ENV',
    defaultValue: 'development'
  },
  {
    key: 'METORIAL_ENV',
    defaultValue: 'development'
  },

  {
    key: 'VITE_EXPLORER_URL',
    defaultValue: `http://${HOSTNAME}:6050`
  },
  {
    key: 'VITE_EXPLORER_V2_URL',
    defaultValue: `http://${HOSTNAME}:4350`
  },

  {
    key: 'VITE_FEDERATION_INSTANCES',
    defaultValue: JSON.stringify({
      local1: {
        federationApi: `http://${HOSTNAME}:4321`,
        coreApi: `http://${HOSTNAME}:4310?_metorial_instance=local1`,
        adminApi: `http://${HOSTNAME}:4322/metorial-admin`,
        horizonAppId: 'metorial-enterprise-dev'
      },
      local2: {
        federationApi: `http://${HOSTNAME}:4321`,
        coreApi: `http://${HOSTNAME}:4310?_metorial_instance=local2`,
        adminApi: `http://${HOSTNAME}:4322/metorial-admin`,
        horizonAppId: 'metorial-enterprise-dev'
      }
    })
  },

  {
    key: 'FEATURED_COLLECTION_IDS',
    defaultValue: 'landing-featured,landing-popular',
    isEnterprise: true
  },
  {
    key: 'LANDING_COLLECTION_IDS',
    defaultValue: 'landing_collection',
    isEnterprise: true
  },

  {
    key: 'VITE_ADMIN_API_URL',
    defaultValue: `http://${HOSTNAME}:4322/metorial-admin`,
    isEnterprise: true
  },
  {
    key: 'CORE_API_URL',
    defaultValue: `http://${HOSTNAME}:4310`,
    isEnterprise: true
  },

  // {
  //   key: 'VITE_AUTH_API_URL',
  //   defaultValue: `http://${HOSTNAME}:4321/metorial-id`,
  //   isEnterprise: true
  // },

  // {
  //   key: 'VITE_LANDING_API_URL',
  //   defaultValue: `http://${HOSTNAME}:4323/metorial-landing`,
  //   isEnterprise: true
  // },
  // {
  //   key: 'VITE_TEAM_API_URL',
  //   defaultValue: `http://${HOSTNAME}:4324/metorial-team`,
  //   isEnterprise: true
  // },
  // {
  //   key: 'VITE_USER_API_URL',
  //   defaultValue: `http://${HOSTNAME}:4325/metorial-user`,
  //   isEnterprise: true
  // },
  // {
  //   key: 'VITE_DASHBOARD_API_URL',
  //   defaultValue: `http://${HOSTNAME}:4326/metorial-dashboard`,
  //   isEnterprise: true
  // },

  {
    key: 'VITE_CUSTOM_PORTAL_API_URL',
    defaultValue: 'http://localhost:4315'
  },
  {
    key: 'VITE_MARKETPLACE_API_URL',
    defaultValue: `http://${HOSTNAME}:4312/metorial-marketplace`,
    isEnterprise: true
  },

  {
    key: 'VITE_DASHBOARD_FRONTEND_URL',
    defaultValue: `http://${HOSTNAME}:4300`,
    isEnterprise: true
  },
  {
    key: 'VITE_LANDING_FRONTEND_URL',
    defaultValue: 'https://metorial.com',
    isEnterprise: true
  },
  {
    key: 'VITE_DOCS_FRONTEND_URL',
    defaultValue: 'https://metorial.com/docs',
    isEnterprise: true
  },
  {
    key: 'VITE_API_DOCS_FRONTEND_URL',
    defaultValue: 'https://metorial.com/api',
    isEnterprise: true
  },

  {
    key: 'VITE_FEATURED_COLLECTION_SLUG',
    defaultValue: 'dashboard_collection',
    isEnterprise: true
  },
  {
    key: 'VITE_PUBLIC_API_URL',
    defaultValue: `http://${HOSTNAME}:4310`,
    isEnterprise: true
  }
];
