import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags,
  useUser
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import { showCustomProviderRemoteFormModal } from '../../../scenes/customProvider/modal';

export let CustomProvidersListLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let user = useUser();
  let pathname = useLocation().pathname;

  let listPathParams = [organization.data, project.data, instance.data] as const;
  let isRemoteList = pathname.endsWith('/external-providers');
  let page = isRemoteList
    ? {
        title: 'Remote MCP Servers',
        description: 'Connect to remote MCP servers using the Metorial platform.',
        actionLabel: 'Link Remote MCP Server',
        actionType: 'remote' as const
      }
    : {
        title: 'Custom MCP Servers',
        description:
          'Build custom MCP servers powered by Metorial. Deploy them on your own infrastructure or use Metorial-managed infrastructure.',
        actionLabel: 'Create Custom MCP Server',
        actionType: 'managed' as const
      };

  let openCreateModal = (type: 'remote' | 'managed') => {
    if (type === 'managed' && !user.data) return;

    showCustomProviderRemoteFormModal({
      type
    });
  };

  let renderActions = () => {
    if (isRemoteList) {
      return (
        !!flags.data?.flags['paid-custom-providers'] && (
          <Button onClick={() => openCreateModal(page.actionType)} size="2">
            {page.actionLabel}
          </Button>
        )
      );
    }

    return (
      !!(
        flags.data?.flags['custom-providers-enabled'] &&
        flags.data?.flags['paid-custom-providers']
      ) && (
        <Button
          onClick={() => openCreateModal(page.actionType)}
          loading={user.isLoading}
          disabled={!user.data && !user.isLoading}
          size="2"
        >
          {page.actionLabel}
        </Button>
      )
    );
  };

  return (
    <ContentLayout>
      <PageHeader
        title={page.title}
        description={page.description}
        actions={renderActions()}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Remote MCP Server',
            to: Paths.instance.externalProviders(...listPathParams)
          },
          {
            label: 'Custom MCP Server',
            to: Paths.instance.customProviders(...listPathParams)
          }
        ]}
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};
