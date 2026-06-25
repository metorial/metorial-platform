import { getImageUrl } from '@metorial/db/src/lib/getImageUrl';
import PQueue from 'p-queue';
import rehypeParse from 'rehype-parse';
import rehypeRaw from 'rehype-raw';
import rehypeRemark from 'rehype-remark';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { hastSchema } from './hastSchema';
import { isRelativeUrl, joinUrls } from './urls';

export type MarkdownOptions = {
  id: string;

  imageRoot?: string;
  linkRoot?: string;
  rootPath?: string;
};

export class Markdown {
  private constructor(
    private readonly markdown: string,
    private readonly opts: MarkdownOptions
  ) {}

  static from(markdown: string, opts: MarkdownOptions) {
    return new Markdown(markdown, opts);
  }

  async toHtml() {
    let file = await unified()
      .use(remarkParse)
      .use(remarkFrontmatter)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeSanitize, hastSchema)
      .use(rehypePrefixRelativeUrls(this.opts))
      .use(rehypeStringify)
      .process(this.markdown);

    return String(file);
  }

  async toMarkdown() {
    let file = await unified()
      .use(rehypeParse)
      .use(remarkFrontmatter)
      .use(remarkGfm)
      .use(rehypeRemark)
      .use(rehypePrefixRelativeUrls(this.opts))
      .use(remarkStringify)
      .process(this.markdown);

    return String(file);
  }
}

let rehypePrefixRelativeUrls = (opts: MarkdownOptions) => {
  return () => {
    return async (tree: any) => {
      let q = new PQueue({ concurrency: Infinity });

      visit(tree, 'element', node => {
        if (!node.properties) return;

        if (node.tagName === 'a' && typeof node.properties.href === 'string') {
          if (isRelativeUrl(node.properties.href) && opts.linkRoot) {
            node.properties.href = joinUrls(
              opts.linkRoot,
              opts.rootPath,
              node.properties.href
            );
          }

          try {
            let u = new URL(node.properties.href);

            if (u.hostname != 'metorial.com' && !u.hostname.endsWith('.metorial.com')) {
              node.properties.target = '_blank';
              node.properties.rel = 'noopener noreferrer';
            }

            node.properties.href = u.toString();
          } catch (e) {
            node.properties.href = '#';
          }
        }

        if (node.tagName === 'img' && typeof node.properties.src === 'string') {
          if (isRelativeUrl(node.properties.src) && opts.imageRoot) {
            node.properties.src = joinUrls(opts.imageRoot, opts.rootPath, node.properties.src);
          }

          try {
            let u = new URL(node.properties.src);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') {
              throw new Error('Invalid URL protocol');
            }

            node.properties.src = u.toString();

            if (u.hostname != 'metorial.com' && !u.hostname.endsWith('.metorial.com')) {
              q.add(async () => {
                node.properties.src = await getImageUrl({
                  id: opts.id,
                  image: {
                    type: 'url',
                    url: node.properties.src
                  }
                });
              });
            }
          } catch (e) {
            node.properties.src = '#';
          }
        }
      });

      await q.onIdle();
    };
  };
};
