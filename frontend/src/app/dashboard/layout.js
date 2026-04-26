import '@/components/portal/portal.css';

export default function PortalLayout({ children }) {
  return (
    <div className="portal-shell">
      <main className="portal-shell-main">{children}</main>
    </div>
  );
}
