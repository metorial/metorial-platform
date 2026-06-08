import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthCallback } from './pages/auth/AuthCallback';
import { DeploymentDetail } from './pages/deployments/DeploymentDetail';
import { DeploymentList } from './pages/deployments/DeploymentList';
import { DiscoveryDetail } from './pages/discoveries/DiscoveryDetail';
import { DiscoveryList } from './pages/discoveries/DiscoveryList';
import { EventList } from './pages/events/EventList';
import { SlateBulkRedeploy } from './pages/slates/SlateBulkRedeploy';
import { SlateDetail } from './pages/slates/SlateDetail';
import { SlateList } from './pages/slates/SlateList';
import { VersionDetail } from './pages/versions/VersionDetail';
import { VersionList } from './pages/versions/VersionList';

export let App = () => {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/slates" replace />} />

        <Route path="/slates" element={<SlateList />} />
        <Route path="/slates/redeploy" element={<SlateBulkRedeploy />} />
        <Route path="/slates/:slateId" element={<SlateDetail />} />

        <Route path="/slates/:slateId/versions" element={<VersionList />} />
        <Route path="/slates/:slateId/versions/:versionId" element={<VersionDetail />} />

        <Route path="/deployments" element={<DeploymentList />} />
        <Route path="/slates/:slateId/deployments" element={<DeploymentList />} />
        <Route
          path="/slates/:slateId/deployments/:deploymentId"
          element={<DeploymentDetail />}
        />

        <Route path="/discoveries" element={<DiscoveryList />} />
        <Route path="/slates/:slateId/discoveries" element={<DiscoveryList />} />
        <Route
          path="/slates/:slateId/versions/:versionId/discoveries/:discoveryId"
          element={<DiscoveryDetail />}
        />

        <Route path="/events" element={<EventList />} />
        <Route path="/slates/:slateId/events" element={<EventList />} />
      </Route>
    </Routes>
  );
};
