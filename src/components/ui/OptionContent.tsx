import { MathText } from '@/components/ui/MathText';
import { buildUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * An answer option's body: its text, and its picture under it. An option may have either or both — a figure with a label
 * ("Figure A"), a sum with a diagram — so neither hides the other.
 */
export function OptionContent({
  text,
  imageUrl,
  alt,
  textClassName,
  imageClassName,
}: {
  text?: string | null;
  imageUrl?: string | null;
  alt: string;
  textClassName?: string;
  imageClassName?: string;
}) {
  const hasText = !!text && text.trim() !== '';
  return (
    <>
      {hasText && (
        <span className={cn('block', textClassName)}>
          <MathText text={text!} />
        </span>
      )}
      {imageUrl && (
        <img
          src={buildUrl(imageUrl)}
          alt={alt}
          className={cn(hasText && 'mt-1.5', 'max-h-32 rounded border border-gray-200 object-contain dark:border-gray-700', imageClassName)}
        />
      )}
    </>
  );
}
