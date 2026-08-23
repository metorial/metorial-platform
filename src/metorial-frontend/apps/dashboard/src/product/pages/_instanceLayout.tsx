import { InstanceMenuLayout } from '@metorial/layout';
import { Outlet } from 'react-router-dom';

export let InstanceLayout = () => {
  return (
    <InstanceMenuLayout>
      <Outlet />
    </InstanceMenuLayout>
  );
};
