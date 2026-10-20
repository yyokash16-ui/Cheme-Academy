import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

export const neonAuth = createAuthClient(
  'https://ep-ancient-dawn-a17owzjq.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth',
  { adapter: BetterAuthReactAdapter() }
);
