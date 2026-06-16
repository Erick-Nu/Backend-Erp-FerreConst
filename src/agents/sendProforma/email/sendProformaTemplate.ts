import { access, readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { logger } from '../../../utils/logger.js';
import type { SendProformaModel } from '../data/sendProformaModel.js';

const SEND_PROFORMA_EMAIL_TEMPLATE_PATH = 'uploads/templates/send-proforma-email.html';
const SEND_PROFORMA_EMAIL_LOG_PREFIX = '[sendProformaEmail]';
let cachedEmailTemplate: string | null = null;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrencyAmount(value: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function resolveDocumentPath(documentPath: string): string {
  if (documentPath.startsWith('/uploads/')) {
    return resolve(process.cwd(), documentPath.replace(/^\/+/, ''));
  }

  if (isAbsolute(documentPath)) {
    return documentPath;
  }

  return resolve(process.cwd(), documentPath);
}

async function validateDocumentAccess(documentPath: string): Promise<void> {
  await access(documentPath);
}

async function getEmailTemplate(): Promise<string> {
  if (cachedEmailTemplate) {
    return cachedEmailTemplate;
  }

  const templatePath = resolve(process.cwd(), SEND_PROFORMA_EMAIL_TEMPLATE_PATH);
  logger.info(`${SEND_PROFORMA_EMAIL_LOG_PREFIX} Cargando plantilla de correo`);
  const templateContent = await readFile(templatePath, 'utf-8');
  cachedEmailTemplate = templateContent;
  logger.info(`${SEND_PROFORMA_EMAIL_LOG_PREFIX} Plantilla de correo cargada correctamente`);
  return templateContent;
}

async function buildSendProformaEmailBody(task: SendProformaModel): Promise<string> {
  const template = await getEmailTemplate();

  return template
    .replaceAll('{{receptor}}', escapeHtml(task.sendclntenombre))
    .replaceAll('{{proforma}}', escapeHtml(task.sendprfmaidentificador))
    .replaceAll('{{empresa}}', escapeHtml(task.sendemrznsocial))
    .replaceAll('{{sucursal}}', escapeHtml(task.sendsuidentificador))
    .replaceAll('{{pago}}', escapeHtml(task.sendmpnombre))
    .replaceAll('{{total}}', escapeHtml(formatCurrencyAmount(task.sendprfmatotal)))
    .replaceAll('{{emisor}}', escapeHtml(task.sendemrznsocial))
    .replaceAll('{{emisorMail}}', escapeHtml(task.sendemcorreo ?? 'No disponible'));
}

export {
  buildSendProformaEmailBody,
  resolveDocumentPath,
  validateDocumentAccess,
};
