import multer from 'multer';
import type { Request, RequestHandler } from 'express';
import { writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { env } from '../config/env.js';

type image = {
  fieldName: string;
  originalName: string;
  encoding: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
};


const UPLOADS_STORAGE_BASE_PATH = './uploads';
const UPLOADS_PUBLIC_BASE_PATH = '/uploads';
const DEFAULT_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg'] as const;

const upload = multer({
  storage: multer.memoryStorage(),
});

const parseImage = upload.single('imagen');

function toPublicImageUrl(imagePath: string): string {
  return `${env.publicBaseUrl}${imagePath}`;
}

function getImage(req: Request): image | null {
  const { file } = req;
  if (!file) {
    return null;
  }

  const image = {
    fieldName: file.fieldname,
    originalName: file.originalname,
    encoding: file.encoding,
    mimeType: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  };
  return image;
}

function sanitizeFileName(fileName: string): string {
  const trimmedFileName = fileName.trim();
  const sanitizedFileName = trimmedFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (sanitizedFileName.length === 0) {
    return 'image';
  }

  return sanitizedFileName;
}

function validateImageSize(
  uploadedImage: image | null,
  maxSizeBytes: number = DEFAULT_MAX_IMAGE_SIZE_BYTES,
): true {
  if (!uploadedImage) {
    throw new Error('La imagen es requerida');
  }

  if (maxSizeBytes <= 0) {
    throw new Error('Tamano maximo de imagen inválido');
  }

  if (uploadedImage.size <= 0 || uploadedImage.size > maxSizeBytes) {
    throw new Error('El tamaño de la imagen excede el límite permitido');
  }

  return true;
}

function validateImageType(uploadedImage: image | null): true {
  if (!uploadedImage) {
    throw new Error('La imagen es requerida');
  }

  const extension = extname(uploadedImage.originalName).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension as '.png' | '.jpg')) {
    throw new Error('Solo se permiten imagenes PNG y JPG');
  }

  return true;
}

async function saveImage(image: image, destinationPath: string): Promise<string> {
  const finalFileName = sanitizeFileName(basename(image.originalName));
  const fileNameSegment = `/${finalFileName}`;
  const filePath = `${UPLOADS_STORAGE_BASE_PATH}${destinationPath}${fileNameSegment}`;
  const publicPath = `${UPLOADS_PUBLIC_BASE_PATH}${destinationPath}${fileNameSegment}`;
  try {
    await writeFile(filePath, image.buffer);
    return publicPath;
  } catch {
    throw new Error('Error al guardar la imagen');
  }
}


const parseImageMiddleware: RequestHandler[] = [parseImage];

export {
  getImage,
  parseImage,
  parseImageMiddleware,
  saveImage,
  toPublicImageUrl,
  validateImageType,
  validateImageSize,
};

export type { image };
