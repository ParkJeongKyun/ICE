'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useConfig } from '@/contexts/ConfigContext/ConfigContext';
import { useTab } from '@/contexts/TabDataContext/TabDataContext';
import { useJumpToOffset } from '@/hooks/useJumpToOffset';
import Collapse from '@/components/common/Collapse/Collapse';
import {
  AnomalyItem,
  AnomalyList,
  CellHeaderDiv,
  ContentDiv,
  PeValueDiv,
  SubHeader,
  ToneText,
} from '../../InfoCollapse.styles';
import PeInfoRow, { HIGH_ENTROPY_THRESHOLD } from '../PeInfoRow';
import { formatOffset } from '@/utils/formatters';

const PeBasicCollapse: React.FC = () => {
  const t = useTranslations('peInfo');
  const { config } = useConfig();
  const { activeData } = useTab();
  const onJumpToOffset = useJumpToOffset();
  const peData = activeData?.peData;

  if (!peData) return null;

  const { basic, hashes, versionInfo, anomalies } = peData;
  const entropy = basic.totalEntropy.toFixed(4);

  return (
    <Collapse id="pe-basic" title={t('groups.basic')} open>
      <PeInfoRow field="magic">{basic.magic}</PeInfoRow>
      <PeInfoRow field="machine">{basic.machine}</PeInfoRow>
      {basic.language && (
        <PeInfoRow field="language">{basic.language}</PeInfoRow>
      )}
      {basic.compiler && (
        <PeInfoRow field="compiler">{basic.compiler}</PeInfoRow>
      )}
      <PeInfoRow field="entropy">
        {basic.totalEntropy > HIGH_ENTROPY_THRESHOLD ? (
          <ToneText $tone="danger">{entropy}</ToneText>
        ) : (
          entropy
        )}
      </PeInfoRow>
      <PeInfoRow field="timeDateStamp">{basic.timeDateStamp}</PeInfoRow>
      <PeInfoRow field="imageBase">{basic.imageBase}</PeInfoRow>
      <PeInfoRow
        field="entryPoint"
        onJump={() => onJumpToOffset(basic.entryPointOffset)}
      >
        {basic.entryPoint} (
        {formatOffset(basic.entryPointOffset, config.ui.numberBase)})
      </PeInfoRow>

      {hashes && (
        <>
          <SubHeader>{t('hashes.name')}</SubHeader>
          <PeInfoRow field="impHash" mono>
            {hashes.impHash}
          </PeInfoRow>
          <PeInfoRow field="authentihash" mono>
            {hashes.authentihash}
          </PeInfoRow>
        </>
      )}

      {versionInfo && Object.keys(versionInfo).length > 0 && (
        <>
          <SubHeader>{t('versionInfo.name')}</SubHeader>
          {Object.entries(versionInfo).map(([key, value]) => (
            <ContentDiv key={key}>
              <CellHeaderDiv>{key}</CellHeaderDiv>
              <PeValueDiv $compact>{value}</PeValueDiv>
            </ContentDiv>
          ))}
        </>
      )}

      {anomalies && anomalies.length > 0 && (
        <>
          <SubHeader>{t('anomalies.name')}</SubHeader>
          <AnomalyList>
            {anomalies.map((anomaly, i) => (
              <AnomalyItem key={i}>⚠️ {anomaly}</AnomalyItem>
            ))}
          </AnomalyList>
        </>
      )}
    </Collapse>
  );
};

export default React.memo(PeBasicCollapse);
