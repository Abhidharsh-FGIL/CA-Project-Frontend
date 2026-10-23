import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/components/user/UserShell', () => ({
  UserShell: ({ children }: any) => <div>{children}</div>,
  ORANGE_SURFACE: '',
  PANEL_SURFACE: '',
}));
vi.mock('@/contexts/UserPortalContext', () => ({
  useUserPortal: () => ({
    user: { user_id: 'u1', preferred_exam: 'group-4', subscription_tier: 'free' },
    assessments: [],
    history: [],
    isLoading: false,
  }),
  useOptionalUserPortal: () => null,
}));

import UserPerformancePage from '@/pages/user/UserPerformancePage';

describe('the performance page', () => {
  it('draws', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/user/performance']}>
          <UserPerformancePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(html.length).toBeGreaterThan(100);
  });
});
