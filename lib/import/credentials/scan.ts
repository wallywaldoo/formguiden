/**
 * Content-based rejection of credential, identity, and executable material.
 *
 * Filenames never drive a decision here; every probe reads bytes. A match
 * rejects the whole upload rather than the single entry that matched, because
 * an archive carrying one credential file is not a trustworthy archive.
 *
 * Findings carry a category code only. The matched value, the JSON key path,
 * and any file content must never reach a message, a log, or the database.
 * See docs/security-model.md §8.2 and §8.4.
 */

export const CREDENTIAL_REJECTION_CODES = [
  "credential_material_detected",
  "identity_material_detected",
  "executable_content_detected",
  "diagnostic_material_detected",
] as const;

export type CredentialRejectionCode =
  (typeof CREDENTIAL_REJECTION_CODES)[number];

export type CredentialFinding = {
  code: CredentialRejectionCode;
  message: string;
};

const MESSAGES: Record<CredentialRejectionCode, string> = {
  credential_material_detected:
    "Filen innehåller inloggningsuppgifter eller sessionsdata. Formkurvan tar aldrig emot ditt Garmin-lösenord. Ladda upp endast din garmin.db.",
  identity_material_detected:
    "Filen innehåller kontouppgifter från Garmin Connect. Ladda upp endast din garmin.db.",
  executable_content_detected:
    "Filen innehåller körbar kod och kan inte importeras.",
  diagnostic_material_detected:
    "Filen är en logg- eller felsökningsfil. Ladda upp endast din garmin.db.",
};

/**
 * Text credential files are small. Scanning a full 25 MiB binary for
 * substrings costs more than it catches, so large inputs are sampled at both
 * ends. A SQLite payload is additionally constrained by the schema and column
 * allowlist in lib/import/garmindb, which is the real control for that path.
 */
const FULL_SCAN_LIMIT_BYTES = 1024 * 1024;
const EDGE_WINDOW_BYTES = 512 * 1024;

const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_JSON_NODES = 50_000;
const MAX_JSON_DEPTH = 64;

const EXECUTABLE_SIGNATURES: readonly (readonly number[])[] = [
  [0x4d, 0x5a], // DOS/PE
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0xfe, 0xed, 0xfa, 0xce], // Mach-O 32 BE
  [0xfe, 0xed, 0xfa, 0xcf], // Mach-O 64 BE
  [0xce, 0xfa, 0xed, 0xfe], // Mach-O 32 LE
  [0xcf, 0xfa, 0xed, 0xfe], // Mach-O 64 LE
  [0xca, 0xfe, 0xba, 0xbe], // Mach-O fat / Java class
  [0xbe, 0xba, 0xfe, 0xca], // Mach-O fat swapped
  [0x00, 0x61, 0x73, 0x6d], // WebAssembly
  [0x23, 0x21], // #! shebang
];

/**
 * High-signal literals checked against raw bytes, so they still fire inside
 * binary containers. Each one is specific enough that a legitimate FIT, TCX,
 * GPX, CSV, or GarminDB SQLite payload will not contain it.
 */
const CREDENTIAL_LITERALS: readonly string[] = [
  "secure_password",
  "password_file",
  "access_token",
  "refresh_token",
  "oauth_token",
  "oauth1_token",
  "oauth2_token",
  "garminconnectconfig",
  "private key-----",
  "set-cookie:",
  "garmin-sso",
  "sessionid=",
];

const IDENTITY_LITERALS: readonly string[] = [
  "userprofileid",
  "garminguid",
  "profileimageurllarge",
  "profileimageurlmedium",
  "profileimageurlsmall",
];

const DIAGNOSTIC_LITERALS: readonly string[] = [
  "garmindb.log",
  "root : debug",
  "traceback (most recent call last)",
];

const CREDENTIAL_KEY_PATTERN =
  /^(password|passwd|pwd|secure_password|password_file|secret|client_secret|token|access_token|refresh_token|id_token|oauth_token|oauth|session|session_id|sessionid|cookie|cookies|authorization|auth_token|api_key|apikey|private_key)$/i;

const IDENTITY_KEY_PATTERN =
  /^(userprofileid|garminguid|profileimageurllarge|profileimageurlmedium|profileimageurlsmall)$/i;

const JWT_PATTERN =
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}/;

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((value, index) => bytes[index] === value);
}

/** Byte-preserving decode so substring probes work on binary containers. */
function decodeLatin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

function scanWindows(bytes: Uint8Array): string {
  if (bytes.byteLength <= FULL_SCAN_LIMIT_BYTES) {
    return decodeLatin1(bytes);
  }
  const head = bytes.subarray(0, EDGE_WINDOW_BYTES);
  const tail = bytes.subarray(bytes.byteLength - EDGE_WINDOW_BYTES);
  return `${decodeLatin1(head)}\n${decodeLatin1(tail)}`;
}

function parseJsonDocument(bytes: Uint8Array): unknown {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_JSON_BYTES) {
    return undefined;
  }
  const text = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes)
    .replace(/^\uFEFF/, "")
    .trim();
  if (!text.startsWith("{") && !text.startsWith("[")) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

type JsonKeyVerdict = CredentialRejectionCode | null;

/**
 * Iterative walk with node and depth ceilings so a hostile document cannot
 * exhaust the stack or the event loop.
 */
function walkJsonKeys(root: unknown): JsonKeyVerdict {
  const stack: { value: unknown; depth: number }[] = [
    { value: root, depth: 0 },
  ];
  let nodes = 0;
  let sawCredentialsObject = false;
  let sawConfigDirectories = false;
  let sawConfigEnabledStats = false;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      break;
    }
    const { value, depth } = current;
    if (depth > MAX_JSON_DEPTH) {
      continue;
    }
    nodes += 1;
    if (nodes > MAX_JSON_NODES) {
      break;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === "object") {
          stack.push({ value: item, depth: depth + 1 });
        }
      }
      continue;
    }

    if (value === null || typeof value !== "object") {
      continue;
    }

    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (CREDENTIAL_KEY_PATTERN.test(key)) {
        return "credential_material_detected";
      }
      if (IDENTITY_KEY_PATTERN.test(key)) {
        return "identity_material_detected";
      }

      const lowerKey = key.toLowerCase();
      if (
        lowerKey === "credentials" &&
        child !== null &&
        typeof child === "object"
      ) {
        sawCredentialsObject = true;
      }
      if (lowerKey === "directories") {
        sawConfigDirectories = true;
      }
      if (lowerKey === "enabled_stats") {
        sawConfigEnabledStats = true;
      }

      if (child !== null && typeof child === "object") {
        stack.push({ value: child, depth: depth + 1 });
      }
    }
  }

  // GarminConnectConfig.json shape, regardless of what the file is called.
  if (sawCredentialsObject && (sawConfigDirectories || sawConfigEnabledStats)) {
    return "credential_material_detected";
  }
  return null;
}

function containsAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * Returns a finding when the bytes must be rejected, or null when they carry
 * no credential, identity, executable, or diagnostic material.
 */
export function scanForCredentialMaterial(
  bytes: Uint8Array,
): CredentialFinding | null {
  const code = classify(bytes);
  return code ? { code, message: MESSAGES[code] } : null;
}

function classify(bytes: Uint8Array): CredentialRejectionCode | null {
  if (bytes.byteLength === 0) {
    return null;
  }

  for (const signature of EXECUTABLE_SIGNATURES) {
    if (startsWith(bytes, signature)) {
      return "executable_content_detected";
    }
  }

  const json = parseJsonDocument(bytes);
  if (json !== undefined) {
    const verdict = walkJsonKeys(json);
    if (verdict) {
      return verdict;
    }
  }

  // Literal probes compare lowercase; the pattern probes need original case.
  const window = scanWindows(bytes);
  const lowered = window.toLowerCase();

  if (containsAny(lowered, CREDENTIAL_LITERALS)) {
    return "credential_material_detected";
  }
  if (containsAny(lowered, IDENTITY_LITERALS)) {
    return "identity_material_detected";
  }
  if (containsAny(lowered, DIAGNOSTIC_LITERALS)) {
    return "diagnostic_material_detected";
  }
  if (JWT_PATTERN.test(window) || BEARER_PATTERN.test(window)) {
    return "credential_material_detected";
  }

  return null;
}

export class CredentialMaterialError extends Error {
  readonly code: CredentialRejectionCode;

  constructor(finding: CredentialFinding) {
    super(finding.message);
    this.name = "CredentialMaterialError";
    this.code = finding.code;
  }
}

/** Throws when the bytes must be rejected. Used at every trust boundary. */
export function assertNoCredentialMaterial(bytes: Uint8Array): void {
  const finding = scanForCredentialMaterial(bytes);
  if (finding) {
    throw new CredentialMaterialError(finding);
  }
}
