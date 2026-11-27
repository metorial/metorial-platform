import { Outlet } from 'react-router-dom';
import { AgentTrackingPageGate } from './_gate';

export let AgentTrackingGateLayout = () => (
  <AgentTrackingPageGate>
    <Outlet />
  </AgentTrackingPageGate>
);
