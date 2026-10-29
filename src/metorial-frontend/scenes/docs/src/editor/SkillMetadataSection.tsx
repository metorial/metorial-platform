import {
  skillLoader,
  useSkill,
  useSkillAssistant,
  useSkillAssistantWorkspace
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

let Panel = styled.div`
  margin: -4px 0 18px;
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.size.radius};
  background: ${({ theme }) => theme.color.bgAlt};
  overflow: hidden;
`;

let Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;

  & + & {
    border-top: 1px solid ${({ theme }) => theme.color.border};
  }
`;

let FieldHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

let FieldLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.textMuted};
`;

let FieldInput = styled.input`
  width: 100%;
  margin: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 12.5px;
  box-sizing: border-box;

  &::placeholder {
    color: ${({ theme }) => theme.color.textSubtle};
  }
`;

let FieldTextarea = styled.textarea`
  display: block;
  width: 100%;
  min-height: 64px;
  margin: 0;
  border: 0;
  resize: none;
  outline: 0;
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.5;
  box-sizing: border-box;

  &::placeholder {
    color: ${({ theme }) => theme.color.textSubtle};
  }
`;

let Hint = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.color.textSubtle};
`;

let ErrorText = styled.div`
  padding: 0 12px 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.color.danger};
`;

let Callout = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -4px 0 18px;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme.color.callout.warning.border};
  border-radius: ${({ theme }) => theme.size.radius};
  background: ${({ theme }) => theme.color.callout.warning.bg};
  color: ${({ theme }) => theme.color.callout.warning.text};
  font-size: 13px;
  line-height: 1.45;
`;

let CalloutText = styled.button`
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
`;

let normalizeClientName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export let SkillMetadataSection = (p: {
  instanceId: string;
  skillId: string;
  documentId: string;
  readOnly: boolean;
  open: boolean;
  onOpen: () => void;
}) => {
  let skill = useSkill(p.instanceId, p.skillId);
  let updateMutator = skill.updateMutator();
  let workspace = useSkillAssistantWorkspace();
  let assistant = useSkillAssistant({
    organizationId: workspace?.organizationId,
    instanceId: p.instanceId,
    skillId: p.skillId,
    documentId: p.documentId
  });

  let savedName = skill.data?.clientName ?? '';
  let savedDescription = skill.data?.clientDescription ?? '';

  let [name, setName] = useState(savedName);
  let [description, setDescription] = useState(savedDescription);
  let focusedRef = useRef<'name' | 'description' | null>(null);
  let descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (focusedRef.current != 'name') setName(savedName);
  }, [savedName]);
  useEffect(() => {
    if (focusedRef.current != 'description') setDescription(savedDescription);
  }, [savedDescription]);

  useEffect(() => {
    let el = descriptionRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 64)}px`;
  }, [description, p.open]);

  let wasBusyRef = useRef(false);
  useEffect(() => {
    if (wasBusyRef.current && !assistant.isBusy) skillLoader.refetchAll();
    wasBusyRef.current = assistant.isBusy;
  }, [assistant.isBusy]);

  if (!skill.data) return null;

  let canEdit = !p.readOnly && (workspace?.canWrite ?? true);
  let hasDescription = savedDescription.trim().length > 0;

  let saveName = async () => {
    focusedRef.current = null;
    let next = normalizeClientName(name);
    if (!next) {
      setName(savedName);
      return;
    }
    setName(next);
    if (next != savedName) await updateMutator.mutate({ clientName: next });
  };

  let saveDescription = async () => {
    focusedRef.current = null;
    let next = description.trim();
    if (!next) {
      setDescription(savedDescription);
      return;
    }
    if (next != savedDescription) await updateMutator.mutate({ clientDescription: next });
  };

  let generate = async () => {
    p.onOpen();
    try {
      await assistant.send({
        text: 'Write the client description for this skill.',
        context: { mode: 'metadata', documentId: p.documentId, placement: 'inline' }
      });
    } catch {}
  };

  let generateButton = canEdit ? (
    <Button
      type="button"
      size="1"
      variant="outline"
      loading={assistant.isBusy}
      onClick={generate}
    >
      {hasDescription ? 'Regenerate' : 'Generate'}
    </Button>
  ) : null;

  return (
    <>
      {!hasDescription && (
        <Callout>
          <CalloutText type="button" onClick={p.onOpen}>
            <strong>This skill has no description.</strong> Agents need a description to
            discover it.{' '}
          </CalloutText>
          {generateButton}
        </Callout>
      )}

      {p.open && (
        <Panel>
          <Field>
            <FieldHeader>
              <FieldLabel>Client name</FieldLabel>
            </FieldHeader>
            <FieldInput
              value={name}
              readOnly={!canEdit}
              placeholder="my-skill"
              spellCheck={false}
              onFocus={() => (focusedRef.current = 'name')}
              onChange={e => setName(e.target.value)}
              onBlur={saveName}
            />
          </Field>

          <Field>
            <FieldHeader>
              <FieldLabel>Client description</FieldLabel>
              {hasDescription && generateButton}
            </FieldHeader>
            <FieldTextarea
              ref={descriptionRef}
              value={description}
              readOnly={!canEdit || assistant.isBusy}
              placeholder={
                assistant.isBusy
                  ? 'Writing a description...'
                  : 'What this skill does and when an agent should use it'
              }
              onFocus={() => (focusedRef.current = 'description')}
              onChange={e => setDescription(e.target.value)}
              onBlur={saveDescription}
            />
          </Field>

          {(assistant.error || updateMutator.error) && (
            <ErrorText>
              {assistant.error ?? updateMutator.error?.data?.message ?? 'Could not save.'}
            </ErrorText>
          )}
        </Panel>
      )}
    </>
  );
};
