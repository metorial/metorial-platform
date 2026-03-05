import { ContentLayout, PageHeader, createInstance, updateInstance } from '@metorial/layout';
import { useCurrentProject } from '@metorial/state';
import { Badge, Button, Entity, RenderDate } from '@metorial/ui';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let ProjectSettingsInstancesPage = () => {
  let project = useCurrentProject();
  let instances = project.data?.instances;

  return (
    <ContentLayout variant="medium">
      <PageHeader
        title="Instances"
        description="Create multiple project instances for different environments. For example, one for production, one for staging, and one for development."
        actions={
          <Button size="2" onClick={() => project.data && createInstance(project.data)}>
            Create Instance
          </Button>
        }
      />

      <Wrapper>
        {instances?.map(i => (
          <Entity.Wrapper key={i.id}>
            <Entity.Content>
              <Entity.Field
                title={i.name}
                prefix={
                  i.type == 'production' ? (
                    <Badge color="blue">Production</Badge>
                  ) : (
                    <Badge color="orange">Development</Badge>
                  )
                }
              />

              <Entity.Field title="Created" value={<RenderDate date={i.createdAt} />} />

              <Entity.Field title="Actions" right>
                <Button size="1" variant="soft" onClick={() => updateInstance(i)}>
                  Edit
                </Button>
              </Entity.Field>
            </Entity.Content>
          </Entity.Wrapper>
        ))}
      </Wrapper>
    </ContentLayout>
  );
};
