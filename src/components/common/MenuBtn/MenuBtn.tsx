import styled, { css } from 'styled-components';
import Tooltip from '@/components/common/Tooltip/Tooltip';
import { Link } from '@/locales/routing';

interface Props {
  onClick: () => void;
  text: string;
  disabled?: boolean;
  disabledTxt?: string;
}

const MenuBtn: React.FC<Props> = ({
  onClick,
  text,
  disabled = false,
  disabledTxt,
}) => {
  const button = (
    <Btn onClick={onClick} disabled={disabled}>
      {text}
    </Btn>
  );

  return disabled && disabledTxt ? (
    <Tooltip text={disabledTxt}>{button}</Tooltip>
  ) : (
    button
  );
};

const menuItemStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;

  padding: 5px;
  border-radius: 4px;

  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  color: var(--main-color);

  transition: all 0.15s ease;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--ice-main-color);
    background-color: var(--main-hover-color);
  }

  &:active {
    opacity: 0.8;
  }
`;

const Btn = styled.button.attrs({ type: 'button' })`
  ${menuItemStyle}
  border: none;
  background: none;
  font-family: inherit;

  &:disabled {
    color: var(--main-disabled-color);
    background: none;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

/** 페이지 이동 메뉴 (버튼과 같은 모양의 링크) */
export const MenuLink = styled(Link)`
  ${menuItemStyle}
  text-decoration: none;
`;

export default MenuBtn;
