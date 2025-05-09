import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeader, createProject, updateProject } from '@metorial/layout';
import { useCurrentOrganization } from '@metorial/state';
import { Button, Entity, RenderDate } from '@metorial/ui';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let OrganizationSettingsProjectsPage = () => {
  let org = useCurrentOrganization();

  return (
    <>
      <PageHeader
        title="Projects"
        description="Create multiple projects to organize your work."
        actions={
          <Button size="2" onClick={() => createProject(org.data!)}>
            Create Project
          </Button>
        }
      />

      <Wrapper>
        {renderWithLoader({
          org
        })(({ org }) => (
          <>
            {org.data.projects.map(i => (
              <Entity.Wrapper key={i.id}>
                <Entity.Content>
                  <Entity.Field title={i.name} value={i.slug} />

                  <Entity.Field title="Created" value={<RenderDate date={i.createdAt} />} />

                  <Entity.Field title="Actions" right>
                    <Button size="1" variant="soft" onClick={() => updateProject(i)}>
                      Edit
                    </Button>
                  </Entity.Field>
                </Entity.Content>
              </Entity.Wrapper>
            ))}
          </>
        ))}
      </Wrapper>
    </>
  );
};
