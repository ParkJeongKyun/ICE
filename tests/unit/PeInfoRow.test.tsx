// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import PeInfoRow, {
  toHex,
} from '@/components/InfoCollapse/PeInfoCollapse/PeInfoRow';
import peInfo from '@/locales/ko/peInfo/peInfo.json';

const renderRow = (ui: React.ReactElement) =>
  render(
    <NextIntlClientProvider locale="ko" messages={{ peInfo }}>
      {ui}
    </NextIntlClientProvider>
  );

describe('PeInfoRow', () => {
  it('peInfo.json의 name을 라벨로, 값은 그대로 표시', () => {
    renderRow(<PeInfoRow field="magic">MZ</PeInfoRow>);

    expect(screen.getByText(peInfo.magic.name)).toBeInTheDocument();
    expect(screen.getByText('MZ')).toBeInTheDocument();
  });

  it('onJump가 있을 때만 이동 버튼을 표시하고 클릭 시 호출', () => {
    const onJump = vi.fn();
    const { rerender } = renderRow(<PeInfoRow field="lfanew">0x80</PeInfoRow>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="ko" messages={{ peInfo }}>
        <PeInfoRow field="lfanew" onJump={onJump}>
          0x80
        </PeInfoRow>
      </NextIntlClientProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: peInfo.jumpToOffset }));
    expect(onJump).toHaveBeenCalledTimes(1);
  });
});

describe('toHex', () => {
  it('PE 내부 주소는 0x 접두사 16진수', () => {
    expect(toHex(4096)).toBe('0x1000');
  });
});
