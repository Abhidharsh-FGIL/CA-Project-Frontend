import type { ContentField, ContentGroup } from './define';
import { landing } from './landing';
import { auth } from './auth';
import { dashboard } from './dashboard';
import { practice } from './practice';
import { assessment } from './assessment';
import { reports } from './reports';
import { account } from './account';

/** Every group of editable text, in the order the admin screen lists them. */
export const CONTENT_GROUPS: ContentGroup[] = [landing, auth, dashboard, practice, assessment, reports, account];

type KeysOf<G> = G extends { fields: infer F } ? keyof F & string : never;
/** Every key that can be read — a typo in `t('…')` is a compile error. */
export type ContentKey =
  | KeysOf<typeof landing>
  | KeysOf<typeof auth>
  | KeysOf<typeof dashboard>
  | KeysOf<typeof practice>
  | KeysOf<typeof assessment>
  | KeysOf<typeof reports>
  | KeysOf<typeof account>;

/** key → field, across every group. */
export const CONTENT_FIELDS: Record<string, ContentField> = Object.assign({}, ...CONTENT_GROUPS.map(g => g.fields));
