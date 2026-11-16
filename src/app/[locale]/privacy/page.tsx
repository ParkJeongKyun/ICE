import type { Metadata } from 'next';
import PrivacyLayout from '@/layouts/PrivacyLayout/PrivacyLayout';
import { type Locale } from '@/locales/routing';
import { SITE_URL, pageUrl } from '@/constants/site';

type Props = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await props.params;
  const isKo = locale === 'ko';

  const title = isKo ? '개인정보 처리방침' : 'Privacy Policy';

  const description = isKo
    ? 'ICE Forensic의 개인정보 처리방침. 클라이언트 기반 처리로 파일 데이터는 서버로 전송되지 않습니다.'
    : 'ICE Forensic Privacy Policy. Client-side processing ensures your files are never uploaded to our servers.';

  return {
    title: title,
    description: description,
    keywords: isKo
      ? ['개인정보 처리방침', '프라이버시', '데이터 보호', 'ICE Forensic']
      : ['Privacy Policy', 'Privacy', 'Data Protection', 'ICE Forensic'],
    alternates: {
      canonical: pageUrl(locale, 'privacy'),
      languages: {
        en: pageUrl('en', 'privacy'),
        ko: pageUrl('ko', 'privacy'),
        // sitemap과 동일: 하위 페이지의 기본 언어 페이지는 영어
        'x-default': pageUrl('en', 'privacy'),
      },
    },
    openGraph: {
      title: title,
      description: description,
      url: pageUrl(locale, 'privacy'),
      locale: isKo ? 'ko_KR' : 'en_US',
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/pullLogo.png`,
          width: 1000,
          height: 400,
          alt: 'ICE Forensic',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [`${SITE_URL}/pullLogo.png`],
    },
  };
}

export default async function PrivacyPage() {
  return <PrivacyLayout />;
}
