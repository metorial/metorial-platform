import { remark } from 'remark';
import strip from 'strip-markdown';

export let stripMarkdown = (
  text: string,
  mode: 'no-formatting' | 'simple-formatting' = 'no-formatting'
) => {
  let file = remark()
    .use(strip, { keep: mode == 'no-formatting' ? [] : ['link', 'strong', 'emphasis'] })
    .processSync(text);

  return String(file);
};
