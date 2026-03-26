import { Outlet } from 'react-router';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { useBalance } from './hooks/useBalance';

export function Layout() {
  useBalance();

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.1),transparent_26%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.08),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]">
      <div className="pointer-events-none fixed inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:52px_52px]" />
      <Navbar />
      <main className="relative z-10 flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
