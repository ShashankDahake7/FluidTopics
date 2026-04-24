'use client';

import { useParams } from 'next/navigation';
import DesignerEditor from '@/components/designer/DesignerEditor';

export default function DesignerEditorPage() {
  const params = useParams();
  return <DesignerEditor pageId={params.id} />;
}
