import { useForm } from '@metorial/data-hooks';
import { Button, Dialog, Input, Spacer, showModal } from '@metorial/ui';
import { useState } from 'react';

let SkillCloneForm = (p: {
  close: () => void;
  title: string;
  description: string;
  submitLabel: string;
  initialName: string;
  initialDescription?: string | null;
  onSubmit: (values: { name: string; description?: string }) => Promise<boolean | void>;
}) => {
  let [isSubmitting, setIsSubmitting] = useState(false);
  let form = useForm({
    initialValues: {
      name: p.initialName,
      description: p.initialDescription ?? ''
    },
    onSubmit: async values => {
      setIsSubmitting(true);

      try {
        let shouldStayOpen = await p.onSubmit({
          name: values.name.trim(),
          description: values.description.trim() || undefined
        });

        if (shouldStayOpen === false) return;
        p.close();
      } finally {
        setIsSubmitting(false);
      }
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Dialog.Title>{p.title}</Dialog.Title>
      <Dialog.Description>{p.description}</Dialog.Description>

      <Input label="Name" required {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input
        as="textarea"
        label="Description"
        minRows={4}
        {...form.getFieldProps('description')}
      />
      <form.RenderError field="description" />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="soft" onClick={p.close}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {p.submitLabel}
        </Button>
      </Dialog.Actions>
    </form>
  );
};

export let showSkillCloneFormModal = (p: {
  title: string;
  description: string;
  submitLabel: string;
  initialName: string;
  initialDescription?: string | null;
  onSubmit: (values: { name: string; description?: string }) => Promise<boolean | void>;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <SkillCloneForm {...p} close={close} />
    </Dialog.Wrapper>
  ));
