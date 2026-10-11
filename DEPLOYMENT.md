# Stable demo deployment

The Cloudflare quick-tunnel URL is temporary. This project is prepared for a stable Render web-service URL backed by MongoDB Atlas. No credentials belong in GitHub.

## What this deployment provides

- One Render URL serving the React site and Express API from the same origin.
- A separate Atlas replica-set database for wallet transactions.
- A stable `onrender.com` hostname while the Render service exists.

The Blueprint uses Render's free web-service plan for an assignment demo. Free services can sleep after 15 minutes without traffic and take about a minute to wake. Choose a paid always-on plan if clients must reach it without a cold start.

## Deploy

1. Create a normal MongoDB Atlas project and an **M0 Free** cluster (not an ephemeral cluster). Create a database user with a unique, strong password and copy the SRV connection URI. Put `veloop_wallet` in the database portion of the URI. Keep this URI private.
2. Add the Render service's outbound addresses to Atlas Network Access. Render free services do not have a fixed outbound IP; for a short-lived demo, Atlas may require a broad IP rule. If you use `0.0.0.0/0`, use a dedicated least-privilege database user with a strong unique password, demo data only, and remove the rule after the demo. Never use production data.
3. Push this project, including `render.yaml`, to `Dollsingha/VELOop-Rewards`.
4. Sign in to Render, choose **New → Blueprint**, connect the GitHub repository, and create the service from `render.yaml`.
5. When prompted, set `MONGO_URI`, `GOOGLE_CLIENT_ID`, and `PAYOUT_DETAILS_ENCRYPTION_KEY` in Render's secret fields. The Blueprint generates `JWT_SECRET`. Generate the encryption key locally with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Paste the 64-character output into Render's secret field. Do not commit or send it in chat.
6. Wait for the Render health check at `/api/health` to pass. Render will show the stable service URL. The service reads `RENDER_EXTERNAL_URL` to allow same-origin API requests.
7. In the Google OAuth client's **Authorized JavaScript origins**, add the exact Render origin, such as `https://your-service.onrender.com` (scheme and host only). Keep the same client ID in the Render `GOOGLE_CLIENT_ID` field; the build uses that value for the browser button.
8. Seed the payout configuration into Atlas from a trusted machine with the backend dependencies installed and `MONGO_URI` set to the Atlas URI:

   ```powershell
   cd backend
   npm ci
   npm run seed:payout-options
   ```

   This command adds only missing UPI payout options. It does not create demo users or change existing payout settings. New users can register through the site.

## Required service settings

The Blueprint sets `NODE_ENV=production`, enables proxy-aware rate limiting, generates `JWT_SECRET`, and prompts for the Atlas URI, Google OAuth client ID, and 32-byte hex payout encryption key. Keep the service's environment values private. The app creates a fresh MongoDB database; migrate only synthetic demo data if needed.

The app records withdrawal requests only. No real UPI transfer provider is connected.

