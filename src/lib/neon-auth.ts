import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

// Neon Auth client. The package is beta, so keep the provider boundary isolated.
export const neonAuth: any = createAuthClient(
  'https://ep-ancient-dawn-a17owzjq.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth',
  { adapter: BetterAuthReactAdapter() }
);
