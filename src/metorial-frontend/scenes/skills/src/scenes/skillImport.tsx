import type {
  CreateSkillImportInput,
  DashboardInstanceSkillsImportsGetOutput
} from '@metorial/state';
import { renderWithLoader } from '@metorial/data-hooks';
import { parsePublicScmRepositoryUrl } from '@metorial/scene-scm';
import { useCreateSkillImport, useSkillImport, useUploadFile } from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  Callout,
  Dialog,
  Input,
  Panel,
  Spacer,
  Text,
  showModal,
  toast
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

type SkillImport = DashboardInstanceSkillsImportsGetOutput;
type SkillImportStatus = SkillImport['status'];
type SkillImportSource = CreateSkillImportInput['source'];

let SkillLink = styled(Link)`
  font-weight: 600;
  text-decoration: none;
`;

let statusColor = (status: SkillImportStatus): 'blue' | 'red' | 'orange' | 'gray' =>
  status == 'completed'
    ? 'blue'
    : status == 'failed'
      ? 'red'
      : status == 'pending' || status == 'processing'
        ? 'orange'
        : 'gray';

let SkillImportStatusBadge = ({ status }: { status: SkillImportStatus }) => (
  <div>
    <Badge size="1" color={statusColor(status)}>
      {status}
    </Badge>
  </div>
);

let getSkillImportSourceAttribute = (source: SkillImport['source']) =>
  source.type == 'file'
    ? {
        label: 'File',
        content: `${source.fileName} (${source.format == 'zip' ? 'ZIP' : 'Markdown'})`
      }
    : {
        label: 'Repository',
        content:
          source.repositoryName ??
          (source.type == 'public' ? source.repositoryUrl : source.repositoryId)
      };

let SkillImportDetails = (p: {
  instanceId: string;
  skillImportId: string;
  getSkillPath: (skillId: string) => string;
}) => {
  let skillImport = useSkillImport(p.instanceId, p.skillImportId);

  return renderWithLoader({ skillImport })(({ skillImport }) => (
    <>
      <Attributes
        itemWidth="300px"
        attributes={[
          {
            label: 'Status',
            content: <SkillImportStatusBadge status={skillImport.data.status} />
          },
          getSkillImportSourceAttribute(skillImport.data.source)
        ]}
      />

      <Spacer height={20} />

      {(skillImport.data.items.length > 0 || !skillImport.data.error) && (
        <Table
          headers={['Skill', 'Path', 'Status']}
          data={skillImport.data.items
            .sort((a, b) => a.path.localeCompare(b.path))
            .map(item => ({
              data: [
                item.skill && item.status == 'completed' ? (
                  <SkillLink to={p.getSkillPath(item.skill.id)}>{item.skill.name}</SkillLink>
                ) : item.skill ? (
                  <Text size="2" color="gray600">
                    {item.skill.name}
                  </Text>
                ) : item.error ? (
                  <Text size="2" color="red500">
                    {item.error}
                  </Text>
                ) : (
                  <Text size="2" color="gray600">
                    Waiting for skill…
                  </Text>
                ),
                item.path,
                <SkillImportStatusBadge status={item.status} />
              ]
            }))}
        />
      )}

      {!skillImport.data.items.length && !skillImport.data.error && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 16 }}>
          The source is being scanned for skills.
        </Text>
      )}

      {skillImport.data.error && (
        <>
          <Spacer height={10} />
          <Callout color="red">{skillImport.data.error}</Callout>
        </>
      )}
    </>
  ));
};

export let showSkillImportStatusPanel = (p: {
  instanceId: string;
  skillImportId: string;
  getSkillPath: (skillId: string) => string;
}) =>
  showModal(({ dialogProps }) => (
    <Panel.Wrapper {...dialogProps} width={900}>
      <Panel.Header>
        <Panel.Title>Skill Import</Panel.Title>
      </Panel.Header>
      <Panel.Content>
        <SkillImportDetails {...p} />
      </Panel.Content>
    </Panel.Wrapper>
  ));

export let validateSkillImportFile = (file: Pick<File, 'name' | 'size'>) => {
  let extension = file.name.split('.').pop()?.toLowerCase();

  if (!extension || !['zip', 'md', 'markdown'].includes(extension)) {
    return 'Choose a ZIP or Markdown file.';
  }

  let maxSize = extension == 'zip' ? 10 * 1024 * 1024 : 3 * 1024 * 1024;
  if (file.size > maxSize) {
    return extension == 'zip'
      ? 'ZIP skill archives must be 10 MB or smaller.'
      : 'Markdown skill files must be 3 MB or smaller.';
  }

  return null;
};

let showSkillImportFileError = (message: string) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={480}>
      <Dialog.Title>Unable to upload skill</Dialog.Title>
      <Dialog.Description>{message}</Dialog.Description>
      <Dialog.Actions>
        <Button onClick={close}>Close</Button>
      </Dialog.Actions>
    </Dialog.Wrapper>
  ));

export let useSkillImportActions = (p: {
  instanceId: string;
  getSkillPath: (skillId: string) => string;
}) => {
  let uploadFile = useUploadFile();
  let createSkillImport = useCreateSkillImport();

  let openStatus = (skillImportId: string) => {
    window.setTimeout(
      () =>
        showSkillImportStatusPanel({
          instanceId: p.instanceId,
          skillImportId,
          getSkillPath: p.getSkillPath
        }),
      0
    );
  };

  let createImport = async (source: SkillImportSource) => {
    let [skillImport] = await createSkillImport.mutate({
      instanceId: p.instanceId,
      source
    });
    if (!skillImport) return false;

    openStatus(skillImport.id);
    return true;
  };

  let importUploadedFile = async (file: File) => {
    let [uploadedFile, uploadError] = await uploadFile.mutate({
      instanceId: p.instanceId,
      file,
      title: file.name,
      purpose: 'generic'
    });
    if (uploadError) throw uploadError;
    if (!uploadedFile) throw new Error('Upload completed without a file');

    if (
      !(await createImport({
        type: 'file',
        fileId: uploadedFile.id
      }))
    ) {
      throw new Error('Failed to start the skill import');
    }
  };

  let uploadWithToast = (run: () => Promise<void>) => {
    toast.promise(run, {
      loading: 'Uploading skill...',
      success: 'Skill uploaded',
      error: error => error?.data?.message ?? error?.message ?? 'Failed to upload skill'
    });
  };

  let uploadSelectedFile = (file: File) => {
    uploadWithToast(() => importUploadedFile(file));
  };

  let uploadSkillDirectory = () => {
    let input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.onchange = async () => {
      let files = Array.from(input.files ?? []);
      if (!files.length) return;

      let { createSkillImportZipFromDirectory, validateSkillImportDirectory } = await import(
        './skillImportZip'
      );

      let validationError = validateSkillImportDirectory(files);
      if (validationError) {
        showSkillImportFileError(validationError);
        return;
      }

      uploadWithToast(async () => {
        let zipFile = await createSkillImportZipFromDirectory(files);
        let zipValidationError = validateSkillImportFile(zipFile);
        if (zipValidationError) throw new Error(zipValidationError);
        await importUploadedFile(zipFile);
      });
    };
    input.click();
    void import('./skillImportZip');
  };

  let uploadSkill = () => {
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.md,.markdown,application/zip,text/markdown,text/plain';
    input.multiple = false;
    input.onchange = () => {
      let file = input.files?.[0];
      if (!file) return;

      let validationError = validateSkillImportFile(file);
      if (validationError) {
        showSkillImportFileError(validationError);
        return;
      }

      uploadSelectedFile(file);
    };
    input.click();
  };

  return {
    createImport,
    uploadSkill,
    uploadSkillDirectory,
    isLoading: uploadFile.isLoading || createSkillImport.isLoading,
    RenderError: () => (
      <>
        <uploadFile.RenderError />
        <createSkillImport.RenderError />
      </>
    )
  };
};

let PublicSkillImportForm = (p: {
  instanceId: string;
  getSkillPath: (skillId: string) => string;
  close: () => void;
}) => {
  let skillImport = useSkillImportActions(p);
  let [repositoryUrl, setRepositoryUrl] = useState('');
  let [validationError, setValidationError] = useState<string | null>(null);

  let submit = async (event: FormEvent) => {
    event.preventDefault();

    let repository = parsePublicScmRepositoryUrl(repositoryUrl);
    if (!repository) {
      setValidationError(
        'Enter a public GitHub, GitLab, or Bitbucket repository URL without a branch or file path.'
      );
      return;
    }

    setValidationError(null);
    if (
      await skillImport.createImport({
        type: 'public',
        repositoryUrl: repository.url
      })
    ) {
      p.close();
    }
  };

  return (
    <>
      <Dialog.Title>Import skill from URL</Dialog.Title>
      <Dialog.Description>
        Enter the URL of a public GitHub, GitLab, or Bitbucket repository containing one or
        more skills.
      </Dialog.Description>

      <form onSubmit={submit}>
        <Input
          label="Repository URL"
          placeholder="https://github.com/owner/repository"
          value={repositoryUrl}
          onChange={event => {
            setRepositoryUrl(event.target.value);
            setValidationError(null);
          }}
          autoFocus
        />
        {validationError && <Callout color="red">{validationError}</Callout>}
        <skillImport.RenderError />

        <Spacer height={20} />
        <Dialog.Actions>
          <Button type="button" variant="soft" color="gray" onClick={p.close}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={skillImport.isLoading}
            disabled={!repositoryUrl.trim()}
          >
            Import Skill
          </Button>
        </Dialog.Actions>
      </form>
    </>
  );
};

export let showPublicSkillImportModal = (p: {
  instanceId: string;
  getSkillPath: (skillId: string) => string;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={520}>
      <PublicSkillImportForm {...p} close={close} />
    </Dialog.Wrapper>
  ));
