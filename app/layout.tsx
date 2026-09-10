import type { Metadata, Viewport } from 'next';
import './globals.css';
import './flow.css';
import './atmosphere.css';
import './bracelet.css';
import './motion.css';
export const metadata: Metadata = {
  title: '星间来信 · A Signal Between Stars',
  description: '一束穿过星海的信号，正在寻找某个人。七段旅程，一次相遇。',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090d16',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
