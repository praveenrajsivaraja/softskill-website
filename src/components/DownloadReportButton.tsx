import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadExcelReport, type ExcelSheet } from '@/lib/excelReport';

interface DownloadReportButtonProps {
  filename: string;
  sheets: ExcelSheet[];
  disabled?: boolean;
}

const DownloadReportButton = ({ filename, sheets, disabled = false }: DownloadReportButtonProps) => (
  <Button
    type="button"
    variant="outline"
    size="sm"
    disabled={disabled}
    onClick={() => downloadExcelReport(filename, sheets)}
  >
    <Download className="mr-2 h-4 w-4" />
    Download report
  </Button>
);

export default DownloadReportButton;
