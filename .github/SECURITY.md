# 보안 정책 (Security Policy)

## 지원 버전 (Supported Versions)

ICE Forensic은 [www.ice-forensic.com](https://www.ice-forensic.com)에 배포된 **최신 버전만** 지원합니다.
이전 버전에 대한 보안 수정은 따로 제공하지 않으며, 수정 사항은 다음 배포에 반영됩니다.

Only the **latest version** deployed at [www.ice-forensic.com](https://www.ice-forensic.com) is supported.
Fixes are shipped in the next release; older versions are not patched separately.

## 취약점 제보 (Reporting a Vulnerability)

**공개 이슈로 올리지 말고** 아래 방법으로 비공개 제보해 주세요.

**Please do not open a public issue.** Report privately instead:

- GitHub **[Security → Report a vulnerability](https://github.com/ParkJeongKyun/ICE/security/advisories/new)** (비공개 제보, 권장)

제보에 포함해 주시면 좋은 내용 (Please include):

- 영향을 받는 페이지나 기능 (affected page or feature)
- 재현 방법과 사용한 파일 (steps to reproduce and sample file, if any)
- 예상되는 영향 (expected impact)

확인하는 대로 답변드리며, 수정이 배포된 뒤 제보자 동의를 받아 공개합니다.
We will respond as soon as possible and disclose the issue, with your consent, after a fix is released.

## 범위 (Scope)

ICE Forensic은 서버 없이 브라우저 안에서 파일을 분석하며, 파일은 서버로 전송되지 않습니다.
아래와 같은 문제를 특히 환영합니다.

ICE Forensic analyzes files entirely in the browser; files are never uploaded. We are especially interested in:

- 조작된 파일로 스크립트를 실행시키는 문제 (XSS via crafted files)
- 파일 내용이 외부로 전송되는 문제 (file data leaking to third parties)
- 콘텐츠 보안 정책(CSP) 우회 (Content Security Policy bypass)
- 링크 노트(LinkNote) URL 공유 기능의 데이터 노출 (data exposure through LinkNote URLs)

범위 밖 (Out of scope): 서비스 거부를 위한 대량 요청, 사회공학, 사용자 기기가 이미 감염된 경우
(volumetric DoS, social engineering, already-compromised devices).
