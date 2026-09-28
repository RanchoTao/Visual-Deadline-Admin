import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const forbidden = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "VD_ADMIN_API_TOKEN",
  "ADMIN_OWNER_USER_IDS",
  "GITHUB_TOKEN",
  "VERCEL_TOKEN",
  "PADDLE_API_KEY",
  "RESEND_API_KEY",
  "DEEPSEEK_API_KEY",
  "fixture-internal-token",
  "fixture-owner-session",
];
let scanned = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(js|json|map)$/.test(entry.name)) {
      scanned++;
      const content = await readFile(path, "utf8");
      for (const key of forbidden)
        if (content.includes(key))
          throw new Error(
            `Privileged identifier in browser asset: ${entry.name}: ${key}`,
          );
    }
  }
}
await scan(".next/static");
console.log(
  `Client boundary check passed: ${scanned} built assets, no privileged configuration identifiers or fixture tokens.`,
);
