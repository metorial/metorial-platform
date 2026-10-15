import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSandboxMachine
} from '@metorial/state';
import { useParams } from 'react-router-dom';

export let useSandboxMachinePage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { machineId } = useParams();
  let machine = useSandboxMachine(instance.data?.id, machineId);
  let path = (...parts: string[]) =>
    Paths.instance.sandboxMachine(
      organization.data,
      project.data,
      instance.data,
      machineId,
      ...parts
    );
  let machinesPath = Paths.instance.sandboxMachines(
    organization.data,
    project.data,
    instance.data
  );
  let diskPath = (id: string) =>
    Paths.instance.sandboxDisk(organization.data, project.data, instance.data, id);
  let imagePath = (id: string) =>
    Paths.instance.sandboxImage(organization.data, project.data, instance.data, id);
  return {
    organization,
    project,
    instance,
    machineId,
    machine,
    path,
    machinesPath,
    diskPath,
    imagePath
  };
};
