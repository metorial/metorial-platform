import { SetupLayout } from '@metorial/layout';
import { createProject, useOrganizations, useUser } from '@metorial/state';
import { CenteredSpinner } from '@metorial/ui';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import astronaut from '../../../assets/astronaut_waving1.webp';

export let JumpstartPage = () => {
  let user = useUser();

  let orgs = useOrganizations();
  let createOrganization = orgs.createMutator();

  let [search] = useSearchParams();
  let path = search.get('path');

  let navigate = useNavigate();

  let creating = useRef(false);
  useEffect(() => {
    if (!orgs.data || !user.data) return;
    if (creating.current) return;
    creating.current = true;

    let org = orgs.data[0];
    if (org) return navigate(`/o/${org.slug}?path=${path ?? ''}`, { replace: true });

    (async () => {
      let [org] = await createOrganization.mutate({
        name: user.data!.name
      });
      if (!org) return;

      let project = await createProject({
        organizationId: org.id,
        name: 'My Project'
      });

      navigate(`/p/${org.slug}/${project.slug}?path=${path ?? ''}`, { replace: true });
    })().catch(e => {
      console.error(e);
    });
  }, [user.data, orgs.data]);

  return (
    <SetupLayout
      main={{
        title: 'Setting up Metorial',
        description: ''
      }}
      imageUrl={astronaut}
    >
      <CenteredSpinner />
    </SetupLayout>
  );
};
