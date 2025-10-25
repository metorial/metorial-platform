import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags, useServerDeployment } from '@metorial/state';
import { Button, Spacer, Switch, TextArrayInput } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { ServerDeploymentForm } from '../../../scenes/serverDeployments/form';

export let ServerDeploymentConfigPage = () => {
  let { serverDeploymentId } = useParams();
  let instance = useCurrentInstance();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  let update = deployment.useUpdateMutator();
  let flags = useDashboardFlags();

  let advancedSecurityForm = useForm({
    initialValues:
      deployment.data?.access?.ipAllowlist.status == 'enabled'
        ? {
            ipAllowlistEnabled: true,
            ipWhitelist: deployment.data?.access?.ipAllowlist.ipWhitelist,
            ipBlacklist: deployment.data?.access?.ipAllowlist.ipBlacklist
          }
        : {
            ipAllowlistEnabled: false,
            ipWhitelist: [],
            ipBlacklist: []
          },
    onSubmit: async values => {
      if (!deployment.data) return;

      await update.mutate({
        access: {
          ipAllowlist: values.ipAllowlistEnabled
            ? {
                ipWhitelist: values.ipWhitelist.filter(ip => ip.trim() !== ''),
                ipBlacklist: values.ipBlacklist.filter(ip => ip.trim() !== '')
              }
            : null
        }
      });
    },
    schema: yup =>
      yup.object().shape({
        ipAllowlistEnabled: yup.boolean().required(),
        ipWhitelist: yup.array().of(yup.string()),
        ipBlacklist: yup.array().of(yup.string())
      }) as any
  });

  return renderWithLoader({ deployment })(({ deployment }) => (
    <>
      <ServerDeploymentForm type="update" serverDeploymentId={deployment.data.id} />

      <Spacer height={20} />

      <Box
        title="Advanced Security"
        description="Configure advanced security settings for this server deployment."
      >
        <form onSubmit={advancedSecurityForm.handleSubmit}>
          <Switch
            checked={advancedSecurityForm.values.ipAllowlistEnabled}
            label="Enable IP Allowlist"
            onCheckedChange={async v => {
              await advancedSecurityForm.setFieldValue('ipAllowlistEnabled', v);
              if (!v) {
                setTimeout(() => {
                  advancedSecurityForm.submitForm();
                }, 50);
              }
            }}
          />

          {advancedSecurityForm.values.ipAllowlistEnabled && (
            <>
              <Spacer height={15} />

              <TextArrayInput
                label="IP Whitelist"
                value={advancedSecurityForm.values.ipWhitelist}
                onChange={v => advancedSecurityForm.setFieldValue('ipWhitelist', v)}
              />

              <Spacer height={15} />

              <TextArrayInput
                label="IP Blacklist"
                value={advancedSecurityForm.values.ipBlacklist}
                onChange={v => advancedSecurityForm.setFieldValue('ipBlacklist', v)}
              />

              <Spacer height={20} />

              <Button type="submit" loading={update.isLoading} success={update.isSuccess}>
                Save
              </Button>
            </>
          )}
        </form>
      </Box>
    </>
  ));
};
