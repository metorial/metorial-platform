import { setFederationConfig } from '@metorial-enterprise/federation-frontend-config';
import { setConfig } from '@metorial/frontend-config';

let adminApiUrl = import.meta.env.VITE_ADMIN_API_URL!;
let authApiUrl = import.meta.env.VITE_AUTH_API_URL!;
let landingApiUrl = import.meta.env.VITE_LANDING_API_URL!;
let teamApiUrl = import.meta.env.VITE_TEAM_API_URL!;
let userApiUrl = import.meta.env.VITE_USER_API_URL!;
let coreApiUrl = import.meta.env.VITE_CORE_API_URL!;
let dashboardApiUrl = import.meta.env.VITE_DASHBOARD_API_URL!;
let privateApiUrl = import.meta.env.VITE_PRIVATE_API_URL!;
let publicApiUrl = import.meta.env.VITE_PUBLIC_API_URL!;

let authFrontendUrl = import.meta.env.VITE_AUTH_FRONTEND_URL!;
let dashboardFrontendUrl = import.meta.env.VITE_DASHBOARD_FRONTEND_URL!;
let accountFrontendUrl = import.meta.env.VITE_ACCOUNT_FRONTEND_URL!;
let teamFrontendUrl = import.meta.env.VITE_TEAM_FRONTEND_URL!;
let landingFrontendUrl = import.meta.env.VITE_LANDING_FRONTEND_URL!;
let docsFrontendUrl = import.meta.env.VITE_DOCS_FRONTEND_URL!;
let apiDocsFrontendUrl = import.meta.env.VITE_API_DOCS_FRONTEND_URL!;
let codeEditorUrl = import.meta.env.VITE_CODE_EDITOR_URL!;

let metorialEnvironment = import.meta.env.VITE_METORIAL_ENV! as any;

setFederationConfig({
  environment: metorialEnvironment,

  urls: {
    apis: {
      auth: authApiUrl.replace('app.metorial.com', 'admin.metorial.com'),
      admin: adminApiUrl.replace('app.metorial.com', 'admin.metorial.com'),
      team: teamApiUrl.replace('app.metorial.com', 'admin.metorial.com'),
      user: userApiUrl.replace('app.metorial.com', 'admin.metorial.com'),
      dashboard: dashboardApiUrl.replace('app.metorial.com', 'admin.metorial.com'),
      core: coreApiUrl.replace('app.metorial.com', 'admin.metorial.com'),

      landing: landingApiUrl
    },
    microFrontends: {
      auth: authFrontendUrl,
      dashboard: dashboardFrontendUrl,
      account: accountFrontendUrl,
      team: teamFrontendUrl,
      landing: landingFrontendUrl,
      docs: docsFrontendUrl,
      apiDocs: apiDocsFrontendUrl
    }
  }
});

setConfig({
  apiUrl: coreApiUrl.replace('app.metorial.com', 'admin.metorial.com'),
  publicApiUrl: publicApiUrl.replace('app.metorial.com', 'admin.metorial.com'),
  privateApiUrl: privateApiUrl.replace('app.metorial.com', 'account.metorial.com'),

  microFrontends: {
    codeEditorUrl
  },

  environment: metorialEnvironment,

  enterprise: {
    organizationFrontendUrl: teamFrontendUrl,
    accountFrontendUrl: accountFrontendUrl
  },

  auth: {
    authFrontendUrl: authFrontendUrl,
    loginPath: '/login',
    logoutPath: '/logout',
    signupPath: '/signup'
  }
});
