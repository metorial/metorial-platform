import { Footer } from '../../components/footer';
import { Help } from '../../components/help';
import { Nav } from '../../components/nav';

export default ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative w-full">
      <Nav />

      {children}

      <Footer />

      <Help />
    </div>
  );
};
