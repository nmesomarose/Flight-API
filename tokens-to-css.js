/**
 * tokens-to-css.js
 * =================
 * Converts a Figma design tokens JSON export into CSS custom properties.
 *
 * Input:  design-tokens.tokens.json  (Figma Variables export)
 * Output: css/ directory containing:
 *   - primitives.css   — Raw colour palettes (foundation values, NOT for direct UI use)
 *   - roles.css        — Semantic colour roles (the tokens UI components should reference)
 *   - spacing.css      — Spacing scale
 *   - typography.css   — Typography presets (each style maps to shorthand properties)
 *   - effects.css      — Shadow definitions
 *   - tokens.css       — Master file that @import's all of the above in the correct order
 *
 * Colour architecture
 * -------------------
 * The design system separates colour into two layers:
 *
 *   PRIMITIVE COLOURS  ("primitive colour collection")
 *     These are the raw palette foundations — hue ramps, key colours, and shade
 *     scales (0-100). They must never be applied directly to UI elements. They
 *     exist solely as the building blocks that colour roles reference.
 *
 *   COLOUR ROLES  ("colour roles")
 *     These are the semantic, intent-driven tokens that SHOULD be applied in UI.
 *     Each role maps (via a Figma reference like "{primitive colour collection
 *     .primary colour palette.primary 40}") to exactly one primitive swatch.
 *     Component code consumes *these* tokens, never primitives directly.
 *
 * This separation means you can re-skin the entire UI by re-pointing the role
 * tokens to different primitive swatches — no component code needs to change.
 *
 * Usage
 * -----
 *   node tokens-to-css.js
 *
 * The script uses only Node built-ins (fs, path). No external dependencies.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Path to the Figma-exported tokens JSON file (relative to this script). */
const INPUT_PATH = path.join(__dirname, "design-tokens.tokens.json");

/** Directory where generated CSS files are written. */
const OUTPUT_DIR = path.join(__dirname, "css");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a raw hex colour string (e.g. "#2215d6ff") to a CSS-friendly value.
 * - If the colour is fully opaque (alpha = "ff"), the alpha channel is stripped
 *   so the output is a simple `#rrggbb` (shorter, widely supported).
 * - Semi-transparent colours keep their 8-digit hex form (`#rrggbbaa`).
 *
 * @param  {string} hex  — Colour value from the tokens file.
 * @return {string}      — Cleaned hex string usable in CSS.
 */
function hexToCSS(hex) {
  if (typeof hex !== "string") return hex;
  // Strip any leading "0x" or trailing colour-space identifiers if present.
  let clean = hex.trim().toLowerCase();
  // If 8-char hex and last two chars are "ff" (fully opaque), drop alpha.
  if (/^#[0-9a-f]{8}$/.test(clean) && clean.slice(7) === "ff") {
    return clean.slice(0, 7);
  }
  return clean;
}

/**
 * Turn a human-readable token name into a valid CSS custom-property suffix.
 *
 * Rules applied:
 *   - Trim whitespace.
 *   - Collapse internal whitespace / multiple spaces to a single hyphen.
 *   - Replace non-alphanumeric characters (except hyphens) with hyphens.
 *   - Collapse consecutive hyphens.
 *   - Lower-case the result.
 *
 * Examples:
 *   "display large"       → "display-large"
 *   "primary key colour"  → "primary-key-colour"
 *   "on primary"          → "on-primary"
 *   "no spacing"          → "no-spacing"
 *
 * @param  {string} name
 * @return {string}
 */
function toKebabCase(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")   // non-alnum → hyphen
    .replace(/-+/g, "-")            // collapse runs
    .replace(/^-|-$/g, "");         // trim leading/trailing hyphens
}

/**
 * Flatten a nested token group into a flat array of { name, token } entries.
 *
 * Tokens that represent composite values (like typography, which has sub-keys
 * such as fontSize, fontWeight, etc.) are treated as a single leaf — they are
 * NOT recursed into at this stage; their sub-keys are handled by specialised
 * formatters later.
 *
 * @param  {object}  group       — Nested token object.
 * @param  {string}  prefix      — Accumulated kebab-case prefix (path segments joined by hyphens).
 * @param  {string}  separator   — The segment separator applied *between* prefix and current name.
 * @return {Array<{ name: string, token: object }>}
 */
function flattenTokens(group, prefix = "", separator = "-") {
  const results = [];

  for (const [key, value] of Object.entries(group)) {
    if (value === null || value === undefined) continue;

    const currentName = prefix ? `${prefix}${separator}${toKebabCase(key)}` : toKebabCase(key);

    // A token is a "leaf" if it has a `type` and `value` at the top level,
    // OR if it's a composite token (e.g. typography) whose children each
    // have `type` and `value`.
    const isLeaf =
      typeof value === "object" && value !== null && !Array.isArray(value) && "type" in value;

    const isComposite =
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.values(value).some(
        (v) => typeof v === "object" && v !== null && "type" in v && "value" in v
      );

    if (isLeaf || isComposite) {
      results.push({ name: currentName, token: value });
    } else if (typeof value === "object") {
      // Recurse into sub-groups (e.g. "primary colour palette" → individual swatches).
      results.push(...flattenTokens(value, currentName));
    }
    // Primitive values (numbers, strings) that don't match the token schema are
    // silently skipped — they shouldn't appear in well-formed token files.
  }

  return results;
}

// ---------------------------------------------------------------------------
// Reference resolver
// ---------------------------------------------------------------------------

/**
 * Build a flat lookup map from token path → resolved hex value.
 *
 * Figma token exports reference other tokens using the syntax:
 *   "{primitive colour collection.primary colour palette.primary 40}"
 *
 * This function flattens every colour token in the file into a map keyed by
 * the braced reference string, so we can resolve role→primitive links in O(1).
 *
 * @param  {object} tokens — The full design-tokens JSON.
 * @return {Map<string, string>} — Reference string → hex value.
 */
function buildReferenceMap(tokens) {
  const map = new Map();

  function walk(obj, pathParts) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (typeof value === "object" && "type" in value && "value" in value) {
        if (value.type === "color" && typeof value.value === "string") {
          const refKey = `{${pathParts.join(".")}.${key}}`;
          map.set(refKey, value.value);
        }
      } else if (typeof value === "object") {
        walk(value, [...pathParts, key]);
      }
    }
  }

  walk(tokens, []);
  return map;
}

/**
 * Resolve a token's `value` field, replacing any `{...}` references with the
 * actual hex value from the reference map.
 *
 * @param  {string}              value — Raw token value (may contain references).
 * @param  {Map<string,string>}  refMap — Reference lookup map.
 * @return {string}                     — Fully resolved value.
 */
function resolveReference(value, refMap) {
  if (typeof value !== "string") return value;

  // Replace all occurrences of {path.to.token} with the resolved hex.
  return value.replace(/\{([^}]+)\}/g, (match, refPath) => {
    const resolved = refMap.get(match);
    if (resolved) return resolved;
    // If we can't resolve it, keep the original reference string so the
    // problem is visible in the output rather than silently producing a
    // broken value.
    console.warn(`  ⚠  Unresolved reference: ${match}`);
    return match;
  });
}

// ---------------------------------------------------------------------------
// CSS generation helpers
// ---------------------------------------------------------------------------

/**
 * Convert a "shadow" type token's value object into a CSS box-shadow string.
 *
 * @param  {object} shadow — Token value with shadowType, radius, color, offsetX, offsetY, spread.
 * @return {string}        — CSS shadow shorthand, e.g. "drop-shadow(4px 6px 8px #00000052)".
 */
function shadowToCSS(shadow) {
  if (typeof shadow !== "object" || shadow === null) return "none";

  const { shadowType, radius, color, offsetX, offsetY, spread } = shadow;
  const cssColor = hexToCSS(color);

  if (shadowType === "dropShadow") {
    return `drop-shadow(${offsetX}px ${offsetY}px ${radius}px ${cssColor})`;
  }

  // Fallback for inset or other shadow types (not expected in this file, but
  // handled defensively).
  return `${offsetX}px ${offsetY}px ${radius}px ${spread}px ${cssColor}`;
}

/**
 * Convert a typography composite token into individual CSS custom-property
 * lines for each sub-property.
 *
 * @param  {string} prefix — CSS variable prefix (e.g. "display-large").
 * @param  {object} token  — Composite token with sub-keys like fontSize, fontFamily, etc.
 * @return {string}        — Multi-line string of CSS custom-property declarations.
 */
function typographyToCSS(prefix, token) {
  const lines = [];

  const mapping = {
    fontSize:        (v) => `${v}px`,
    fontFamily:      (v) => v,
    fontWeight:      (v) => v,
    fontStyle:       (v) => v,
    fontStretch:     (v) => v,
    letterSpacing:   (v) => `${v}px`,
    lineHeight:      (v) => `${v}px`,
    textDecoration:  (v) => v,
    textCase:        (v) => v === "none" ? "normal" : v,
    paragraphIndent:  (v) => `${v}px`,
    paragraphSpacing: (v) => `${v}px`,
  };

  for (const [prop, formatter] of Object.entries(mapping)) {
    if (token[prop] && token[prop].value !== undefined) {
      lines.push(`  --${prefix}-${toKebabCase(prop)}: ${formatter(token[prop].value)};`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------

/**
 * Read the tokens file, resolve all references, and write out the CSS files.
 */
function convert() {
  // --- Read & parse input ------------------------------------------------
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Input file not found: ${INPUT_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT_PATH, "utf-8");
  const tokens = JSON.parse(raw);

  // --- Create output directory -------------------------------------------
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // --- Build reference map for resolving role → primitive links -----------
  const refMap = buildReferenceMap(tokens);

  // ====================================================================
  // 1. PRIMITIVE COLOURS  (foundation palettes — not for direct UI use)
  // ====================================================================
  const primitiveSections = [
    "key colour group",
    "primary colour palette",
    "secondary colour palette",
    "tertiary colour palette",
    "neutral colour palette",
    "neutral variant colour palette",
    "error colour palette",
  ];

  let primitivesCSS = [
    "/* ========================================================================= */",
    "/* design-tokens.tokens.json — PRIMITIVE COLOUR PALETTES                      */",
    "/* ========================================================================= */",
    "/*                                                                            */",
    "/* These are the FOUNDATION colour values of the design system.               */",
    "/*                                                                            */",
    "/* IMPORTANT: Primitive colours must NOT be applied directly to UI elements.  */",
    "/* They exist solely as the raw palette from which COLOUR ROLES (semantic     */",
    "/* tokens) are derived. Always consume the corresponding --role-* variable    */",
    "/* in your component styles instead of these.                                 */",
    "/*                                                                            */",
    "/* To re-skin the UI, re-point the role tokens in roles.css to different      */",
    "/* primitive swatches — no component code needs to change.                    */",
    "/* ========================================================================= */",
    "",
    ":root {",
    "",
  ];

  for (const sectionName of primitiveSections) {
    const section = tokens["primitive colour collection"]?.[sectionName];
    if (!section) continue;

    primitivesCSS.push(`  /* --- ${sectionName.toUpperCase()} --- */`);

    const flat = flattenTokens(section);
    // Sort by numeric portion so "primary 0", "primary 10", … appear in order.
    flat.sort((a, b) => {
      const numA = parseInt(a.name.match(/(\d+)$/)?.[1] ?? "0", 10);
      const numB = parseInt(b.name.match(/(\d+)$/)?.[1] ?? "0", 10);
      return numA - numB || a.name.localeCompare(b.name);
    });

    for (const { name, token } of flat) {
      if (token.type === "color" && typeof token.value === "string") {
        primitivesCSS.push(`  --primitive-${name}: ${hexToCSS(token.value)};`);
      }
    }

    primitivesCSS.push("");
  }

  primitivesCSS.push("}");
  primitivesCSS.push("");

  fs.writeFileSync(path.join(OUTPUT_DIR, "primitives.css"), primitivesCSS.join("\n"), "utf-8");
  console.log("✓  css/primitives.css");

  // ====================================================================
  // 2. COLOUR ROLES  (semantic tokens — USE THESE in components)
  // ====================================================================
  const roles = tokens["colour roles"];

  let rolesCSS = [
    "/* ========================================================================= */",
    "/* design-tokens.tokens.json — COLOUR ROLES (Semantic Tokens)                 */",
    "/* ========================================================================= */",
    "/*                                                                            */",
    "/* These are the SEMANTIC colour tokens that SHOULD be used in UI components. */",
    "/* Each role expresses an *intent* (e.g. primary, on-primary, error role)    */",
    "/* and maps to exactly one primitive swatch under the hood.                   */",
    "/*                                                                            */",
    "/* To re-skin the application, change the values in this file to point at     */",
    "/* different primitive swatches. Component code never needs to change.        */",
    "/* ========================================================================= */",
    "",
    ":root {",
    "",
  ];

  if (roles) {
    const flat = flattenTokens(roles);
    for (const { name, token } of flat) {
      if (token.type === "color" && typeof token.value === "string") {
        const resolved = resolveReference(token.value, refMap);
        rolesCSS.push(`  --color-${name}: ${hexToCSS(resolved)};`);
      }
    }
  }

  rolesCSS.push("}");
  rolesCSS.push("");

  fs.writeFileSync(path.join(OUTPUT_DIR, "roles.css"), rolesCSS.join("\n"), "utf-8");
  console.log("✓  css/roles.css");

  // ====================================================================
  // 3. SPACING
  // ====================================================================
  const spacing = tokens["spacing collection"];

  let spacingCSS = [
    "/* ========================================================================= */",
    "/* design-tokens.tokens.json — SPACING SCALE                                 */",
    "/* ========================================================================= */",
    "",
    ":root {",
    "",
  ];

  if (spacing) {
    const flat = flattenTokens(spacing);
    for (const { name, token } of flat) {
      if (token.type === "dimension" && typeof token.value === "number") {
        spacingCSS.push(`  --spacing-${name}: ${token.value}px;`);
      }
    }
  }

  spacingCSS.push("}");
  spacingCSS.push("");

  fs.writeFileSync(path.join(OUTPUT_DIR, "spacing.css"), spacingCSS.join("\n"), "utf-8");
  console.log("✓  css/spacing.css");

  // ====================================================================
  // 4. TYPOGRAPHY
  // ====================================================================
  const typography = tokens["typography"];

  let typoCSS = [
    "/* ========================================================================= */",
    "/* design-tokens.tokens.json — TYPOGRAPHY PRESETS                             */",
    "/* ========================================================================= */",
    "/*                                                                            */",
    "/* Each typography style exposes its sub-properties as individual CSS         */",
    "/* custom properties so you can compose styles as needed, or consume the     */",
    "/* individual properties directly.                                            */",
    "/* ========================================================================= */",
    "",
    ":root {",
    "",
  ];

  if (typography) {
    const flat = flattenTokens(typography);
    for (const { name, token } of flat) {
      // Composite typography tokens have sub-keys with type/value instead of
      // a top-level type/value.
      const isComposite =
        typeof token === "object" &&
        token !== null &&
        Object.values(token).some(
          (v) => typeof v === "object" && v !== null && "type" in v && "value" in v
        );

      if (isComposite) {
        typoCSS.push(`  /* --- ${name.toUpperCase()} --- */`);
        typoCSS.push(typographyToCSS(name, token));
        typoCSS.push("");
      }
    }
  }

  typoCSS.push("}");
  typoCSS.push("");

  fs.writeFileSync(path.join(OUTPUT_DIR, "typography.css"), typoCSS.join("\n"), "utf-8");
  console.log("✓  css/typography.css");

  // ====================================================================
  // 5. EFFECTS (Shadows)
  // ====================================================================
  const effects = tokens["effect"];

  let effectsCSS = [
    "/* ========================================================================= */",
    "/* design-tokens.tokens.json — EFFECTS (Shadows)                              */",
    "/* ========================================================================= */",
    "",
    ":root {",
    "",
  ];

  if (effects) {
    const flat = flattenTokens(effects);
    for (const { name, token } of flat) {
      if (token.type === "custom-shadow" && typeof token.value === "object") {
        effectsCSS.push(`  --effect-${name}: ${shadowToCSS(token.value)};`);
      }
    }
  }

  effectsCSS.push("}");
  effectsCSS.push("");

  fs.writeFileSync(path.join(OUTPUT_DIR, "effects.css"), effectsCSS.join("\n"), "utf-8");
  console.log("✓  css/effects.css");

  // ====================================================================
  // 6. MASTER FILE  (single import entry-point)
  // ====================================================================
  const masterCSS = [
    "/* ========================================================================= */",
    "/* design-tokens — Master CSS Custom Properties                               */",
    "/* ========================================================================= */",
    "/*                                                                            */",
    "/* This file imports all token categories in the correct dependency order:    */",
    "/*                                                                            */",
    "/*   1. Primitives  — Raw palettes (reference only; never apply directly)     */",
    "/*   2. Roles       — Semantic tokens (consume these in components)           */",
    "/*   3. Spacing     — Layout spacing scale                                    */",
    "/*   4. Typography  — Text style presets                                      */",
    "/*   5. Effects     — Shadows                                                 */",
    "/*                                                                            */",
    "/* Usage in your project:                                                     */",
    '/*   <link rel="stylesheet" href="css/tokens.css">                            */',
    "/*                                                                            */",
    "/* Or in a CSS file:                                                          */",
    "/*   @import url('css/tokens.css');                                           */",
    "/* ========================================================================= */",
    "",
    '@import url("primitives.css");',
    '@import url("roles.css");',
    '@import url("spacing.css");',
    '@import url("typography.css");',
    '@import url("effects.css");',
    "",
  ];

  fs.writeFileSync(path.join(OUTPUT_DIR, "tokens.css"), masterCSS.join("\n"), "utf-8");
  console.log("✓  css/tokens.css");

  // --- Summary ------------------------------------------------------------
  console.log("");
  console.log(`All CSS files written to ${OUTPUT_DIR}`);
  console.log("Done.");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
convert();
