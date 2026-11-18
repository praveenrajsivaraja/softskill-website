export type ExcelCell = string | number | null | undefined;

export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: ExcelCell[][];
}

export interface ExcelDownload {
  filename: string;
  sheets: ExcelSheet[];
  downloadNow?: boolean;
}

const escapeXml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const sheetName = (name: string, usedNames: Set<string>): string => {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Report';
  let candidate = cleaned;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    const ending = ` ${suffix}`;
    candidate = `${cleaned.slice(0, 31 - ending.length)}${ending}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
};

const cellXml = (value: ExcelCell): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escapeXml(value == null ? '' : String(value))}</Data></Cell>`;
};

const rowXml = (values: ExcelCell[]): string => `<Row>${values.map(cellXml).join('')}</Row>`;

export const buildExcelWorkbook = (sheets: ExcelSheet[]): string => {
  const usableSheets = sheets.length > 0 ? sheets : [{ name: 'Report', headers: ['Note'], rows: [['No rows']] }];
  const usedNames = new Set<string>();
  const worksheets = usableSheets.map((sheet) => {
    const name = sheetName(sheet.name, usedNames);
    const rows = [sheet.headers, ...sheet.rows].map(rowXml).join('');
    return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${rows}</Table></Worksheet>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheets}
</Workbook>`;
};

export const downloadExcelReport = (filename: string, sheets: ExcelSheet[]): void => {
  const safeName = filename.toLowerCase().endsWith('.xls') ? filename : `${filename}.xls`;
  const blob = new Blob([`\uFEFF${buildExcelWorkbook(sheets)}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
