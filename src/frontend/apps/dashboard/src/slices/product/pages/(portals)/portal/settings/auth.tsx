import { renderWithLoader, useForm } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  usePortal,
  usePortalConsumerAuthFactors,
  useSsoTenants
} from '@metorial/state';
import { Button, Dialog, Entity, Flex, Input, showModal, Spacer, Switch } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Fragment, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FormBox } from '../../../../scenes/form/box';
import { Field } from '../../../../scenes/form/field';

export let PortalSettingsAuthPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);
  let factors = usePortalConsumerAuthFactors(instance.data?.id, portal.data?.id, {
    limit: 100
  });
  let factorsOuter = factors;
  let ssoTenants = useSsoTenants(instance.data?.id);

  let updateMutator = portal.useUpdateMutator();

  let deleteMutator = factors.useDeleteMutator();
  let createMutator = factors.useCreateMutator();

  let anyIsLoading = deleteMutator.isLoading || createMutator.isLoading;

  let emailFactor = factors.data?.items.find(f => f.type == 'email_code');
  let ssoFactors = factors.data?.items.filter(f => f.type == 'sso');

  let addSsoFactor = async () => {
    showModal(({ dialogProps }) => {
      let createSsoTenantMutator = ssoTenants.useCreateMutator();
      let setupSsoTenantMutator = ssoTenants.useSetupMutator();

      let form = useForm({
        initialValues: {
          name: ''
        },
        updateInitialValues: true,
        onSubmit: async values => {
          let [ssoTenant] = await createSsoTenantMutator.mutate({
            name: values.name
          });
          if (!ssoTenant) return;

          let url = new URL(window.location.href);
          url.searchParams.set('sso_tenant_id', ssoTenant.id);

          let [ssoTenantSetup] = await setupSsoTenantMutator.mutate({
            ssoTenantId: ssoTenant.id,
            redirectUri: url.toString()
          });
          if (!ssoTenantSetup) return;

          window.location.href = ssoTenantSetup.url;
        },
        schema: yup =>
          yup.object().shape({
            name: yup.string().required('Name is required')
          })
      });

      return (
        <Dialog.Wrapper {...dialogProps}>
          <Dialog.Title>Setup SSO Authentication</Dialog.Title>

          <Spacer height={5} />

          <form onSubmit={form.handleSubmit}>
            <Input label="Name" {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer height={15} />

            <Button
              type="submit"
              size="2"
              loading={
                createSsoTenantMutator.isLoading ||
                setupSsoTenantMutator.isLoading ||
                form.isSubmitting
              }
            >
              Save
            </Button>
          </form>
        </Dialog.Wrapper>
      );
    });
  };

  let [searchParams, setSearchParams] = useSearchParams();
  let ssoTenantId = searchParams.get('sso_tenant_id');

  let ssoTenantSetupCompleteRef = useRef(false);
  useEffect(() => {
    if (!ssoTenantId) return;
    if (ssoTenantSetupCompleteRef.current) return;
    setSearchParams(s => {
      s.delete('sso_tenant_id');
      return s;
    });

    ssoTenantSetupCompleteRef.current = true;

    (async () => {
      await createMutator.mutate({ type: 'sso', ssoTenantId });
    })().catch(console.error);
  }, [ssoTenantId]);

  return (
    <>
      {renderWithLoader({ portal, factors })(({ portal, factors }) => (
        <>
          <FormBox
            title="Authentication Settings"
            description="Manage authentication methods for users accessing this portal."
            initialValues={{
              sessionExpiryTimeInSeconds: portal.data.auth.sessionExpiryTimeInSeconds
            }}
            schema={yup =>
              yup.object({
                sessionExpiryTimeInSeconds: yup
                  .number()
                  .min(600, 'Session expiry time must be at least 600 seconds (10 minutes).')
                  .required('Session expiry time is required.')
              })
            }
            onSubmit={val => {
              return updateMutator.mutate({
                sessionExpiryTimeInSeconds: val.sessionExpiryTimeInSeconds
              });
            }}
            mutators={[updateMutator]}
          >
            <Field field="sessionExpiryTimeInSeconds">
              {({ getFieldProps }) => (
                <Input
                  type="number"
                  label="Session Expiry Time (in seconds)"
                  description="Set the duration (in seconds) before a user's session expires."
                  {...getFieldProps()}
                />
              )}
            </Field>
          </FormBox>

          <Spacer size={15} />

          <Box
            title="Email Code Authentication"
            description="Allow users to log in using their email address."
          >
            <Switch
              label="Enable Email Code Authentication"
              checked={emailFactor?.status == 'active'}
              disabled={anyIsLoading}
              onCheckedChange={async value => {
                if (value) {
                  await createMutator.mutate({ type: 'email_code' });
                } else {
                  await deleteMutator.mutate({ consumerAuthFactorId: emailFactor!.id });
                }
              }}
            />
          </Box>

          <Spacer size={15} />

          <Box
            title="SSO Authentication"
            description="Authenticate users via Single Sign-On (SSO) providers."
          >
            {ssoFactors?.length == 0 ? (
              <Switch
                label="Enable SSO Authentication"
                checked={false}
                disabled={anyIsLoading}
                onCheckedChange={_ => addSsoFactor()}
              />
            ) : (
              <>
                {ssoFactors?.map((factor, i) => (
                  <Fragment key={factor.id}>
                    {i > 0 && <Spacer size={15} />}

                    <Entity.Wrapper>
                      <Entity.Content>
                        <Entity.Field title={factor.name} />
                        <Entity.Field title="Actions" right>
                          <Flex gap={10}>
                            <Button
                              size="1"
                              variant="outline"
                              disabled={anyIsLoading}
                              onClick={async () => {
                                await deleteMutator.mutate({
                                  consumerAuthFactorId: factor.id
                                });
                              }}
                            >
                              Remove
                            </Button>

                            <Button
                              size="1"
                              variant="outline"
                              disabled={anyIsLoading}
                              onClick={() =>
                                showModal(({ dialogProps, close }) => {
                                  let updateMutator = factorsOuter.useUpdateMutator();

                                  let form = useForm({
                                    initialValues: {
                                      name: factor.name,
                                      publicName: factor.publicName
                                    },
                                    updateInitialValues: true,
                                    onSubmit: async values => {
                                      await updateMutator.mutate({
                                        consumerAuthFactorId: factor.id,
                                        name: values.name,
                                        publicName: values.publicName
                                      });
                                      setTimeout(() => close(), 500);
                                    },
                                    schema: yup =>
                                      yup.object().shape({
                                        name: yup.string().required('Name is required'),
                                        publicName: yup
                                          .string()
                                          .required('Public Name is required')
                                      })
                                  });

                                  return (
                                    <Dialog.Wrapper {...dialogProps}>
                                      <Dialog.Title>Edit SSO Factor</Dialog.Title>

                                      <Spacer height={5} />

                                      <form onSubmit={form.handleSubmit}>
                                        <Input label="Name" {...form.getFieldProps('name')} />
                                        <form.RenderError field="name" />

                                        <Spacer height={15} />

                                        <Input
                                          label="Public Name"
                                          {...form.getFieldProps('publicName')}
                                        />
                                        <form.RenderError field="publicName" />

                                        <Spacer height={15} />

                                        <Button
                                          type="submit"
                                          size="2"
                                          loading={updateMutator.isLoading}
                                          success={updateMutator.isSuccess}
                                        >
                                          Save
                                        </Button>
                                      </form>
                                    </Dialog.Wrapper>
                                  );
                                })
                              }
                            >
                              Edit
                            </Button>
                          </Flex>
                        </Entity.Field>
                      </Entity.Content>
                    </Entity.Wrapper>
                  </Fragment>
                ))}

                <Spacer size={15} />

                <Button onClick={() => addSsoFactor()} size="2" disabled={anyIsLoading}>
                  Add Another SSO Provider
                </Button>
              </>
            )}
          </Box>
        </>
      ))}
    </>
  );
};
