import { subspace } from '../subspace';

export let subspaceBrandService = subspace.brand;

export type SubspaceBrand = Awaited<ReturnType<typeof subspace.brand.get>>;
