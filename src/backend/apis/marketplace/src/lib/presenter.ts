let marketplacePresenterOptions = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'instance_publishable'
} as const;

type MarketplacePresenterRun<T> = (opts: typeof marketplacePresenterOptions) => {
  run: (ctx: Record<string, never>) => Promise<T>;
};

export let runMarketplacePresenter = async <T>(run: MarketplacePresenterRun<T>) =>
  await run(marketplacePresenterOptions).run({});
