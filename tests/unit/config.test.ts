import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  deepMerge,
  parseStoredConfig,
} from '@/contexts/ConfigContext/ConfigContext';

describe('deepMerge', () => {
  it('중첩 객체는 합치고 바뀐 값만 덮어씀', () => {
    const merged = deepMerge(DEFAULT_CONFIG, {
      ui: { panelVisibility: { tools: { searcher: false } } },
    });

    expect(merged.ui.panelVisibility.tools.searcher).toBe(false);
    expect(merged.ui.panelVisibility.tools.hashCalculator).toBe(true);
    expect(merged.ui.bytesPerLine).toBe(DEFAULT_CONFIG.ui.bytesPerLine);
  });

  it('원본(기본 설정)을 변경하지 않음', () => {
    const snapshot = structuredClone(DEFAULT_CONFIG);
    deepMerge(DEFAULT_CONFIG, { engines: { image: { enabled: false } } });
    expect(DEFAULT_CONFIG).toEqual(snapshot);
  });
});

describe('parseStoredConfig', () => {
  it('저장된 값이 없는 항목은 기본값으로 채움', () => {
    const config = parseStoredConfig(JSON.stringify({ theme: 'light' }));
    expect(config.theme).toBe('light');
    expect(config.engines).toEqual(DEFAULT_CONFIG.engines);
  });

  it('잘못된 값은 기본값으로 되돌리고 기본 설정은 오염시키지 않음', () => {
    const snapshot = structuredClone(DEFAULT_CONFIG);
    const config = parseStoredConfig(
      JSON.stringify({
        theme: 'neon',
        ui: { bytesPerLine: 7, numberBase: 'base64', dateFormat: 'JP' },
        engines: { image: 'yes', pe: 'no' },
        analysis: { enabled: 1 },
      })
    );

    expect(config.theme).toBe(DEFAULT_CONFIG.theme);
    expect(config.ui.bytesPerLine).toBe(16);
    expect(config.ui.numberBase).toBe('hexadecimal');
    expect(config.ui.dateFormat).toBe('ISO');
    expect(config.engines.image).toEqual(DEFAULT_CONFIG.engines.image);
    expect(config.engines.pe).toBe(false);
    expect(config.analysis.enabled).toBe(true);
    expect(DEFAULT_CONFIG).toEqual(snapshot);
  });

  describe('구버전 설정 이관 (analysis.imageMetadata → engines.image.enabled)', () => {
    it('이미지 분석을 꺼둔 사용자는 업데이트 후에도 꺼진 상태 유지', () => {
      const config = parseStoredConfig(
        JSON.stringify({ analysis: { imageMetadata: false } })
      );
      expect(config.engines.image.enabled).toBe(false);
      expect(config.engines.image.exif).toBe(true);
    });

    it('새 engines 설정이 이미 있으면 구버전 값은 무시', () => {
      const config = parseStoredConfig(
        JSON.stringify({
          analysis: { imageMetadata: false },
          engines: { image: { enabled: true } },
        })
      );
      expect(config.engines.image.enabled).toBe(true);
    });
  });

  it('깨진 JSON은 예외 (Provider에서 기본 설정 사용)', () => {
    expect(() => parseStoredConfig('{broken')).toThrow();
  });
});
