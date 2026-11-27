import { EntityContent } from './content';
import { EntityContentRaw } from './contentRaw';
import { EntityField } from './field';
import { EntityFooter } from './footer';
import { EntityHeader } from './header';
import { EntityWrapper } from './wrapper';

export let Entity = {
  Wrapper: EntityWrapper,
  Footer: EntityFooter,
  Field: EntityField,
  Content: EntityContent,
  Header: EntityHeader,
  ContentRaw: EntityContentRaw
};
