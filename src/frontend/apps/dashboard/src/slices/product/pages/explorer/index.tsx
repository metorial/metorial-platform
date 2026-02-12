import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCreateProviderDeployment,
  useCurrentInstance,
  useProvider,
  useProviderDeployments
} from '@metorial/state';
import { Button, Flex, Input, Spacer, Tabs, Text, theme } from '@metorial/ui';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Explainer } from '../../../../components/explainer';
import { ProviderDeploymentsList } from '../../scenes/providerDeployments/list';
import { ProviderSearch } from '../../scenes/providers/search';
import { InspectorFrame } from './inspector';

type Provider = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
};

let Wrapper = styled.div`
  display: flex;
  height: calc(100vh - 78px);
`;

let Aside = styled(motion.aside)`
  height: 100%;
  position: relative;
  border-right: 1px solid ${theme.colors.gray400};
`;

let AsideInner = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #fafafa;
  overflow-y: auto;
  overflow-x: hidden;
`;

let Main = styled.main`
  height: 100%;
  overflow: hidden;
  flex: 1;
`;

let MainEmpty = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  p {
    color: ${theme.colors.gray600};
    font-size: 24px;
    font-weight: 500;
  }
`;

let Open = styled.button`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: none;

  svg {
    height: 20px;
    width: 20px;
    color: ${theme.colors.gray600};
  }
`;

let Providers = styled.div`
  padding: 20px;
`;

let CreateForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding-top: 15px;
`;

export let ExplorerPage = () => {
  let [open, setOpen] = useState(true);

  let [providerTab, setProviderTab] = useState<'create' | 'list'>('create');
  let [providerDeploymentId, setProviderDeploymentId] = useState<string | null>(null);

  let instance = useCurrentInstance();

  let [search, setSearch] = useSearchParams();
  let providerIdParam = search.get('provider_id');
  let providerDeploymentIdParam = search.get('provider_deployment_id');

  let provider = useProvider(instance.data?.instanceId, providerIdParam ?? undefined);
  let [selectedProvider, _setSelectedProvider] = useState<Provider | null>(null);
  useEffect(() => {
    if (provider.data) {
      _setSelectedProvider(provider.data);
    }
  }, [provider.data]);

  useEffect(() => {
    if (providerDeploymentIdParam) setProviderDeploymentId(providerDeploymentIdParam);
  }, [providerDeploymentIdParam]);

  useEffect(() => {
    if (providerDeploymentId) {
      setOpen(false);

      setSearch(
        v => {
          v.set('provider_deployment_id', providerDeploymentId);
          return v;
        },
        { replace: true }
      );
    }
  }, [providerDeploymentId]);

  let deploymentsFilter = useMemo(
    () => ({
      providerId: selectedProvider ? selectedProvider.id : undefined
    }),
    [selectedProvider]
  );

  let deployments = useProviderDeployments(instance.data?.instanceId, deploymentsFilter);

  useEffect(() => {
    let deploymentsForCurrentProvider = deployments.data?.items.filter(
      d => d.providerId == (selectedProvider?.id ?? providerIdParam)
    );

    if (!deployments.isLoading && deploymentsForCurrentProvider?.length)
      setProviderTab('list');
  }, [deployments.data, deployments.isLoading]);

  let [deploymentName, setDeploymentName] = useState('');
  let [deploymentDescription, setDeploymentDescription] = useState('');
  let [isCreating, setIsCreating] = useState(false);
  let [createError, setCreateError] = useState<string | null>(null);
  let createMutation = useCreateProviderDeployment();

  let handleCreateDeployment = async () => {
    if (!instance.data || !selectedProvider || !deploymentName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    let [result, err] = await createMutation.mutate({
      instanceId: instance.data.instanceId,
      name: deploymentName.trim(),
      description: deploymentDescription.trim() || undefined,
      providerId: selectedProvider.id
    });

    setIsCreating(false);

    if (err) {
      console.error('Failed to create deployment:', err);
      setCreateError(err.data?.message || 'Failed to create deployment');
    } else if (result) {
      setProviderDeploymentId(result.id);
      setDeploymentName('');
      setDeploymentDescription('');
    }
  };

  return (
    <Wrapper>
      <Aside
        initial={{ width: 400 }}
        animate={open ? { width: 450 } : { width: 30 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <AnimatePresence>
          <AsideInner
            key={
              open ? (selectedProvider ? 'select_deployment' : 'select_provider') : 'closed'
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            {!open && (
              <Open onClick={() => setOpen(!open)}>
                <RiArrowRightLine />
              </Open>
            )}

            {open && (
              <Providers>
                {!selectedProvider && !providerIdParam && (
                  <>
                    {providerDeploymentId && (
                      <>
                        <Button
                          iconLeft={<RiCloseLine />}
                          onClick={() => setOpen(!open)}
                          size="1"
                          variant="outline"
                          type="button"
                        >
                          Close
                        </Button>

                        <Spacer height={10} />
                      </>
                    )}

                    <Text as="p" size="3" weight="strong" color="gray900">
                      Select a provider
                    </Text>

                    <Spacer height={5} />

                    <ProviderSearch
                      onSelect={provider => {
                        _setSelectedProvider(provider);
                        setSearch(
                          v => {
                            v.set('provider_id', provider.id);
                            return v;
                          },
                          { replace: true }
                        );
                      }}
                    />
                  </>
                )}

                {selectedProvider &&
                  renderWithLoader({ deployments, provider })(() => (
                    <>
                      <Flex justify="space-between" align="center">
                        <Button
                          iconLeft={<RiArrowLeftLine />}
                          onClick={() => {
                            _setSelectedProvider(null);
                            setSearch(v => new URLSearchParams(), { replace: true });
                            setOpen(true);
                          }}
                          size="1"
                          variant="outline"
                          type="button"
                        >
                          Back
                        </Button>

                        <Button
                          iconLeft={<RiCloseLine />}
                          onClick={() => setOpen(!open)}
                          size="1"
                          variant="outline"
                          type="button"
                        >
                          Close
                        </Button>
                      </Flex>

                      <Spacer height={10} />

                      <Text as="p" size="3" weight="strong" color="gray900">
                        {providerTab == 'create' ? (
                          <>
                            Set up{' '}
                            {selectedProvider.name ?? selectedProvider.slug ?? 'Provider'}
                          </>
                        ) : (
                          <>Choose a deployment</>
                        )}
                      </Text>

                      <Spacer height={5} />

                      <Tabs
                        tabs={[
                          { id: 'create', label: 'Create' },
                          { id: 'list', label: 'Your Deployments' }
                        ]}
                        action={v => setProviderTab(v as 'create' | 'list')}
                        current={providerTab}
                      />

                      {providerTab == 'create' && (
                        <CreateForm>
                          <Input
                            label="Deployment Name"
                            value={deploymentName}
                            onChange={e => setDeploymentName(e.target.value)}
                            placeholder="My Deployment"
                            required
                          />

                          <Input
                            label="Description"
                            value={deploymentDescription}
                            onChange={e => setDeploymentDescription(e.target.value)}
                            placeholder="Optional description"
                            as="textarea"
                            minRows={2}
                          />

                          {createError && (
                            <Text size="2" color="red500">
                              {createError}
                            </Text>
                          )}

                          <Flex gap={10}>
                            <Button
                              type="button"
                              variant="outline"
                              size="2"
                              onClick={() => {
                                _setSelectedProvider(null);
                                setSearch(v => new URLSearchParams(), { replace: true });
                                setOpen(true);
                              }}
                            >
                              Back
                            </Button>
                            <Button
                              type="button"
                              size="2"
                              onClick={handleCreateDeployment}
                              loading={isCreating}
                              disabled={!deploymentName.trim()}
                            >
                              Create & Connect
                            </Button>
                          </Flex>
                        </CreateForm>
                      )}

                      {providerTab == 'list' && (
                        <ProviderDeploymentsList
                          providerId={selectedProvider.id}
                          order="desc"
                          onDeploymentClick={deployment => {
                            setOpen(false);
                            setProviderDeploymentId(deployment.id);
                          }}
                        />
                      )}
                    </>
                  ))}
              </Providers>
            )}
          </AsideInner>
        </AnimatePresence>
      </Aside>

      <Main>
        {!providerDeploymentId && (
          <MainEmpty>
            <p>Click on a provider to start</p>
          </MainEmpty>
        )}

        {providerDeploymentId && (
          <InspectorFrame providerDeployment={{ id: providerDeploymentId }} />
        )}
      </Main>

      <Explainer
        title="Using the MCP Explorer"
        description="Learn how to use the Explorer to explore and interact with your MCP provider."
        youtubeId="mzGOU3LVuT0"
        id="explorer"
      />
    </Wrapper>
  );
};
