import type { Metadata } from 'next';
import MainLayout from '@/layouts/MainLayout/MainLayout';
import DropzoneWrapper from '@/components/DropzoneWrapper/DropzoneWrapper';
import Modal from '@/components/common/Modal/Modal';
import { type Locale } from '@/locales/routing';
import { getMarkdownData } from '@/utils/getMarkdown';
import { SITE_URL, pageUrl } from '@/constants/site';

type Props = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await props.params;
  const isKo = locale === 'ko';

  const title = isKo
    ? '온라인 헥스 뷰어 & 온라인 EXIF 뷰어'
    : 'Online Hex Viewer & Online EXIF Viewer';

  const description = isKo
    ? '설치 없이 웹에서 바로 사용하는 디지털 포렌식 도구. 헥스 뷰어, 파일 헤더 분석, 이미지 EXIF 메타데이터 분석을 지원합니다.'
    : 'Web-based digital forensics tool without installation. Supports Hex Viewer, File Header Analysis, and Image EXIF Metadata Analysis.';

  const keywords = isKo
    ? [
        '헥스 뷰어',
        '디지털 포렌식',
        'EXIF 분석기',
        '무설치 헥스 에디터',
        '파일 분석',
      ]
    : [
        'Hex Viewer',
        'Digital Forensics',
        'EXIF Viewer',
        'Online Hex Editor',
        'File Analysis',
      ];

  return {
    title: title,
    description: description,
    keywords: keywords,
    alternates: {
      canonical: pageUrl(locale),
      languages: {
        en: pageUrl('en'),
        ko: pageUrl('ko'),
        // sitemap과 동일: 메인 페이지의 기본 언어 페이지는 루트(언어 선택)
        'x-default': pageUrl(),
      },
    },
    openGraph: {
      title: title,
      description: description,
      url: pageUrl(locale),
      locale: isKo ? 'ko_KR' : 'en_US',
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/pullLogo.png`,
          width: 1000,
          height: 400,
          alt: 'ICE Forensic Logo',
        },
      ],
    },
  };
}

export default async function HomePage(props: Props) {
  const params = await props.params;
  const locale = params.locale;

  const markdownData = getMarkdownData(locale, ['about']);

  return (
    <>
      <DropzoneWrapper>
        <MainLayout />
        <Modal markdownData={markdownData} />
      </DropzoneWrapper>
    </>
  );
}
