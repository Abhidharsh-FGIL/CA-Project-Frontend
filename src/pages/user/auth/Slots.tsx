import { Fragment, type ReactNode } from 'react';

/**
 * Editable text with parts that are markup, not words: `{email}` becomes the node given for `email`
 * (a bold address, a link). Text that is not a known slot is shown as typed.
 */
export function Slots({ text, slots }: { text: string; slots: Record<string, ReactNode> }) {
  return (
    <>
      {text.split(/(\{\w+\})/g).map((part, i) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        return <Fragment key={i}>{name && name in slots ? slots[name] : part}</Fragment>;
      })}
    </>
  );
}
