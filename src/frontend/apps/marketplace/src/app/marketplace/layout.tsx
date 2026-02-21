import { Footer } from '../../components/footer';
import { Help } from '../../components/help';
import { Nav } from '../../components/nav';
import { listProviderCategories } from '../../state/provider';

export default async ({ children }: { children: React.ReactNode }) => {
  let categories = await listProviderCategories({});

  return (
    <div className="relative w-full">
      <Nav categories={categories.items} />

      {children}

      <Footer />

      <Help />
    </div>
  );
};
