import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export let DevOnly = ({ children }: { children: React.ReactNode }) => {
  let { devToolsEnabled, isLoading } = useAuth();

  if (isLoading) return null;
  if (!devToolsEnabled) return <Navigate to="/slates" replace />;

  return children;
};
