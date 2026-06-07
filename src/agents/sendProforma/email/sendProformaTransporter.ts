import type { Transporter } from 'nodemailer';
import { env } from '../../../config/env.js';
import { createTransporter } from '../../../services/nodemailer.js';
import { logger } from '../../../utils/logger.js';
import { findSendProformaCompanyConfigRows } from '../data/sendProformaConfig.js';

const SEND_PROFORMA_EMAIL_USER_KEY = 'sendproforma.email.user';
const SEND_PROFORMA_EMAIL_PASSWORD_KEY = 'sendproforma.email.password';
const transporterByCompanyId: Record<string, Transporter> = {};

async function findCompanyEmailCredentials(sendemid: string): Promise<{ emailUser: string; emailPassword: string }> {
  logger.info('[SendProforma] Obteniendo credenciales de correo para empresa');
  const configRows = await findSendProformaCompanyConfigRows(sendemid);

  const configMap: Record<string, string> = {};
  for (const row of configRows) {
    configMap[row.cfclave] = row.cfvalor;
  }

  const emailUser = configMap[SEND_PROFORMA_EMAIL_USER_KEY];
  const emailPassword = configMap[SEND_PROFORMA_EMAIL_PASSWORD_KEY];

  if (!emailUser || !emailPassword) {
    logger.error('[SendProforma] Configuración de correo incompleta para empresa: ' + sendemid);
    throw new Error(`Missing company email configuration for send proforma: ${sendemid}`);
  }

  return { emailUser, emailPassword };
}

function createAgentTransporter(emailUser: string, emailPassword: string): Transporter {
  const smtpHost = env.smtpHost ?? '';
  const smtpPort = env.smtpPort ?? 0;
  const smtpSecure = env.smtpSecure ?? false;

  if (!smtpHost || !smtpPort || !emailUser || !emailPassword) {
    throw new Error('Missing SMTP configuration for send proforma');
  }

  return createTransporter({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: emailUser,
    pass: emailPassword,
  });
}

async function getCompanyTransporter(sendemid: string): Promise<Transporter> {
  const cachedTransporter = transporterByCompanyId[sendemid];

  if (cachedTransporter) {
    return cachedTransporter;
  }

  logger.info('[SendProforma] Creando nuevo transporter para empresa');
  const { emailUser, emailPassword } = await findCompanyEmailCredentials(sendemid);
  const transporter = createAgentTransporter(emailUser, emailPassword);

  transporterByCompanyId[sendemid] = transporter;

  return transporter;
}

function isFileAccessError(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}

export { getCompanyTransporter, isFileAccessError };
