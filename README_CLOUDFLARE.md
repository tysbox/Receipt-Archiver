# Deploy to Cloudflare Pages (minimal)

This branch is prepared for Cloudflare Pages deployment.

Steps to deploy:

1. On Cloudflare Pages, select "Connect to Git" and choose this repository.
2. For the **Production branch**, choose `cloudflare-pages` (or the branch you want).
3. Set the **Build command** to:

```bash
npm run build
```

4. Set the **Build output directory** to:

```
dist
```

5. (Optional) Set Node version in Pages settings / environment to match your local Node.
6. Deploy. After first successful deploy, open the provided HTTPS URL and install as PWA from Safari.

Notes:
- This branch removes `node_modules` and `dist` from the repository so the Pages builder will run `npm install` then `npm run build` on Cloudflare's side.
- If you want to restrict access, use **Cloudflare Access** (Zero Trust) or add an authentication Worker.