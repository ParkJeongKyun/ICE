'use client';

import { useEffect, useRef } from 'react';
import { useTab } from '@/contexts/TabDataContext/TabDataContext';
import { useWorker } from '@/contexts/WorkerContext/WorkerContext';
import { useRefs } from '@/contexts/RefContext/RefContext';
import type { TabData, TabKey } from '@/types';
import type { HashType } from '@/types/worker/hash.worker.types';
import {
  extractStrings,
  hexDump,
  hexOffset,
  num,
  patternBytes,
  readBytes,
  truncate,
} from '@/utils/webMcp';
import { isPeFile } from '@/utils/fileType';

/*
 * WebMCP: 브라우저의 AI 에이전트(Chrome 확장, Claude Code + Chrome DevTools MCP 등)가
 * ICE에 열어 둔 파일을 ICE 엔진으로 분석할 수 있도록 도구를 등록
 * https://developer.chrome.com/docs/ai/webmcp
 *
 * - document.modelContext(현재 이름), navigator.modelContext(이전 이름)가 있는 브라우저에서만 동작
 *   (실험 기능: Chrome origin trial 토큰은 NEXT_PUBLIC_WEBMCP_TOKEN)
 * - 파일은 이 페이지 안에서 분석하고 도구 결과만 에이전트에 전달
 * - 헥스 뷰어 위치 이동 외에는 모두 읽기 전용
 * - 도구 설명과 결과는 에이전트(모델)가 읽으므로 영어로 작성
 */

type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
  annotations?: ToolAnnotations;
};

type ModelContext = {
  registerTool: (
    tool: ToolDefinition,
    options?: { signal?: AbortSignal }
  ) => Promise<void> | void;
};

const getModelContext = (): ModelContext | undefined => {
  const context =
    (document as unknown as { modelContext?: ModelContext }).modelContext ??
    (navigator as unknown as { modelContext?: ModelContext }).modelContext;
  return typeof context?.registerTool === 'function' ? context : undefined;
};

/** 도구가 실행될 때 읽는 최신 화면 상태 */
type AppState = {
  tabData: TabData;
  activeKey: TabKey;
  tabOrder: TabKey[];
  setActiveKey: (key: TabKey) => void;
  analysisManager: ReturnType<typeof useWorker>['analysisManager'];
  hashManager: ReturnType<typeof useWorker>['hashManager'];
  scrollTo: (offset: number, length: number) => void;
};

// 파일에서 나온 값이 들어 있는 결과: 에이전트가 그 안의 지시문을 따르지 않도록 표시
const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  untrustedContentHint: true,
};

const MAX_HEX_BYTES = 4096;
const MAX_STRINGS_BYTES = 16 * 1024 * 1024;
// 엔진이 돌려주는 최대 검색 결과 수 (이만큼 찾으면 더 있을 수 있음)
const ENGINE_MAX_MATCHES = 1000;
// EXIF 태그 값 하나의 최대 글자 수 (MakerNote처럼 수십 KB인 값이 그대로 가지 않도록)
const MAX_EXIF_VALUE_CHARS = 1024;

const json = (value: unknown) => JSON.stringify(value, null, 2);

const tabArg = {
  type: 'string',
  description:
    'Tab key or file name from ice_list_files. Omit to use the file currently shown.',
};

function createTools(state: () => AppState): ToolDefinition[] {
  /** 탭 키나 파일 이름으로 열린 파일을 찾음 (생략하면 지금 보이는 파일) */
  const resolveTab = (tab: unknown) => {
    const { tabData, activeKey } = state();
    const keys = Object.keys(tabData);
    if (!keys.length)
      throw new Error(
        'No file is open in ICE. Ask the user to drop a file onto the page first.'
      );
    let key = activeKey;
    if (typeof tab === 'string' && tab) {
      key =
        keys.find((k) => k === tab) ??
        keys.find((k) => tabData[k].fileInfo.name === tab) ??
        keys.find(
          (k) => tabData[k].fileInfo.name.toLowerCase() === tab.toLowerCase()
        ) ??
        '';
      if (!key)
        throw new Error(`No open file matches "${tab}". Use ice_list_files.`);
    }
    return { key, data: tabData[key] };
  };

  return [
    {
      name: 'ice_list_files',
      description:
        'List the files the user has opened in ICE (a browser-based forensic hex viewer). Shows each tab key, file name, size, the type detected from the file content, and which analysis results are available. Call this first.',
      inputSchema: { type: 'object', properties: {} },
      annotations: READ_ONLY,
      async execute() {
        const { tabData, activeKey, tabOrder } = state();
        const keys = [
          ...tabOrder.filter((k) => tabData[k]),
          ...Object.keys(tabData).filter((k) => !tabOrder.includes(k)),
        ];
        return json(
          keys.map((key) => {
            const { fileInfo, exifInfo, textChunkData, peData } = tabData[key];
            return {
              tab: key,
              name: fileInfo.name,
              size: fileInfo.size,
              detectedType: fileInfo.mimeType || 'unknown',
              detectedExtension: fileInfo.extension || '',
              shownInViewer: key === activeKey,
              available: {
                exif: Boolean(exifInfo),
                pngText: Boolean(textChunkData),
                pe: Boolean(peData),
              },
            };
          })
        );
      },
    },
    {
      name: 'ice_read_hex',
      description: `Read bytes of an open file as a hex dump (offset, hex bytes, ASCII). Up to ${MAX_HEX_BYTES} bytes per call.`,
      inputSchema: {
        type: 'object',
        properties: {
          tab: tabArg,
          offset: {
            type: 'integer',
            minimum: 0,
            description: 'Start offset (decimal)',
          },
          length: {
            type: 'integer',
            minimum: 1,
            maximum: MAX_HEX_BYTES,
            description: 'Number of bytes (default 256)',
          },
        },
      },
      annotations: READ_ONLY,
      async execute(args) {
        const { data } = resolveTab(args.tab);
        const offset = num(args.offset, 0, 0, Number.MAX_SAFE_INTEGER);
        if (offset >= data.file.size)
          throw new Error(`Offset is beyond the file size (${data.file.size})`);
        const length = num(args.length, 256, 1, MAX_HEX_BYTES);
        return hexDump(await readBytes(data.file, offset, length), offset);
      },
    },
    {
      name: 'ice_search',
      description: `Search the whole open file for a text or hex pattern with the ICE engine and return matching offsets with surrounding bytes. Works on large files. Finds at most ${ENGINE_MAX_MATCHES} matches.`,
      inputSchema: {
        type: 'object',
        properties: {
          tab: tabArg,
          pattern: {
            type: 'string',
            description: 'Text such as "Exif", or hex such as "4D 5A 90 00"',
          },
          encoding: {
            type: 'string',
            enum: ['text', 'hex'],
            description: 'Default text',
          },
          ignoreCase: {
            type: 'boolean',
            description: 'Case-insensitive text search',
          },
          maxResults: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
            description: 'Default 50',
          },
        },
        required: ['pattern'],
      },
      annotations: READ_ONLY,
      async execute(args) {
        const { analysisManager } = state();
        if (!analysisManager)
          throw new Error(
            'The ICE engine is still loading. Try again shortly.'
          );
        const { data } = resolveTab(args.tab);
        const encoding = args.encoding === 'hex' ? 'hex' : 'text';
        const pattern = patternBytes(String(args.pattern ?? ''), encoding);
        if (!pattern.length) throw new Error('Pattern is empty');
        const maxResults = num(args.maxResults, 50, 1, 1000);
        const result =
          encoding === 'hex'
            ? await analysisManager.execute('SEARCH_HEX', {
                file: data.file,
                pattern,
              })
            : await analysisManager.execute('SEARCH_ASCII', {
                file: data.file,
                pattern,
                ignoreCase: Boolean(args.ignoreCase),
              });
        const offsets = (result.data?.indices ?? []).map((m) => m.index);
        const shown = offsets.slice(0, maxResults);
        return json({
          pattern: args.pattern,
          encoding,
          totalMatches: offsets.length,
          // 엔진은 최대 1000개까지만 찾음
          ...(offsets.length >= ENGINE_MAX_MATCHES && {
            note: `Search stops at ${ENGINE_MAX_MATCHES} matches; there may be more.`,
          }),
          matches: await Promise.all(
            shown.slice(0, 10).map(async (offset) => {
              const from = Math.max(0, offset - 8);
              return {
                offset,
                offsetHex: '0x' + offset.toString(16).toUpperCase(),
                context: hexDump(
                  await readBytes(data.file, from, pattern.length + 16),
                  from
                ),
              };
            })
          ),
          moreOffsets: shown.slice(10),
        });
      },
    },
    {
      name: 'ice_get_metadata',
      description:
        'Get the analysis results ICE already computed for an open file: EXIF tags with their file offsets and GPS location (images), PNG text chunks, or a Windows PE summary.',
      inputSchema: { type: 'object', properties: { tab: tabArg } },
      annotations: READ_ONLY,
      async execute(args) {
        const { data } = resolveTab(args.tab);
        const { exifInfo, textChunkData, peData, fileInfo } = data;
        return json({
          file: fileInfo,
          // 썸네일(base64)은 크기만 남김
          exif: exifInfo
            ? {
                ...exifInfo,
                thumbnail: exifInfo.thumbnail
                  ? `(base64 image, ${exifInfo.thumbnail.length} chars, omitted)`
                  : '',
                tagInfos: exifInfo.tagInfos?.map((tag) => ({
                  ...tag,
                  data: truncate(tag.data, MAX_EXIF_VALUE_CHARS),
                })),
              }
            : null,
          pngText: textChunkData ?? null,
          pe: peData
            ? {
                note: 'Use ice_get_pe for full sections, imports, certificates.',
                basic: peData.basic,
              }
            : null,
        });
      },
    },
    {
      name: 'ice_get_pe',
      description:
        'Get Windows PE (EXE/DLL/SYS) structures ICE parsed for an open file. Results can be large, so choose parts.',
      inputSchema: {
        type: 'object',
        properties: {
          tab: tabArg,
          parts: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Any of: basic, dosHeader, richHeader, fileHeader, optionalHeader, dataDirectories, sections, imports, exports, debug, security, certificates, versionInfo, tls, hashes. Default: basic, fileHeader, sections, imports, certificates, versionInfo',
          },
        },
      },
      annotations: READ_ONLY,
      async execute(args) {
        const { data } = resolveTab(args.tab);
        if (!data.peData) {
          // PE 엔진은 설정에서 켜야 동작 (기본값 꺼짐)
          throw new Error(
            isPeFile(
              data.fileInfo.mimeType ?? '',
              data.fileInfo.extension ?? ''
            )
              ? 'PE analysis is turned off in ICE. Ask the user to enable the PE engine in ICE settings and open the file again.'
              : 'This file is not a Windows executable, so there is no PE analysis.'
          );
        }
        const parts =
          Array.isArray(args.parts) && args.parts.length
            ? args.parts.map(String)
            : [
                'basic',
                'fileHeader',
                'sections',
                'imports',
                'certificates',
                'versionInfo',
              ];
        const pe = data.peData as unknown as Record<string, unknown>;
        return json(Object.fromEntries(parts.map((p) => [p, pe[p] ?? null])));
      },
    },
    {
      name: 'ice_strings',
      description:
        'Extract printable ASCII and UTF-16LE strings with their offsets from a range of an open file. Useful for finding URLs, paths and commands.',
      inputSchema: {
        type: 'object',
        properties: {
          tab: tabArg,
          offset: {
            type: 'integer',
            minimum: 0,
            description: 'Start offset (default 0)',
          },
          length: {
            type: 'integer',
            minimum: 1,
            maximum: MAX_STRINGS_BYTES,
            description: 'Bytes to scan (default and maximum 16 MiB)',
          },
          minLength: {
            type: 'integer',
            minimum: 3,
            maximum: 64,
            description: 'Default 6',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 2000,
            description: 'Default 300',
          },
        },
      },
      annotations: READ_ONLY,
      async execute(args) {
        const { data } = resolveTab(args.tab);
        const offset = num(args.offset, 0, 0, Number.MAX_SAFE_INTEGER);
        const length = num(
          args.length,
          MAX_STRINGS_BYTES,
          1,
          MAX_STRINGS_BYTES
        );
        const found = extractStrings(
          await readBytes(data.file, offset, length),
          offset,
          num(args.minLength, 6, 3, 64),
          num(args.limit, 300, 1, 2000)
        );
        return (
          found
            .map(
              (s) => `${hexOffset(s.offset)} ${s.encoding.padEnd(7)} ${s.value}`
            )
            .join('\n') || '(no strings found)'
        );
      },
    },
    {
      name: 'ice_hash',
      description:
        'Compute a hash of a whole open file (md5, sha1, sha256 or sha512).',
      inputSchema: {
        type: 'object',
        properties: {
          tab: tabArg,
          algorithm: {
            type: 'string',
            enum: ['md5', 'sha1', 'sha256', 'sha512'],
            description: 'Default sha256',
          },
        },
      },
      annotations: READ_ONLY,
      async execute(args) {
        const { hashManager } = state();
        if (!hashManager)
          throw new Error('The hash worker is not ready. Try again shortly.');
        const { data } = resolveTab(args.tab);
        const hashType = (
          ['md5', 'sha1', 'sha256', 'sha512'].includes(String(args.algorithm))
            ? args.algorithm
            : 'sha256'
        ) as HashType;
        const result = await hashManager.execute('PROCESS_HASH', {
          file: data.file,
          hashType,
        });
        return json({ algorithm: hashType, hash: result.data.hash });
      },
    },
    {
      name: 'ice_show_offset',
      description:
        "Show a byte range to the user: switch ICE's hex viewer to the file and scroll to and highlight the range. Changes only what is displayed, never the file.",
      inputSchema: {
        type: 'object',
        properties: {
          tab: tabArg,
          offset: { type: 'integer', minimum: 0, description: 'Start offset' },
          length: {
            type: 'integer',
            minimum: 1,
            description: 'Bytes to highlight (default 1)',
          },
        },
        required: ['offset'],
      },
      annotations: { readOnlyHint: false, consequentialHint: false },
      async execute(args) {
        const { key, data } = resolveTab(args.tab);
        const offset = num(args.offset, 0, 0, Number.MAX_SAFE_INTEGER);
        if (offset >= data.file.size)
          throw new Error(`Offset is beyond the file size (${data.file.size})`);
        const length = num(args.length, 1, 1, data.file.size - offset);
        const { activeKey, setActiveKey } = state();
        if (key !== activeKey) {
          setActiveKey(key);
          // 탭이 바뀌어 헥스 뷰어가 다시 그려진 뒤 이동
          await new Promise((r) => setTimeout(r, 100));
        }
        state().scrollTo(offset, length);
        return `Showing ${data.fileInfo.name} at offset ${offset} (0x${offset.toString(16).toUpperCase()}), ${length} byte(s) highlighted.`;
      },
    },
  ];
}

/** 메인 화면에 붙여 WebMCP 도구를 등록 (화면에는 아무것도 그리지 않음) */
export default function WebMcpTools() {
  const { tabData, activeKey, setActiveKey, tabOrder } = useTab();
  const { analysisManager, hashManager } = useWorker();
  const { hexViewerRef } = useRefs();

  const stateRef = useRef<AppState | null>(null);
  // 도구는 한 번만 등록하고, 실행할 때마다 최신 상태를 읽음
  useEffect(() => {
    stateRef.current = {
      tabData,
      activeKey,
      tabOrder,
      setActiveKey,
      analysisManager,
      hashManager,
      scrollTo: (offset, length) =>
        hexViewerRef.current?.scrollToIndex(offset, length),
    };
  });

  useEffect(() => {
    const modelContext = getModelContext();
    if (!modelContext) return;
    const controller = new AbortController();
    for (const tool of createTools(() => stateRef.current!)) {
      // 도구에서 오류가 나면 브라우저는 원인 없이 "실행 실패"로만 전달하므로
      // 에이전트가 원인을 보고 다시 시도할 수 있도록 오류도 결과 문장으로 돌려줌
      const execute: ToolDefinition['execute'] = async (args) => {
        try {
          // 초기 WebMCP는 입력을 JSON 문자열로 넘김 (Chrome 155부터 객체)
          const input = typeof args === 'string' ? JSON.parse(args) : args;
          return await tool.execute(input ?? {});
        } catch (error) {
          return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      };
      Promise.resolve(
        modelContext.registerTool(
          { ...tool, execute },
          { signal: controller.signal }
        )
      ).catch((error) =>
        console.warn(`[WebMCP] ${tool.name} registration failed:`, error)
      );
    }
    return () => controller.abort();
  }, []);

  return null;
}
