import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { Outlet, useNavigate } from 'react-router-dom';
import { Explainer } from '../../../../../components/explainer';
import { showCallbackFormModal } from '../../../scenes/callbacks/modal';

export let CallbacksListLayout = () => {
  let flags = useDashboardFlags();
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let canCreateCallback =
    !!flags.data?.flags['callbacks-enabled'] && !!flags.data?.flags['paid-callbacks'];

  return (
    <ContentLayout>
      <PageHeader
        title="Callbacks"
        description="Receive async notifications for events that occur within providers."
        actions={
          canCreateCallback ? (
            <Button
              size="2"
              onClick={() =>
                instance.data &&
                showCallbackFormModal({
                  instanceId: instance.data.id,
                  onCreate: callback => {
                    if (!instance.data) return;

                    navigate(
                      Paths.instance.callback(
                        organization.data,
                        project.data,
                        instance.data,
                        callback.id
                      )
                    );
                  }
                })
              }
            >
              Add Callback
            </Button>
          ) : undefined
        }
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>

      <Explainer
        title="Understanding Callbacks"
        description="Learn how to use callbacks to receive notifications for events that occur within providers."
        videoUrl="https://dashboard-assets.metorial-cdn.com/videos/metorial-dashboard-onboarding/2026-07-13/callbacks.mp4"
        id="callbacks-home"
      />
    </ContentLayout>
  );
};
