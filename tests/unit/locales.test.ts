/**
 * 번역 파일 회귀 테스트
 * - ko/en 키 구조가 같은지
 * - 소스 코드에서 쓰는 번역 키와 토스트 코드가 실제로 존재하는지
 *   (없으면 next-intl이 INSUFFICIENT_PATH 오류를 내거나 화면에 키 이름이 그대로 노출됨)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOAST_DEFAULTS } from '@/utils/toastDefaults';

const ROOT = join(__dirname, '../..');
const LOCALES_DIR = join(ROOT, 'src/locales');
const LOCALES = ['ko', 'en'] as const;

type Messages = Record<string, unknown>;

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

/** src/locales/request.ts와 같은 방식으로 namespace를 구성 */
function loadMessages(locale: string): Messages {
  const dir = join(LOCALES_DIR, locale);
  const messages: Messages = readJson(join(dir, 'translation.json'));
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, `${name}.json`);
    if (statSync(join(dir, name)).isDirectory()) {
      try {
        messages[name] = readJson(file);
      } catch {
        // markdown 등 json namespace가 아닌 폴더
      }
    }
  }
  return messages;
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => flattenKeys(item, `${prefix}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix];
}

function getPath(messages: Messages, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      messages
    );
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const messagesByLocale = Object.fromEntries(
  LOCALES.map((locale) => [locale, loadMessages(locale)])
) as Record<(typeof LOCALES)[number], Messages>;

const sources = listSourceFiles(join(ROOT, 'src')).map((path) => ({
  path: relative(ROOT, path),
  code: readFileSync(path, 'utf8'),
}));

/**
 * 소스에서 정적으로 확인 가능한 번역 키 수집
 * const t = useTranslations('ns') 로 만든 함수의 t('key') / t.raw('key') / t.rich('key') 호출
 */
function collectTranslationKeys() {
  const used: { file: string; key: string }[] = [];

  for (const { path, code } of sources) {
    const translators = new Map<string, string>();
    for (const m of code.matchAll(
      /const\s+(\w+)\s*=\s*useTranslations\(\s*(?:'([^']*)')?\s*\)/g
    )) {
      translators.set(m[1], m[2] ?? '');
    }

    for (const [name, namespace] of translators) {
      const call = new RegExp(
        `\\b${name}(?:\\.(?:raw|rich|markup))?\\(\\s*'([^'\`$]+)'`,
        'g'
      );
      for (const m of code.matchAll(call)) {
        used.push({
          file: path,
          key: namespace ? `${namespace}.${m[1]}` : m[1],
        });
      }
    }

    // <PeInfoRow field="x"> → peInfo.x.name / peInfo.x.description
    for (const m of code.matchAll(/<PeInfoRow[^>]*?\sfield="([^"]+)"/g)) {
      used.push({ file: path, key: `peInfo.${m[1]}.name` });
      used.push({ file: path, key: `peInfo.${m[1]}.description` });
    }
  }
  return used;
}

describe('ko / en 번역 구조', () => {
  const namespaces = Object.keys(messagesByLocale.ko);

  it.each(namespaces)('%s', (namespace) => {
    const ko = flattenKeys(messagesByLocale.ko[namespace]).sort();
    const en = flattenKeys(messagesByLocale.en[namespace]).sort();
    expect(en).toEqual(ko);
  });
});

describe('소스에서 사용하는 번역 키', () => {
  const used = collectTranslationKeys();

  it('수집이 정상 동작 (정규식 회귀 방지)', () => {
    expect(used.length).toBeGreaterThan(100);
  });

  it.each(LOCALES)('%s에 모두 존재', (locale) => {
    const missing = used
      .filter(({ key }) => getPath(messagesByLocale[locale], key) === undefined)
      .map(({ file, key }) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });
});

describe('토스트 메시지', () => {
  const codes = new Set(Object.keys(TOAST_DEFAULTS));
  // 호출 시 message를 직접 넘기는 횟수 (항상 넘기면 locale에는 title만 있어도 됨)
  const usage = new Map<string, { total: number; withMessage: number }>();

  for (const { code } of sources) {
    for (const m of code.matchAll(
      /\b(?:code|errorCode):\s*'([A-Z][A-Z0-9_]+)'(,\s*message:)?/g
    )) {
      codes.add(m[1]);
      const count = usage.get(m[1]) ?? { total: 0, withMessage: 0 };
      count.total++;
      if (m[2]) count.withMessage++;
      usage.set(m[1], count);
    }
  }

  const alwaysHasMessage = (code: string) => {
    const count = usage.get(code);
    return !!count && count.total === count.withMessage;
  };

  it.each(LOCALES)('%s에 모든 코드의 제목과 내용이 존재', (locale) => {
    const has = (path: string) =>
      typeof getPath(messagesByLocale[locale], path) === 'string';
    const missing = [...codes].filter(
      (code) =>
        !has(`messages.${code}.title`) ||
        (!alwaysHasMessage(code) && !has(`messages.${code}.message`))
    );
    expect(missing).toEqual([]);
  });
});
