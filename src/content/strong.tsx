import { Fragment, type ReactNode } from 'react';

/** Like `Rich`, but `*word*` becomes `<strong>word</strong>` — for body text that had bold words inside a sentence. */
export function Strong({ text }: { text: string }): ReactNode {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.length > 2 && part.startsWith('*') && part.endsWith('*') ? <strong key={i}>{part.slice(1, -1)}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}
