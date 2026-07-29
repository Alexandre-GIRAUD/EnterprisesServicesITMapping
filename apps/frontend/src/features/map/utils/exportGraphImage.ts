import { toJpeg, toPng } from 'html-to-image';

export type GraphImageFormat = 'png' | 'jpeg';

type ExportGraphImageOptions = {
  /** React Flow root element (e.g. `#graph-canvas-pane`). */
  element: HTMLElement;
  format: GraphImageFormat;
  fileName: string;
  /** Device pixel ratio for sharper exports (default 2). */
  pixelRatio?: number;
};

function shouldIncludeNode(domNode: HTMLElement): boolean {
  if (domNode.classList?.contains('react-flow__controls')) return false;
  if (domNode.classList?.contains('react-flow__attribution')) return false;
  if (domNode.classList?.contains('hidden-apps-picker')) return false;
  return true;
}

function triggerDownload(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

/**
 * Capture the visible application graph as PNG or JPEG and download it.
 * Controls / attribution / hidden-apps picker are excluded; legend is kept.
 */
export async function exportGraphImage({
  element,
  format,
  fileName,
  pixelRatio = 2,
}: ExportGraphImageOptions): Promise<void> {
  const options = {
    cacheBust: true,
    pixelRatio,
    backgroundColor: '#f8fafc',
    filter: (domNode: HTMLElement) => shouldIncludeNode(domNode),
  };

  const dataUrl =
    format === 'jpeg'
      ? await toJpeg(element, { ...options, quality: 0.95 })
      : await toPng(element, options);

  triggerDownload(dataUrl, fileName);
}

export function buildGraphExportFileName(
  mode: 'production' | 'sandbox',
  format: GraphImageFormat,
  date = new Date()
): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `flowra-${mode}-graph-${yyyy}-${mm}-${dd}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}
