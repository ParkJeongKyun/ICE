#!/usr/bin/env bash
# 운영 배포: devel을 main에 병합하고 오늘 날짜 태그(v2026.11.18)를 푸시
# 태그가 푸시되면 GitHub Actions(deploy.yml)가 테스트, 빌드 후 GitHub Pages에 배포하고
# 화면에 표시되는 버전도 이 태그 이름이 됨
#
# 같은 날 다시 배포하면 오늘 태그를 새 커밋으로 옮겨 다시 배포 (버전 이름은 항상 날짜 하나)
# 배포만 실패했다면 새 태그를 만들지 말고 실패한 Actions 실행을 다시 돌리면 됨 (gh run rerun)
#
# 릴리즈 노트: 배포 전에 RELEASE_NOTES.md에 이번 변경 사항을 적고 커밋
# 배포가 끝나면 Actions가 그 내용으로 GitHub Release를 만듦
set -euo pipefail

branch=$(git branch --show-current)
if [ "$branch" != "devel" ]; then
  echo "devel 브랜치에서 실행하세요 (현재: $branch)"
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "커밋하지 않은 변경이 있습니다. 먼저 커밋하세요."
  exit 1
fi

# 다른 곳에서 만들거나 옮긴 태그(같은 날 이전 배포 등)까지 알 수 있도록 원격 정보를 먼저 받음
git fetch origin --tags --force

if [ "$(git rev-parse devel)" != "$(git rev-parse origin/devel)" ] &&
  ! git merge-base --is-ancestor origin/devel devel; then
  echo "원격 devel에 로컬에 없는 커밋이 있습니다. 먼저 git pull 하세요."
  exit 1
fi

# 지난 배포 이후 바뀐 것이 없으면 확인 (같은 내용을 다시 배포하는 경우)
last=$(git tag --list 'v*' --sort=-creatordate | head -1)
if [ -n "$last" ] && git merge-base --is-ancestor devel "$last"; then
  echo "지난 배포($last) 이후 새 커밋이 없습니다."
  echo "배포가 실패해서 다시 돌리려면: gh run rerun --failed \$(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
  read -r -p "그래도 새 태그로 다시 배포할까요? [y/N] " answer
  [ "$answer" = "y" ] || { echo "취소했습니다."; exit 0; }
fi

# 릴리즈 노트 확인 (GitHub Release 본문이 됨)
if [ ! -s RELEASE_NOTES.md ]; then
  echo "RELEASE_NOTES.md에 이번 배포 내용을 적고 커밋하세요."
  exit 1
fi
if [ -n "$last" ] && git cat-file -e "$last:RELEASE_NOTES.md" 2>/dev/null &&
  git diff --quiet "$last" devel -- RELEASE_NOTES.md; then
  echo "RELEASE_NOTES.md가 지난 배포($last)와 같습니다."
  read -r -p "같은 릴리즈 노트로 배포할까요? [y/N] " answer
  [ "$answer" = "y" ] || { echo "취소했습니다."; exit 0; }
fi

# 오늘 날짜 태그 (오늘 이미 배포했으면 그 태그를 옮김)
tag="v$(date +%Y.%m.%d)"
old=$(git rev-parse -q --verify "refs/tags/$tag^{commit}" || true)

echo "배포 전에 단위 테스트를 실행합니다."
npm test --silent

echo
echo "devel → main 병합 후 $tag 태그로 배포합니다."
[ -n "$old" ] && echo "오늘 이미 ${tag}로 배포했습니다. 태그를 새 커밋으로 옮겨 다시 배포합니다."
[ -n "$last" ] && echo "지난 배포: $last"
read -r -p "계속할까요? [y/N] " answer
[ "$answer" = "y" ] || { echo "취소했습니다."; exit 0; }

# 중간에 실패해도 devel 브랜치로 돌아옴
trap 'git checkout -q devel' EXIT

git push origin devel
git checkout -q main
git pull --ff-only origin main
if ! git merge --no-edit devel; then
  git merge --abort
  echo "main에 병합하다 충돌이 났습니다. 직접 해결한 뒤 다시 실행하세요."
  exit 1
fi
git push origin main

git tag -f "$tag" >/dev/null
if ! git push -f origin "$tag"; then
  # 푸시하지 못한 태그가 원격과 다르게 남지 않도록 되돌림
  if [ -n "$old" ]; then
    git tag -f "$tag" "$old" >/dev/null
  else
    git tag -d "$tag" >/dev/null
  fi
  echo "태그를 푸시하지 못했습니다. 다시 실행하세요."
  exit 1
fi

echo
echo "배포를 시작했습니다 ($tag)."
echo "진행 상황: https://github.com/ParkJeongKyun/ICE/actions"
echo "배포가 끝나면 릴리즈: https://github.com/ParkJeongKyun/ICE/releases/tag/$tag"
echo "터미널에서 보기: gh run watch"
