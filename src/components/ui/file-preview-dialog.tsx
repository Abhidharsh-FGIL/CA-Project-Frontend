import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCw, Download, Maximize2, Minimize2, X, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiDownload, buildUrl } from '@/lib/api';
import { saveAs } from 'file-saver';

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Relative path like /uploads/assignment-files/... OR full http URL */
  fileUrl: string;
  fileName?: string;
  title?: string;
}

/**
 * If the URL is already absolute, return as-is.
 * If relative, return the backend-relative path (for use with buildUrl / apiDownload).
 */
function toRelativePath(url: string): string {
  if (!url) return '';
  // Already relative
  if (!url.startsWith('http://') && !url.startsWith('https://')) return url;
  // If it points to our backend, extract the path portion
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function isPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

function isImage(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?|$)/i.test(url);
}

function getFileExtension(url: string): string {
  const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
  return match ? match[1].toUpperCase() : 'FILE';
}

export function FilePreviewDialog({ open, onOpenChange, fileUrl, fileName, title }: FilePreviewDialogProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const relativePath = toRelativePath(fileUrl);
  const displayUrl = buildUrl(relativePath);
  const pdf = isPdf(relativePath);
  const img = isImage(relativePath);
  const canPreview = pdf || img;
  const ext = getFileExtension(relativePath);

  const handleZoomIn = useCallback(() => setScale(s => Math.min(s + 0.25, 4)), []);
  const handleZoomOut = useCallback(() => setScale(s => Math.max(s - 0.25, 0.25)), []);
  const handleRotate = useCallback(() => setRotation(r => (r + 90) % 360), []);
  const handleReset = useCallback(() => { setScale(1); setRotation(0); }, []);

  const handleDownload = useCallback(async () => {
    if (!relativePath) return;
    setDownloading(true);
    try {
      const blob = await apiDownload(relativePath);
      const name = fileName || relativePath.split('/').pop() || 'file';
      saveAs(blob, name);
    } catch {
      // Fallback: open in new tab
      window.open(displayUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  }, [relativePath, fileName, displayUrl]);

  const toggleFullscreen = useCallback(() => setIsFullscreen(f => !f), []);

  // Reset on close
  const handleOpenChange = useCallback((val: boolean) => {
    if (!val) { setScale(1); setRotation(0); setIsFullscreen(false); }
    onOpenChange(val);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col p-0 gap-0 overflow-hidden [&>button.absolute]:hidden',
          isFullscreen
            ? 'max-w-[100vw] w-[100vw] h-[100vh] rounded-none'
            : canPreview
              ? 'max-w-[90vw] w-[90vw] max-h-[90vh] h-[85vh]'
              : 'max-w-md w-full h-auto'
        )}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-background/95 backdrop-blur shrink-0">
          <DialogHeader className="flex-1 min-w-0 space-y-0">
            <DialogTitle className="text-sm font-medium truncate leading-normal">
              {title || fileName || 'Preview'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-0.5 ml-4">
            {img && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} title="Zoom out">
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} title="Zoom in">
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRotate} title="Rotate">
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-border mx-0.5" />
              </>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleFullscreen} title={isFullscreen ? 'Minimize' : 'Maximize'}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} disabled={downloading} title="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenChange(false)} title="Close">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 min-h-0 overflow-auto flex items-center justify-center bg-muted/30"
          onDoubleClick={handleReset}
        >
          {pdf ? (
            <iframe
              src={displayUrl}
              className="w-full h-full border-0"
              title={title || fileName || 'PDF Preview'}
            />
          ) : img ? (
            <div className="p-4 flex items-center justify-center min-h-0 w-full h-full">
              <img
                src={displayUrl}
                alt={fileName || 'Preview'}
                className="max-w-none select-none transition-transform duration-200"
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  maxHeight: scale <= 1 ? '100%' : undefined,
                  maxWidth: scale <= 1 ? '100%' : undefined,
                }}
                draggable={false}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-base">{fileName || 'File'}</p>
                <p className="text-sm text-muted-foreground mt-1">{ext} file - Preview not available</p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button onClick={handleDownload} disabled={downloading}>
                  <Download className="h-4 w-4 mr-2" />
                  {downloading ? 'Downloading...' : 'Download File'}
                </Button>
                <Button variant="outline" onClick={() => window.open(displayUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
