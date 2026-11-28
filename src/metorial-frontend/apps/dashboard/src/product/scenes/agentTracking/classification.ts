let hostedModelPromptLength = '2,000';

type ClassificationValues = {
  deterministicEnabled: boolean;
  aiEnabled: boolean;
};

type ContentMode = 'basic' | 'shape' | 'full';

export let classificationUpdate = (values: ClassificationValues): ClassificationValues => ({
  deterministicEnabled: values.deterministicEnabled,
  aiEnabled: values.deterministicEnabled && values.aiEnabled
});

export let hostedModelPromptText = (mode: ContentMode) =>
  mode == 'full'
    ? `This environment keeps prompt text, so the first ${hostedModelPromptLength} characters of the session's first prompt are sent too.`
    : 'This environment does not keep prompt text, so no prompt is sent.';
