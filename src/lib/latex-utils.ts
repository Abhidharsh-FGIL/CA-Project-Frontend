/**
 * Shared LaTeX utilities for normalizing and stripping math delimiters.
 */

/**
 * Put back the backslash of a LaTeX command that a JSON (or Python) string escape swallowed.
 *
 * A generator that writes "\right" or "\frac" into JSON without doubling the backslash has it read back as an escape:
 * "\r" becomes a carriage return and "ight" is left behind, "\f" a form feed before "rac". KaTeX then sees "\left("
 * with no "\right)" and refuses the whole formula, so the reader gets raw source. A carriage return, form feed,
 * backspace, bell or vertical tab directly before a lowercase letter is never prose (a line ending is "\r\n"), so it
 * is read as the command it was. A tab or newline can be prose, so only before the commands it must have been.
 */
export function repairSwallowedEscapes(content: string): string {
  return content
    .replace(/\r(?=[a-z])/g, '\\r')
    .replace(/\f(?=[a-z])/g, '\\f')
    .replace(/\x08(?=[a-z])/g, '\\b')
    .replace(/\x07(?=[a-z])/g, '\\a')
    .replace(/\v(?=[a-z])/g, '\\v')
    // The escape takes the command's first letter with it: "\times" arrives as a tab and "imes".
    .replace(/\t(?=(?:ext|imes|heta|an|au|frac|riangle|herefore|ilde)\b)/g, '\\t')
    .replace(/\n(?=(?:eq|abla|otin)\b)/g, '\\n');
}

/**
 * Convert LaTeX-style delimiters \(...\) and \[...\] to $...$ and $$...$$
 * that remark-math and KaTeX understand.
 */
export function normalizeLatex(content: string | null | undefined): string {
  if (!content) return '';
  return repairSwallowedEscapes(content)
    // Unescape literal newline / tab / carriage-return escape sequences that arrive
    // as text (double-escaped by the backend, so they render on screen as "\n").
    // Only when NOT followed by a lowercase letter, so real LaTeX commands such as
    // \neq, \nabla, \ne, \ni, \nu, \theta, \times, \to, \rho, \right survive.
    .replace(/\\r(?![a-z])/g, '')
    .replace(/\\n(?![a-z])/g, '\n')
    .replace(/\\t(?![a-z])/g, '\t')
    .replace(/\\\((.+?)\\\)/gs, (_, math) => `$${math}$`)
    .replace(/\\\[(.+?)\\\]/gs, (_, math) => `$$${math}$$`);
}

/**
 * Map of common LaTeX commands to their Unicode equivalents.
 * Used when exporting to formats that cannot render LaTeX (DOCX, PDF, Excel).
 */
const LATEX_TO_UNICODE: [RegExp, string][] = [
  // Greek letters
  [/\\alpha\b/g, 'α'], [/\\beta\b/g, 'β'], [/\\gamma\b/g, 'γ'], [/\\delta\b/g, 'δ'],
  [/\\epsilon\b/g, 'ε'], [/\\zeta\b/g, 'ζ'], [/\\eta\b/g, 'η'], [/\\theta\b/g, 'θ'],
  [/\\iota\b/g, 'ι'], [/\\kappa\b/g, 'κ'], [/\\lambda\b/g, 'λ'], [/\\mu\b/g, 'μ'],
  [/\\nu\b/g, 'ν'], [/\\xi\b/g, 'ξ'], [/\\pi\b/g, 'π'], [/\\rho\b/g, 'ρ'],
  [/\\sigma\b/g, 'σ'], [/\\tau\b/g, 'τ'], [/\\upsilon\b/g, 'υ'], [/\\phi\b/g, 'φ'],
  [/\\chi\b/g, 'χ'], [/\\psi\b/g, 'ψ'], [/\\omega\b/g, 'ω'],
  [/\\Gamma\b/g, 'Γ'], [/\\Delta\b/g, 'Δ'], [/\\Theta\b/g, 'Θ'], [/\\Lambda\b/g, 'Λ'],
  [/\\Pi\b/g, 'Π'], [/\\Sigma\b/g, 'Σ'], [/\\Phi\b/g, 'Φ'], [/\\Psi\b/g, 'Ψ'], [/\\Omega\b/g, 'Ω'],
  // Logic operators
  [/\\neg\b/g, '¬'], [/\\lnot\b/g, '¬'],
  [/\\land\b/g, '∧'], [/\\wedge\b/g, '∧'],
  [/\\lor\b/g, '∨'], [/\\vee\b/g, '∨'],
  [/\\oplus\b/g, '⊕'],
  [/\\rightarrow\b/g, '→'], [/\\to\b/g, '→'], [/\\Rightarrow\b/g, '⇒'], [/\\implies\b/g, '⇒'],
  [/\\leftarrow\b/g, '←'], [/\\Leftarrow\b/g, '⇐'],
  [/\\leftrightarrow\b/g, '↔'], [/\\Leftrightarrow\b/g, '⇔'], [/\\iff\b/g, '⇔'],
  [/\\forall\b/g, '∀'], [/\\exists\b/g, '∃'],
  // Set / relational operators
  [/\\in\b/g, '∈'], [/\\notin\b/g, '∉'], [/\\subset\b/g, '⊂'], [/\\subseteq\b/g, '⊆'],
  [/\\supset\b/g, '⊃'], [/\\supseteq\b/g, '⊇'], [/\\cup\b/g, '∪'], [/\\cap\b/g, '∩'],
  [/\\emptyset\b/g, '∅'], [/\\varnothing\b/g, '∅'],
  // Comparison
  [/\\neq?\b/g, '≠'], [/\\leq?\b/g, '≤'], [/\\geq?\b/g, '≥'],
  [/\\approx\b/g, '≈'], [/\\equiv\b/g, '≡'], [/\\sim\b/g, '∼'],
  [/\\ll\b/g, '≪'], [/\\gg\b/g, '≫'],
  // Arithmetic / calculus
  [/\\times\b/g, '×'], [/\\div\b/g, '÷'], [/\\cdot\b/g, '·'], [/\\pm\b/g, '±'], [/\\mp\b/g, '∓'],
  [/\\sqrt\{([^}]+)\}/g, '√($1)'], [/\\sqrt\b/g, '√'],
  [/\\int\b/g, '∫'], [/\\sum\b/g, '∑'], [/\\prod\b/g, '∏'],
  [/\\partial\b/g, '∂'], [/\\nabla\b/g, '∇'], [/\\infty\b/g, '∞'],
  // Fractions: \frac{a}{b} → (a)/(b)
  [/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)'],
  // Superscript / subscript: keep caret/underscore, strip braces
  [/\^{([^}]+)}/g, '^($1)'], [/_{([^}]+)}/g, '_($1)'],
  // Misc
  [/\\cdots\b/g, '⋯'], [/\\ldots\b/g, '…'], [/\\dots\b/g, '…'],
  [/\\circ\b/g, '°'], [/\\degree\b/g, '°'],
  [/\\perp\b/g, '⊥'], [/\\parallel\b/g, '∥'], [/\\angle\b/g, '∠'], [/\\triangle\b/g, '△'],
  [/\\therefore\b/g, '∴'], [/\\because\b/g, '∵'],
  // Clean up remaining braces from \text{...} or {groups}
  [/\\text\{([^}]+)\}/g, '$1'],
  [/\\mathrm\{([^}]+)\}/g, '$1'],
  [/\\mathbf\{([^}]+)\}/g, '$1'],
  [/\\textbf\{([^}]+)\}/g, '$1'],
  [/\\left\b/g, ''], [/\\right\b/g, ''],
  [/\\,/g, ' '], [/\\;/g, ' '], [/\\!/g, ''], [/\\quad\b/g, '  '], [/\\qquad\b/g, '    '],
];

/**
 * Strip LaTeX delimiters and convert LaTeX commands to readable Unicode text.
 * Used in export scenarios (DOCX, PDF, Excel) where KaTeX rendering is not available.
 *
 * Example: "$x^2 + y^2 = z^2$" → "x^2 + y^2 = z^2"
 * Example: "p \land q" → "p ∧ q"
 * Example: "\neg p \lor q" → "¬p ∨ q"
 */
export function stripLatexDelimiters(text: string): string {
  // First normalize \(...\) and \[...\] to $ form
  let result = normalizeLatex(text);
  // Strip display math $$...$$ (must come before inline)
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => math.trim());
  // Strip inline math $...$
  result = result.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_, math) => math.trim());
  // Convert LaTeX commands to Unicode
  for (const [pattern, replacement] of LATEX_TO_UNICODE) {
    result = result.replace(pattern, replacement);
  }
  // Clean up leftover curly braces (from things like {x} → x)
  result = result.replace(/\{([^}]*)\}/g, '$1');
  return result;
}
