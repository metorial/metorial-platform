import { DashboardInstanceScmReposCreateOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { getConfig, Paths } from '@metorial/frontend-config';
import {
  useCreateCustomProviderVersion,
  useCurrentInstance,
  useCustomProvider,
  useCustomProviderCodeEditorToken
} from '@metorial/state';
import { Button, Dialog, Flex, Input, showModal, Spacer, Text, theme } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { RiArrowRightSLine, RiExpandDiagonal2Line, RiUpload2Line } from '@remixicon/react';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
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

let normalizeRepoPath = (path: string | null | undefined) => {
  let trimmed = path?.trim();
  return trimmed ? trimmed : undefined;
};

export let CustomProviderCodePage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomProvider(instance.data?.id, customServerId);

  let editorToken = useCustomProviderCodeEditorToken(instance.data?.id, customServer.data?.id);

  let [isExpanded, setIsExpanded] = useState(false);

  let url = useMemo(() => {
    if (!editorToken.data) return null;
    if (editorToken.data.url) return editorToken.data.url;
    return getConfig().microFrontends?.codeEditorUrl ?? null;
  }, [editorToken.data]);

  let createVersion = useCreateCustomProviderVersion();
  let navigate = useNavigate();

  let linkedRepo = useMemo(() => {
    let repoFromApi =
      customServer.data?.scmRepo ?? customServer.data?.draftBucket?.scmRepoLink?.repository;
    if (repoFromApi) {
      return {
        id: repoFromApi.id,
        url: repoFromApi.url,
        defaultBranch: repoFromApi.defaultBranch,
        path: customServer.data?.draftBucket?.scmRepoLink?.path ?? undefined
      };
    }

    let metadataRepo = customServer.data?.metadata?.repository as
      | { url?: string; branch?: string; path?: string }
      | undefined;
    if (!metadataRepo?.url) return null;

    return {
      id: undefined,
      url: metadataRepo.url,
      defaultBranch: metadataRepo.branch ?? 'main',
      path: metadataRepo.path
    };
  }, [customServer.data]);
  let codeManagementUnavailable =
    Boolean(customServer.data?.draft?.remoteMcpServer) ||
    Boolean(customServer.data?.draft?.containerImage);

  let publishFrom = useMemo(() => {
    if (linkedRepo?.id) {
      return {
        type: 'function' as const,
        env: {},
        runtime: { identifier: 'nodejs' as const, version: '22.x' as const },
        repository: {
          repositoryId: linkedRepo.id,
          branch: linkedRepo.defaultBranch || 'main',
          path: normalizeRepoPath(linkedRepo.path)
        }
      };
    }

    return {
      type: 'function' as const,
      files: [],
      env: {},
      runtime: { identifier: 'nodejs' as const, version: '22.x' as const }
    };
  }, [linkedRepo]);

  let publishNewVersion = async () => {
    let [version] = await createVersion.mutate({
      instanceId: instance.data!.id,
      customProviderId: customServer.data!.id,
      from: publishFrom
    });

    if (version) {
      navigate(
        Paths.instance.customServer(
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

  return renderWithLoader({ customServer })(({ customServer }) => (
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
              <Button as="span" size="2" variant="outline" onClick={publishNewVersion}>
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
                            if (!repo || !customServer.data) return;

                            let [version] = await createVersion.mutate({
                              instanceId: instance.data!.id,
                              customProviderId: customServer.data.id,
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
