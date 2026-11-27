import { PrismTheme } from 'prism-react-renderer';

const theme: PrismTheme = {
  plain: {
    color: '#444',
    backgroundColor: '#fff'
  },
  styles: [
    {
      types: ['changed'],
      style: {
        color: '#719dfa',
        fontStyle: 'italic'
      }
    },
    {
      types: ['deleted'],
      style: {
        color: 'rgba(239, 83, 80, 0.56)',
        fontStyle: 'italic'
      }
    },
    {
      types: ['inserted', 'attr-name'],
      style: {
        color: '#3366d1',
        fontStyle: 'italic'
      }
    },
    {
      types: ['comment'],
      style: {
        color: '989fb1',
        fontStyle: 'italic'
      }
    },
    {
      types: ['string', 'builtin', 'char', 'constant', 'url'],
      style: {
        color: '#3366d1'
      }
    },
    {
      types: ['variable'],
      style: {
        color: '#65c999'
      }
    },
    {
      types: ['number'],
      style: {
        color: '#65c999'
      }
    },
    {
      types: ['punctuation'],
      style: {
        color: '#c3714c'
      }
    },
    {
      types: ['function', 'selector', 'doctype'],
      style: {
        color: '#c3714c',
        fontStyle: 'italic'
      }
    },
    {
      types: ['class-name'],
      style: {
        color: 'rgb(17, 17, 17)'
      }
    },
    {
      types: ['tag'],
      style: {
        color: '#c3714c'
      }
    },
    {
      types: ['operator', 'property', 'keyword', 'namespace'],
      style: {
        color: '#0c9b7c'
      }
    },
    {
      types: ['boolean'],
      style: {
        color: '#bc5454'
      }
    }
  ]
};
export default theme;
