import { useRef, useState } from 'react';
import { ChevronDown, Download, Plus, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { describeSheetImport, downloadCsv, parseCsv, rowsToRecords, type SheetImportResult } from '@/lib/spreadsheet';

interface AdminSheetMenuProps {
  label: string;
  singleLabel: string;
  multipleLabel: string;
  templateFilename: string;
  templateHeaders: string[];
  templateSample: string[][];
  onCreateOne: () => void;
  importRows: (rows: Record<string, string>[]) => Promise<SheetImportResult>;
  onComplete?: () => void;
}

const AdminSheetMenu = ({
  label,
  singleLabel,
  multipleLabel,
  templateFilename,
  templateHeaders,
  templateSample,
  onCreateOne,
  importRows,
  onComplete,
}: AdminSheetMenuProps) => {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const uploadSheet = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'xlsx' || extension === 'xls') {
      toast({
        title: 'Save the sheet as CSV',
        description: 'Excel and Google Sheets can open the sample. Save or download it as CSV, then upload that file.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    try {
      const records = rowsToRecords(parseCsv(await file.text()));
      if (records.length === 0) {
        toast({
          title: 'Empty sheet',
          description: 'Add at least one data row under the header.',
          variant: 'destructive',
        });
        return;
      }
      const result = await importRows(records);
      const description = describeSheetImport(result);
      toast({
        title: result.created + result.updated > 0 ? 'Sheet imported' : 'Sheet was not imported',
        description,
        variant: result.errors.length > 0 && result.created + result.updated === 0 ? 'destructive' : 'default',
      });
      if (result.created + result.updated > 0) {
        onComplete?.();
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: 'sheet_import_failed',
        message: error instanceof Error ? error.message : 'unknown',
      }));
      toast({
        title: 'Sheet was not imported',
        description: 'The file could not be read. Use the sample CSV and keep the header row.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      if (fileInput.current) {
        fileInput.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void uploadSheet(file);
          }
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={isImporting}>
            {isImporting ? 'Importing…' : label}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onCreateOne}>
            <Plus className="mr-2 h-4 w-4" />
            {singleLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInput.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {multipleLabel}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => downloadCsv(templateFilename, templateHeaders, templateSample)}>
            <Download className="mr-2 h-4 w-4" />
            Download sample template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default AdminSheetMenu;
