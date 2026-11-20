# ICE - Forensic Web Application Repository

A web application for forensic analysis, including hex viewers and image EXIF metadata analysis.

## Official Website

Visit the official website for more details:  
[www.ice-forensic.com](https://www.ice-forensic.com)

© 2022 Park Jeong-Kyun (dbzoseh84@gmail.com). All rights reserved.

## [Developer](https://www.ice-forensic.com/en/about)

---

## How to Run

```bash
npm install
npm run dev
```

## How to Build

```bash
npm run build   # 정적 파일이 out/ 에 생성됨
npm start       # out/ 을 로컬에서 확인
```

## How to Test

```bash
npm test            # 단위 테스트
npm run test:e2e    # E2E 테스트 (정적 빌드 후 실제 브라우저로 실행)
npm run test:visual # 화면 비교 테스트 (로컬 전용)
```

자세한 내용은 [tests/README.md](tests/README.md)를 참고하세요.

## How to Deploy

배포 전에 [`RELEASE_NOTES.md`](RELEASE_NOTES.md)에 이번 변경 사항을 적고 커밋한 뒤, devel 브랜치에서 실행합니다.
(영어를 먼저 쓰고, 한국어는 `<details><summary>한국어</summary>` 안에 접어 둡니다)

```bash
npm run release
```

[`scripts/release.sh`](scripts/release.sh)가 다음을 순서대로 진행합니다.

1. 커밋하지 않은 변경, 원격에만 있는 커밋이 없는지 확인
2. 릴리즈 노트가 지난 배포와 같으면 확인
3. 단위 테스트 실행
4. devel → main 병합 후 푸시
5. 오늘 날짜 태그(`v2026.11.18`)를 만들어 푸시

`v`로 시작하는 태그가 푸시되면 GitHub Actions([deploy.yml](.github/workflows/deploy.yml))가
테스트 → 빌드 → GitHub Pages 배포를 진행하고, 이어서 `RELEASE_NOTES.md` 내용으로
[GitHub Release](https://github.com/ParkJeongKyun/ICE/releases)를 만듭니다.

- **버전**: 화면에 표시되는 버전은 태그 이름입니다. `.env`의 `NEXT_PUBLIC_APP_VERSION`은 로컬 실행용(`dev`)이라 바꿀 필요가 없습니다.
- **같은 날 다시 배포**: 오늘 태그(`v2026.11.18`)를 새 커밋으로 옮겨 다시 배포합니다. 버전 이름은 항상 날짜 하나이고, 같은 Release의 내용이 갱신됩니다.
- **릴리즈 노트**: v2026.03.18까지의 기록은 [위키](https://github.com/ParkJeongKyun/ICE/wiki/ko_release)에 있습니다.
- **배포만 실패한 경우**: 새 태그를 만들지 말고 실패한 실행을 다시 돌립니다.

  ```bash
  gh run rerun --failed $(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')
  ```

- 진행 상황은 `gh run watch` 또는 [Actions](https://github.com/ParkJeongKyun/ICE/actions)에서 확인합니다.

## AI Agent Tools (WebMCP, 실험 기능)

메인 화면은 [WebMCP](https://developer.chrome.com/docs/ai/webmcp)로 브라우저 AI 에이전트용 분석 도구를 등록합니다
([`src/components/WebMcpTools`](src/components/WebMcpTools/WebMcpTools.tsx)).
WebMCP를 지원하는 브라우저에서만 동작하고, 화면 이동(`ice_show_offset`) 외에는 모두 읽기 전용입니다.

- **Origin trial 토큰**: `.env`의 `NEXT_PUBLIC_WEBMCP_TOKEN` (`www.ice-forensic.com` 전용, 2027-03-30까지). 갱신하면 이 값만 바꾸고, 정식 기능이 되면 비웁니다.
- **로컬 확인**: 토큰은 운영 도메인 전용이라 `chrome://flags/#enable-webmcp-testing`을 켜거나 Chrome을 `--enable-features=WebMCP`로 실행
- **Claude Code로 사용** (운영 사이트는 토큰으로 켜지므로 플래그 불필요, `-s user`라 어느 폴더에서나 사용):

  ```bash
  claude mcp add -s user chrome-devtools -- npx chrome-devtools-mcp@latest --categoryExperimentalWebmcp
  # 로컬(localhost)에서 쓸 때는 끝에 --chromeArg=--enable-features=WebMCP 추가
  ```

- **테스트**: `tests/e2e/webmcp.spec.ts` (에이전트처럼 도구를 직접 호출), `tests/unit/webMcp.test.ts`

## Security

취약점은 공개 이슈가 아니라 [보안 정책](.github/SECURITY.md)에 따라 비공개로 제보해 주세요.
