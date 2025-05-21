import { ServersDeploymentsDeleteOutput } from '@metorial/core';
import { ServersListingsGetOutput } from '@metorial/core/src/mt_2025_01_01_dashboard';
import { Button, Spacer, Tabs, Text, theme } from '@metorial/ui';
import { RiArrowLeftLine, RiArrowRightLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { ServerDeploymentForm } from '../../scenes/server-deployments/form';
import { ServerDeploymentsList } from '../../scenes/server-deployments/table';
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
  let [selectServer, setSelectServer] = useState<ServersListingsGetOutput | null>(null);
  let [serverTab, setServerTab] = useState<'create' | 'list'>('create');
  let [serverDeployment, setServerDeployment] =
    useState<ServersDeploymentsDeleteOutput | null>(null);

  useEffect(() => {
    if (!serverDeployment) return;
    setOpen(false);
    setSelectServer(null);
    setServerTab('create');
  }, [serverDeployment]);

  return (
    <Wrapper>
      <Aside
        initial={{ width: 300 }}
        animate={selectServer ? { width: 500 } : open ? { width: 300 } : { width: 30 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <AnimatePresence>
          <AsideInner
            key={open ? 'open' : 'closed'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            {!open && !selectServer && (
              <Open onClick={() => setOpen(!open)}>
                <RiArrowRightLine />
              </Open>
            )}

            {open && !selectServer && (
              <Servers>
                {serverDeployment && (
                  <>
                    <Button
                      iconLeft={<RiArrowLeftLine />}
                      onClick={() => setOpen(!open)}
                      size="1"
                      variant="outline"
                    >
                      Close
                    </Button>
                    <Spacer height={10} />
                  </>
                )}

                <Text as="p" size="3" weight="strong" color="gray900">
                  Select a server
                </Text>

                <Spacer height={5} />

                <ServerSearch onSelect={server => setSelectServer(server)} />
              </Servers>
            )}

            {selectServer && (
              <Servers>
                <Text as="p" size="3" weight="strong" color="gray900">
                  {serverTab == 'create' ? (
                    <>Set up {selectServer.name}</>
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
                    for={{
                      serverId: selectServer.server.id
                    }}
                    extraActions={
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectServer(null);
                          setOpen(true);
                        }}
                      >
                        Back
                      </Button>
                    }
                  />
                )}

                {serverTab == 'list' && (
                  <ServerDeploymentsList
                    serverIds={[selectServer.server.id]}
                    onDeploymentClick={deployment => {
                      setServerDeployment(deployment);
                    }}
                  />
                )}
              </Servers>
            )}
          </AsideInner>
        </AnimatePresence>
      </Aside>

      <Main>
        {!serverDeployment && (
          <MainEmpty>
            <p>Click on a server to start</p>
          </MainEmpty>
        )}

        {serverDeployment && <InspectorFrame serverDeployment={serverDeployment} />}
      </Main>
    </Wrapper>
  );
};
