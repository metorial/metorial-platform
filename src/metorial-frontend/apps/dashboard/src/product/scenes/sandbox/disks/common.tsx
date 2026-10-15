import type { DashboardInstanceSandboxDisksGetOutput } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSandboxMachine
} from '@metorial/state';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

export type SandboxDisk = DashboardInstanceSandboxDisksGetOutput;

export let DiskStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let useSandboxDiskPaths = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return {
    instanceId: instance.data?.id,
    disk: (id: string, ...parts: string[]) =>
      Paths.instance.sandboxDisk(organization.data, project.data, instance.data, id, ...parts),
    disks: Paths.instance.sandboxDisks(organization.data, project.data, instance.data),
    machine: (id: string, ...parts: string[]) =>
      Paths.instance.sandboxMachine(
        organization.data,
        project.data,
        instance.data,
        id,
        ...parts
      )
  };
};

export let DiskMachineLink = ({ id, ...props }: { id: string; settings?: boolean }) => {
  let paths = useSandboxDiskPaths();
  let machine = useSandboxMachine(paths.instanceId, id);

  return (
    <Link to={paths.machine(id, ...(props.settings ? ['settings'] : []))}>
      {machine.data?.name || machine.data?.slug || id}
    </Link>
  );
};
