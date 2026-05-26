import { createWriteStream } from 'node:fs';
import { access, chmod, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PDFDocumentWithTables } from 'pdfkit-table';

import { renderProformaTemplate } from './proformaTemplate.js';
import type {
  ProformaPdfBrandingData,
  ProformaPdfFontConfig,
  ProformaPdfInput,
  ProformaPdfItemData,
  ProformaPdfResult,
} from './proformaTypes.js';

const PROFORMA_OUTPUT_DIRECTORY = resolve(process.cwd(), 'uploads', 'proformas');
const PROFORMA_ASSETS_DIRECTORY = resolve(PROFORMA_OUTPUT_DIRECTORY, 'assets');
const PROFORMA_OUTPUT_DIRECTORY_MODE = 0o775;
const DEFAULT_REGULAR_FONT = 'Helvetica';
const DEFAULT_BOLD_FONT = 'Helvetica-Bold';

const DEFAULT_FONT_REGULAR_PATH = resolve(PROFORMA_ASSETS_DIRECTORY, 'Montserrat-Regular.ttf');
const DEFAULT_FONT_BOLD_PATH = resolve(PROFORMA_ASSETS_DIRECTORY, 'Montserrat-SemiBold.ttf');

function sanitizeFileSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatFileDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function buildProformaFileName(identificador: string, createdAt: Date): string {
  const safeIdentifier = sanitizeFileSegment(identificador);
  const safeDate = sanitizeFileSegment(formatFileDate(createdAt));

  return `${safeIdentifier}_${safeDate}.pdf`;
}

function buildProformaPdfRelativePath(fileName: string, companyRuc?: string): string {
  if (companyRuc) {
    return `/${join('uploads', 'proformas', getProformaCompanyDirectoryName(companyRuc), fileName)}`;
  }

  return `/${join('uploads', 'proformas', fileName)}`;
}

function buildProformaPdfAbsolutePath(fileName: string, companyRuc?: string): string {
  if (companyRuc) {
    return join(PROFORMA_OUTPUT_DIRECTORY, getProformaCompanyDirectoryName(companyRuc), fileName);
  }

  return join(PROFORMA_OUTPUT_DIRECTORY, fileName);
}

function normalizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const withoutExtension = trimmed.replace(/\.pdf$/i, '');
  const sanitized = sanitizeFileSegment(withoutExtension);

  if (sanitized.length === 0) {
    return 'proforma.pdf';
  }

  return `${sanitized}.pdf`;
}

async function pathExists(pathToCheck: string): Promise<boolean> {
  try {
    await access(pathToCheck);
    return true;
  } catch {
    return false;
  }
}

async function ensureProformaOutputDirectory(): Promise<void> {
  await ensureDirectory(PROFORMA_OUTPUT_DIRECTORY);
  await ensureDirectory(PROFORMA_ASSETS_DIRECTORY);
}

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await trySetDirectoryPermissions(path);
}

async function trySetDirectoryPermissions(path: string): Promise<void> {
  try {
    await chmod(path, PROFORMA_OUTPUT_DIRECTORY_MODE);
  } catch {
    return;
  }
}

function getProformaCompanyDirectoryName(companyRuc: string): string {
  return sanitizeFileSegment(companyRuc) || 'sin_ruc';
}

async function ensureProformaCompanyDirectory(companyRuc: string): Promise<string> {
  const companyDirectoryName = getProformaCompanyDirectoryName(companyRuc);
  const companyOutputDirectory = join(PROFORMA_OUTPUT_DIRECTORY, companyDirectoryName);

  await ensureDirectory(companyOutputDirectory);

  return companyDirectoryName;
}

async function resolveFontConfig(input?: ProformaPdfBrandingData): Promise<ProformaPdfFontConfig> {
  const regularCandidate = input?.fontRegularPath ?? DEFAULT_FONT_REGULAR_PATH;
  const boldCandidate = input?.fontBoldPath ?? DEFAULT_FONT_BOLD_PATH;

  const hasRegular = await pathExists(regularCandidate);
  const hasBold = await pathExists(boldCandidate);

  if (hasRegular && hasBold) {
    return {
      regular: regularCandidate,
      bold: boldCandidate,
    };
  }

  return {
    regular: DEFAULT_REGULAR_FONT,
    bold: DEFAULT_BOLD_FONT,
  };
}

function createPdfDocument() {
  return new PDFDocumentWithTables({
    margin: 40,
    size: 'A4',
  });
}

function createProformaFilePaths(companyDirectoryName: string, fileName: string): Pick<ProformaPdfResult, 'absolutePath' | 'relativePath'> {
  const absolutePath = join(PROFORMA_OUTPUT_DIRECTORY, companyDirectoryName, fileName);
  const relativePath = join('uploads', 'proformas', companyDirectoryName, fileName);

  return {
    absolutePath,
    relativePath,
  };
}

function resolveOutputFileName(data: ProformaPdfInput): string {
  if (data.outputFileName) {
    return normalizeFileName(data.outputFileName);
  }

  return buildProformaFileName(data.identificador, data.fechaEmision);
}

async function waitForPdfWriteFinish(
  stream: ReturnType<typeof createWriteStream>,
  document: ReturnType<typeof createPdfDocument>,
): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    stream.on('finish', () => resolvePromise());
    stream.on('error', (error: Error) => rejectPromise(error));
    document.on('error', (error: Error) => rejectPromise(error));
  });
}

async function writeProformaPdf(
  data: ProformaPdfInput,
  absolutePath: string,
): Promise<void> {
  const fonts = await resolveFontConfig(data.branding);
  const document = createPdfDocument();

  const stream = createWriteStream(absolutePath);
  document.pipe(stream);

  await renderProformaTemplate(document, data, fonts);

  document.end();

  await waitForPdfWriteFinish(stream, document);
}

async function generateProformaPdf(data: ProformaPdfInput): Promise<ProformaPdfResult> {
  await ensureProformaOutputDirectory();
  const companyDirectoryName: string = await ensureProformaCompanyDirectory(data.empresa.ruc);
  const fileName = resolveOutputFileName(data);
  const filePaths = createProformaFilePaths(companyDirectoryName, fileName);

  await writeProformaPdf(data, filePaths.absolutePath);

  return {
    fileName,
    absolutePath: filePaths.absolutePath,
    relativePath: filePaths.relativePath,
  };
}

export {
  generateProformaPdf,
  ensureProformaOutputDirectory,
  buildProformaFileName,
  buildProformaPdfRelativePath,
  buildProformaPdfAbsolutePath,
  getProformaCompanyDirectoryName,
  PROFORMA_OUTPUT_DIRECTORY,
  PROFORMA_ASSETS_DIRECTORY,
  DEFAULT_FONT_REGULAR_PATH,
  DEFAULT_FONT_BOLD_PATH,
};
export type { ProformaPdfInput, ProformaPdfResult, ProformaPdfItemData };
