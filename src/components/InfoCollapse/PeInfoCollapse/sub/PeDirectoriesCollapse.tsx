'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useConfig } from '@/contexts/ConfigContext/ConfigContext';
import { useTab } from '@/contexts/TabDataContext/TabDataContext';
import { useJumpToOffset } from '@/hooks/useJumpToOffset';
import Collapse from '@/components/common/Collapse/Collapse';
import ChevronRightIcon from '@/components/common/Icons/ChevronRightIcon';
import { JumpButton, SectionTable, SubHeader } from '../../InfoCollapse.styles';
import { toHex } from '../PeInfoRow';
import { formatOffset } from '@/utils/formatters';

const PeDirectoriesCollapse: React.FC = () => {
  const t = useTranslations('peInfo');
  const { config } = useConfig();
  const { activeData } = useTab();
  const onJumpToOffset = useJumpToOffset();
  const directories = activeData?.peData?.dataDirectories;

  if (!directories || directories.length === 0) return null;

  return (
    <Collapse id="pe-directories" title={t('groups.directories')} open>
      <SubHeader>{t('dataDirectories.name')}</SubHeader>
      <SectionTable>
        <thead>
          <tr>
            <th>{t('sectionName.name')}</th>
            <th>{t('virtualAddress.name')}</th>
            <th>{t('offset.name')}</th>
            <th>{t('rawSize.name')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {directories.map((d, i) => (
            <tr key={i}>
              <td>{d.name}</td>
              <td>{toHex(d.virtualAddress)}</td>
              <td>{formatOffset(d.fileOffset, config.ui.numberBase)}</td>
              <td>{formatOffset(d.size, config.ui.numberBase)}</td>
              <td>
                <JumpButton
                  onClick={() => onJumpToOffset(d.fileOffset)}
                  aria-label={t('jumpToOffset')}
                >
                  <ChevronRightIcon width={12} height={12} />
                </JumpButton>
              </td>
            </tr>
          ))}
        </tbody>
      </SectionTable>
    </Collapse>
  );
};

export default React.memo(PeDirectoriesCollapse);
