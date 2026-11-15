import type {
  AuditSandboxDisk,
  AuditSandboxImage,
  AuditSandboxImageBuild,
  AuditSandboxMachine
} from '@metorial/fabric';

type MachineLike = {
  id: string;
  image?: { id: string } | null;
  tenant?: { region: { identifier: string } } | null;
  remote?: { name?: string | null; spec?: { memoryMiB: number; vcpus: number } } | null;
};

type DiskLike = {
  id: string;
  name: string | null;
  type: string;
  sizeBytes: bigint | null;
  tenant?: { region: { identifier: string } } | null;
};

export let toAuditMachine = (machine: MachineLike): AuditSandboxMachine => ({
  id: machine.id,
  name: machine.remote?.name ?? null,
  imageId: machine.image?.id ?? null,
  regionIdentifier: machine.tenant?.region.identifier ?? null,
  specMemoryMiB: machine.remote?.spec?.memoryMiB ?? null,
  specVcpus: machine.remote?.spec?.vcpus ?? null
});

export let toAuditDisk = (disk: DiskLike): AuditSandboxDisk => ({
  id: disk.id,
  name: disk.name,
  type: disk.type,
  sizeBytes: disk.sizeBytes === null ? null : Number(disk.sizeBytes),
  regionIdentifier: disk.tenant?.region.identifier ?? null
});

export let toAuditImage = (image: { id: string; name: string | null }): AuditSandboxImage => ({
  id: image.id,
  name: image.name
});

export let toAuditImageBuild = (build: {
  id: string;
  status: string;
  image: { id: string };
}): AuditSandboxImageBuild => ({
  id: build.id,
  imageId: build.image.id,
  status: build.status
});
