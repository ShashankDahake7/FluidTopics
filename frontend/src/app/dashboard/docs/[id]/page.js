'use client';
import { useParams } from 'next/navigation';
import DocumentReader from '@/components/portal/DocumentReader';

// Thin wrapper around the shared <DocumentReader/> so that
// /dashboard/docs/<id> and /r/<...path> use the exact same reader UI.
// The actual TOC, floating actions, search, share dialog, and rating
// block all live in the component.
export default function DocReaderPage() {
  const { id } = useParams();
  return <DocumentReader documentId={id} allDocsHref="/dashboard" />;
}
