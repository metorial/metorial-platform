import { providerPresenter } from '../presenters';
import { providerService } from '../services';
import { app } from './_app';

export let providerController = app.controller({
  getDefault: app
    .handler()
    .do(async _ => providerPresenter(await providerService.getDefaultProvider()))
});
