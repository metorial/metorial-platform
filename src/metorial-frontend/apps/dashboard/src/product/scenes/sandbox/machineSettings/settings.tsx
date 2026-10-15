import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { DetailsSettingsLayout } from '@metorial/details-layout';
import {
  useCreateSandboxMachineAccess,
  useSandboxDisk,
  useSandboxRegions,
  type DashboardInstanceSandboxMachinesUpdateBody
} from '@metorial/state';
import {
  Button,
  Callout,
  Copy,
  Flex,
  Input,
  KeyValueInput,
  NumberInput,
  RenderDate,
  Select,
  Switch,
  Text,
  TextArrayInput,
  confirm,
  keyValueEntriesToRecord,
  recordToKeyValueEntries,
  theme
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FormPage } from '../../form/page';
import { SandboxDiskResizeProgress } from '../disks/resizeProgress';
import { formatBytes } from '../lib/format';
import { useSandboxMachinePage } from '../machines/context';
import { showSandboxResizeDiskDialog } from '../resizeDiskDialog';
import {
  SandboxLifecycleField,
  SandboxMountsField,
  SandboxNetworkField,
  SandboxSizeField,
  type DiskMount
} from './fields';

let RestartHint = () => {
  let { machine } = useSandboxMachinePage();
  let restart = machine.useRestartMutator();
  if (!machine.data?.restartRequired) return null;
  return (
    <Callout color="orange">
      <Flex gap={15} align="center" justify="space-between" style={{ width: '100%' }}>
        <Text>Restart to apply these changes.</Text>
        <Button
          style={{ alignSelf: 'flex-start' }}
          size="1"
          loading={restart.isLoading}
          success={restart.isSuccess}
          disabled={!!machine.data.operation}
          onClick={() => restart.mutate()}
        >
          Restart Now
        </Button>
      </Flex>
      <restart.RenderError />
    </Callout>
  );
};

export let SandboxGeneralSettings = () => {
  let { machine, machinesPath, instance } = useSandboxMachinePage();
  let regions = useSandboxRegions(instance.data?.id);
  let update = machine.useUpdateMutator();
  let remove = machine.useDeleteMutator();
  let navigate = useNavigate();
  let form = useForm({
    initialValues: { name: machine.data?.name || '' },
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate({ name: values.name.trim() });
    },
    schema: yup => yup.object({ name: yup.string().trim().required('Name is required') })
  });
  return renderWithLoader({ machine })(() => (
    <DetailsSettingsLayout title="General">
      <FormPage>
        <RestartHint />
        <Box title="General">
          <form onSubmit={form.handleSubmit}>
            <Flex direction="column" gap={15}>
              <Input label="Name" {...form.getFieldProps('name')} />
              <form.RenderError field="name" />
              <update.RenderError />
              <Button
                style={{ alignSelf: 'flex-start' }}
                size="2"
                type="submit"
                loading={update.isLoading}
                success={update.isSuccess}
              >
                Save
              </Button>
            </Flex>
          </form>
        </Box>
        <Box title="Region">
          {renderWithLoader({ regions })(({ regions }) => {
            let region = regions.data.items.find(region => region.id === machine.data?.region);
            return <Text>{region?.name || machine.data?.region}</Text>;
          })}
        </Box>
        <Box
          title="Danger Zone"
          description="Delete this machine and its root disk. Standard disks are detached."
        >
          <Button
            style={{ alignSelf: 'flex-start' }}
            size="2"
            color="red"
            loading={remove.isLoading}
            success={remove.isSuccess}
            onClick={() =>
              confirm({
                title: 'Delete Machine',
                description: `Permanently delete ${machine.data?.name || machine.data?.slug || 'this machine'} and its root disk?`,
                confirmText: 'Delete Machine',
                onConfirm: async () => {
                  let [result] = await remove.mutate();
                  if (result) navigate(machinesPath);
                }
              })
            }
          >
            Delete Machine
          </Button>
          <remove.RenderError />
        </Box>
      </FormPage>
    </DetailsSettingsLayout>
  ));
};

let RootDiskSettingsBox = () => {
  let { machine, instance } = useSandboxMachinePage();
  let disk = useSandboxDisk(instance.data?.id, machine.data?.rootDisk?.id);

  return (
    <Box title="Root Disk">
      {renderWithLoader({ disk })(({ disk }) => (
        <Flex direction="column" gap={15}>
          <Flex align="center" justify="space-between" gap={15}>
            <Text weight="strong">{formatBytes(disk.data.sizeBytes)}</Text>
            <Button
              size="2"
              variant="outline"
              disabled={
                !!disk.data.activeResize ||
                disk.data.status !== 'active' ||
                disk.data.sizeBytes == null
              }
              onClick={() => showSandboxResizeDiskDialog({ disk: disk.data })}
            >
              Resize Disk
            </Button>
          </Flex>
          <SandboxDiskResizeProgress disk={disk.data} embedded />
        </Flex>
      ))}
    </Box>
  );
};

export let SandboxSizeSettings = () => {
  let { machine, instance } = useSandboxMachinePage();
  let update = machine.useUpdateMutator();
  let restart = machine.useRestartMutator();
  let form = useForm({
    initialValues: { specId: machine.data?.spec?.id || '' },
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate({ specId: values.specId });
    },
    schema: yup => yup.object({ specId: yup.string().required('Choose a size') })
  });
  return renderWithLoader({ machine })(({ machine }) => (
    <DetailsSettingsLayout title="Size">
      <FormPage>
        <RestartHint />
        <Box title="Size" description="Changing size takes effect after a restart.">
          <form onSubmit={form.handleSubmit}>
            <Flex direction="column" gap={15}>
              <SandboxSizeField
                instanceId={instance.data?.id}
                region={machine.data.region}
                value={form.values.specId}
                currentValue={machine.data.spec?.id || undefined}
                onChange={id => form.setFieldValue('specId', id)}
              />
              <form.RenderError field="specId" />
              <Flex gap={8}>
                <Button
                  style={{ alignSelf: 'flex-start' }}
                  size="2"
                  type="submit"
                  loading={update.isLoading}
                  success={update.isSuccess}
                  disabled={restart.isLoading || !form.values.specId}
                >
                  Save
                </Button>
                <Button
                  style={{ alignSelf: 'flex-start' }}
                  size="2"
                  type="button"
                  variant="outline"
                  loading={restart.isLoading}
                  success={restart.isSuccess}
                  disabled={
                    update.isLoading || !!machine.data.operation || !form.values.specId
                  }
                  onClick={async () => {
                    let [result] = await update.mutate({ specId: form.values.specId });
                    if (result) await restart.mutate();
                  }}
                >
                  Save and Restart
                </Button>
              </Flex>
              <update.RenderError />
              <restart.RenderError />
            </Flex>
          </form>
        </Box>
        {machine.data.rootDisk && <RootDiskSettingsBox />}
      </FormPage>
    </DetailsSettingsLayout>
  ));
};

export let SandboxStorageSettings = () => {
  let { machine, instance } = useSandboxMachinePage();
  let update = machine.useUpdateMutator();
  let form = useForm({
    initialValues: {
      mounts: (machine.data?.mounts ?? []).map(m => ({
        diskId: m.diskId,
        mountPath: m.mountPath
      })) as DiskMount[]
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate({ mounts: values.mounts });
    },
    schema: yup =>
      yup.object({
        mounts: yup
          .array()
          .required()
          .test(
            'complete-mounts',
            'Select a disk and an absolute mount path for each mount.',
            mounts => mounts.every(mount => !!mount.diskId && mount.mountPath.startsWith('/'))
          )
          .test(
            'unique-disks',
            'Each disk can only be mounted once.',
            mounts => new Set(mounts.map(mount => mount.diskId)).size === mounts.length
          )
          .test(
            'unique-paths',
            'Mount paths must be unique. Choose a different path for each disk.',
            mounts => new Set(mounts.map(mount => mount.mountPath)).size === mounts.length
          )
      }) as any
  });
  return renderWithLoader({ machine })(({ machine }) => (
    <DetailsSettingsLayout title="Storage">
      <FormPage>
        <RestartHint />
        {machine.data.rootDisk && <RootDiskSettingsBox />}
        <Box title="Disk Mounts">
          <form onSubmit={form.handleSubmit}>
            <Flex direction="column" gap={15}>
              {!!form.values.mounts.length && (
                <SandboxMountsField
                  hideAddButton
                  instanceId={instance.data?.id}
                  region={machine.data.region}
                  value={form.values.mounts}
                  onChange={mounts => form.setFieldValue('mounts', mounts)}
                />
              )}
              <form.RenderError field="mounts" />
              <Flex gap={8}>
                <Button
                  style={{ alignSelf: 'flex-start' }}
                  size="2"
                  type="submit"
                  loading={update.isLoading}
                  success={update.isSuccess}
                >
                  Save
                </Button>
                <Button
                  size="2"
                  type="button"
                  variant="outline"
                  disabled={update.isLoading}
                  onClick={() =>
                    form.setFieldValue('mounts', [
                      ...form.values.mounts,
                      { diskId: '', mountPath: '/data' }
                    ])
                  }
                >
                  Add Disk
                </Button>
              </Flex>
              <update.RenderError />
            </Flex>
          </form>
        </Box>
      </FormPage>
    </DetailsSettingsLayout>
  ));
};

export let SandboxLifecycleSettings = () => {
  let { machine } = useSandboxMachinePage();
  let update = machine.useUpdateMutator();
  let form = useForm({
    initialValues: machine.data?.lifecyclePolicy ?? {
      pauseAfterIdleSeconds: null,
      hibernateAfterPausedSeconds: null,
      connectionIdleSeconds: null
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate({ lifecyclePolicy: values });
    },
    schema: yup =>
      yup.object({
        pauseAfterIdleSeconds: yup.number().nullable(),
        hibernateAfterPausedSeconds: yup.number().nullable(),
        connectionIdleSeconds: yup.number().nullable()
      })
  });
  return renderWithLoader({ machine })(() => (
    <DetailsSettingsLayout title="Lifecycle">
      <FormPage>
        <RestartHint />
        <Box title="Idle Behavior">
          <form onSubmit={form.handleSubmit}>
            <Flex direction="column" gap={15}>
              <SandboxLifecycleField
                value={form.values}
                onChange={policy => form.setValues(policy)}
              />
              <Button
                style={{ alignSelf: 'flex-start' }}
                size="2"
                type="submit"
                loading={update.isLoading}
                success={update.isSuccess}
              >
                Save
              </Button>
              <update.RenderError />
            </Flex>
          </form>
        </Box>
        <HooksSettingsBox />
      </FormPage>
    </DetailsSettingsLayout>
  ));
};

export let SandboxNetworkSettings = () => {
  let { machine, instance } = useSandboxMachinePage();
  let update = machine.useUpdateMutator();
  let form = useForm({
    initialValues: {
      firewallIds: machine.data?.firewallIds || [],
      publicPorts: machine.data?.publicPorts || []
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate(values);
    },
    schema: yup =>
      yup.object({
        firewallIds: yup.array().of(yup.string().required()).defined(),
        publicPorts: yup
          .array()
          .of(yup.number().integer().min(1).max(65535).required())
          .defined()
      })
  });
  return renderWithLoader({ machine })(() => (
    <DetailsSettingsLayout title="Network">
      <FormPage>
        <RestartHint />
        <Box title="Network">
          <form onSubmit={form.handleSubmit}>
            <Flex direction="column" gap={15}>
              <SandboxNetworkField
                hideAddPortButton
                instanceId={instance.data?.id}
                firewallIds={form.values.firewallIds}
                publicPorts={form.values.publicPorts}
                onFirewallsChange={ids => form.setFieldValue('firewallIds', ids)}
                onPortsChange={ports => form.setFieldValue('publicPorts', ports)}
              />
              <form.RenderError field="publicPorts" />
              <Flex gap={8}>
                <Button
                  style={{ alignSelf: 'flex-start' }}
                  size="2"
                  type="submit"
                  loading={update.isLoading}
                  success={update.isSuccess}
                >
                  Save
                </Button>
                <Button
                  size="2"
                  type="button"
                  variant="outline"
                  disabled={update.isLoading}
                  onClick={() =>
                    form.setFieldValue('publicPorts', [...form.values.publicPorts, 3000])
                  }
                >
                  Add Public Port
                </Button>
              </Flex>
              <update.RenderError />
            </Flex>
          </form>
        </Box>
        <PortAccessBox />
      </FormPage>
    </DetailsSettingsLayout>
  ));
};

type Hook = NonNullable<DashboardInstanceSandboxMachinesUpdateBody['lifecycleHooks']>[number];
let HooksFields = (p: { value: Hook[]; onChange: (hooks: Hook[]) => void }) => (
  <Flex direction="column" gap={15}>
    {!!p.value.length && (
      <Flex direction="column" gap={20}>
        {p.value.map((hook, index) => {
          let change = (next: Hook) =>
            p.onChange(p.value.map((h, i) => (i === index ? next : h)));
          return (
            <Box key={index} title={`Hook ${index + 1}`}>
              <Flex direction="column" gap={15}>
                <Select
                  label="Type"
                  value={hook.type}
                  items={[
                    { id: 'script', label: 'Script' },
                    { id: 'http', label: 'HTTP' }
                  ]}
                  onChange={type =>
                    change(
                      type === 'http'
                        ? { type: 'http', on: hook.on, path: '/', port: 8080 }
                        : { type: 'script', on: hook.on, path: '', arguments: [] }
                    )
                  }
                />
                <Select
                  label="Run On"
                  value={hook.on}
                  items={['start', 'pause', 'resume', 'terminate'].map(id => ({
                    id,
                    label: id[0].toUpperCase() + id.slice(1)
                  }))}
                  onChange={on => change({ ...hook, on: on as Hook['on'] })}
                />
                <Input
                  label={hook.type === 'http' ? 'Request Path' : 'Script Path'}
                  value={hook.path}
                  onChange={e => change({ ...hook, path: e.target.value })}
                />
                {hook.type === 'http' ? (
                  <NumberInput
                    label="Port"
                    format={{ useGrouping: false }}
                    value={hook.port}
                    min={1}
                    max={65535}
                    onChange={port => change({ ...hook, port: port ?? 8080 })}
                  />
                ) : (
                  <div>
                    <TextArrayInput
                      label="Arguments"
                      value={hook.arguments}
                      onChange={args => change({ ...hook, arguments: args })}
                    />
                  </div>
                )}
                <Switch
                  label="Wait for Completion"
                  checked={hook.wait ?? false}
                  onCheckedChange={wait => change({ ...hook, wait })}
                />
                <NumberInput
                  label="Timeout"
                  unit="seconds"
                  min={1}
                  value={hook.timeoutSeconds ?? 30}
                  onChange={timeout =>
                    change({ ...hook, timeoutSeconds: timeout ?? undefined })
                  }
                />
                <Button
                  style={{ alignSelf: 'flex-start' }}
                  size="2"
                  type="button"
                  variant="outline"
                  onClick={() => p.onChange(p.value.filter((_, i) => i !== index))}
                >
                  Remove Hook
                </Button>
              </Flex>
            </Box>
          );
        })}
      </Flex>
    )}
    <Button
      style={{ alignSelf: 'flex-start' }}
      size="2"
      type="button"
      variant="outline"
      disabled={p.value.length >= 16}
      onClick={() =>
        p.onChange([...p.value, { type: 'script', on: 'start', path: '', arguments: [] }])
      }
    >
      Add Hook
    </Button>
  </Flex>
);
let RuntimeSettingsBox = () => {
  let { machine } = useSandboxMachinePage();
  let update = machine.useUpdateMutator();
  let form = useForm({
    initialValues: {
      setup: machine.data?.runtime?.setup || [],
      entrypoint: machine.data?.runtime?.entrypoint || [],
      cmd: machine.data?.runtime?.cmd || [],
      env: recordToKeyValueEntries(machine.data?.runtime?.env || {}),
      workdir: machine.data?.runtime?.workdir || '',
      user: machine.data?.runtime?.user || '',
      stopSignal: machine.data?.runtime?.stopSignal || 'SIGTERM'
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate({
        runtime: {
          setup: values.setup.filter(Boolean),
          entrypoint: values.entrypoint.filter(Boolean),
          cmd: values.cmd.filter(Boolean),
          env: keyValueEntriesToRecord(values.env),
          workdir: values.workdir || undefined,
          user: values.user || undefined,
          stopSignal: values.stopSignal as NonNullable<
            DashboardInstanceSandboxMachinesUpdateBody['runtime']
          >['stopSignal']
        }
      });
    },
    schema: yup => yup.object({ workdir: yup.string(), user: yup.string() }) as any
  });
  return (
    <Box title="Runtime">
      <form onSubmit={form.handleSubmit}>
        <Flex direction="column" gap={15}>
          <div>
            <TextArrayInput
              label="Setup"
              value={form.values.setup}
              onChange={value => form.setFieldValue('setup', value)}
            />
          </div>
          <div>
            <TextArrayInput
              label="Entrypoint"
              value={form.values.entrypoint}
              onChange={value => form.setFieldValue('entrypoint', value)}
            />
          </div>
          <div>
            <TextArrayInput
              label="Command"
              value={form.values.cmd}
              onChange={value => form.setFieldValue('cmd', value)}
            />
          </div>
          <Input label="Working Directory" {...form.getFieldProps('workdir')} />
          <Input label="User" {...form.getFieldProps('user')} />
          <Select
            label="Stop Signal"
            value={form.values.stopSignal}
            items={['SIGTERM', 'SIGINT', 'SIGKILL', 'SIGHUP', 'SIGQUIT'].map(id => ({
              id,
              label: id
            }))}
            onChange={value => form.setFieldValue('stopSignal', value)}
          />
          <KeyValueInput
            masked
            label="Environment Variables"
            value={form.values.env}
            onChange={value => form.setFieldValue('env', value)}
          />
          <Button
            style={{ alignSelf: 'flex-start' }}
            size="2"
            type="submit"
            loading={update.isLoading}
            success={update.isSuccess}
          >
            Save
          </Button>
          <update.RenderError />
        </Flex>
      </form>
    </Box>
  );
};

let HooksSettingsBox = () => {
  let { machine } = useSandboxMachinePage();
  let update = machine.useUpdateMutator();
  let hooks: Hook[] = (machine.data?.lifecycleHooks ?? []).map(h =>
    h.type === 'http'
      ? {
          type: 'http',
          on: h.on,
          path: h.path,
          port: h.port ?? 8080,
          wait: h.wait ?? undefined,
          timeoutSeconds: h.timeoutSeconds ?? undefined
        }
      : {
          type: 'script',
          on: h.on,
          path: h.path,
          arguments: h.arguments ?? [],
          wait: h.wait ?? undefined,
          timeoutSeconds: h.timeoutSeconds ?? undefined
        }
  );
  let form = useForm({
    initialValues: {
      hooks,
      ignoreImageHooks: machine.data?.ignoreImageHooks ?? false,
      entrypointWaitSeconds: machine.data?.entrypointWaitSeconds ?? null
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (values.hooks.some(h => !h.path.trim())) {
        form.setFieldTouched('hooks', true);
        form.setFieldError('hooks', 'Every hook needs a path.');
        return;
      }
      await update.mutate({
        lifecycleHooks: values.hooks,
        ignoreImageHooks: values.ignoreImageHooks,
        entrypointWaitSeconds: values.entrypointWaitSeconds
      });
    },
    schema: yup => yup.object({ hooks: yup.array().defined() }) as any
  });
  return (
    <Box title="Lifecycle Hooks">
      <form onSubmit={form.handleSubmit}>
        <Flex direction="column" gap={15}>
          <HooksFields
            value={form.values.hooks}
            onChange={value => form.setFieldValue('hooks', value)}
          />
          <form.RenderError field="hooks" />
          <Switch
            label="Ignore Image Hooks"
            checked={form.values.ignoreImageHooks}
            onCheckedChange={value => form.setFieldValue('ignoreImageHooks', value)}
          />
          <NumberInput
            label="Entrypoint Wait"
            unit="seconds"
            min={0}
            value={form.values.entrypointWaitSeconds}
            onChange={value => form.setFieldValue('entrypointWaitSeconds', value)}
          />
          <Button
            style={{ alignSelf: 'flex-start' }}
            size="2"
            type="submit"
            loading={update.isLoading}
            success={update.isSuccess}
          >
            Save
          </Button>
          <update.RenderError />
        </Flex>
      </form>
    </Box>
  );
};

export let SandboxRuntimeSettings = () => {
  let { machine } = useSandboxMachinePage();
  return renderWithLoader({ machine })(() => (
    <DetailsSettingsLayout title="Runtime">
      <FormPage>
        <RestartHint />
        <RuntimeSettingsBox />
      </FormPage>
    </DetailsSettingsLayout>
  ));
};

let PortAccessResult = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  border-top: 1px solid ${theme.colors.gray400};
  padding-top: 15px;
`;

let PortAccessBox = () => {
  let { machine, machineId, instance } = useSandboxMachinePage();
  let access = useCreateSandboxMachineAccess();
  let form = useForm({
    initialValues: { port: machine.data?.publicPorts[0] ?? 3000, ttl: 3600 },
    onSubmit: async values => {
      if (!machineId || !instance.data) return;
      await access.mutate({
        instanceId: instance.data.id,
        machineId,
        scope: 'ports',
        ports: [values.port],
        port: values.port,
        ttlSeconds: values.ttl
      });
    },
    schema: yup =>
      yup.object({
        port: yup.number().integer().min(1).max(65535).required(),
        ttl: yup.number().integer().min(60).max(3600).required()
      })
  });
  return (
    <Box title="Port Access" description="Generate access credentials for a port.">
      <form onSubmit={form.handleSubmit}>
        <Flex direction="column" gap={15}>
          <NumberInput
            label="Port"
            format={{ useGrouping: false }}
            value={form.values.port}
            min={1}
            max={65535}
            onChange={value => form.setFieldValue('port', value)}
          />
          <form.RenderError field="port" />
          <NumberInput
            label="Expires After"
            unit="seconds"
            value={form.values.ttl}
            min={60}
            max={3600}
            onChange={value => form.setFieldValue('ttl', value)}
          />
          <Button
            style={{ alignSelf: 'flex-start' }}
            size="2"
            type="submit"
            loading={access.isLoading}
            success={access.isSuccess}
            disabled={!machine.data || machine.data.status === 'terminated'}
          >
            Generate URL
          </Button>
          <access.RenderError />
          {access.data?.url && (
            <PortAccessResult>
              <Copy label="URL" value={access.data.url} />
              <Copy
                label="Access Token"
                value="••••••••••••••••••••••••"
                copyValue={access.data.token}
              />
              <Text size="1" color="gray600">
                Token expires <RenderDate date={access.data.expiresAt} />
              </Text>
              <Text size="1" color="gray600">
                For private ports, send the token in the Metorial-Sandbox-Token header. Public
                ports need no token.
              </Text>
            </PortAccessResult>
          )}
        </Flex>
      </form>
    </Box>
  );
};
