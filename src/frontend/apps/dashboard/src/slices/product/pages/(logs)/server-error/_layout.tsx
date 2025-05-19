import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useServerRunErrorGroup
} from '@metorial/state';
import { Datalist, LinkTabs, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';

let Grid = styled.div`
  display: grid;
  grid-template-columns: calc(100% - 350px) 300px;
  gap: 50px;
`;

let Main = styled.main``;

let Aside = styled.aside``;

export let ServerErrorLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { serverErrorId } = useParams();
  let error = useServerRunErrorGroup(instance.data?.id, serverErrorId);

  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    error.data?.id ?? serverErrorId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={error.data?.message ?? ''}
        pagination={[
          {
            label: 'Errors',
            href: Paths.instance.serverErrors(organization.data, project.data, instance.data)
          },
          {
            label: error.data?.code,
            href: Paths.instance.serverError(...serverPathParams)
          }
        ]}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Occurrences',
            to: Paths.instance.serverError(...serverPathParams)
          }
          // {
          //   label: 'Affected Deployments',
          //   to: Paths.instance.serverError(...serverPathParams, 'deployments')
          // }
        ]}
      />

      {renderWithLoader({ error })(({ error }) => (
        <Grid>
          <Main>
            <Outlet />
          </Main>
          <Aside>
            <Datalist
              items={[
                { label: 'Error Group ID', value: <ID id={error.data.id} /> },
                { label: 'First Seen', value: <RenderDate date={error.data.createdAt} /> },
                {
                  label: 'Occurrences',
                  value: error.data.count
                },
                { label: 'Code', value: error.data.code },

                {
                  label: 'Server Name',
                  value: error.data.defaultError?.serverRun.server.name ?? 'unknown'
                },
                {
                  label: 'Server ID',
                  value: <ID id={error.data.defaultError?.serverRun.server.id} />
                }
              ]}
            />
          </Aside>
        </Grid>
      ))}
    </ContentLayout>
  );
};
