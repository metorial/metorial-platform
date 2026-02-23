import { DashboardInstanceScmReposCreateOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { getConfig, Paths } from '@metorial/frontend-config';
import {
  useCreateCustomServerVersion,
  useCurrentInstance,
  useCustomServer,
  useCustomServerCodeEditorToken
} from '@metorial/state';
import { Button, Dialog, Flex, Input, showModal, Spacer, theme } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { RiArrowRightSLine, RiExpandDiagonal2Line, RiUpload2Line } from '@remixicon/react';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { SelectRepo } from '../../../scenes/customServer/selectRepo';

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

export let CustomServerCodePage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  let editorToken = useCustomServerCodeEditorToken(
    instance.data?.id,
    customServer.data?.id
  );

  let [isExpanded, setIsExpanded] = useState(false);

  let url = useMemo(() => {
    if (!editorToken.data) return null;
    if (editorToken.data.url) return editorToken.data.url;
    return getConfig().microFrontends?.codeEditorUrl ?? null;
  }, [editorToken.data]);

  let createVersion = useCreateCustomServerVersion();
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
      customServerId: customServer.data!.id,
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
      {linkedRepo ? (
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
                  let [repo, setRepo] = useState<DashboardInstanceScmReposCreateOutput | undefined>(
                    undefined
                  );

                  let createVersion = useCreateCustomServerVersion();

                  return (
                    <Dialog.Wrapper {...dialogProps} width={600}>
                      <Dialog.Title>Connect Repository</Dialog.Title>
                      <Dialog.Description>
                        Select a repository from your connected Git accounts to link it to this
                        provider.
                      </Dialog.Description>
                      <SelectRepo
                        onSelect={repo => setRepo(repo)}
                        selectedRepoId={repo?.id}
                      />

                      <Spacer height={15} />

                      <Input
                        label="Path"
                        description="The path within the repository where the provider code is located."
                        placeholder="e.g. /my-server"
                        value={path}
                        onChange={e => setPath(e.target.value)}
                      />

                      <Spacer height={15} />

                      <Dialog.Actions>
                        <Button onClick={close} variant="outline" size="2">
                          Cancel
                        </Button>
                        <Button
                          size="2"
                          disabled={!repo}
                          loading={createVersion.isLoading}
                          success={createVersion.isSuccess}
                          onClick={async () => {
                            let [res] = await createVersion.mutate({
                              instanceId: instance.data!.id,
                              customServerId: customServer.data!.id,
                              customProviderId: customServer.data!.id,
                              from: {
                                type: 'function',
                                env: {},
                                runtime: {
                                  identifier: 'nodejs' as const,
                                  version: '22.x' as const
                                },
                                repository: {
                                  repositoryId: repo!.id,
                                  branch: repo!.defaultBranch,
                                  path: normalizeRepoPath(path)
                                }
                              }
                            });

                            if (res) {
                              navigate(
                                Paths.instance.customServer(
                                  instance.data?.organization,
                                  instance.data?.project,
                                  instance.data,
                                  res.customProviderId,
                                  'versions',
                                  { version_id: res.id }
                                )
                              );
                              setTimeout(() => close(), 500);
                            }
                          }}
                        >
                          Connect Repository
                        </Button>
                      </Dialog.Actions>
                    </Dialog.Wrapper>
                  );
                })
              }
              iconRight={<RiArrowRightSLine />}
            >
              Connect Repository
            </Button>
          </SideBox>
          <Spacer height={15} />
        </>
      )}

      {url && (
        <Wrapper data-expanded={isExpanded}>
          <Nav
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 2 }}
          >
            <Button
              size="1"
              iconLeft={<RiExpandDiagonal2Line />}
              onClick={() => setIsExpanded(v => !v)}
            >
              {isExpanded ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>

            <Button size="1" iconLeft={<RiUpload2Line />} onClick={publishNewVersion}>
              Publish New Version
            </Button>
          </Nav>

          <Iframe src={url!} title={customServer.data?.name ?? 'Code Editor'} />
        </Wrapper>
      )}
    </>
  ));
};
