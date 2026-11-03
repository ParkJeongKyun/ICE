'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useConfig } from '@/contexts/ConfigContext/ConfigContext';
import { useTab } from '@/contexts/TabDataContext/TabDataContext';
import { useJumpToOffset } from '@/hooks/useJumpToOffset';
import Collapse from '@/components/common/Collapse/Collapse';
import {
  CellBodyDiv,
  CellHeaderDiv,
  ContentDiv,
  SectionTable,
  SubHeader,
} from '../../InfoCollapse.styles';
import PeInfoRow, { toHex } from '../PeInfoRow';
import { formatOffset } from '@/utils/formatters';

const PeHeadersCollapse: React.FC = () => {
  const t = useTranslations('peInfo');
  const { config } = useConfig();
  const { activeData } = useTab();
  const onJumpToOffset = useJumpToOffset();
  const peData = activeData?.peData;

  if (!peData) return null;

  const { dosHeader, fileHeader, optionalHeader, richHeader } = peData;
  const format = (value: number) => formatOffset(value, config.ui.numberBase);

  return (
    <Collapse id="pe-headers" title={t('groups.headers')} open>
      <SubHeader>{t('dosHeader.name')}</SubHeader>
      <PeInfoRow field="magic">{dosHeader.magic}</PeInfoRow>
      <PeInfoRow field="lfanew" onJump={() => onJumpToOffset(dosHeader.lfanew)}>
        {format(dosHeader.lfanew)}
      </PeInfoRow>

      <SubHeader>{t('fileHeader.name')}</SubHeader>
      <PeInfoRow
        field="offset"
        onJump={() => onJumpToOffset(fileHeader.offset)}
      >
        {format(fileHeader.offset)}
      </PeInfoRow>
      <PeInfoRow field="numberOfSections">
        {fileHeader.numberOfSections}
      </PeInfoRow>
      <PeInfoRow field="characteristics">
        {format(fileHeader.characteristics)}
      </PeInfoRow>

      {optionalHeader && Object.keys(optionalHeader).length > 0 && (
        <>
          <SubHeader>{t('optionalHeader.name')}</SubHeader>
          {Object.entries(optionalHeader).map(([key, value]) => (
            <ContentDiv key={key}>
              <CellHeaderDiv>{key}</CellHeaderDiv>
              <CellBodyDiv>
                {typeof value === 'number'
                  ? `${toHex(value)} (${value})`
                  : String(value)}
              </CellBodyDiv>
            </ContentDiv>
          ))}
        </>
      )}

      {richHeader?.items?.length > 0 && (
        <>
          <SubHeader>{t('richHeader.name')}</SubHeader>
          <PeInfoRow
            field="offset"
            onJump={() => onJumpToOffset(richHeader.offset)}
          >
            {format(richHeader.offset)}
          </PeInfoRow>
          <SectionTable>
            <thead>
              <tr>
                <th>{t('table.prodId')}</th>
                <th>{t('table.version')}</th>
                <th>{t('table.count')}</th>
              </tr>
            </thead>
            <tbody>
              {richHeader.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.id}</td>
                  <td>{item.version}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </SectionTable>
        </>
      )}
    </Collapse>
  );
};

export default React.memo(PeHeadersCollapse);
