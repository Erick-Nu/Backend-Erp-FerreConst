import { config } from 'dotenv';

class EnvConfig {
  public readonly logLevel: string;
  public readonly port: number;
  public readonly corsOrigin: string;
  public readonly databaseUrl: string;
  public readonly jwtSecret: string;
  public readonly jwtExpiresIn: string;
  public readonly bcryptSaltRounds: number;

  private readonly errors: string[] = [];

  constructor() {
    config({
      quiet: true,
    });

    this.logLevel = this.getStringEnv('LOG_LEVEL');
    this.port = this.getNumberEnv('PORT', true);
    this.corsOrigin = this.getStringEnv('CORS_ORIGIN');
    this.databaseUrl = this.getStringEnv('DATABASE_URL');
    this.jwtSecret = this.getStringEnv('JWT_SECRET');
    this.jwtExpiresIn = this.getStringEnv('JWT_EXPIRES_IN');
    this.bcryptSaltRounds = this.getNumberEnv('BCRYPT_SALT_ROUNDS', true);

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
