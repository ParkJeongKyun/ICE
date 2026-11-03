import fs from 'fs';
import path from 'path';

/**
 * 마크다운에서 빌드 시점 값으로 치환할 자리 표시자
 * (예: "# 현재 버전 : {{APP_VERSION}}")
 */
const PLACEHOLDERS: Record<string, string | undefined> = {
  APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
};

const fillPlaceholders = (text: string) =>
  text.replace(
    /\{\{(\w+)\}\}/g,
    (match, key: string) => PLACEHOLDERS[key] ?? match
  );

/**
 * Read a list of markdown files from public/locales/{locale}/markdown and return a map.
 * Synchronous by design (used inside server components during render).
 */
export function getMarkdownData(locale: string, files: string[]) {
  const markdownData: { [key: string]: string } = {};

  files.forEach((fname) => {
    try {
      const filePath = path.join(
        process.cwd(),
        'public',
        'locales',
        locale,
        'markdown',
        `${fname}.md`
      );
      markdownData[fname] = fillPlaceholders(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      // if file missing or read fails, return empty string to avoid runtime errors
      markdownData[fname] = '';
    }
  });

  return markdownData;
}
