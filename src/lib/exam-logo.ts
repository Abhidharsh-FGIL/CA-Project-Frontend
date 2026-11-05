import { isNtpcGroup } from '@/lib/ntpc-level';

/** The emblem of the body that conducts an exam: the Railways for RRB NTPC, the TNPSC's for everything else. */
export function examLogo(groupId?: string | null): { src: string; alt: string } {
  const base = import.meta.env.BASE_URL;
  return isNtpcGroup(groupId) ? { src: `${base}railways-logo.png`, alt: 'Indian Railways' } : { src: `${base}tnpsc-logo.png`, alt: 'TNPSC' };
}
