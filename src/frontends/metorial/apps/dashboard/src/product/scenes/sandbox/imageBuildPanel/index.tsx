import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { FileInput } from '@metorial/file-upload';
import { FormSection } from '@metorial/form-sections';
import {
  sandboxImageBuildContextExtensions,
  sandboxImageBuildContextMaxBytes,
  uploadSandboxImageBuildContext,
  useCreateSandboxImage,
  useSandboxImageBuildsForImage,
  useStartSandboxImageBuild,
  type DashboardInstanceSandboxImageBuildsGetOutput
} from '@metorial/state';
import {
  Button,
  Callout,
  Input,
  KeyValueInput,
  NumberInput,
  Panel,
  Text,
  getDuplicateKeys,
  keyValueEntriesToRecord,
  recordToKeyValueEntries,
  showModal
} from '@metorial/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageStack, useSandboxImagePaths } from '../images/common';
import { packSandboxDockerfile } from './archive';

type BuildPanelInput = {
  image?: { id: string; name?: string | null };
  previousBuild?: DashboardInstanceSandboxImageBuildsGetOutput;
};

export let showSandboxImageBuildPanel = ({ image, previousBuild }: BuildPanelInput = {}) =>
  showModal(({ dialogProps, close }) => {
    let paths = useSandboxImagePaths();
    let navigate = useNavigate();
    let previous = useSandboxImageBuildsForImage(paths.instanceId, image?.id, {
      order: 'desc',
      limit: 1
    });

    let create = useCreateSandboxImage();
    let start = useStartSandboxImageBuild();

    let [file, setFile] = useState<File | null>(null);

    let [imageId, setImageId] = useState(image?.id);
    let [fileId, setFileId] = useState<string | undefined>(previousBuild?.fileId || undefined);

    let [uploading, setUploading] = useState(false);
    let [progress, setProgress] = useState<number | null>(null);
    let [failure, setFailure] = useState<string>();

    let abort = useRef<AbortController | null>(null);
    let initialized = useRef(false);
    let [args, setArgs] = useState<ReturnType<typeof recordToKeyValueEntries>>([]);
    let busy = uploading || create.isLoading || start.isLoading;
    useEffect(() => () => abort.current?.abort(), []);

    let form = useForm({
      initialValues: {
        name: '',
        dockerfilePath: 'Dockerfile',
        contextPath: '.',
        target: '',
        timeout: 30,
        disk: 16
      },
      onSubmit: async values => {
        if (!paths.instanceId || busy) return;
        setFailure(undefined);

        if (getDuplicateKeys(args).size) {
          setFailure('Build argument names must be unique.');
          return;
        }
        if (!fileId && !file) {
          setFailure('Choose a Dockerfile or build context archive.');
          return;
        }

        let selectedImage = imageId;
        if (!selectedImage) {
          let [created] = await create.mutate({
            instanceId: paths.instanceId,
            name: values.name.trim()
          });
          if (!created) return;
          selectedImage = created.id;
          setImageId(created.id);
        }

        let selectedFile = fileId;
        if (!selectedFile) {
          setProgress(null);
          setUploading(true);
          abort.current = new AbortController();
          try {
            let context = sandboxImageBuildContextExtensions.some(extension =>
              file!.name.toLowerCase().endsWith(extension)
            )
              ? file!
              : await packSandboxDockerfile(await file!.text(), values.dockerfilePath);
            let uploaded = await uploadSandboxImageBuildContext({
              instanceId: paths.instanceId,
              file: context,
              signal: abort.current.signal,
              onProgress: p => setProgress(p.ratio)
            });
            selectedFile = uploaded.id;
            setFileId(uploaded.id);
          } catch (error) {
            setFailure(
              error instanceof Error
                ? error.message
                : 'The build context could not be uploaded.'
            );
            return;
          } finally {
            setUploading(false);
          }
        }
        let [build] = await start.mutate({
          instanceId: paths.instanceId,
          imageId: selectedImage,
          fileId: selectedFile,
          dockerfilePath: values.dockerfilePath,
          contextPath: values.contextPath,
          target: values.target || undefined,
          buildArgs: keyValueEntriesToRecord(args),
          timeoutSeconds: Math.round(values.timeout * 60),
          diskSizeBytes: values.disk * 1024 ** 3
        });
        if (build) {
          close();
          navigate(paths.version(selectedImage, build.versionId));
        }
      },
      schema: yup =>
        yup.object({
          name: image ? yup.string() : yup.string().trim().required('Name is required'),
          dockerfilePath: yup.string().trim().required('Dockerfile Path is required'),
          contextPath: yup.string().trim().required('Context Path is required'),
          target: yup.string(),
          timeout: yup
            .number()
            .min(1)
            .max(120)
            .test(
              'whole-seconds',
              'Timeout must resolve to whole seconds.',
              value => value != null && Math.abs(value * 60 - Math.round(value * 60)) < 1e-6
            )
            .required(),
          disk: yup.number().integer().min(1).required()
        })
    });

    useEffect(() => {
      let build = previousBuild || previous.data?.items[0];
      if (!build || initialized.current) return;
      initialized.current = true;
      void form.setValues({
        ...form.values,
        dockerfilePath: build.dockerfilePath || 'Dockerfile',
        contextPath: build.contextPath || '.',
        target: build.target || '',
        timeout: (build.timeoutSeconds ?? 1800) / 60,
        disk: (build.diskSizeBytes ?? 16 * 1024 ** 3) / 1024 ** 3
      });
      setArgs(
        recordToKeyValueEntries(
          Object.fromEntries((build.buildArgNames ?? []).map(name => [name, '']))
        )
      );
    }, [previousBuild, previous.data]);
    let content = (
      <form onSubmit={form.handleSubmit}>
        <ImageStack>
          {!image && (
            <>
              <Input
                label="Name"
                {...form.getFieldProps('name')}
                disabled={busy || !!imageId}
              />
              <form.RenderError field="name" />
            </>
          )}
          {fileId && !file && (
            <Callout color="gray">
              The previously uploaded build context will be reused. Upload a new Dockerfile or
              archive to replace it.
            </Callout>
          )}
          <FileInput
            label="Build Context"
            title="Upload a Dockerfile or Build Context Archive"
            value={file}
            onChange={value => {
              setFile(value);
              setFileId(undefined);
              setProgress(null);
            }}
            maxSize={sandboxImageBuildContextMaxBytes}
            disabled={busy}
            progress={uploading ? progress : undefined}
            description="Upload a Dockerfile, .zip, .tar, .tar.gz, or .tgz. A standalone Dockerfile is automatically zipped; archives must include your Dockerfile."
          />
          <Input
            label="Dockerfile Path"
            {...form.getFieldProps('dockerfilePath')}
            onInput={value => {
              void form.setFieldValue('dockerfilePath', value);
              if (
                file &&
                !sandboxImageBuildContextExtensions.some(extension =>
                  file.name.toLowerCase().endsWith(extension)
                )
              )
                setFileId(undefined);
            }}
            disabled={busy}
          />
          <form.RenderError field="dockerfilePath" />
          <Input label="Context Path" {...form.getFieldProps('contextPath')} disabled={busy} />
          <form.RenderError field="contextPath" />
          <FormSection
            title="Advanced"
            description="Target, build arguments, timeout, build disk"
            collapsible
            defaultOpen={false}
          >
            <ImageStack>
              <Input label="Target" {...form.getFieldProps('target')} disabled={busy} />
              <KeyValueInput
                label="Build Arguments"
                value={args}
                onChange={setArgs}
                maxRows={64}
                disabled={busy}
              />
              {!!(previousBuild || previous.data?.items[0])?.buildArgNames?.length && (
                <Text size="2">
                  Previous argument names are prefilled. Enter their values again; saved values
                  are private.
                </Text>
              )}
              <NumberInput
                label="Timeout"
                value={form.values.timeout}
                onChange={value => void form.setFieldValue('timeout', value)}
                unit="minutes"
                step={1 / 60}
                min={1}
                max={120}
                disabled={busy}
              />
              <form.RenderError field="timeout" />
              <NumberInput
                label="Machine Disk Size"
                value={form.values.disk}
                onChange={value => void form.setFieldValue('disk', value)}
                unit="GiB"
                min={1}
                disabled={busy}
              />
              <form.RenderError field="disk" />
            </ImageStack>
          </FormSection>
          {failure && <Callout color="red">{failure}</Callout>}
          <create.RenderError />
          <start.RenderError />
          <Panel.Actions>
            <Button size="2" type="button" variant="outline" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button size="2" type="submit" loading={busy} success={start.isSuccess}>
              {failure || create.error || start.error
                ? 'Retry'
                : image
                  ? 'Start Build'
                  : 'Create Image'}
            </Button>
          </Panel.Actions>
        </ImageStack>
      </form>
    );
    return (
      <Panel.Wrapper
        {...dialogProps}
        onOpenChange={open => {
          if (!busy) dialogProps.onOpenChange(open);
        }}
        width={760}
      >
        <Panel.Header>
          <Panel.Title>
            {image ? `New Version of ${image.name || image.id}` : 'Create Image'}
          </Panel.Title>
          <Panel.Description>Build a machine image from a Dockerfile.</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          {image ? renderWithLoader({ previous })(() => content) : content}
        </Panel.Content>
      </Panel.Wrapper>
    );
  });
