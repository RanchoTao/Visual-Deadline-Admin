import "server-only";
import { createGateway } from "./gateway-core";
export function gateway() {
  return createGateway(
    process.env.VD_ADMIN_API_URL,
    process.env.VD_ADMIN_API_TOKEN,
  );
}
export function gatewayConfigured() {
  return Boolean(
    process.env.VD_ADMIN_API_URL && process.env.VD_ADMIN_API_TOKEN,
  );
}
