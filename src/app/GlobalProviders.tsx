'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { HexViewerCacheProvider } from '@/contexts/HexViewerCacheContext/HexViewerCacheContext';
import { ProcessProvider } from '@/contexts/ProcessContext/ProcessContext';
import { RefProvider } from '@/contexts/RefContext/RefContext';
import { TabDataProvider } from '@/contexts/TabDataContext/TabDataContext';
import { WorkerProvider } from '@/contexts/WorkerContext/WorkerContext';
import { ConfigProvider } from '@/contexts/ConfigContext/ConfigContext';
import StyledComponentsRegistry from '@/app/[locale]/StyledComponentsRegistry';
import { routing } from '@/locales/routing';

// WASM/Worker가 필요한 페이지: 메인 페이지(/ko, /en)와 언어 선택 페이지(/, 엔진 미리 받기)
// 그 외 페이지(소개, 문서, 링크 노트, 개인정보, 404)는 엔진을 받지 않음
const ENGINE_PATHS = ['/', ...routing.locales.map((locale) => `/${locale}`)];

export default function GlobalProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLightPage = !ENGINE_PATHS.includes(pathname);

  if (isLightPage) {
    return (
      <ConfigProvider>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider>
      <ProcessProvider>
        <WorkerProvider>
          <TabDataProvider>
            <RefProvider>
              <HexViewerCacheProvider>
                <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
              </HexViewerCacheProvider>
            </RefProvider>
          </TabDataProvider>
        </WorkerProvider>
      </ProcessProvider>
    </ConfigProvider>
  );
}
