import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance } from '@metorial/state';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { showProviderDeploymentFormModal } from '../scenes/providerDeployments/modal';

export let SetupProviderPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let [searchParams] = useSearchParams();
  let openedRef = useRef(false);
  let createdRef = useRef(false);

  let providerId = searchParams.get('provider_id');
  let nextUrl = searchParams.get('next_url');

  useEffect(() => {
    if (!instance.data || openedRef.current) return;
    openedRef.current = true;

    showProviderDeploymentFormModal({
      type: 'create',
      providerId: providerId ?? undefined,
      onCreate: deployment => {
        createdRef.current = true;
        if (nextUrl) {
          window.location.replace(nextUrl);
          return;
        }
        navigate(
          Paths.instance.providerDeployment(
            instance.data.organization,
            instance.data.project,
            instance.data,
            deployment.id
          )
        );
      },
      onClose: () => {
        if (createdRef.current) return;
        navigate(
          Paths.instance.providerDeployments(
            instance.data.organization,
            instance.data.project,
            instance.data
          ),
          { replace: true }
        );
      }
    });
  }, [instance.data, providerId, nextUrl, navigate]);

  return null;
};
