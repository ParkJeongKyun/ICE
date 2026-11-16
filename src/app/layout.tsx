import type { Metadata } from 'next';
import GlobalProviders from './GlobalProviders';
import { SITE_URL } from '@/constants/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  // title template defined once at app root — pages provide plain titles
  title: {
    template: '%s | ICE Forensic',
    default: 'ICE Forensic',
  },

  // invariant global metadata
  authors: [
    {
      name: 'Park Jeong Kyun',
      url: SITE_URL,
    },
  ],
  creator: 'Park Jeong Kyun',
  robots: { index: true, follow: true },
  referrer: 'strict-origin-when-cross-origin',
  icons: { icon: `${SITE_URL}/favicon.ico` },

  // common OpenGraph assets only (page-specific title/description are set per-page)
  openGraph: {
    type: 'website',
    siteName: 'ICE Forensic',
    images: [
      {
        url: `${SITE_URL}/pullLogo.png`,
        width: 1000,
        height: 400,
        alt: 'ICE Forensic Logo',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    images: [`${SITE_URL}/pullLogo.png`],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GlobalProviders>{children}</GlobalProviders>;
}
