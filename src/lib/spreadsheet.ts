export interface SheetImportResult {
  created: number;
  updated: number;
  errors: string[];
}

export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
};

export const rowsToRecords = (rows: string[][]): Record<string, string>[] => {
  const [header, ...body] = rows;
  if (!header) {
    return [];
  }
  const keys = header.map((name) => name.trim().toLowerCase().replace(/\s+/g, '_'));
  return body.map((row) => Object.fromEntries(keys.map((key, index) => [key, (row[index] ?? '').trim()])));
};

export const missingSheetColumns = (rows: Record<string, string>[], required: string[]): string[] => {
  if (rows.length === 0) {
    return ['The sheet has no data rows.'];
  }
  const keys = Object.keys(rows[0]);
  return required
    .filter((column) => !keys.includes(column))
    .map((column) => `Missing column ${column}. Download the sample template and keep its header row.`);
};

export const readBoolean = (value: string | undefined, fallback: boolean): boolean | null => {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) {
    return fallback;
  }
  if (['true', 'yes', 'y', '1'].includes(text)) {
    return true;
  }
  if (['false', 'no', 'n', '0'].includes(text)) {
    return false;
  }
  return null;
};

export const pipeList = (value: string | undefined): string[] => {
  return (value ?? '').split('|').map((item) => item.trim()).filter(Boolean);
};

const escapeCsvCell = (value: string): string => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const buildCsv = (headers: string[], sampleRows: string[][]): string => {
  return [headers, ...sampleRows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n');
};

export const downloadCsv = (filename: string, headers: string[], sampleRows: string[][]): void => {
  const blob = new Blob([buildCsv(headers, sampleRows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const describeSheetImport = (result: SheetImportResult): string => {
  const summary = `Created ${result.created}, updated ${result.updated}.`;
  if (result.errors.length === 0) {
    return summary;
  }
  const shown = result.errors.slice(0, 4).join(' ');
  const remaining = result.errors.length > 4 ? ` ${result.errors.length - 4} more row problem(s).` : '';
  return `${summary} ${shown}${remaining}`;
};
