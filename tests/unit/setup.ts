// jsdom 환경 테스트에서 toBeInTheDocument 등 DOM matcher 사용
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
