import type { Identification, ProformaStatus, Role, Status } from '../config/databaseTypes.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[\p{L}\s]+$/u;
const RUC_PATTERN = /^\d{13}$/;
const CEDULA_PATTERN = /^\d{10}$/;
const PHONE_PATTERN = /^09\d{8}$/;
const COMPANY_CODE_PATTERN = /^[a-zA-Z0-9]{4}$/;
const BRANCH_IDENTIFIER_PATTERN = /^\d{3}$/;

const EMPTY_TEXT_MESSAGE = 'El texto es requerido';
const EMPTY_NUMBER_MESSAGE = 'El número es requerido';
const EMPTY_PASSWORD_MESSAGE = 'La contraseña es requerida';
const INVALID_EMAIL_MESSAGE = 'El correo debe ser válido';
const INVALID_NAME_MESSAGE = 'El nombre sólo debe contener letras y espacios';
const INVALID_NUMBER_MESSAGE = 'El valor debe ser un número válido';
const INVALID_PASSWORD_MESSAGE = 'La contraseña debe tener al menos 8 caracteres';
const INVALID_ROLE_MESSAGE = 'El rol debe ser administrador, jefe o empleado';
const INVALID_STATUS_MESSAGE = 'El estado debe ser activo, inactivo o eliminado';
const INVALID_RUC_MESSAGE = 'El RUC debe ser válido';
const INVALID_TEXT_MESSAGE = 'El texto sólo debe contener letras y espacios';
const INVALID_COMPANY_CODE_MESSAGE = 'El código de empresa debe tener exactamente 4 caracteres alfanuméricos';
const INVALID_BRANCH_IDENTIFIER_MESSAGE = 'El identificador de sucursal debe ser exactamente 3 digitos';
const INVALID_PHONE_MESSAGE = 'El teléfono debe ser un número móvil válido de 10 digitos (ej. 0984653471)';
const INVALID_IDENTIFICATION_MESSAGE = 'La identificación debe ser numérica y válida para el tipo seleccionado';
const MIN_PASSWORD_LENGTH = 8;
const EMPTY_ROLE_MESSAGE = 'El rol es requerido';
const EMPTY_STATUS_MESSAGE = 'El estado es requerido';
const ROLE_VALUES: Role[] = ['administrador', 'jefe', 'empleado'];
const STATUS_VALUES: Status[] = ['activo', 'inactivo', 'eliminado'];
const FILTER_STATUS_VALUES: Status[] = ['activo', 'inactivo'];
const PROFORMA_STATUS_VALUES: ProformaStatus[] = ['emitida', 'pagada', 'anulada'];

function cleanString(value: string): string {
  const cleanedValue = value.trim();

  return cleanedValue;
}

function validateRequiredString(value: string, errorMessage: string): string {
  const cleanedValue = cleanString(value);

  if (cleanedValue.length > 0) {
    return cleanedValue;
  }

  throw new Error(errorMessage);
}

function validateText(value: string): string {
  const cleanedValue = cleanString(value);

  validateRequiredString(cleanedValue, EMPTY_TEXT_MESSAGE);

  if (NAME_PATTERN.test(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(INVALID_TEXT_MESSAGE);
}

function validateNumber(value: string | number): number {
  if (typeof value === 'number') {
    return validateNumberValue(value);
  }

  const cleanedValue = cleanString(value);

  if (cleanedValue.length === 0) {
    throw new Error(EMPTY_NUMBER_MESSAGE);
  }

  const numberValue = Number(cleanedValue);

  return validateNumberValue(numberValue);
}

function validateEmail(
  value: string,
  requiredMessage = EMPTY_TEXT_MESSAGE,
  invalidMessage = INVALID_EMAIL_MESSAGE,
): string {
  const cleanedValue = cleanString(value);

  validateRequiredString(cleanedValue, requiredMessage);

  if (isValidEmail(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(invalidMessage);
}

function validateName(
  value: string,
  requiredMessage = EMPTY_TEXT_MESSAGE,
  invalidMessage = INVALID_NAME_MESSAGE,
): string {
  const cleanedValue = cleanString(value);

  validateRequiredString(cleanedValue, requiredMessage);

  if (isValidName(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(invalidMessage);
}

function validateRuc(value: string): string {
  const cleanedValue = cleanString(value);

  validateRequiredString(cleanedValue, EMPTY_TEXT_MESSAGE);

  if (isValidRuc(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(INVALID_RUC_MESSAGE);
}

function validateRole(
  value: string,
  requiredMessage = EMPTY_ROLE_MESSAGE,
  invalidMessage = INVALID_ROLE_MESSAGE,
): Role {
  const cleanedValue = validateRequiredString(value, requiredMessage);

  if (isValidRole(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(invalidMessage);
}

function validatePassword(
  value: string,
  requiredMessage = EMPTY_PASSWORD_MESSAGE,
  invalidMessage = INVALID_PASSWORD_MESSAGE,
): string {
  const cleanedValue = validateRequiredString(value, requiredMessage);

  if (isValidPassword(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(invalidMessage);
}

function validateStatus(
  value: string,
  requiredMessage = EMPTY_STATUS_MESSAGE,
  invalidMessage = INVALID_STATUS_MESSAGE,
): Status {
  const cleanedValue = validateRequiredString(value, requiredMessage);

  if (isValidStatus(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(invalidMessage);
}

function validateCodeCompany(
  value: string,
  requiredMessage = EMPTY_TEXT_MESSAGE,
  invalidMessage = INVALID_COMPANY_CODE_MESSAGE,
): string {
  const cleanedValue = cleanString(value);

  validateRequiredString(cleanedValue, requiredMessage);

  if (COMPANY_CODE_PATTERN.test(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(invalidMessage);
}

function validateBranchIdentifier(
  value: string,
  requiredMessage = EMPTY_TEXT_MESSAGE,
  invalidMessage = INVALID_BRANCH_IDENTIFIER_MESSAGE,
): string {
  const cleanedValue = cleanString(value);

  validateRequiredString(cleanedValue, requiredMessage);

  if (BRANCH_IDENTIFIER_PATTERN.test(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(invalidMessage);
}

function validatePhone(
  value: string,
  requiredMessage = EMPTY_TEXT_MESSAGE,
  invalidMessage = INVALID_PHONE_MESSAGE,
): string {
  const cleanedValue = cleanString(value);

  validateRequiredString(cleanedValue, requiredMessage);

  if (isValidPhone(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(invalidMessage);
}

function validateIdentificationByType(
  value: string,
  identificationType: Identification,
  requiredMessage = EMPTY_TEXT_MESSAGE,
  invalidMessage = INVALID_IDENTIFICATION_MESSAGE,
): string {
  const cleanedValue = validateRequiredString(value, requiredMessage);
  const isNumericValue = /^\d+$/.test(cleanedValue);

  if (!isNumericValue) {
    throw new Error(invalidMessage);
  }

  if (identificationType === 'cedula' && CEDULA_PATTERN.test(cleanedValue)) {
    return cleanedValue;
  }

  if (identificationType === 'ruc' && RUC_PATTERN.test(cleanedValue)) {
    return cleanedValue;
  }

  throw new Error(invalidMessage);
}

function validateNumberValue(value: number): number {
  if (Number.isFinite(value)) {
    return value;
  }

  throw new Error(INVALID_NUMBER_MESSAGE);
}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

function isValidName(value: string): boolean {
  return NAME_PATTERN.test(value);
}

function isValidPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH;
}

function isValidRole(value: string): value is Role {
  return ROLE_VALUES.includes(value as Role);
}

function isValidStatus(value: string): value is Status {
  return STATUS_VALUES.includes(value as Status);
}

function isValidFilterStatus(value: string): value is Status {
  return FILTER_STATUS_VALUES.includes(value as Status);
}

function isValidProformaStatus(value: string): value is ProformaStatus {
  return PROFORMA_STATUS_VALUES.includes(value as ProformaStatus);
}

function isValidRuc(value: string): boolean {
  const cleanedValue = cleanString(value);

  return RUC_PATTERN.test(cleanedValue);
}

function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value);
}

export {
  validateEmail,
  validateName,
  validateNumber,
  validatePassword,
  validateRequiredString,
  validateRole,
  validateStatus,
  isValidStatus,
  isValidFilterStatus,
  isValidProformaStatus,
  validateRuc,
  validateText,
  validateCodeCompany,
  validateBranchIdentifier,
  validatePhone,
  validateIdentificationByType,
};
