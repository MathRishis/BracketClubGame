import type { Metadata } from 'next';
import Home from '@/components/home';
import { database } from '@/db';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const { b } = await searchParams;
  let title = 'Bracket Club — Let the group decide',
    description =
      'Create a bracket, invite your friends, and vote your way to one winner.';
  if (b) {
    const row = await database()
      .prepare('SELECT title,description FROM brackets WHERE id=?')
      .bind(b)
      .first<{ title: string; description: string }>();
    if (row) {
      title = row.title + ' — Bracket Club';
      description =
        row.description || 'Join this bracket and vote for your favorite.';
    }
  }
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}
export default function Page() {
  return <Home />;
}
