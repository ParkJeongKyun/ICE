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

## How to Deploy

`v`로 시작하는 태그를 푸시하면 GitHub Actions가 테스트 → 빌드 → GitHub Pages 배포를 진행합니다.

```bash
git checkout main
git merge origin/devel
git push origin main

git tag v2026.11.04
git push origin v2026.11.04
```

같은 버전을 다시 배포하려면 Actions에서 해당 실행을 Re-run 하거나, 태그를 옮겨 다시 푸시합니다.

```bash
git tag -f v2026.11.04
git push origin v2026.11.04 --force
```
