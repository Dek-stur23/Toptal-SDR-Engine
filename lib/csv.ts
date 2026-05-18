// Pure CSV parsing + hotlist field mapping. Split out from the Hotlist
// client component so tests and other callers can use them without
// pulling in React.

export interface CsvPreviewRow {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  linkedinUrl: string;
  selected: boolean;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let curr = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          curr += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(curr);
        curr = "";
      } else {
        curr += ch;
      }
    }
    out.push(curr);
    return out.map((s) => s.trim());
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? "").trim();
    });
    return row;
  });
}

// LinkedIn URLs show up under a huge variety of column names in practice
// (LinkedIn, LinkedIn Link, LinkedIn URL, Profile URL, Person Linkedin
// Url, URL, ...). Match permissively:
//   1. Header contains "linkedin", OR
//   2. Header is profile/li-style (profile url, profile link, li url, ...), OR
//   3. Value itself looks like a linkedin.com URL (last-resort scan).
function looksLikeLinkedinUrl(v: string): boolean {
  return /linkedin\.com\//i.test(v);
}

export function pickLinkedinUrl(row: Record<string, string>): string {
  const headers = Object.keys(row);
  // Pass 1: header contains "linkedin"
  for (const h of headers) {
    if (h.includes("linkedin") && row[h]) return row[h];
  }
  // Pass 2: profile/li-style headers
  for (const h of headers) {
    if (
      (h.includes("profile") && (h.includes("url") || h.includes("link"))) ||
      h === "li url" ||
      h === "li link" ||
      h === "url"
    ) {
      if (row[h]) return row[h];
    }
  }
  // Pass 3: scan every cell for a linkedin.com URL
  for (const h of headers) {
    if (row[h] && looksLikeLinkedinUrl(row[h])) return row[h];
  }
  return "";
}

export function mapCsvRowsToPreview(
  rows: Record<string, string>[],
): CsvPreviewRow[] {
  const firstNameKeys = ["first name", "firstname", "first", "given name"];
  const lastNameKeys = [
    "last name",
    "lastname",
    "last",
    "family name",
    "surname",
  ];
  const fullNameKeys = ["name", "full name", "contact name", "contact"];
  const titleKeys = ["title", "job title", "position", "role"];
  const companyKeys = [
    "company",
    "company name",
    "organization",
    "employer",
    "account",
  ];

  const pick = (row: Record<string, string>, keys: string[]): string => {
    for (const k of keys) {
      const v = row[k];
      if (v) return v;
    }
    return "";
  };

  const out: CsvPreviewRow[] = [];
  rows.forEach((row, i) => {
    let firstName = pick(row, firstNameKeys);
    let lastName = pick(row, lastNameKeys);
    const fullName = pick(row, fullNameKeys);
    if (!firstName && !lastName && fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ");
    }
    const title = pick(row, titleKeys);
    const company = pick(row, companyKeys);
    const linkedinUrl = pickLinkedinUrl(row);
    if (!firstName && !lastName && !company) return; // skip empty rows
    out.push({
      id: `csv-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      firstName,
      lastName,
      title,
      company,
      linkedinUrl,
      selected: true,
    });
  });
  return out;
}
