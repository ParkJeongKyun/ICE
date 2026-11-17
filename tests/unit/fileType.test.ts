import { describe, expect, it } from 'vitest';
import { isPeFile } from '@/utils/fileType';

describe('isPeFile', () => {
  it('엔진이 판별한 PE MIME', () => {
    expect(isPeFile('application/vnd.microsoft.portable-executable', '')).toBe(
      true
    );
    expect(isPeFile('application/x-msdownload', '')).toBe(true);
  });

  it('확장자로도 판별 (대소문자 무시)', () => {
    expect(isPeFile('application/octet-stream', 'DLL')).toBe(true);
    expect(isPeFile('application/octet-stream', 'sys')).toBe(true);
  });

  it('ELF 실행 파일과 일반 파일은 PE가 아님', () => {
    expect(isPeFile('application/x-executable', '')).toBe(false);
    expect(isPeFile('image/jpeg', 'jpg')).toBe(false);
  });
});
