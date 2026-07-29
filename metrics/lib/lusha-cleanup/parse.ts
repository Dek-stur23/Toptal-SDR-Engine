// Robust RFC 4180 CSV parser used by the cleanup module. Handles:
// - UTF-8 BOM (Lusha exports occasionally carry one)
// - Quoted fields with embedded quotes ("" → ")
// - Quoted fields with embedded commas and newlines
// - CRLF or LF line endings
// - Trailing blank rows

export interface ParsedCsv {
  headers: string[];
  rows: string[][]; // parallel to headers by index; short rows are padded with "".
  raggedLines: number[]; // 1-based line numbers where cell count != header count
}

export function parseCsv(text: string): ParsedCsv {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const all: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur);
        cur = "";
        all.push(row);
        row = [];
      } else {
        cur += c;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    all.push(row);
  }

  // Drop trailing empty rows.
  while (all.length > 0) {
    const last = all[all.length - 1];
    if (last.length === 0 || (last.length === 1 && last[0] === "")) all.pop();
    else break;
  }

  if (all.length === 0) {
    return { headers: [], rows: [], raggedLines: [] };
  }

  // Headers: strip surrounding whitespace on every one (quirk: leading
  // space from ", " delimiter shows up on every non-first header).
  const headers = all[0].map((h) => h.trim());
  const raggedLines: number[] = [];
  const rows: string[][] = [];
  for (let i = 1; i < all.length; i++) {
    const r = all[i];
    if (r.length !== headers.length) {
      raggedLines.push(i + 1); // 1-based line number
    }
    // Pad or truncate to header width, and trim every cell.
    const padded = new Array<string>(headers.length);
    for (let j = 0; j < headers.length; j++) {
      padded[j] = (r[j] ?? "").trim();
    }
    rows.push(padded);
  }

  return { headers, rows, raggedLines };
}

// Serialize rows into RFC 4180 CSV bytes. UTF-8 with no BOM, CRLF
// line endings — same defaults the Part 1 export uses so downstream
// tools stay consistent.
export function toCsvBytes(rows: (readonly string[])[]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell ?? "";
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    )
    .join("\r\n");
}
