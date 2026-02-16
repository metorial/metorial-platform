import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export let ProviderDeploymentsRedirectPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();

  useEffect(() => {
    if (!instance.data) return;

    navigate(
      Paths.instance.providerDeployments(organization.data, project.data, instance.data),
      { replace: true }
    );
  }, [instance.data, organization.data, project.data, navigate]);

  return null;
};

export let SessionTemplatesRedirectPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();

  useEffect(() => {
    if (!instance.data) return;

    navigate(Paths.instance.sessionTemplates(organization.data, project.data, instance.data), {
      replace: true
    });
  }, [instance.data, organization.data, project.data, navigate]);

  return null;
};
