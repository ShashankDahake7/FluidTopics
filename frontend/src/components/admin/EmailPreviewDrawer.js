'use client';
import { useEffect, useRef, useCallback } from 'react';
import './drawerlasagna-layer.css';

/**
 * Slide-in iframe drawer used by the admin notification screens to preview
 * email templates. Pass a `template` (display title used for the header), a
 * fully formed HTML `srcDoc`, and an `onClose` callback. When `template` is
 * falsy the drawer renders nothing.
 */
export default function EmailPreviewDrawer({ template, srcDoc, onClose }) {
  const layerRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (!template) return undefined;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [template, handleKeyDown]);

  useEffect(() => {
    if (!template) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [template]);

  useEffect(() => {
    if (template && layerRef.current) {
      layerRef.current.focus();
    }
  }, [template]);

  if (!template) return null;

  return (
    <aside
      ref={layerRef}
      className="drawerlasagna-layer drawerlasagna-layer-opened drawerlasagna-layer-active"
      tabIndex={0}
      aria-hidden={false}
    >
      <div className="drawerlasagna-layer-pasta" role="presentation" onClick={onClose} />
      <div
        className="drawerlasagna-layer-garnish"
        role="dialog"
        aria-modal="true"
        aria-label={template}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawerlasagna-layer-header">
          <div className="drawerlasagna-layer-close-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 48" width="50" height="48" aria-hidden="true">
              <title>drawer close background</title>
              <path
                className="cls-1"
                d="M49,48,5.81,38.21A4.79,4.79,0,0,1,2,33.52v-19A4.79,4.79,0,0,1,5.81,9.79L49,0Z"
              />
              <path
                className="cls-2"
                d="M50,48,5.81,38.21A4.79,4.79,0,0,1,2,33.52v-19A4.79,4.79,0,0,1,5.81,9.79L50,0"
              />
            </svg>
            <button
              type="button"
              className="ft-btn ft-btn-no-bg ft-btn-no-border ft-btn-square"
              aria-label="Close"
              onClick={onClose}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span className="ft-btn-inner-text">Close</span>
            </button>
          </div>
          <h2 className="drawerlasagna-layer-title">
            <span className="gwt-InlineLabel">{template}</span>
          </h2>
        </header>
        <div className="drawerlasagna-layer-content">
          <div className="drawerlasagna-content-wrapper">
            <iframe
              title="Email preview"
              srcDoc={srcDoc}
              className="invisible-iframe drawerlasagna-content"
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
