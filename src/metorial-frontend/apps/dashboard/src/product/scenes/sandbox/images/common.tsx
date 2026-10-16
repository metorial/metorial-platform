import { Paths } from '@metorial/frontend-config';
import {
  useCurrentOrganization,
  useCurrentProject,
  useCurrentInstance,
  sandboxMachinesLoader
} from '@metorial/state';
import { useMutation } from '@metorial/data-hooks';
import { confirm } from '@metorial/ui';
import styled from 'styled-components';

export let ImageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
`;

export let useSandboxImagePaths = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return {
    instanceId: instance.data?.id,
    images: () => Paths.instance.sandboxImages(organization.data, project.data, instance.data),
    image: (id: string, ...sub: string[]) =>
      Paths.instance.sandboxImage(organization.data, project.data, instance.data, id, ...sub),
    version: (id: string, versionId: string) =>
      Paths.instance.sandboxImageVersion(
        organization.data,
        project.data,
        instance.data,
        id,
        versionId
      ),
    machine: (id: string) =>
      Paths.instance.sandboxMachine(organization.data, project.data, instance.data, id),
    machines: (imageId: string) =>
      `${Paths.instance.sandboxMachines(organization.data, project.data, instance.data)}?image_id=${encodeURIComponent(imageId)}`
  };
};

export let imageVersionLabel = (version: { id: string; versionNumber: number | null }) =>
  version.versionNumber == null ? version.id.slice(-8) : `Version ${version.versionNumber}`;

export let useConfirmSandboxImageDeletion = (input: {
  instanceId?: string;
  imageId: string;
  onDelete: () => Promise<unknown>;
}) =>
  useMutation(async (_: void) => {
    if (!input.instanceId) return;

    let count = 0;
    let after: string | undefined;

    while (true) {
      let page = await sandboxMachinesLoader.fetchAndReturn(
        { instanceId: input.instanceId, imageId: input.imageId, limit: 100, after },
        { force: true }
      );

      count += page.items.length;
      if (!page.pagination.hasMoreAfter || !page.items.length) break;
      after = page.items.at(-1)!.id;
    }

    confirm({
      title: 'Delete Image',
      description: `Running builds are cancelled. ${count} machines use this image.`,
      confirmText: 'Delete Image',
      onConfirm: () => {
        void input.onDelete();
      }
    });
  });
