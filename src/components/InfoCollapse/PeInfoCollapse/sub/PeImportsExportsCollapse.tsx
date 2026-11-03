'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useConfig } from '@/contexts/ConfigContext/ConfigContext';
import { useTab } from '@/contexts/TabDataContext/TabDataContext';
import { useJumpToOffset } from '@/hooks/useJumpToOffset';
import Collapse from '@/components/common/Collapse/Collapse';
import ChevronRightIcon from '@/components/common/Icons/ChevronRightIcon';
import {
  ImportGroupItem,
  ImportLibraryName,
  ImportList,
  ImportNameList,
  ImportNameTag,
  JumpButton,
  SectionTable,
  SubHeader,
} from '../../InfoCollapse.styles';
import { formatOffset } from '@/utils/formatters';

const PeImportsExportsCollapse: React.FC = () => {
  const t = useTranslations('peInfo');
  const { config } = useConfig();
  const { activeData } = useTab();
  const onJumpToOffset = useJumpToOffset();
  const peData = activeData?.peData;

  const imports = peData?.imports ?? [];
  const exports = peData?.exports ?? [];

  if (imports.length === 0 && exports.length === 0) return null;

  return (
    <Collapse id="pe-imports-exports" title={t('groups.importsExports')} open>
      {imports.length > 0 && (
        <>
          <SubHeader>{t('imports.name')}</SubHeader>
          <ImportList>
            {imports.map((lib, i) => (
              <ImportGroupItem key={i}>
                <ImportLibraryName>{lib.library}</ImportLibraryName>
                <ImportNameList>
                  {/* Go는 빈 slice를 null로 직렬화함 */}
                  {(lib.imports ?? []).map((imp, j) => (
                    <ImportNameTag key={j}>{imp.name}</ImportNameTag>
                  ))}
                </ImportNameList>
              </ImportGroupItem>
            ))}
          </ImportList>
        </>
      )}

      {exports.length > 0 && (
        <>
          <SubHeader>{t('exports.name')}</SubHeader>
          <SectionTable>
            <thead>
              <tr>
                <th>{t('sectionName.name')}</th>
                <th>{t('address.name')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exports.map((e, i) => (
                <tr key={i}>
                  <td>{e.name}</td>
                  <td>{formatOffset(e.address, config.ui.numberBase)}</td>
                  <td>
                    <JumpButton
                      onClick={() => onJumpToOffset(e.offset)}
                      aria-label={t('jumpToOffset')}
                    >
                      <ChevronRightIcon width={12} height={12} />
                    </JumpButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </SectionTable>
        </>
      )}
    </Collapse>
  );
};

export default React.memo(PeImportsExportsCollapse);
