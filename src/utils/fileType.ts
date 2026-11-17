/**
 * Windows 실행 파일(PE)인지 판별 (분석 워커와 AI 에이전트 도구가 같은 기준을 씀)
 * core 엔진(h2non/filetype)은 PE를 application/vnd.microsoft.portable-executable로 반환
 * (application/x-executable은 ELF의 MIME이므로 PE로 보지 않음)
 */
export const isPeFile = (mimeType: string, extension: string): boolean =>
  mimeType === 'application/vnd.microsoft.portable-executable' ||
  mimeType === 'application/x-msdownload' ||
  ['exe', 'dll', 'sys', 'ocx'].includes(extension.toLowerCase());
