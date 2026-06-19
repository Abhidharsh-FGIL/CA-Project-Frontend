import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, FileType } from 'lucide-react';
import type { ExportFormat } from '@/lib/eval-export-utils';

interface DownloadDropdownProps {
  onDownload: (format: ExportFormat) => void | Promise<void>;
  label?: string;
  size?: 'sm' | 'default' | 'icon';
  variant?: 'outline' | 'ghost' | 'default';
  disabled?: boolean;
}

export function DownloadDropdown({
  onDownload,
  label = 'Download',
  size = 'sm',
  variant = 'outline',
  disabled = false,
}: DownloadDropdownProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (format: ExportFormat) => {
    setLoading(true);
    try {
      await onDownload(format);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1" disabled={disabled || loading}>
          <Download className="h-3 w-3" />
          {size !== 'icon' && (loading ? 'Preparing...' : label)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleClick('excel')} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleClick('pdf')} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-red-600" />
          PDF (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleClick('docx')} className="gap-2 cursor-pointer">
          <FileType className="h-4 w-4 text-blue-600" />
          Word (.docx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
