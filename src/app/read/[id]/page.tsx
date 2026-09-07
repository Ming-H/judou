import { notFound } from 'next/navigation';
import PdfViewer from '@/components/PdfViewer';
import { getStore } from '@/core/store';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const entry = await getStore().get(params.id);
  return { title: entry?.title ?? '阅读' };
}

export default async function ReadPage({ params }: { params: { id: string } }) {
  const entry = await getStore().get(params.id);
  if (!entry) notFound();
  return <PdfViewer doc={entry} />;
}
