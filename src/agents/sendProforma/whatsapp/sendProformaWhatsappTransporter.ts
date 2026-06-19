import axios from 'axios';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import type { SendProformaModel } from '../data/sendProformaModel.js';
import { buildSendProformaWhatsappCaption } from './sendProformaWhatsappTemplate.js';

const SEND_PROFORMA_WHATSAPP_ENDPOINT = 'https://apiconsult.zampisoft.com/api/whatsapp/send-file';
const SEND_PROFORMA_WHATSAPP_LOG_PREFIX = '[sendProformaWhatsapp]';

type SendProformaWhatsappResponse = {
  success?: boolean;
  status?: string;
  cost?: number;
  instance?: string;
  provider?: {
    message?: string;
  };
};

function resolveDocumentPath(documentPath: string): string {
  if (documentPath.startsWith('/uploads/')) {
    return resolve(process.cwd(), documentPath.replace(/^\/+/, ''));
  }

  if (isAbsolute(documentPath)) {
    return documentPath;
  }

  return resolve(process.cwd(), documentPath);
}

async function readDocumentAsBase64(documentPath: string): Promise<string> {
  const documentBuffer = await readFile(documentPath);

  return documentBuffer.toString('base64');
}

function normalizeWhatsappPhone(phone: string | null): string {
  if (typeof phone !== 'string') {
    throw new Error('El teléfono del cliente es requerido para enviar proforma por WhatsApp');
  }

  const cleanedPhone = phone.trim();
  if (!/^09\d{8}$/.test(cleanedPhone)) {
    throw new Error('El teléfono del cliente debe ser un número móvil válido de Ecuador para enviar proforma por WhatsApp');
  }

  return `593${cleanedPhone.slice(1)}`;
}

function buildDocumentFileName(task: SendProformaModel): string {
  return `${task.sendprfmaidentificador}.pdf`;
}

async function sendProformaByWhatsapp(task: SendProformaModel, instance: string): Promise<void> {
  const apiToken = env.whatsappApiconsultToken;
  if (!apiToken) {
    throw new Error('WHATSAPP_APICONSULT_TOKEN es requerido para enviar proforma por WhatsApp');
  }

  const documentPath = resolveDocumentPath(task.sendprfmadocumento);
  const file = await readDocumentAsBase64(documentPath);
  const phone = normalizeWhatsappPhone(task.sendclntetelefono);

  logger.info(
    {
      sendid: task.sendid,
      instance,
      phone,
      fileName: buildDocumentFileName(task),
    },
    `${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Enviando proforma por whatsapp`,
  );

  let responseData: SendProformaWhatsappResponse;

  try {
    const response = await axios.post<SendProformaWhatsappResponse>(
      SEND_PROFORMA_WHATSAPP_ENDPOINT,
      {
        instance,
        phone,
        file,
        filename: buildDocumentFileName(task),
        mimeType: 'application/pdf',
        caption: buildSendProformaWhatsappCaption(task),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiToken,
        },
      },
    );
    responseData = response.data;
  } catch (error) {
    if (axios.isAxiosError<SendProformaWhatsappResponse>(error)) {
      throw new Error(error.response?.data?.provider?.message ?? error.message);
    }

    throw error;
  }

  if (responseData.success !== true) {
    throw new Error(responseData.provider?.message ?? 'La solicitud de envío de proforma por WhatsApp no fue exitosa');
  }

  logger.info(
    {
      sendid: task.sendid,
      instance: responseData.instance,
      status: responseData.status,
      cost: responseData.cost,
    },
    `${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Proforma enviada correctamente por whatsapp`,
  );
}

export { resolveDocumentPath, sendProformaByWhatsapp };
