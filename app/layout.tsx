import type { Metadata, Viewport } from 'next';
import './globals.css';
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export const metadata: Metadata = { title: 'Bracket Club — Let the group decide', description: 'Create a bracket, invite your friends, and vote your way to one winner.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({children}: {children: React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}

