# Visual Deadline Admin

- This is the independent internal console. Do not move it into the product repository.
- Inspect the checkout and preserve unrelated changes. Work on feature branches; never merge automatically.
- All privileged integration credentials stay server-side. No real credentials in files, output, fixtures, screenshots or commits.
- Do not reproduce product rules in this repository. Unknown contracts remain pending and fail closed.
- Every privileged endpoint authenticates and authorizes independently. Every mutation requires a matching authoritative audit receipt.
- Private user content is accessible only through the scoped, case-bound, audited flow.
- Ordinary operator UI is Simplified Chinese. Unknown metrics are unknown, not zero or mock production records.
- Run `npm test`, `npm run typecheck`, `npm run build`, `npm run check:client`, `npm run test:http`, `npm run test:production`, and `git diff --check` before delivery.
- Test fixtures are local-only contract doubles. Never wire them into deployed application routes or claim they prove backend semantics.
- Keep Paddle Sandbox only. Live provider integration and deployment require their real backend contracts and configuration.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
