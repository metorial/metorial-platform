import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import { FormSection } from '@metorial/form-sections';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateSandboxMachine,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSandboxImage,
  useSandboxImages,
  useSandboxRegions,
  useSandboxRegionSelection,
  useSandboxSpecs
} from '@metorial/state';
import {
  Button,
  Callout,
  Flex,
  Input,
  keyValueEntriesToRecord,
  KeyValueInput,
  OptionToggle,
  Select,
  Spacer,
  Text,
  type KeyValueEntry
} from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useSearchFilter } from '@metorial/use-search-filter';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ProviderCreationPanelShell,
  showProviderCreationPanel
} from '../../providerCreationPanel';
import {
  SandboxLifecycleField,
  SandboxMountsField,
  SandboxNetworkField,
  SandboxSizeField,
  type DiskMount,
  type LifecyclePolicy
} from '../machineSettings/fields';
import { SandboxImageLogo } from '../shared/imageLogo';

export type ShowSandboxCreateMachinePanelOptions = { imageId?: string };
let ImageSelection = (p: { instanceId?: string; onSelect: (id: string) => void }) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, { updateSearchParams: false });
  let [owner, setOwner] = useState('all');
  let images = useSandboxImages(p.instanceId, {
    search: searchQuery || undefined,
    owner: owner === 'all' ? undefined : (owner as 'own' | 'global'),
    status: ['active', 'pending'],
    order: 'desc',
    limit: 24
  });
  return (
    <Flex direction="column" gap={16}>
      <Flex align="end" gap={12} wrap="wrap">
        <div style={{ flex: '1 1 300px' }}>
          <Input
            label="Search Images"
            value={search}
            onInput={setSearch}
            placeholder="Search images..."
          />
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <OptionToggle
            size="2"
            value={owner}
            onChange={setOwner}
            items={[
              { id: 'all', label: 'All' },
              { id: 'global', label: 'Metorial' },
              { id: 'own', label: 'Your Images' }
            ]}
          />
        </div>
      </Flex>
      {renderWithPagination(images)(images =>
        images.data.items.length === 0 ? (
          <Text size="2" color="gray600">
            {searchQuery?.trim()
              ? 'No images found matching your search.'
              : owner === 'own'
                ? 'Deploy your own images first to create a machine from them.'
                : 'No images available.'}
          </Text>
        ) : (
          <ItemGrid.Root responsive>
            <>
              {images.data.items.map(image => (
                <ItemGrid.Item
                  key={image.id}
                  variant="v2"
                  small
                  entity={image}
                  title={image.name || image.identifier || 'Untitled image'}
                  description={image.owner === 'global' ? 'Metorial image' : 'Custom image'}
                  icon={<SandboxImageLogo image={image} size={32} />}
                  disabled={!image.latestVersionId}
                  bottom={
                    !image.latestVersionId ? (
                      <Text size="1">Build a version before creating a machine.</Text>
                    ) : undefined
                  }
                  onClick={() => p.onSelect(image.id)}
                />
              ))}
            </>
          </ItemGrid.Root>
        )
      )}
    </Flex>
  );
};

let ConfigureMachine = (p: { imageId: string; close: () => void; back: () => void }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let image = useSandboxImage(instance.data?.id, p.imageId);
  let regions = useSandboxRegions(instance.data?.id);
  let selection = useSandboxRegionSelection();
  let specs = useSandboxSpecs(instance.data?.id);
  let create = useCreateSandboxMachine();
  let [submissionError, setSubmissionError] = useState<string | null>(null);
  let navigate = useNavigate();
  let form = useForm({
    initialValues: {
      name: '',
      region: '',
      specId: '',
      mounts: [] as DiskMount[],
      env: [] as KeyValueEntry[],
      lifecyclePolicy: {
        pauseAfterIdleSeconds: null,
        hibernateAfterPausedSeconds: 600,
        connectionIdleSeconds: 300
      } as LifecyclePolicy,
      firewallIds: [] as string[],
      publicPorts: [] as number[]
    },
    onSubmit: async values => {
      setSubmissionError(null);
      let availableRegions =
        regions.data?.items.filter(
          r => image.data?.regions.includes(r.id) && r.availability === 'available'
        ) ?? [];
      let region = values.region || selection.getRegion(availableRegions);
      if (
        !instance.data ||
        !region ||
        !availableRegions.some(r => r.id === region) ||
        !image.data?.latestVersionId
      ) {
        setSubmissionError(
          'Choose an available image and region before creating the machine.'
        );
        return;
      }
      if (
        !specs.data?.items.some(
          spec => spec.id === values.specId && spec.available && spec.regions.includes(region)
        )
      ) {
        form.setFieldTouched('specId', true);
        form.setFieldError('specId', 'Choose a machine size.');
        setSubmissionError('Choose an available CPU and memory combination.');
        return;
      }
      if (
        values.mounts.some(m => !m.diskId || !m.mountPath.startsWith('/')) ||
        new Set(values.mounts.map(m => m.diskId)).size !== values.mounts.length ||
        new Set(values.mounts.map(m => m.mountPath)).size !== values.mounts.length
      ) {
        form.setFieldTouched('mounts', true);
        form.setFieldError(
          'mounts',
          'Select a disk and an absolute mount path for each mount.'
        );
        setSubmissionError('Check your disks: each disk needs a unique, absolute mount path.');
        return;
      }
      if (
        values.publicPorts.some(port => !Number.isInteger(port) || port < 1 || port > 65535) ||
        new Set(values.publicPorts).size !== values.publicPorts.length
      ) {
        setSubmissionError('Public ports must be unique whole numbers between 1 and 65535.');
        return;
      }
      let [machine] = await create.mutate({
        instanceId: instance.data.id,
        imageId: p.imageId,
        name: values.name.trim() || undefined,
        region,
        specId: values.specId,
        mounts: values.mounts,
        runtime: { env: keyValueEntriesToRecord(values.env) },
        lifecyclePolicy: values.lifecyclePolicy,
        firewallIds: values.firewallIds,
        publicPorts: values.publicPorts,
        start: true
      });
      if (!machine) return;

      selection.rememberRegion(region);
      p.close();
      navigate(
        Paths.instance.sandboxMachine(
          organization.data,
          project.data,
          instance.data,
          machine.id
        )
      );
      toast.success('Machine Created');
    },
    schema: yup =>
      yup.object({ name: yup.string(), specId: yup.string(), region: yup.string() }) as any
  });
  let availableRegions =
    regions.data?.items.filter(
      r => image.data?.regions.includes(r.id) && r.availability === 'available'
    ) ?? [];
  let region = form.values.region || selection.getRegion(availableRegions) || '';
  let regionAvailable = availableRegions.some(r => r.id === region);
  let sizeAvailable = specs.data?.items.some(
    spec => spec.id === form.values.specId && spec.available && spec.regions.includes(region)
  );
  return renderWithLoader({ image, regions })(({ image, regions }) => (
    <form onSubmit={form.handleSubmit}>
      <Flex direction="column" gap={20}>
        <Input label="Name" {...form.getFieldProps('name')} />
        <form.RenderError field="name" />
        <Select
          label="Region"
          value={region}
          disabled={!availableRegions.length || create.isLoading}
          placeholder="No Available Regions"
          items={availableRegions.map(r => ({ id: r.id, label: r.name || r.id }))}
          onChange={value => {
            selection.rememberRegion(value);
            form.setFieldValue('region', value);
            form.setFieldValue('specId', '');
            form.setFieldValue('mounts', []);
          }}
        />
        {availableRegions.length === 0 && (
          <Callout color="orange" variant="inline">
            This image has no available regions. Choose another image.
          </Callout>
        )}
        <div>
          <SandboxSizeField
            instanceId={instance.data?.id}
            region={region}
            value={form.values.specId}
            onChange={id => form.setFieldValue('specId', id)}
          />
          <Spacer size={4} />
        </div>
        <form.RenderError field="specId" />
        <FormSection title="Disks" collapsible defaultOpen={false}>
          <SandboxMountsField
            instanceId={instance.data?.id}
            region={region}
            value={form.values.mounts}
            onChange={value => form.setFieldValue('mounts', value)}
          />
          <form.RenderError field="mounts" />
        </FormSection>
        <FormSection title="Environment Variables" collapsible defaultOpen={false}>
          <KeyValueInput
            masked
            label="Environment Variables"
            hideLabel
            value={form.values.env}
            onChange={value => form.setFieldValue('env', value)}
          />
        </FormSection>
        <FormSection title="Idle Behavior" collapsible defaultOpen={false}>
          <SandboxLifecycleField
            value={form.values.lifecyclePolicy}
            onChange={value => form.setFieldValue('lifecyclePolicy', value)}
          />
        </FormSection>
        <FormSection title="Network" collapsible defaultOpen={false}>
          <SandboxNetworkField
            instanceId={instance.data?.id}
            firewallIds={form.values.firewallIds}
            publicPorts={form.values.publicPorts}
            onFirewallsChange={value => form.setFieldValue('firewallIds', value)}
            onPortsChange={value => form.setFieldValue('publicPorts', value)}
          />
        </FormSection>
        {submissionError && (
          <Callout color="orange" variant="inline">
            {submissionError}
          </Callout>
        )}
        <create.RenderError />
        <Flex gap={8} justify="end">
          <Button
            size="2"
            type="button"
            variant="outline"
            disabled={create.isLoading}
            onClick={p.back}
          >
            Back
          </Button>
          <Button
            size="2"
            type="submit"
            loading={create.isLoading}
            success={create.isSuccess}
            disabled={!image.data.latestVersionId || !regionAvailable || !sizeAvailable}
          >
            Create Machine
          </Button>
        </Flex>
      </Flex>
    </form>
  ));
};

let CreateMachinePanel = (p: ShowSandboxCreateMachinePanelOptions & { close: () => void }) => {
  let instance = useCurrentInstance();
  let [imageId, setImageId] = useState(p.imageId || '');
  let [step, setStep] = useState(p.imageId ? 1 : 0);
  return (
    <ProviderCreationPanelShell
      title="Create Machine"
      description="Choose an image and configure your machine."
      currentStep={step}
      setCurrentStep={setStep}
      isStepDisabled={next => next === 1 && !imageId}
      steps={[
        {
          title: 'Choose Image',
          render: () => (
            <ImageSelection
              instanceId={instance.data?.id}
              onSelect={id => {
                setImageId(id);
                setStep(1);
              }}
            />
          )
        },
        {
          title: 'Configure',
          render: () => (
            <ConfigureMachine imageId={imageId} close={p.close} back={() => setStep(0)} />
          )
        }
      ]}
    />
  );
};

export let showSandboxCreateMachinePanel = (
  options: ShowSandboxCreateMachinePanelOptions = {}
) =>
  showProviderCreationPanel(({ close }) => <CreateMachinePanel {...options} close={close} />, {
    width: 900
  });
