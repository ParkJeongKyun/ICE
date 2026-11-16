import type { Metadata } from 'next';
import DocsLayout from '@/layouts/DocsLayout/DocsLayout';
import { getMarkdownData } from '@/utils/getMarkdown';
import { type Locale } from '@/locales/routing';
import { SITE_URL, pageUrl } from '@/constants/site';

type Props = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await props.params;
  const isKo = locale === 'ko';

  const title = isKo ? '문서' : 'Docs';
  const description = isKo
    ? 'ICE Forensic 사용 가이드 및 참고 자료'
    : 'ICE Forensic — preview, FAQ and use-cases.';

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl(locale, 'docs'),
      languages: {
        en: pageUrl('en', 'docs'),
        ko: pageUrl('ko', 'docs'),
        // sitemap과 동일: 하위 페이지의 기본 언어 페이지는 영어
        'x-default': pageUrl('en', 'docs'),
      },
    },
    openGraph: {
      title,
      description,
      url: pageUrl(locale, 'docs'),
      locale: isKo ? 'ko_KR' : 'en_US',
      type: 'website',
    },
  };
}

export default async function DocsPage(props: Props) {
  const params = await props.params;
  const locale = params.locale;

  const markdownData = getMarkdownData(locale, ['about']);

  return <DocsLayout markdownData={markdownData} />;
}
