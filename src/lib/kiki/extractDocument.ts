import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

GlobalWorkerOptions.workerSrc = pdfWorker;

const maxCharacters = 100000;
const maxBytes = 8 * 1024 * 1024;

export interface ExtractedDocument {
  text: string;
  truncated: boolean;
}

const extensionOf = (file: File): string => file.name.split('.').pop()?.toLowerCase() ?? '';

const limitText = (text: string): ExtractedDocument => {
  const trimmed = text.replace(/\u0000/g, '').trim();
  if (!trimmed) {
    throw new Error('KIKI could not find any text in that file.');
  }
  if (trimmed.length <= maxCharacters) {
    return { text: trimmed, truncated: false };
  }
  return { text: trimmed.slice(0, maxCharacters), truncated: true };
};

const pdfText = async (file: File): Promise<string> => {
  const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const parts: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    parts.push(line);
    if (parts.join('\n').length >= maxCharacters) {
      break;
    }
  }
  return parts.join('\n');
};

export const extractDocument = async (file: File): Promise<ExtractedDocument> => {
  if (file.size > maxBytes) {
    throw new Error('That file is too large. Use a file under 8 MB.');
  }
  const extension = extensionOf(file);
  if (extension === 'xls' || extension === 'xlsx') {
    throw new Error('Save the Excel file as CSV, then upload that file.');
  }
  if (extension === 'doc') {
    throw new Error('Save the Word file as DOCX or CSV, then upload that file.');
  }
  if (extension === 'csv' || extension === 'txt') {
    return limitText(await file.text());
  }
  if (extension === 'pdf') {
    return limitText(await pdfText(file));
  }
  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return limitText(result.value);
  }
  throw new Error('Upload a CSV, TXT, PDF, or DOCX file.');
};
