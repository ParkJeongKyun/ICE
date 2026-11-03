'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Tooltip from '@/components/common/Tooltip/Tooltip';
import ChevronRightIcon from '@/components/common/Icons/ChevronRightIcon';
import {
  CellHeaderDiv,
  ContentDiv,
  JumpButton,
  PeValueDiv,
} from '../InfoCollapse.styles';

/** 이 값을 넘는 엔트로피는 패킹/암호화 의심으로 강조 표시 */
export const HIGH_ENTROPY_THRESHOLD = 7.0;

/** RVA 등 PE 내부 주소는 설정과 무관하게 16진수로 표시 */
export const toHex = (value: number) => `0x${value.toString(16)}`;

interface PeInfoRowProps {
  /** peInfo.json의 항목 키 (name은 라벨, description은 툴팁) */
  field: string;
  children: React.ReactNode;
  /** 지정하면 헥스 뷰어 이동 버튼 표시 */
  onJump?: () => void;
  /** 해시, 경로 등 긴 값은 작은 글씨로 표시 */
  compact?: boolean;
  mono?: boolean;
}

/**
 * PE 정보의 "라벨(툴팁) | 값" 한 줄
 */
const PeInfoRow: React.FC<PeInfoRowProps> = ({
  field,
  children,
  onJump,
  compact,
  mono,
}) => {
  const t = useTranslations('peInfo');

  return (
    <ContentDiv>
      <CellHeaderDiv>
        <Tooltip text={t(`${field}.description`)}>{t(`${field}.name`)}</Tooltip>
        {onJump && (
          <JumpButton onClick={onJump} aria-label={t('jumpToOffset')}>
            <ChevronRightIcon width={12} height={12} />
          </JumpButton>
        )}
      </CellHeaderDiv>
      <PeValueDiv $compact={compact} $mono={mono}>
        {children}
      </PeValueDiv>
    </ContentDiv>
  );
};

export default PeInfoRow;
