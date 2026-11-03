import React from 'react';
import { useConfig } from '@/contexts/ConfigContext/ConfigContext';
import { useTab } from '@/contexts/TabDataContext/TabDataContext';
import FileInfoCollapse from '@/components/InfoCollapse/FileInfoCollapse/FileInfoCollapse';
import ImageInfoCollapse from '@/components/InfoCollapse/ImageInfoCollapse/ImageInfoCollapse';
import PeInfoCollapse from '@/components/InfoCollapse/PeInfoCollapse/PeInfoCollapse';

const InfoPanel: React.FC = () => {
  const { config } = useConfig();
  const { activeData } = useTab();
  const v = config.ui.panelVisibility.info;

  if (!v.enabled) return null;

  // 해당 엔진으로 분석된 탭에서만 엔진별 정보 표시
  const engines = activeData?.engines;

  return (
    <div>
      {v.fileInfo && <FileInfoCollapse />}
      {v.imageInfo && engines?.image && <ImageInfoCollapse />}
      {v.peInfo && engines?.pe && <PeInfoCollapse />}
    </div>
  );
};

export default InfoPanel;
