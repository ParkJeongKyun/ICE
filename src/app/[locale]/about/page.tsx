import type { Metadata } from 'next';
import AboutLayout from '@/layouts/AboutLayout/AboutLayout';
import { type Locale } from '@/locales/routing';
import { SITE_URL, pageUrl } from '@/constants/site';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === 'ko';

  const title = isKo ? '개발자 소개' : 'About Developer';

  const description = isKo
    ? '박정균 개발자 소개. 디지털 포렌식, 정보보안, 침해사고대응 전문가.'
    : 'Park Jeong Kyun - Digital Forensics, Information Security, and Incident Response Expert.';

  return {
    title: title,
    description: description,
    keywords: isKo
      ? ['개발자 소개', '박정균', '디지털 포렌식', '정보보안', '포렌식 전문가']
      : [
          'About Developer',
          'Park Jeong Kyun',
          'Digital Forensics',
          'Information Security',
        ],
    alternates: {
      canonical: pageUrl(locale, 'about'),
      languages: {
        en: pageUrl('en', 'about'),
        ko: pageUrl('ko', 'about'),
        // sitemap과 동일: 하위 페이지의 기본 언어 페이지는 영어
        'x-default': pageUrl('en', 'about'),
      },
    },
    openGraph: {
      title: title,
      description: description,
      url: pageUrl(locale, 'about'),
      locale: isKo ? 'ko_KR' : 'en_US',
      type: 'profile',
      images: [
        {
          url: `${SITE_URL}/pullLogo.png`,
          width: 1000,
          height: 400,
          alt: 'ICE Forensic - Developer Profile',
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

export default function AboutPage() {
  return <AboutLayout />;
}
