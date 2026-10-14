/**
 * The product's logo, in three forms — the mark, the full lockup and the name set in type.
 *
 * Every place that shows the brand takes it from here, so changing the logo is a change to the
 * files in `public/` (`logo-mark.png`, `logo-full.png`, `favicon.png`, `favicon.ico`) and to the
 * colours below. The pictures have a transparent background; the mark's blue cap disappears into
 * a dark surface, so on the navy bars it sits on a white tile (`LogoTile`).
 */
import { cn } from '@/lib/utils';

/** The logo's colours, sampled from the artwork itself: the wordmark blue, the book blue and the orange. */
export const BRAND_COLOURS = { blue: '#04459a', sky: '#006bc1', orange: '#f4701c' } as const;

const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`;

/** The book-and-cap mark on its own. Decorative — the name beside it says what it is. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src={asset('logo-mark.png')}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('block select-none object-contain', className)}
    />
  );
}

/** The mark and the name side by side, as supplied — one picture, so the lettering is the designer's own. */
export function LogoFull({ className, alt = 'MyGovExams' }: { className?: string; alt?: string }) {
  return <img src={asset('logo-full.png')} alt={alt} draggable={false} className={cn('block select-none object-contain', className)} />;
}

/**
 * The mark on a white rounded tile — for dark surfaces, where its navy cap would vanish.
 * Size it with `className` (`h-9 w-9`); the mark fills the tile less its padding.
 */
export function LogoTile({ className }: { className?: string }) {
  return (
    <span className={cn('flex flex-shrink-0 items-center justify-center rounded-xl bg-white p-1', className)}>
      <LogoMark className="h-full w-full" />
    </span>
  );
}

/**
 * "MyGovExams" in the logo's colours — blue, orange, blue. `onDark` sets it all in white for the
 * navy bars; otherwise each part lightens a little in dark mode so the blue is never lost on a
 * dark surface.
 */
export function Wordmark({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <span className={cn('font-extrabold tracking-tight', onDark && 'text-white', className)}>
      <span className={onDark ? undefined : 'text-[#04459a] dark:text-white'}>My</span>
      <span className={onDark ? undefined : 'text-[#f4701c] dark:text-[#ff9a4d]'}>Gov</span>
      <span className={onDark ? undefined : 'text-[#04459a] dark:text-[#6aa8ff]'}>Exams</span>
    </span>
  );
}
