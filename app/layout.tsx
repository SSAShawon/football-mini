import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'KICKTACTIC — Every Move Matters', description: 'A tactical tabletop football duel. Set your angle, pull back, and let the pitch decide.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
