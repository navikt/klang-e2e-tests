import { requiredEnvString } from '../config/env';

export interface User {
  username: string;
  password: string;
}

export const userSaksbehandler: User = {
  username: requiredEnvString('SAKSBEHANDLER_USERNAME'),
  password: requiredEnvString('SAKSBEHANDLER_PASSWORD'),
};
