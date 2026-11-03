'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Bio,
  Content,
  Footer,
  Interview,
  Intro,
  IntroTop,
  Key,
  Links,
  Page,
  Role,
  Row,
  Section,
  SectionTitle,
  Value,
} from './AboutLayout.styles';
import { IceLogoArt } from './AsciiArt/AsciiArt';
import {
  INTERVIEW_ISO_DATE,
  INTERVIEW_LINK,
  InterviewJsonLd,
} from './ForensicInterviewCard/ForensicInterviewCard';
import { Link } from '@/locales/routing';
import LocaleSwitcher from '@/components/LocaleSwitcher/LocaleSwitcher';
import SponsorButton from '@/components/SponsorButton/SponsorButton';
import {
  calculateCareerDuration,
  calculateTotalCareerDuration,
} from '@/utils/careerCalculator';

const EMAIL = 'dbzoseh84@gmail.com';
const PROFILE_LINKS = [
  { label: 'GitHub', href: 'https://github.com/ParkJeongKyun' },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/%EC%A0%95%EA%B7%A0-%EB%B0%95-6180553b8/',
  },
];
const BIRTH_YEAR = 2001;
const INTERVIEW_IMAGE = '/images/articles/article_1.webp';

type EducationItem = {
  school: string;
  major: string;
  status: string;
  year: string;
};
type MilitaryData = { service: string; position: string; period: string };
type CareerItem = { period: string; company: string; position: string };
type ProjectItem = {
  name: string;
  client: string;
  role: string;
  period: string;
};

/** "회사 - 팀" 형식을 회사와 팀으로 분리 */
const splitCompany = (text: string) => {
  const [company, ...rest] = text.split(/\s[-–]\s/);
  return { company, team: rest.join(' – ') };
};

/** "2020.11.23 ~ 2022.07.22" → "2020.11 – 2022.07" (월 단위로 통일) */
const formatPeriod = (period: string) =>
  period.replace(/(\d{4}\.\d{2})\.\d{2}/g, '$1').replace(/\s*[-–~]\s*/, ' – ');

const About: React.FC = () => {
  const t = useTranslations('about');
  const education = t.raw('educationData') as EducationItem[];
  const military = t.raw('militaryData') as MilitaryData;
  const certificates = t.raw('certificatesData') as string[];
  const skillsExpert = t.raw('skillsExpertData') as string[];
  const skillsLang = t.raw('skillsLangData') as string[];
  const careers = t.raw('careersData') as CareerItem[];
  const projects = t.raw('projectsData') as ProjectItem[];

  const formatDuration = ({
    years,
    months,
  }: {
    years: number;
    months: number;
  }) =>
    [
      years > 0 && `${years}${t('year')}`,
      months > 0 && `${months}${t('month')}`,
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <Page>
      <Content>
        <Intro>
          <IntroTop>
            <IceLogoArt />
            <LocaleSwitcher />
          </IntroTop>
          <h1>{t('nameValue')}</h1>
          <Role>{t('heroRole')}</Role>
          <Bio>{t('heroIntro')}</Bio>
          <Links>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            {PROFILE_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {label}
              </a>
            ))}
          </Links>
        </Intro>

        <InterviewJsonLd
          title={t('interviewCardTitle')}
          description={t('interviewCardDescription')}
          sourceName={t('interviewCardSourceName')}
        />
        <Interview
          href={INTERVIEW_LINK}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={INTERVIEW_IMAGE}
            alt={t('interviewCardImageAlt')}
            width={500}
            height={248}
          />
          <div>
            <span>
              {t('featuredInterview')} · {t('interviewCardSourceName')} ·{' '}
              <time dateTime={INTERVIEW_ISO_DATE}>
                {t('interviewCardDate')}
              </time>
            </span>
            <strong>{t('interviewCardTitle')}</strong>
            <span>{t('interviewCardReadMore')} ↗</span>
          </div>
        </Interview>

        <Section>
          <SectionTitle>
            {t('career')}
            <span>
              {formatDuration(
                calculateTotalCareerDuration(careers.map((c) => c.period))
              )}
            </span>
          </SectionTitle>
          {careers.map((career) => {
            const { company, team } = splitCompany(career.company);
            return (
              <Row key={career.company + career.period}>
                <Key>{formatPeriod(career.period)}</Key>
                <Value>
                  {company}
                  <small>
                    {[
                      team,
                      career.position,
                      formatDuration(calculateCareerDuration(career.period)),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </Value>
              </Row>
            );
          })}
        </Section>

        <Section>
          <SectionTitle>{t('projects')}</SectionTitle>
          {projects.map((project) => (
            <Row key={project.name}>
              <Key>{formatPeriod(project.period)}</Key>
              <Value>
                {project.name}
                <small>
                  {project.role} · {project.client}
                </small>
              </Value>
            </Row>
          ))}
        </Section>

        <Section>
          <SectionTitle>{t('education')}</SectionTitle>
          {education.map((edu) => (
            <Row key={edu.school + edu.year}>
              <Key>{edu.year}</Key>
              <Value>
                {edu.school}
                <small>
                  {[edu.major, edu.status].filter(Boolean).join(' · ')}
                </small>
              </Value>
            </Row>
          ))}
          <Row>
            <Key>{formatPeriod(military.period)}</Key>
            <Value>
              {military.service}
              <small>
                {t('military')} · {military.position}
              </small>
            </Value>
          </Row>
        </Section>

        <Section>
          <SectionTitle>{t('certificates')}</SectionTitle>
          <Row>
            <Key />
            <Value>{certificates.join(' · ')}</Value>
          </Row>
        </Section>

        <Section>
          <SectionTitle>{t('skills')}</SectionTitle>
          <Row>
            <Key>{t('expertise')}</Key>
            <Value>{skillsExpert.join(', ')}</Value>
          </Row>
          <Row>
            <Key>{t('languages')}</Key>
            <Value>{skillsLang.join(', ')}</Value>
          </Row>
        </Section>

        <Section>
          <SectionTitle>{t('personalInfo')}</SectionTitle>
          <Row>
            <Key>{t('dateOfBirth')}</Key>
            <Value>
              {t('dateOfBirthValue')} ({new Date().getFullYear() - BIRTH_YEAR}
              {t('age')})
            </Value>
          </Row>
          <Row>
            <Key>{t('residence')}</Key>
            <Value>{t('residenceValue')}</Value>
          </Row>
          <Row>
            <Key>{t('birthplace')}</Key>
            <Value>{t('birthplaceValue')}</Value>
          </Row>
        </Section>

        <Footer>
          <p>{t('copyright')}</p>
          <Link href="/">ICE Forensic</Link>
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">
            {t('privacyPolicy')}
          </Link>
          <SponsorButton />
        </Footer>
      </Content>
    </Page>
  );
};

export default About;
