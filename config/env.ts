import 'dotenv/config';

export const IS_DEPLOYED = process.env.CI === 'true';

export const envString = (name: string, required: boolean): string | undefined =>
  required ? requiredEnvString(name) : optionalEnvString(name);

export const optionalEnvString = (name: string): string | undefined => {
  const envVariable = process.env[name];

  if (typeof envVariable === 'string' && envVariable.length > 0) {
    return envVariable;
  }

  return undefined;
};

export const requiredEnvString = (name: string, defaultValue?: string): string => {
  const envVariable = process.env[name];

  if (typeof envVariable === 'string' && envVariable.length > 0) {
    return envVariable;
  }

  if (typeof defaultValue === 'string' && defaultValue.length > 0) {
    return defaultValue;
  }

  console.error(`Missing required environment variable '${name}'.`);
  process.exit(1);
};
