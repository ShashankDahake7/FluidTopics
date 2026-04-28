'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function PortalSearch() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const router = useRouter();

  // Debounced /api/search/suggest call
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api.get(`/search/suggest?q=${encodeURIComponent(q)}`)
        .then((d) => {
          setSuggestions(d.suggestions || []);
          setOpen(true);
          setActive(-1);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const goToResults = (q) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  // Custom-template suggestions carry { kind: 'template', href } so a
  // click on Release Notes goes straight to /dashboard/templates/release-notes
  // rather than re-running the query through /search?q=. Other suggestions
  // (topic-title autocomplete) keep the legacy search-rerun behaviour.
  const goToSuggestion = (suggestion) => {
    if (!suggestion) return;
    setOpen(false);
    if (suggestion.kind === 'template' && suggestion.href) {
      router.push(suggestion.href);
      return;
    }
    goToResults(suggestion.text);
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') { e.preventDefault(); goToResults(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) goToSuggestion(suggestions[active]);
      else goToResults();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="portal-search" ref={wrapRef}>
      <form
        className="portal-search-form"
        onSubmit={(e) => { e.preventDefault(); goToResults(); }}
        role="search"
      >
        <input
          type="search"
          className="portal-search-input"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="portal-search-suggest"
        />
        <button type="submit" className="portal-search-btn" aria-label="Search">
          {loading ? (
            <span className="portal-search-spinner" aria-hidden="true" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          )}
        </button>
      </form>

      {open && suggestions.length > 0 && (
        <ul id="portal-search-suggest" className="portal-search-suggest" role="listbox">
          {suggestions.map((s, i) => {
            const isTemplate = s.kind === 'template';
            return (
              <li key={`${s.id}-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`portal-search-suggest-item${i === active ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToSuggestion(s)}
                >
                  {isTemplate ? (
                    // Document-style icon flags this as a static page,
                    // not a topic-title autocomplete.
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  )}
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.text}
                  </span>
                  {isTemplate && (
                    <span
                      style={{
                        background: '#eef4ff', color: '#1d4ed8',
                        padding: '2px 6px', borderRadius: '4px',
                        fontSize: '0.65rem', fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        marginLeft: '8px', flexShrink: 0,
                      }}
                    >
                      Page
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
