import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';

export let PortalUserPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);

  return (
    <>
      {renderWithLoader({ portal })(({ portal }) => (
        <Outlet />
      ))}
    </>
  );
};
