/**
 * The file name a server asks a download to be saved under, from its `Content-Disposition` header.
 *
 * `filename*=UTF-8''…` (percent-encoded, so a Tamil name survives) is preferred over the plain
 * `filename="…"`. Null when the header says neither, so the caller can name the file itself.
 *
 * A browser only lets a page read this header when the server lists it in
 * `Access-Control-Expose-Headers`; without that it is simply absent and this returns null.
 */
export function filenameFromDisposition(header: string | null | undefined): string | null {
  if (!header) return null;

  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      const name = decodeURIComponent(encoded[1].trim());
      if (name) return name;
    } catch {
      // A malformed escape: fall through to the plain name.
    }
  }

  const plain = /filename\s*=\s*"([^"]+)"/i.exec(header) ?? /filename\s*=\s*([^;\s]+)/i.exec(header);
  return plain ? plain[1].trim() || null : null;
}
