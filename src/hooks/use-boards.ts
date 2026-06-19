import { BOARDS as ALL_BOARDS } from '@/constants';

/**
 * Returns the full boards list.
 * The /api/v1/organizations endpoint does not exist on this backend,
 * so org-level board filtering is not applied.
 */
export function useAllowedBoards(): readonly string[] {
  return ALL_BOARDS;
}
