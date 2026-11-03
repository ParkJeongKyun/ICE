import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN;

export default function GoogleScripts() {
  if (process.env.NODE_ENV === 'development' || !GA_ID || !DOMAIN) return null;

  // 배포 도메인에서 접속했을 때만 수집 (로컬 서버, E2E 테스트 접속이 방문자로 집계되지 않도록)
  const hostname = JSON.stringify(new URL(DOMAIN).hostname);
  const gaId = JSON.stringify(GA_ID);

  return (
    <Script id="google-analytics" strategy="afterInteractive">
      {`
        if (location.hostname === ${hostname}) {
          var gaScript = document.createElement('script');
          gaScript.async = true;
          gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + ${gaId};
          document.head.appendChild(gaScript);

          window.dataLayer = window.dataLayer || [];
          window.gtag = function gtag(){dataLayer.push(arguments);};
          gtag('js', new Date());

          gtag('config', ${gaId}, {
            page_path: window.location.pathname,
            cookie_flags: 'SameSite=None;Secure',
            allow_ad_personalization_signals: false,
            anonymize_ip: true
          });
        }
      `}
    </Script>
  );
}
