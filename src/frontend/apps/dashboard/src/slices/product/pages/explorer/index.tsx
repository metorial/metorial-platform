import { renderWithLoader } from '@metorial/data-hooks';
import { ServersListingsGetOutput } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { useCurrentInstance, useServerDeployments, useServerListing } from '@metorial/state';
import { Button, Spacer, Tabs, Text, theme } from '@metorial/ui';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { ServerDeploymentForm } from '../../scenes/serverDeployments/form';
import { ServerDeploymentsList } from '../../scenes/serverDeployments/table';
import { ServerSearch } from '../../scenes/servers/search';
import { InspectorFrame } from './inspector';

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

let Servers = styled.div`
  padding: 20px;
`;

export let ExplorerPage = () => {
  let [open, setOpen] = useState(true);

  let [serverTab, setServerTab] = useState<'create' | 'list'>('create');

  let [serverDeploymentId, setServerDeploymentId] = useState<string | null>(null);

  let instance = useCurrentInstance();

  let [search, setSearch] = useSearchParams();
  let serverIdParam = search.get('server_id');
  let serverDeploymentIdParam = search.get('server_deployment_id');
  let serverImplementationIdParam = search.get('server_implementation_id');

  let server = useServerListing(serverIdParam);
  let [selectedServer, _setSelectedServer] = useState<ServersListingsGetOutput | null>(null);
  useEffect(() => _setSelectedServer(server.data), [server.data]);

  useEffect(() => {
    if (serverDeploymentIdParam) setServerDeploymentId(serverDeploymentIdParam);
  }, [serverDeploymentIdParam]);

  useEffect(() => {
    if (serverDeploymentId) {
      setOpen(false);

      setSearch(v => {
        v.set('server_deployment_id', serverDeploymentId);
        return v;
      });
    }
  }, [serverDeploymentId]);

  let serverDeploymentsFilter = useMemo(
    () => ({
      serverId: selectedServer ? [selectedServer.server.id] : undefined,
      serverImplementationId: serverImplementationIdParam
        ? [serverImplementationIdParam]
        : undefined
    }),
    [selectedServer, serverImplementationIdParam]
  );

  let deployments = useServerDeployments(instance.data?.id, serverDeploymentsFilter);

  useEffect(() => {
    let deploymentsForCurrentServer = deployments.data?.items.filter(
      d => d.server.id == (selectedServer?.server.id ?? serverIdParam)
    );

    if (!deployments.isLoading && deploymentsForCurrentServer?.length) setServerTab('list');
  }, [deployments.data, deployments.isLoading]);

  return (
    <Wrapper>
      <Aside
        initial={{ width: 400 }}
        animate={open ? { width: 450 } : { width: 30 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <AnimatePresence>
          <AsideInner
            key={open ? (selectedServer ? 'select_deployment' : 'select_server') : 'closed'}
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
              <Servers>
                {serverDeploymentId && (
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

                {!selectedServer && !serverIdParam && (
                  <>
                    <Text as="p" size="3" weight="strong" color="gray900">
                      Select a server
                    </Text>

                    <Spacer height={5} />

                    <ServerSearch
                      onSelect={server => {
                        _setSelectedServer(server);
                        setSearch(v => {
                          v.set('server_id', server.id);
                          return v;
                        });
                      }}
                    />
                  </>
                )}

                {selectedServer &&
                  renderWithLoader({ deployments })(() => (
                    <>
                      <Button
                        iconLeft={<RiArrowLeftLine />}
                        onClick={() => {
                          _setSelectedServer(null);
                          setSearch(v => new URLSearchParams());
                          setOpen(true);
                        }}
                        size="1"
                        variant="outline"
                        type="button"
                      >
                        Back
                      </Button>

                      <Spacer height={10} />

                      <Text as="p" size="3" weight="strong" color="gray900">
                        {serverTab == 'create' ? (
                          <>Set up {selectedServer.name}</>
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
                        action={v => setServerTab(v as 'create' | 'list')}
                        current={serverTab}
                      />

                      {serverTab == 'create' && (
                        <ServerDeploymentForm
                          type="create"
                          for={
                            serverImplementationIdParam
                              ? {
                                  serverId: selectedServer.server.id,
                                  serverImplementationId: serverImplementationIdParam
                                }
                              : {
                                  serverId: selectedServer.server.id
                                }
                          }
                          extraActions={
                            <Button
                              type="button"
                              variant="outline"
                              size="2"
                              onClick={() => {
                                _setSelectedServer(null);
                                setSearch(v => new URLSearchParams());
                                setOpen(true);
                              }}
                            >
                              Back
                            </Button>
                          }
                          onCreate={deployment => {
                            setServerDeploymentId(deployment.id);
                          }}
                        />
                      )}

                      {serverTab == 'list' && (
                        <ServerDeploymentsList
                          {...serverDeploymentsFilter}
                          onDeploymentClick={deployment => {
                            setServerDeploymentId(deployment.id);
                          }}
                        />
                      )}
                    </>
                  ))}
              </Servers>
            )}
          </AsideInner>
        </AnimatePresence>
      </Aside>

      <Main>
        {!serverDeploymentId && (
          <MainEmpty>
            <p>Click on a server to start</p>
          </MainEmpty>
        )}

        {serverDeploymentId && (
          <InspectorFrame serverDeployment={{ id: serverDeploymentId }} />
        )}
      </Main>
    </Wrapper>
  );
};
