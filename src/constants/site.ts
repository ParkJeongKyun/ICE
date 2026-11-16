/** 사이트 주소 (끝에 / 없음) */
export const SITE_URL =
  process.env.NEXT_PUBLIC_DOMAIN || 'https://www.ice-forensic.com';

/**
 * 페이지의 절대 주소 (끝에 / 없음)
 * 정적 배포 시 /ko/about.html 로 생성되고 GitHub Pages가 /ko/about 으로 제공
 * (canonical, hreflang, sitemap 주소가 실제 주소와 어긋나면 검색엔진이 다른 페이지로 인식)
 *
 * pageUrl() → https://www.ice-forensic.com
 * pageUrl('ko', 'about') → https://www.ice-forensic.com/ko/about
 */
export const pageUrl = (...segments: string[]) =>
  [SITE_URL, ...segments.filter(Boolean)].join('/');
