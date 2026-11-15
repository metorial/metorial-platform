import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthCallback } from './pages/auth/AuthCallback';
import { SlateBulkCreate } from './pages/slates/SlateBulkCreate';
import { SlateCreate } from './pages/slates/SlateCreate';
import { SlateDetail } from './pages/slates/SlateDetail';
import { SlateList } from './pages/slates/SlateList';
import { SlatePublish } from './pages/slates/SlatePublish';
import { SubRegistryCreate } from './pages/sub-registries/SubRegistryCreate';
import { SubRegistryDetail } from './pages/sub-registries/SubRegistryDetail';
import { SubRegistryList } from './pages/sub-registries/SubRegistryList';
import { TenantCreate } from './pages/tenants/TenantCreate';
import { TenantDetail } from './pages/tenants/TenantDetail';
import { TenantList } from './pages/tenants/TenantList';
import { UserCreate } from './pages/users/UserCreate';
import { UserDetail } from './pages/users/UserDetail';
import { UserList } from './pages/users/UserList';
import { WorkspaceCreate } from './pages/workspaces/WorkspaceCreate';
import { WorkspaceEdit } from './pages/workspaces/WorkspaceEdit';
import { WorkspaceList } from './pages/workspaces/WorkspaceList';

export let App = () => {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/tenants" replace />} />

        {/* Tenants */}
        <Route path="/tenants" element={<TenantList />} />
        <Route path="/tenants/new" element={<TenantCreate />} />
        <Route path="/tenants/:tenantId" element={<TenantDetail />} />

        {/* Tenant resources - nested under tenant */}
        <Route path="/tenants/:tenantId/sub-registries" element={<SubRegistryList />} />
        <Route path="/tenants/:tenantId/sub-registries/new" element={<SubRegistryCreate />} />
        <Route path="/tenants/:tenantId/sub-registries/:subRegistryId" element={<SubRegistryDetail />} />

        <Route path="/tenants/:tenantId/workspaces" element={<WorkspaceList />} />
        <Route path="/tenants/:tenantId/workspaces/new" element={<WorkspaceCreate />} />
        <Route path="/tenants/:tenantId/workspaces/:workspaceId/edit" element={<WorkspaceEdit />} />

        <Route path="/tenants/:tenantId/users" element={<UserList />} />
        <Route path="/tenants/:tenantId/users/new" element={<UserCreate />} />
        <Route path="/tenants/:tenantId/users/:userId" element={<UserDetail />} />

        <Route path="/tenants/:tenantId/slates" element={<SlateList />} />
        <Route path="/tenants/:tenantId/slates/new" element={<SlateCreate />} />
        <Route path="/tenants/:tenantId/slates/bulk-new" element={<SlateBulkCreate />} />
        <Route path="/tenants/:tenantId/slates/:slateId" element={<SlateDetail />} />
        <Route path="/tenants/:tenantId/slates/:slateId/publish" element={<SlatePublish />} />
      </Route>
    </Routes>
  );
};
