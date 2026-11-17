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

devel 브랜치에서 실행합니다.

```bash
npm run release
```

[`scripts/release.sh`](scripts/release.sh)가 다음을 순서대로 진행합니다.

1. 커밋하지 않은 변경, 원격에만 있는 커밋이 없는지 확인
2. 단위 테스트 실행
3. devel → main 병합 후 푸시
4. 오늘 날짜 태그(`v2026.11.18`)를 만들어 푸시

`v`로 시작하는 태그가 푸시되면 GitHub Actions([deploy.yml](.github/workflows/deploy.yml))가
테스트 → 빌드 → GitHub Pages 배포를 진행합니다.

- **버전**: 화면에 표시되는 버전은 태그 이름입니다. `.env`의 `NEXT_PUBLIC_APP_VERSION`은 로컬 실행용(`dev`)이라 바꿀 필요가 없습니다.
- **같은 날 다시 배포**: 태그에 번호가 붙습니다 (`v2026.11.18-2`, `v2026.11.18-3` ...).
- **배포만 실패한 경우**: 새 태그를 만들지 말고 실패한 실행을 다시 돌립니다.

  ```bash
  gh run rerun --failed $(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')
  ```

- 진행 상황은 `gh run watch` 또는 [Actions](https://github.com/ParkJeongKyun/ICE/actions)에서 확인합니다.

## Security

취약점은 공개 이슈가 아니라 [보안 정책](.github/SECURITY.md)에 따라 비공개로 제보해 주세요.
