'use client';
import { useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Mock data ------------------------------ */
/* 50 rows mirror the Angular blueprint exactly (4/19/2026 sessions). */

const SESSIONS = [
  { date: '4/19/2026, 07:29 PM', duration: '20min 18s',  userId: '623c78e6-e18d-44ee-897d-7b78c0d9ef95', uniqueQueries: 3, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 7,  topicViews: 31 },
  { date: '4/19/2026, 07:21 PM', duration: '13min 29s',  userId: 'c98005d4-6994-4456-a45a-4108a5be6eed', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 4 },
  { date: '4/19/2026, 07:14 PM', duration: '13s',         userId: '009c7ed0-dbae-437f-b78f-ccdee165707d', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 0 },
  { date: '4/19/2026, 06:54 PM', duration: '1min 17s',    userId: '745f3ec3-cdfc-41e2-a07d-972e8b724164', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 2 },
  { date: '4/19/2026, 06:24 PM', duration: '12s',         userId: 'Unauthenticated',                       uniqueQueries: 1, uniqueQueriesNoResults: 1, docSearches: 0, docSearchesNoResults: 0, documentViews: 0,  topicViews: 0 },
  { date: '4/19/2026, 05:55 PM', duration: '8s',          userId: '19674d84-b57c-4492-8e8a-90e305356f52', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 05:43 PM', duration: '45s',         userId: '3079f91a-3a7f-4c0f-b117-7ec5015d764b', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 05:21 PM', duration: '22min 38s',   userId: '36c28f34-343a-4176-8292-883b77aaac4f', uniqueQueries: 4, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 5,  topicViews: 14 },
  { date: '4/19/2026, 05:19 PM', duration: '1min 11s',    userId: 'c7a668da-8ca0-4c1d-afd5-1c23fe61ca34', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 3,  topicViews: 3 },
  { date: '4/19/2026, 05:13 PM', duration: '4min 4s',     userId: '6039ee45-7114-4d89-87f1-a99d950d0b51', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 3 },
  { date: '4/19/2026, 05:12 PM', duration: '9s',          userId: '24242d52-7035-4ff8-80ee-c58ac38bdb30', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 05:04 PM', duration: '27min 24s',   userId: '618bfc41-5adc-40d5-b5b5-da0684df634d', uniqueQueries: 5, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 7,  topicViews: 20 },
  { date: '4/19/2026, 04:30 PM', duration: '12min 1s',    userId: 'b39ffdf8-79c2-4a10-a330-37f1827d1fce', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 5,  topicViews: 20 },
  { date: '4/19/2026, 04:28 PM', duration: '1min 2s',     userId: '9979f0ba-336d-41a7-a1d2-ab5236b0b954', uniqueQueries: 3, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 2,  topicViews: 2 },
  { date: '4/19/2026, 04:25 PM', duration: '32min 56s',   userId: 'c98005d4-6994-4456-a45a-4108a5be6eed', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 8 },
  { date: '4/19/2026, 04:21 PM', duration: '34s',         userId: 'da03f4d6-e8dd-4ae0-9213-760d43b345bc', uniqueQueries: 2, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 04:16 PM', duration: '4s',          userId: '6039ee45-7114-4d89-87f1-a99d950d0b51', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 0 },
  { date: '4/19/2026, 04:16 PM', duration: '40s',         userId: 'e1c1d338-12c7-4905-801e-d627722cbb01', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 3 },
  { date: '4/19/2026, 03:58 PM', duration: '32s',         userId: 'b39ffdf8-79c2-4a10-a330-37f1827d1fce', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 0,  topicViews: 4 },
  { date: '4/19/2026, 03:51 PM', duration: '8min 19s',    userId: '2185a448-2b59-496a-b4d1-ecd1586ec0a7', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 03:33 PM', duration: '12s',         userId: '6aab3901-b092-4e67-8edf-a4c36614769e', uniqueQueries: 1, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 03:21 PM', duration: '2min 52s',    userId: 'cb95fc71-f991-4b86-b748-b8b90e034335', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 03:14 PM', duration: '27min 8s',    userId: '4bfbfca2-d7fc-491f-9fef-d594ecdb674f', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 4,  topicViews: 8 },
  { date: '4/19/2026, 03:03 PM', duration: '42s',         userId: 'Unauthenticated',                       uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 0,  topicViews: 0 },
  { date: '4/19/2026, 02:59 PM', duration: '4min 33s',    userId: '9b5d7b2c-6c5b-45fe-a102-08e63325b6fc', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 2 },
  { date: '4/19/2026, 02:44 PM', duration: '18s',         userId: '745f3ec3-cdfc-41e2-a07d-972e8b724164', uniqueQueries: 1, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 02:36 PM', duration: '3min 5s',     userId: '159f3134-51e1-43e7-b2d9-0737749fcc6f', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 02:24 PM', duration: '1min 25s',    userId: '6039ee45-7114-4d89-87f1-a99d950d0b51', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 3 },
  { date: '4/19/2026, 02:16 PM', duration: '1min 41s',    userId: '45a191e0-5aea-4639-ad15-bad527643f14', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 4,  topicViews: 3 },
  { date: '4/19/2026, 01:35 PM', duration: '2min 10s',    userId: 'Unauthenticated',                       uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 0,  topicViews: 0 },
  { date: '4/19/2026, 01:24 PM', duration: '21s',         userId: '2185a448-2b59-496a-b4d1-ecd1586ec0a7', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 01:15 PM', duration: '9min 19s',    userId: 'd55ed4ab-6e0d-424d-9af6-0c9c52d9ad0c', uniqueQueries: 2, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 4,  topicViews: 12 },
  { date: '4/19/2026, 01:13 PM', duration: '2s',          userId: '6039ee45-7114-4d89-87f1-a99d950d0b51', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 0 },
  { date: '4/19/2026, 12:46 PM', duration: '1min 43s',    userId: '17f250cd-3700-4bf0-9ced-325bd3197cf4', uniqueQueries: 1, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 2,  topicViews: 2 },
  { date: '4/19/2026, 12:45 PM', duration: '3min 51s',    userId: '7eb50cfe-d2e8-48be-ab63-0a0bb6708b9a', uniqueQueries: 1, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 4,  topicViews: 7 },
  { date: '4/19/2026, 12:45 PM', duration: '2min 31s',    userId: 'a3a437f4-9d59-4a1c-a418-7ffd083022ca', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 4,  topicViews: 3 },
  { date: '4/19/2026, 12:44 PM', duration: '< 1s',        userId: 'Unauthenticated',                       uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 0,  topicViews: 1 },
  { date: '4/19/2026, 12:35 PM', duration: '13s',         userId: 'ba493d2c-9d84-421e-9822-ae67612f9aee', uniqueQueries: 1, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 12:35 PM', duration: '2s',          userId: 'Unauthenticated',                       uniqueQueries: 1, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 0,  topicViews: 0 },
  { date: '4/19/2026, 12:09 PM', duration: '19min 21s',   userId: 'cb4914c7-3ac6-49cd-b620-adf5e282323e', uniqueQueries: 1, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 4,  topicViews: 5 },
  { date: '4/19/2026, 11:57 AM', duration: '15min 42s',   userId: 'a3a437f4-9d59-4a1c-a418-7ffd083022ca', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 4,  topicViews: 11 },
  { date: '4/19/2026, 11:55 AM', duration: '2min 17s',    userId: '5232258d-c4f9-4d76-8a9a-8fc219c5d39f', uniqueQueries: 1, uniqueQueriesNoResults: 0, docSearches: 1, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 11:24 AM', duration: '12s',         userId: '17f250cd-3700-4bf0-9ced-325bd3197cf4', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 2 },
  { date: '4/19/2026, 11:24 AM', duration: '30s',         userId: 'a3a437f4-9d59-4a1c-a418-7ffd083022ca', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 2 },
  { date: '4/19/2026, 11:23 AM', duration: '4s',          userId: 'Unauthenticated',                       uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 0,  topicViews: 0 },
  { date: '4/19/2026, 10:39 AM', duration: '19s',         userId: 'Unauthenticated',                       uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 0,  topicViews: 0 },
  { date: '4/19/2026, 10:32 AM', duration: '6min 17s',    userId: '53525d98-ca93-47da-9004-8282bf5dde1e', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 17 },
  { date: '4/19/2026, 10:26 AM', duration: '3min 9s',     userId: '1c8f8bec-1002-41f1-8e78-7dce78d5595e', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 1,  topicViews: 1 },
  { date: '4/19/2026, 10:23 AM', duration: '15min 45s',   userId: 'd84abe9c-e102-4cc2-9cd4-b1731f339c0a', uniqueQueries: 0, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 5,  topicViews: 4 },
  { date: '4/19/2026, 10:13 AM', duration: '6min 53s',    userId: '35ef8234-0e4e-4f63-94eb-25842ea349ae', uniqueQueries: 2, uniqueQueriesNoResults: 0, docSearches: 0, docSearchesNoResults: 0, documentViews: 2,  topicViews: 5 },
];

const TOTAL_SESSIONS = 3338;
const PAGE_SIZE = 50;

const COLUMNS = [
  { key: 'date',                   label: 'Session start (UTC)' },
  { key: 'duration',               label: 'Active duration' },
  { key: 'userId',                 label: 'User ID' },
  { key: 'uniqueQueries',          label: 'Unique search queries' },
  { key: 'uniqueQueriesNoResults', label: 'Unique search queries with no results' },
  { key: 'docSearches',            label: 'Searches in doc' },
  { key: 'docSearchesNoResults',   label: 'Searches in doc with no results' },
  { key: 'documentViews',          label: 'Document views' },
  { key: 'topicViews',             label: 'Topic views' },
];

const LANGUAGE_OPTIONS = [
  { value: 'all',   label: 'All' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
];

const AUTH_OPTIONS = [
  { value: 'all',             label: 'All' },
  { value: 'authenticated',   label: 'Authenticated' },
  { value: 'unauthenticated', label: 'Unauthenticated' },
];

/* ------------------------------ Helpers ------------------------------ */

function parseDateToMs(s) {
  /* "4/19/2026, 07:29 PM" → epoch ms */
  const m = s.match(/^(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return 0;
  const [, mo, dy, yr, hh, mm, ap] = m;
  let h = parseInt(hh, 10) % 12;
  if (ap.toUpperCase() === 'PM') h += 12;
  return new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, parseInt(dy, 10), h, parseInt(mm, 10)).getTime();
}

function parseDurationToSec(s) {
  if (!s) return 0;
  if (s === '< 1s') return 0;
  let total = 0;
  const h = s.match(/(\d+)\s*h(?!\w)/);
  const m = s.match(/(\d+)\s*min/);
  const sec = s.match(/(\d+)\s*s(?![a-z])/);
  if (h) total += parseInt(h[1], 10) * 3600;
  if (m) total += parseInt(m[1], 10) * 60;
  if (sec) total += parseInt(sec[1], 10);
  return total;
}

function compareValues(a, b, key) {
  if (key === 'date') return parseDateToMs(a) - parseDateToMs(b);
  if (key === 'duration') return parseDurationToSec(a) - parseDurationToSec(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/* ------------------------------ Icons ------------------------------ */

const IconFilters = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="9" cy="6" r="2.2" fill="#fff" />
    <circle cx="15" cy="12" r="2.2" fill="#fff" />
    <circle cx="8" cy="18" r="2.2" fill="#fff" />
  </svg>
);

const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconHelp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4" />
    <circle cx="12" cy="17" r="0.8" fill="#1d4ed8" stroke="none" />
  </svg>
);

const IconSortAsc = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 15 12 9 18 15" />
  </svg>
);

const IconSortDesc = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconSortNone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" opacity="0.55">
    <polyline points="8 9 12 5 16 9" />
    <polyline points="8 15 12 19 16 15" />
  </svg>
);

const IconCaret = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function SessionListPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [showInfo, setShowInfo] = useState(false);
  const [language, setLanguage] = useState('all');
  const [authStatus, setAuthStatus] = useState('all');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return SESSIONS.filter((row) => {
      if (authStatus === 'authenticated' && row.userId === 'Unauthenticated') return false;
      if (authStatus === 'unauthenticated' && row.userId !== 'Unauthenticated') return false;
      if (userIdFilter.trim() && !row.userId.toLowerCase().includes(userIdFilter.trim().toLowerCase())) return false;
      return true;
    });
  }, [authStatus, userIdFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const cmp = compareValues(a[sortKey], b[sortKey], sortKey);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'desc');
    }
  };

  const totalPages = Math.max(1, Math.ceil(TOTAL_SESSIONS / PAGE_SIZE));
  const rangeFrom = page * PAGE_SIZE + 1;
  const rangeTo = Math.min((page + 1) * PAGE_SIZE, TOTAL_SESSIONS);

  return (
    <AnalyticsShell
      active="session-list"
      breadcrumb={{ prefix: 'Traffic', title: 'Session list' }}
      breadcrumbTrailing={
        <SessionInfoPopover open={showInfo} onToggle={() => setShowInfo((v) => !v)} onClose={() => setShowInfo(false)} />
      }
      feedbackSubject="Feedback about session list and session journey"
      toolbarExtras={
        <>
          <div style={PS.dateIndicator} title="Date range" aria-label="Date range">
            <span style={PS.dateLabels}>
              <span style={PS.dateLine}>From: 4/13/2026</span>
              <span style={PS.dateLine}>To: 4/19/2026</span>
            </span>
            <span style={PS.dateCalendar} aria-hidden="true"><IconCalendar /></span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            title={drawerOpen ? 'Hide filters' : 'Show filters'}
            aria-label={drawerOpen ? 'Hide filters' : 'Show filters'}
            aria-pressed={drawerOpen}
            style={{
              ...PS.toolbarIconBtn,
              background: drawerOpen ? '#eff6ff' : 'transparent',
              color: drawerOpen ? '#1d4ed8' : '#475569',
            }}
          >
            <IconFilters />
          </button>
        </>
      }
    >
      <div style={PS.layout}>
        <main style={{ ...PS.main, marginRight: drawerOpen ? '330px' : 0 }}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Key metrics on user sessions, session journeys, and user interactions on the portal.
            </span>
            <div style={PS.headControls}>
              <button
                type="button"
                style={{ ...PS.iconBtn, color: '#1d4ed8' }}
                title="Download as XLSX"
                aria-label="Download as XLSX"
              >
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            <div style={PS.tableCard}>
              <div style={PS.tableScroll}>
                <table style={PS.table} role="table" aria-label="Session list">
                  <thead>
                    <tr style={PS.headerRow}>
                      {COLUMNS.map((col) => {
                        const isActive = sortKey === col.key;
                        return (
                          <th
                            key={col.key}
                            style={PS.th}
                            scope="col"
                            aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          >
                            <span style={PS.thInner}>
                              <span style={PS.thLabel}>{col.label}</span>
                              <button
                                type="button"
                                style={{
                                  ...PS.sortBtn,
                                  color: isActive ? '#1d4ed8' : '#64748b',
                                }}
                                onClick={() => handleSort(col.key)}
                                aria-label={
                                  isActive
                                    ? `Sort ${col.label} in ${sortDir === 'asc' ? 'descending' : 'ascending'} order`
                                    : `Sort ${col.label} in descending order`
                                }
                                title={
                                  isActive
                                    ? `Sort in ${sortDir === 'asc' ? 'descending' : 'ascending'} order`
                                    : 'Sort in descending order'
                                }
                              >
                                {!isActive ? <IconSortNone /> : sortDir === 'asc' ? <IconSortAsc /> : <IconSortDesc />}
                              </button>
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => (
                      <tr
                        key={`${row.date}-${row.userId}-${i}`}
                        style={PS.row}
                        tabIndex={0}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                      >
                        <td style={{ ...PS.td, whiteSpace: 'nowrap' }}>{row.date.replace(', ', ', ')}</td>
                        <td style={PS.td}>{row.duration}</td>
                        <td style={{ ...PS.td, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.78rem' }}>
                          {row.userId}
                        </td>
                        <td style={PS.td}>{row.uniqueQueries}</td>
                        <td style={PS.td}>{row.uniqueQueriesNoResults}</td>
                        <td style={PS.td}>{row.docSearches}</td>
                        <td style={PS.td}>{row.docSearchesNoResults}</td>
                        <td style={PS.td}>{row.documentViews}</td>
                        <td style={PS.td}>{row.topicViews}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={PS.pager}>
                <div style={PS.pagerRange} aria-live="polite">
                  {rangeFrom} – {rangeTo} of {TOTAL_SESSIONS.toLocaleString('en-US')}
                </div>
                <div style={PS.pagerActions}>
                  <PagerBtn label="First page" disabled={page === 0} onClick={() => setPage(0)}>
                    <PagerArrowFirst />
                  </PagerBtn>
                  <PagerBtn label="Previous page" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    <PagerArrowPrev />
                  </PagerBtn>
                  <PagerBtn label="Next page" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                    <PagerArrowNext />
                  </PagerBtn>
                  <PagerBtn label="Last page" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
                    <PagerArrowLast />
                  </PagerBtn>
                </div>
              </div>
            </div>
          </section>
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Filter sessions">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter sessions</h3>
              <button
                type="button"
                style={PS.drawerCloseBtn}
                onClick={() => setDrawerOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <IconClose />
              </button>
            </header>

            <div style={PS.drawerBody}>
              <FieldSelect
                label="Interface language"
                value={language}
                onChange={setLanguage}
                options={LANGUAGE_OPTIONS}
              />
              <FieldSelect
                label="Authentication status"
                value={authStatus}
                onChange={setAuthStatus}
                options={AUTH_OPTIONS}
              />
              <FieldText
                label="User ID"
                value={userIdFilter}
                onChange={setUserIdFilter}
              />
            </div>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ Popover ------------------------------ */

function SessionInfoPopover({ open, onToggle, onClose }) {
  const ref = useRef(null);
  return (
    <span style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        title="What is a session?"
        aria-label="What is a session?"
        aria-expanded={open}
        style={PS.infoBtn}
      >
        <IconHelp />
      </button>
      {open && (
        <>
          <span
            onClick={onClose}
            aria-hidden="true"
            style={{ position: 'fixed', inset: 0, zIndex: 19 }}
          />
          <div role="tooltip" style={PS.popover}>
            A session is a sequence of events carried out by a single user, which stops after 30 minutes of inactivity or when the user logs out.
            <br />
            <br />
            Click on a line to display the session journey.
          </div>
        </>
      )}
    </span>
  );
}

/* ------------------------------ Form fields ------------------------------ */

function FieldSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div style={FS.field}>
      <label style={FS.label}>{label}</label>
      <button
        type="button"
        style={FS.selectBtn}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current.label}</span>
        <IconCaret open={open} />
      </button>
      {open && (
        <>
          <span
            onClick={() => setOpen(false)}
            aria-hidden="true"
            style={{ position: 'fixed', inset: 0, zIndex: 19 }}
          />
          <ul role="listbox" style={FS.menu}>
            {options.map((opt) => {
              const isSel = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    style={{
                      ...FS.option,
                      background: isSel ? '#eff6ff' : 'transparent',
                      color: isSel ? '#1d4ed8' : '#1f2937',
                      fontWeight: isSel ? 600 : 500,
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function FieldText({ label, value, onChange }) {
  return (
    <div style={FS.field}>
      <label style={FS.label}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={FS.input}
        aria-label={label}
      />
    </div>
  );
}

/* ------------------------------ Pager ------------------------------ */

function PagerBtn({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        ...PS.pagerBtn,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

const PagerArrowFirst = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z" />
  </svg>
);
const PagerArrowPrev = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
  </svg>
);
const PagerArrowNext = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
  </svg>
);
const PagerArrowLast = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z" />
  </svg>
);

/* ------------------------------ Styles ------------------------------ */

const PS = {
  layout: {
    position: 'relative',
    display: 'flex',
    minHeight: 'calc(100vh - 60px - 56px)',
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    transition: 'margin-right 200ms ease',
  },
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569', flex: 1 },
  headControls: { display: 'inline-flex', alignItems: 'center', gap: '12px' },
  iconBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
  },
  toolbarIconBtn: {
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  infoBtn: {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    borderRadius: '50%',
    cursor: 'pointer',
    padding: 0,
  },
  popover: {
    position: 'absolute',
    top: '34px',
    left: '-12px',
    zIndex: 20,
    width: '320px',
    padding: '12px 14px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    fontSize: '0.82rem',
    lineHeight: 1.5,
    color: '#0f172a',
    fontWeight: 400,
    whiteSpace: 'normal',
  },
  dateIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
  },
  dateLabels: { display: 'flex', flexDirection: 'column', lineHeight: 1.15 },
  dateLine: { fontSize: '0.7rem', color: '#475569', fontWeight: 500 },
  dateCalendar: { display: 'inline-flex', color: '#1d4ed8' },

  body: { padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: '16px' },
  tableCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  tableScroll: { overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
  },
  headerRow: {
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    fontWeight: 600,
    color: '#0f172a',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #e5e7eb',
  },
  thInner: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  thLabel: { fontWeight: 600 },
  sortBtn: {
    width: '22px',
    height: '22px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: 0,
  },
  row: {
    background: '#ffffff',
    borderBottom: '1px solid #f1f5f9',
    cursor: 'pointer',
    transition: 'background 120ms ease',
  },
  td: {
    padding: '9px 14px',
    color: '#1f2937',
    fontSize: '0.78rem',
    verticalAlign: 'middle',
  },

  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '10px 18px',
    borderTop: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  pagerRange: {
    fontSize: '0.78rem',
    color: '#475569',
  },
  pagerActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  pagerBtn: {
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    borderRadius: '50%',
  },

  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '330px',
    background: '#ffffff',
    borderLeft: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-2px 0 8px rgba(15, 23, 42, 0.04)',
    zIndex: 5,
  },
  drawerHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #e5e7eb',
  },
  drawerTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' },
  drawerCloseBtn: {
    width: '30px',
    height: '30px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
};

const FS = {
  field: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' },
  label: {
    fontSize: '0.72rem',
    color: '#475569',
    fontWeight: 500,
    paddingLeft: '2px',
  },
  selectBtn: {
    width: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '9px 12px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.85rem',
    color: '#0f172a',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    margin: 0,
    padding: '4px 0',
    listStyle: 'none',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    zIndex: 20,
    maxHeight: '240px',
    overflowY: 'auto',
  },
  option: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    fontSize: '0.84rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.85rem',
    color: '#0f172a',
    fontFamily: 'inherit',
  },
};
