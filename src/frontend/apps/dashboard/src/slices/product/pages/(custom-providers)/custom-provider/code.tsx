import { DashboardInstanceScmReposCreateOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { getConfig, Paths } from '@metorial/frontend-config';
import {
  useCreateCustomProviderVersion,
  useCurrentInstance,
  useCustomProvider,
  useCustomProviderCodeEditorToken,
  useCustomProviderEnv
} from '@metorial/state';
import { Button, Dialog, Flex, Input, showModal, Spacer, Text, theme, toast } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { RiArrowRightSLine, RiExpandDiagonal2Line, RiUpload2Line } from '@remixicon/react';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  getCustomProviderLinkedRepo,
  getFunctionProviderVersionFrom,
  normalizeEnvRecord,
  normalizeRepoPath
} from '../../../scenes/customProvider/utils';
import { SelectRepo } from '../../../scenes/customProvider/selectRepo';

let Wrapper = styled.div`
  &[data-expanded='true'] {
    overflow: hidden;
    position: fixed;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 99999;
  }

  &[data-expanded='false'] {
    border: 1px solid ${theme.colors.gray400};
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    width: 100%;
    height: calc(95vh - 300px);
  }
`;

let Nav = styled(motion.nav)`
  position: absolute;
  top: 0;
  left: 0;
  height: 34px;
  display: flex;
  align-items: center;
  padding: 0 5px;
  gap: 6px;
`;

let Iframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  border-radius: inherit;
  background: #fff;
`;

export let CustomProviderCodePage = () => {
  let instance = useCurrentInstance();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);
  let customProviderEnv = useCustomProviderEnv(instance.data?.id, customProvider.data?.id);

  let editorToken = useCustomProviderCodeEditorToken(
    instance.data?.id,
    customProvider.data?.id
  );

  let [isExpanded, setIsExpanded] = useState(false);

  let url = useMemo(() => {
    if (!editorToken.data) return null;
    if (editorToken.data.url) return editorToken.data.url;
    return getConfig().microFrontends?.codeEditorUrl ?? null;
  }, [editorToken.data]);

  let createVersion = useCreateCustomProviderVersion();
  let navigate = useNavigate();

  let linkedRepo = useMemo(
    () => getCustomProviderLinkedRepo(customProvider.data),
    [customProvider.data]
  );
  let codeManagementUnavailable =
    Boolean(customProvider.data?.draft?.remoteMcpServer) ||
    Boolean(customProvider.data?.draft?.containerImage);

  let publishFrom = useMemo(() => {
    if (!customProvider.data) return null;
    let env = normalizeEnvRecord(customProviderEnv.data?.env);
    return getFunctionProviderVersionFrom(customProvider.data, env);
  }, [customProvider.data, customProviderEnv.data?.env]);

  let canPublish =
    Boolean(publishFrom) && !customProviderEnv.isLoading && !customProviderEnv.error;

  let publishNewVersion = async () => {
    if (!canPublish || !publishFrom) {
      if (customProviderEnv.error) {
        toast.error('Could not load environment variables. Try again from Settings.');
      }
      return;
    }

    let [version] = await createVersion.mutate({
      instanceId: instance.data!.id,
      customProviderId: customProvider.data!.id,
      from: publishFrom
    });

    if (version) {
      navigate(
        Paths.instance.customProvider(
          instance.data?.organization,
          instance.data?.project,
          instance.data,
          version.customProviderId,
          'versions',
          { version_id: version.id }
        )
      );
    }
  };

  return renderWithLoader({ customProvider })(({ customProvider }) => (
    <>
      {codeManagementUnavailable ? (
        <SideBox
          title="Code Management Unavailable"
          description="Remote and Docker-backed providers do not support repository or in-dashboard code management."
        >
          <Text size="2" color="gray600">
            Manage code and releases outside Metorial for this provider type.
          </Text>
        </SideBox>
      ) : linkedRepo ? (
        <>
          <SideBox
            title="Repository"
            description="Code is managed through the connected repository."
          >
            <Flex align="center" gap={10}>
              <Button
                as="span"
                size="2"
                variant="outline"
                disabled={!canPublish}
                loading={customProviderEnv.isLoading || createVersion.isLoading}
                onClick={publishNewVersion}
              >
                Publish New Version
              </Button>

              <Button
                as="span"
                size="2"
                onClick={async () => {
                  if (linkedRepo.url) window.open(linkedRepo.url, '_blank');
                }}
                iconRight={<RiArrowRightSLine />}
              >
                View Repository
              </Button>
            </Flex>
          </SideBox>
          <Spacer height={15} />
        </>
      ) : (
        <>
          <SideBox
            title="Link Repository"
            description="Connect a Git repository to automatically sync code changes to your provider."
          >
            <Button
              as="span"
              size="2"
              onClick={() =>
                showModal(({ dialogProps, close }) => {
                  let [path, setPath] = useState<string | undefined>(undefined);
                  let [repo, setRepo] = useState<
                    DashboardInstanceScmReposCreateOutput | undefined
                  >(undefined);

                  let createVersion = useCreateCustomProviderVersion();

                  return (
                    <Dialog.Wrapper {...dialogProps} width={600}>
                      <Dialog.Title>Connect Repository</Dialog.Title>
                      <Dialog.Description>
                        Select a repository from your connected Git accounts to link it to this
                        provider.
                      </Dialog.Description>
                      <SelectRepo onSelect={repo => setRepo(repo)} selectedRepoId={repo?.id} />

                      <Spacer height={15} />

                      <Input
                        label="Path"
                        description="The path within the repository where the provider code is located."
                        placeholder="e.g. /my-server"
                        value={path}
                        onChange={e => setPath(e.target.value)}
                      />
                      <Spacer height={15} />

                      <Flex justify="end" gap={10}>
                        <Button variant="outline" onClick={close}>
                          Close
                        </Button>

                        <Button
                          disabled={!repo}
                          loading={createVersion.isLoading}
                          onClick={async () => {
                            if (!repo || !customProvider.data) return;

                            let [version] = await createVersion.mutate({
                              instanceId: instance.data!.id,
                              customProviderId: customProvider.data.id,
                              from: {
                                type: 'function',
                                env: {},
                                runtime: {
                                  identifier: 'nodejs',
                                  version: '22.x'
                                },
                                repository: {
                                  repositoryId: repo.id,
                                  branch: repo.defaultBranch || 'main',
                                  path: normalizeRepoPath(path)
                                }
                              }
                            });

                            if (version) {
                              close();
                            }
                          }}
                        >
                          Connect Repository
                        </Button>
                      </Flex>
                    </Dialog.Wrapper>
                  );
                })
              }
            >
              Connect Repository
            </Button>
          </SideBox>
          <Spacer height={15} />
        </>
      )}

      {!codeManagementUnavailable && url && (
        <Wrapper data-expanded={isExpanded}>
          <Nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Button
              size="1"
              variant="outline"
              iconLeft={<RiUpload2Line />}
              disabled={!canPublish}
              loading={customProviderEnv.isLoading || createVersion.isLoading}
              onClick={publishNewVersion}
            >
              Publish New Version
            </Button>

            <Button
              size="1"
              variant="outline"
              iconLeft={<RiExpandDiagonal2Line />}
              onClick={() => setIsExpanded(expanded => !expanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </Nav>

          <Iframe src={editorToken.data?.url ?? url} />
        </Wrapper>
      )}
    </>
  ));
};
