import { SetupLayout } from '@metorial/layout';
import { Button, CenteredSpinner, Spacer } from '@metorial/ui';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../../state/portal/auth';
import { useBoot } from '../../state/portal/client';
import { usePaths } from '../../state/portal/path';

export let LoginPage = () => {
  let boot = useBoot();
  let auth = usePortalAuth();
  let Paths = usePaths();
  let navigate = useNavigate();
  let location = useLocation();
  let hasHandledCallback = useRef(false);
  let homePath = Paths.home();

  let startSso = auth.useStartSso();
  let completeSso = auth.useCompleteSso();

  let params = new URLSearchParams(location.search);
  let code = params.get('code');
  let state = params.get('state');
  let unauthenticatedBoot = boot.data?.type == 'unauthenticated' ? boot.data : null;
  let portalName = boot.data?.portal.name || 'Metorial portal';

  useEffect(() => {
    if (boot.data?.type != 'authenticated') return;
    navigate(homePath, { replace: true });
  }, [boot.data, navigate, homePath]);

  useEffect(() => {
    if (hasHandledCallback.current) return;
    if (!code || !state) return;
    if (!unauthenticatedBoot) return;

    hasHandledCallback.current = true;

    void (async () => {
      let [result] = await completeSso.mutate({
        portalId: unauthenticatedBoot.portal.id,
        code,
        state
      });

      if (result) {
        navigate(homePath, { replace: true });
      }
    })();
  }, [unauthenticatedBoot, code, state, completeSso, navigate, homePath]);

  if (
    boot.isLoading ||
    boot.data?.type == 'authenticated' ||
    (code && state && !completeSso.error)
  ) {
    return (
      <SetupLayout
        main={{
          title: portalName,
          description: 'Secure access to your portal workspace.'
        }}
      >
        <CenteredSpinner />
      </SetupLayout>
    );
  }

  return (
    <SetupLayout
      main={{
        title: portalName,
        description:
          'Continue with your organization SSO to access the catalog and Magic MCP workspace.'
      }}
    >
      <Button
        size="3"
        loading={startSso.isLoading}
        fullWidth
        onClick={async () => {
          let [result] = await startSso.mutate(undefined);
          if (result?.url) {
            window.location.replace(result.url);
          }
        }}
      >
        Continue with SSO
      </Button>

      <Spacer height={14} />
      <startSso.RenderError />
      <completeSso.RenderError />
    </SetupLayout>
  );
};
