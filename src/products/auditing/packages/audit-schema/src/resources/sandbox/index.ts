import { resourceSet } from '../../_lib/resource';
import { sandboxDiskAuditResource, sandboxDiskResizeAuditResource } from './disk';
import { sandboxImageAuditResource, sandboxImageBuildAuditResource } from './image';
import {
  sandboxMachineAccessAuditResource,
  sandboxMachineAuditResource,
  sandboxMachineExecAuditResource
} from './machine';

export let sandboxResources = resourceSet({
  sandbox_machine: sandboxMachineAuditResource,
  sandbox_machine_access: sandboxMachineAccessAuditResource,
  sandbox_machine_exec: sandboxMachineExecAuditResource,
  sandbox_disk: sandboxDiskAuditResource,
  sandbox_disk_resize: sandboxDiskResizeAuditResource,
  sandbox_image: sandboxImageAuditResource,
  sandbox_image_build: sandboxImageBuildAuditResource
});
