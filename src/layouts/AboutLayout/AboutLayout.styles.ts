import styled from 'styled-components';

const MOBILE = '@media (max-width: 640px)';

export const Page = styled.div`
  min-height: 100dvh;
  background: var(--main-bg-color);
  color: var(--main-color);
  text-align: left;
  word-break: keep-all;
  overflow-wrap: break-word;

  a {
    color: var(--ice-main-color);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

export const Content = styled.main`
  max-width: 680px;
  margin: 0 auto;
  padding: 64px 24px 48px;

  ${MOBILE} {
    padding: 40px 16px 32px;
  }
`;

/* 로고 아스키 아트 + 언어 선택 */
export const IntroTop = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  button {
    padding: 1px 6px;
  }

  ${MOBILE} {
    flex-direction: column-reverse;
    align-items: flex-end;

    > :first-child {
      align-self: flex-start;
    }
  }
`;

export const Intro = styled.section`
  margin-bottom: 40px;

  h1 {
    margin: 32px 0 0;
    font-size: 1.25rem;
    font-weight: 700;
  }

  p {
    margin: 0;
  }
`;

export const Role = styled.p`
  margin-top: 2px !important;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ice-main-color);
`;

export const Bio = styled.p`
  margin-top: 16px !important;
  font-size: 0.9rem;
  line-height: 1.7;
`;

export const Links = styled.p`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 12px !important;
  font-size: 0.85rem;
`;

/* 인터뷰: 썸네일 + 제목 한 줄 */
export const Interview = styled.a`
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 16px;
  align-items: center;
  margin-bottom: 48px;
  padding: 12px;
  border: 1px solid var(--main-line-color);
  border-radius: 6px;
  font-size: 0.8rem;
  line-height: 1.5;
  transition: border-color 0.15s ease;

  && {
    color: var(--main-color);
    text-decoration: none;
  }

  &:hover {
    border-color: var(--ice-main-color);
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 3px;
  }

  strong {
    display: block;
    margin-top: 2px;
    font-size: 0.85rem;
  }

  span {
    color: var(--ice-main-color);
  }

  ${MOBILE} {
    grid-template-columns: 96px 1fr;
    gap: 12px;
    padding: 10px;
  }
`;

export const Section = styled.section`
  margin-bottom: 36px;
`;

/* 섹션 제목: 글자 + 얇은 선 */
export const SectionTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 0.8rem;
  font-weight: 700;

  span {
    font-weight: 400;
    color: var(--ice-main-color);
  }

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--main-line-color);
  }
`;

/* "기간 | 내용" 행 */
export const Row = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 12px;
  font-size: 0.85rem;
  line-height: 1.5;

  & + & {
    margin-top: 10px;
  }

  ${MOBILE} {
    grid-template-columns: 1fr;
    gap: 0;
  }
`;

export const Key = styled.div`
  color: var(--main-color-reverse);
  font-variant-numeric: tabular-nums;
`;

export const Value = styled.div`
  small {
    display: block;
    font-size: 0.8rem;
    color: var(--main-color-reverse);
  }
`;

export const Footer = styled.footer`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-top: 56px;
  padding-top: 16px;
  border-top: 1px solid var(--main-line-color);
  font-size: 0.75rem;
  color: var(--main-color-reverse);

  p {
    margin: 0;
  }
`;
