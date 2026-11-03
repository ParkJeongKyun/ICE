'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useTab } from '@/contexts/TabDataContext/TabDataContext';
import Collapse from '@/components/common/Collapse/Collapse';
import {
  CertificateItem,
  SubHeader,
  ToneText,
  ValueList,
} from '../../InfoCollapse.styles';
import PeInfoRow from '../PeInfoRow';

const SECURITY_FLAGS = ['aslr', 'dep', 'cfg', 'seh'] as const;

const PeSecurityTlsCollapse: React.FC = () => {
  const t = useTranslations('peInfo');
  const { activeData } = useTab();
  const peData = activeData?.peData;

  if (!peData) return null;

  const { security, debug, tls, certificates } = peData;

  return (
    <Collapse id="pe-security-tls" title={t('groups.certificatesTls')} open>
      {security && (
        <>
          <SubHeader>{t('security.name')}</SubHeader>
          {SECURITY_FLAGS.map((flag) => (
            <PeInfoRow key={flag} field={flag}>
              <ToneText $tone={security[flag] ? 'success' : 'danger'}>
                {t(security[flag] ? 'status.enabled' : 'status.disabled')}
              </ToneText>
            </PeInfoRow>
          ))}
        </>
      )}

      {debug?.pdbPath && (
        <>
          <SubHeader>{t('debugInfo.name')}</SubHeader>
          <PeInfoRow field="pdbPath" mono>
            {debug.pdbPath}
          </PeInfoRow>
        </>
      )}

      {tls?.hasCallbacks && (
        <>
          <SubHeader>{t('tls.name')}</SubHeader>
          <PeInfoRow field="tlsCallbacks" mono>
            <ValueList>
              <ToneText $tone="danger">({tls.callbacks.length})</ToneText>
              {tls.callbacks.map((cb, i) => (
                <span key={i}>{cb}</span>
              ))}
            </ValueList>
          </PeInfoRow>
        </>
      )}

      {certificates && certificates.length > 0 && (
        <>
          <SubHeader>{t('certificates.name')}</SubHeader>
          {certificates.map((cert, i) => (
            <CertificateItem key={i}>
              <PeInfoRow field="certSubject" compact>
                {cert.subject}
              </PeInfoRow>
              <PeInfoRow field="certIssuer" compact>
                {cert.issuer}
              </PeInfoRow>
              <PeInfoRow field="certSerial" mono>
                {cert.serial}
              </PeInfoRow>
              <PeInfoRow field="certValidity" compact>
                {cert.notBefore} ~ {cert.notAfter}
              </PeInfoRow>
            </CertificateItem>
          ))}
        </>
      )}
    </Collapse>
  );
};

export default React.memo(PeSecurityTlsCollapse);
