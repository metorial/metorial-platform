import { Footer } from '../../components/footer';
import { Help } from '../../components/help';
import { Nav } from '../../components/nav';
import { listServerCategories } from '../../state/server';

export default async ({ children }: { children: React.ReactNode }) => {
  let categories = await listServerCategories({});

  return (
    <div className="relative w-full">
      <Nav categories={categories.items} />

      {children}

      <Footer />

      <Help />
    </div>
  );
};
