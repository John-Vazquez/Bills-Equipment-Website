// Public enquiry POSTs are verified with server-side CAPTCHA. Staff retry actions separately validate
// the actual user JWT against Supabase Auth and the active employee profile. No SDK/browser secrets.
import { createHandler } from './handler.js';
Deno.serve(createHandler({
  env: (name: string) => Deno.env.get(name),
  log: (event: string, details: Record<string, unknown>) => console.warn(event, details),
}));
