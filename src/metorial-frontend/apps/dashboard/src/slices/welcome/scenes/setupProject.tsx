import { Paths } from '@metorial/frontend-config';
import { useCurrentOrganization, useProjects } from '@metorial/state';
import { Spacer } from '@metorial/ui';
import { BigButtons, Hint } from '@metorial/ui-product';
import { useNavigate, useSearchParams } from 'react-router-dom';

export let WelcomeSetupProjectScene = () => {
  let navigate = useNavigate();
  let [params] = useSearchParams();
  let organizationId = params.get('organization_id');
  let org = useCurrentOrganization();

  let projects = useProjects(organizationId);
  let createProject = projects.createMutator();

  return (
    <>
      <BigButtons>
        <BigButtons.Button
          title="Start from Scratch"
          description="Create a completely new project"
          onClick={() =>
            organizationId && navigate(Paths.welcome.createProject({ organizationId }))
          }
          disabled={!organizationId || createProject.isLoading}
        />

        <BigButtons.Button
          title="Continue with Demo"
          description="Start with a pre-configured project"
          onClick={async () => {
            let [project] = await createProject.mutate({ name: 'My Project' });

            navigate(Paths.project(org.data!, project));
          }}
          disabled={!organizationId || createProject.isLoading}
        />
      </BigButtons>

      <Spacer size={15} />

      <Hint>You can always create a new project or switch between projects later.</Hint>
    </>
  );
};
