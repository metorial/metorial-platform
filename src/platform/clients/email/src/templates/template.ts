import { IEmail } from './lib/email';

export interface ITemplate<Data> {
  render: (data: Data) => IEmail | Promise<IEmail>;
}

export let createTemplate = <Data>(template: ITemplate<Data>) => template;
