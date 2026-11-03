'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useConfig } from '@/contexts/ConfigContext/ConfigContext';
import { useTab } from '@/contexts/TabDataContext/TabDataContext';
import { useJumpToOffset } from '@/hooks/useJumpToOffset';
import Collapse from '@/components/common/Collapse/Collapse';
import ChevronRightIcon from '@/components/common/Icons/ChevronRightIcon';
import { JumpButton, SectionTable, ToneText } from '../../InfoCollapse.styles';
import { HIGH_ENTROPY_THRESHOLD, toHex } from '../PeInfoRow';
import { formatOffset } from '@/utils/formatters';

const PeSectionsCollapse: React.FC = () => {
  const t = useTranslations('peInfo');
  const { config } = useConfig();
  const { activeData } = useTab();
  const onJumpToOffset = useJumpToOffset();
  const sections = activeData?.peData?.sections;

  if (!sections || sections.length === 0) return null;

  return (
    <Collapse id="pe-sections" title={t('groups.sections')} open>
      <SectionTable>
        <thead>
          <tr>
            <th>{t('sectionName.name')}</th>
            <th>{t('entropy.name')}</th>
            <th>{t('virtualAddress.name')}</th>
            <th>{t('virtualSize.name')}</th>
            <th>{t('rawSize.name')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s, i) => {
            const entropy = s.entropy.toFixed(2);
            return (
              <tr key={i}>
                <td>{s.name}</td>
                <td>
                  {s.entropy > HIGH_ENTROPY_THRESHOLD ? (
                    <ToneText $tone="danger">{entropy}</ToneText>
                  ) : (
                    entropy
                  )}
                </td>
                <td>{toHex(s.virtualAddress)}</td>
                <td>{toHex(s.virtualSize)}</td>
                <td>{formatOffset(s.sizeOfRawData, config.ui.numberBase)}</td>
                <td>
                  <JumpButton
                    onClick={() => onJumpToOffset(s.fileOffset)}
                    aria-label={t('jumpToOffset')}
                  >
                    <ChevronRightIcon width={12} height={12} />
                  </JumpButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </SectionTable>
    </Collapse>
  );
};

export default React.memo(PeSectionsCollapse);
