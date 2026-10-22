import type { ClipboardEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react';

/** The earliest date of birth a date field offers. */
export const EARLIEST_DOB = '1940-01-01';

const openPicker = (input: HTMLInputElement) => {
  try {
    input.showPicker?.();
  } catch {
    /* the browser refused (no user gesture, or no picker) — the native control still works */
  }
};

/**
 * Props that turn a date input into a calendar-only picker: it opens on click, and typing is ignored.
 *
 * Typing into the segments let impossible years such as 0009 or 5678 through. Tab still moves on, and
 * Enter, Space or the Down arrow open the calendar, so the field stays usable from the keyboard.
 */
export const PICK_ONLY = {
  onClick: (e: MouseEvent<HTMLInputElement>) => openPicker(e.currentTarget),
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' || e.key === 'Escape') return;
    e.preventDefault();
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') openPicker(e.currentTarget);
  },
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => e.preventDefault(),
  onDrop: (e: DragEvent<HTMLInputElement>) => e.preventDefault(),
};
