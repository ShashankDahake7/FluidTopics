import '@/components/portal/portal.css';
import PortalRouteGate from '@/components/portal/PortalRouteGate';

export default function PortalLayout({ children }) {
  return (
    <div className="portal-shell">
      <PortalRouteGate>{children}</PortalRouteGate>
    </div>
  );
}
