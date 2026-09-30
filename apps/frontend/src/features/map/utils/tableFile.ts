export type TableGrid = {
  headers: string[];
  rows: string[][];
};

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function tableToCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((line) => line.map(escapeCsvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}`;
}

function escapeExcelCell(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function tableToExcelXml(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((line) => {
    const cells = line
      .map((value) => `<Cell><Data ss:Type="String">${escapeExcelCell(value)}</Data></Cell>`)
      .join('');
    return `<Row>${cells}</Row>`;
  });
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Table"><Table>${lines.join('')}</Table></Worksheet>
</Workbook>`;
}

export function downloadTableFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
