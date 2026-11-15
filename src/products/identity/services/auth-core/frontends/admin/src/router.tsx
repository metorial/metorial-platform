import { ModalRoot, Toaster } from '@metorial-io/ui';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Layout } from './pages/_layout';
import { RouterErrorPage } from './pages/_error/routerError';
import { AuditLogsPage } from './pages/auditLogs/page';
import { AuthCallbackPage } from './pages/auth/callback';
import { LoginPage } from './pages/login';
import { UsersPage } from './pages/users/page';
import { UserPage } from './pages/users/[userId]/page';
import { AdminsPage } from './pages/admin/page';
import { AppsPage } from './pages/apps/page';
import { AppPage } from './pages/apps/[appId]/page';
import { SsoTenantPage } from './pages/apps/[appId]/sso/[ssoTenantId]/page';
import { AccessGroupsPage } from './pages/apps/[appId]/accessGroups/page';
import { AccessGroupPage } from './pages/apps/[appId]/accessGroups/[accessGroupId]/page';
import { TenantsPage } from './pages/tenants/page';
import { TenantPage } from './pages/tenants/[tenantId]/page';
import { SettingsPage } from './pages/settings/page';

let router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <>
        <LoginPage />
        <Toaster />
        <ModalRoot />
      </>
    )
  },
  {
    path: '/auth/callback',
    element: (
      <>
        <AuthCallbackPage />
        <Toaster />
        <ModalRoot />
      </>
    )
  },
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouterErrorPage />,
    children: [
      { path: '', element: <Navigate to="/users" replace /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'users/:userId', element: <UserPage /> },
      { path: 'admins', element: <AdminsPage /> },
      { path: 'apps', element: <AppsPage /> },
      { path: 'apps/:appId', element: <AppPage /> },
      { path: 'apps/:appId/sso/:ssoTenantId', element: <SsoTenantPage /> },
      { path: 'apps/:appId/access-groups', element: <AccessGroupsPage /> },
      { path: 'apps/:appId/access-groups/:accessGroupId', element: <AccessGroupPage /> },
      { path: 'tenants', element: <TenantsPage /> },
      { path: 'tenants/:tenantId', element: <TenantPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  }
]);

export let App = () => {
  return <RouterProvider router={router} />;
};
