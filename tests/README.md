# 테스트

| 종류                 | 도구                    | 위치                       | 실행                              |
| -------------------- | ----------------------- | -------------------------- | --------------------------------- |
| 단위 / 컴포넌트      | Vitest, Testing Library | `tests/unit`               | `npm test` (`npm run test:watch`) |
| E2E                  | Playwright              | `tests/e2e/*.spec.ts`      | `npm run test:e2e`                |
| 화면 (스크린샷 비교) | Playwright              | `tests/e2e/visual.spec.ts` | `npm run test:visual`             |

## 단위 테스트 (`tests/unit`)

브라우저 없이 Node에서 빠르게 실행됩니다. DOM이 필요한 컴포넌트 테스트는 파일 첫 줄에
`// @vitest-environment jsdom`을 적습니다.

- `locales.test.ts`: ko/en 번역 구조 일치, 코드에서 쓰는 번역 키·토스트 코드가 실제로 있는지 검사
  (키가 없으면 next-intl `INSUFFICIENT_PATH` 오류나 화면에 키 이름이 그대로 노출됨)
- `WorkerManager.test.ts`: 처리 중 상태, 타임아웃, 취소 (가짜 워커 사용)
- `wasmLoader.test.ts`: WASM 캐시 사용·복구·구버전 정리 (가짜 Cache API 사용)
- `config.test.ts`: 저장된 설정 복원, 잘못된 값 보정, 구버전 설정 이관
- `dataInspector.test.ts`, `encoding.test.ts`: 데이터 검사 패널의 값 변환(FILETIME, DOS 날짜, GUID, LEB128 등)과
  헥스 뷰어 글자 인코딩. 시간 값은 `TZ=UTC`로 고정해 비교
- `noteCompress.test.ts`: 링크 노트 공유 URL 압축/복원, 예전에 공유된 링크 호환성

## E2E 테스트 (`tests/e2e`)

정적 빌드를 `.next-e2e`에 만들고 띄운 뒤 실제 Chromium으로 실행합니다.
(`npm run dev`의 `.next`와 겹치지 않으므로 개발 서버를 켜둔 채 실행 가능)

- `analysis.spec.ts`: 파일 분석(EXIF, PNG 텍스트), 엔진 로딩/캐시, 페이지 이탈 확인
- `hexViewer.spec.ts`: 가상 스크롤 (오프셋 이동, 휠, 스크롤바 드래그, 64MB 파일), 탭 전환 시 스크롤·선택 위치 복원
- `tools.spec.ts`: 검색(Hex/ASCII), 해시 계산 (Node에서 계산한 값과 비교)
- `pages.spec.ts`: 주요 페이지가 콘솔 오류 없이 열리는지
- 브라우저를 띄워 진행 과정 보기: `npx playwright test hexViewer --headed`

- 이미 떠 있는 서버로 실행: `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`
- 실패 시 `npx playwright show-report`로 스크린샷과 trace 확인
- 샘플 파일(`tests/fixtures/sample.*`)은 `node tests/fixtures/generate.mjs`로 다시 만들 수 있음
  (파일에 넣는 값은 `tests/fixtures/values.json` 하나에서 관리하고 테스트도 같은 값을 사용)

## 화면 테스트

기준 이미지(`tests/e2e/visual.spec.ts-snapshots`)와 픽셀 단위로 비교합니다.
폰트 렌더링이 OS마다 달라 기준 이미지는 OS별로 저장되며(`*-darwin.png`), CI에서는 실행하지 않습니다.

디자인을 의도적으로 바꿨다면 기준 이미지를 갱신하고 함께 커밋합니다.

```bash
npm run test:visual:update
```

## CI

`.github/workflows/test.yml`에서 PR과 master/devel 푸시마다 타입 체크, 단위 테스트, E2E를 실행합니다.
배포(`deploy.yml`)는 단위 테스트가 통과해야 진행됩니다.
