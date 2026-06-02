import { config } from 'dotenv';

class EnvConfig {
  public readonly logLevel: string;
  public readonly port: number;
  public readonly corsOrigin: string;
  public readonly databaseUrl: string;
  public readonly publicBaseUrl: string;
  public readonly jwtSecret: string;
  public readonly accessTokenExpiresIn: string;
  public readonly refreshTokenExpiresInHours: number;
  public readonly bcryptSaltRounds: number;
  public readonly smtpHost: string | undefined;
  public readonly smtpPort: number | undefined;
  public readonly smtpSecure: boolean | undefined;
  public readonly smtpUser: string | undefined;
  public readonly smtpPass: string | undefined;
  public readonly smtpFrom: string | undefined;
  public readonly gmailApiKey: string | undefined;

  private readonly errors: string[] = [];

  constructor() {
    config({
      quiet: true,
    });

    this.logLevel = this.getStringEnv('LOG_LEVEL');
    this.port = this.getNumberEnv('PORT', true);
    this.corsOrigin = this.getStringEnv('CORS_ORIGIN');
    this.databaseUrl = this.getStringEnv('DATABASE_URL');
    this.publicBaseUrl = this.getStringEnv('PUBLIC_BASE_URL');
    this.jwtSecret = this.getStringEnv('JWT_SECRET');
    this.accessTokenExpiresIn = this.getStringEnv('ACCESS_TOKEN_EXPIRES_IN');
    this.refreshTokenExpiresInHours = this.getNumberEnv('REFRESH_TOKEN_EXPIRES_IN_HOURS', true);
    this.bcryptSaltRounds = this.getNumberEnv('BCRYPT_SALT_ROUNDS', true);
    this.smtpHost = this.getOptionalStringEnv('SMTP_HOST');
    this.smtpPort = this.getOptionalNumberEnv('SMTP_PORT', true);
    this.smtpSecure = this.getOptionalBooleanEnv('SMTP_SECURE');
    this.smtpUser = this.getOptionalStringEnv('SMTP_USER');
    this.smtpPass = this.getOptionalStringEnv('SMTP_PASS');
    this.smtpFrom = this.getOptionalStringEnv('SMTP_FROM');
    this.gmailApiKey = this.getOptionalStringEnv('GMAIL_API_KEY');
    this.reportErrors();
  }

  private addError(message: string): void {
    this.errors.push(message);
  }

  private cleanString(value: string | undefined): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const cleanedValue = value.trim();

    if (cleanedValue.length === 0) {
      return undefined;
    }

    return cleanedValue;
  }

  private getStringEnv(name: string): string {
    const value = this.cleanString(process.env[name]);

    if (value !== undefined) {
      return value;
    }

    this.addError(`${name} is required`);

    return '';
  }

  private getOptionalStringEnv(name: string): string | undefined {
    return this.cleanString(process.env[name]);
  }

  private getNumberEnv(name: string, integer = false): number {
    const value = this.cleanString(process.env[name]);

    if (value === undefined) {
      this.addError(`${name} is required`);
      return 0;
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue)) {
      this.addError(`${name} must be a valid number`);
      return 0;
    }

    if (integer && !Number.isInteger(parsedValue)) {
      this.addError(`${name} must be an integer`);
      return 0;
    }

    return parsedValue;
  }

  private getOptionalNumberEnv(name: string, integer = false): number | undefined {
    const value = this.cleanString(process.env[name]);

    if (value === undefined) {
      return undefined;
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue)) {
      this.addError(`${name} must be a valid number`);
      return undefined;
    }

    if (integer && !Number.isInteger(parsedValue)) {
      this.addError(`${name} must be an integer`);
      return undefined;
    }

    return parsedValue;
  }

  private getOptionalBooleanEnv(name: string): boolean | undefined {
    const value = this.cleanString(process.env[name]);

    if (value === undefined) {
      return undefined;
    }

    const normalized = value.toLowerCase();

    if (normalized === 'true' || normalized === '1') {
      return true;
    }

    if (normalized === 'false' || normalized === '0') {
      return false;
    }

    this.addError(`${name} must be a boolean (true/false)`);
    return undefined;
  }

  private reportErrors(): void {
    if (this.errors.length === 0) {
      return;
    }

    throw new Error(
      `Invalid environment variables:\n- ${this.errors.join('\n- ')}`,
    );
  }
}

const env = new EnvConfig();

export { env };
