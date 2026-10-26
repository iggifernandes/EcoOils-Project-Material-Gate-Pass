# EcoOils Material Gate Pass (v1.0)

Replaces the handwritten Material Gate Pass (form EOSM-HSSE-FM003) for non-returnable material leaving the Mentari site.

## Files
• index.html - the whole app (mobile first, EN / ID / MS, version top right above the toggle). This is the only file GitHub Pages needs.
• Code.gs - Google Apps Script backend. Pasted into the "EcoOils Gate Pass Log" Google Sheet (Extensions > Apps Script). It holds no secrets (they are script properties). Keeping it in the repo is only a backup.
• dev/ - tests with a mock Google runtime. `node t01.js` tests the backend (no extra install). `node ui.js` and `node ui2.js` test the phone app and the printed page in headless Chromium (need the `playwright` package). `node t02_patroli.js` runs the real Gate Pass and the real Patroli scripts together (set PATROLI_DIR to the Patroli repo).
• dev/build.py rebuilds index.html from index.src.html + app.js + app.i18n.js (+ the QR library and the logo). If you only edit index.html by hand (for example to paste API_URL) you do not need it.

## How it works
1. The IC (anyone with the link) fills the form on a phone and takes 4 photos of the vehicle (front, top, left, right). The server creates the reference number (MGP-YYMM-0001) when the pass is submitted.
2. The IC prints the pass (one A4 page, QR code, signature blocks) and collects 4 physical signatures: driver, IC rep, EcoOils rep, Site Lead.
3. The IC uploads a photo of the signed pass. The pass becomes "Pending release".
4. A guard opens Gate pass in the Patroli app, scans the QR (or types the reference), compares the signed copy and the 4 photos with the paper original and the vehicle, ticks the four checks and releases. The release is recorded under the guard's own PIN name, with time and phone location.
5. A normal phone camera scanning the QR opens a read-only status page (no names, no ID numbers, no photos).

Validity: Awaiting signatures for 72 h, then Expired. After the signed copy is uploaded, 48 h to release, then Expired (Config sheet: SIGN_WINDOW_HOURS, VALID_HOURS).

## Deploy (first time)
1. Personal Gmail: create a Google Sheet "EcoOils Gate Pass Log". Extensions > Apps Script. Replace the code with Code.gs. Save.
2. Run `setup` (allow the permissions). Run `showCodes` and read ADMIN_PIN and BRIDGE_SECRET in the Execution log. Keep both private: never paste them in chat or WhatsApp.
3. Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone > Deploy. Copy the web app URL (ends in /exec).
4. GitHub (iggifernandes): new public repo EcoOils-Project-Material-Gate-Pass. Upload index.html (and README.md, CLAUDE.md). Settings > Pages > Deploy from branch main / root.
5. In index.html set `var API_URL='<the /exec URL>';` and commit.
6. Patroli: see "Connect to Patroli" below.
7. Hub: replace index.html of EcoOils-Project-HSSE-Hub with the v1.25 file (adds the Material Gate Pass card under Security).

## Connect to Patroli (Patroli v1.41)
1. Patroli Apps Script: replace Code.gs with v1.41. Save.
2. Project Settings (gear) > Script properties > Add: GATEPASS_URL = the Gate Pass /exec URL; GATEPASS_SECRET = BRIDGE_SECRET from showCodes.
3. Run `gateCheck` once. Allow the new permission (connect to an external service). The log must say "Gate Pass reachable".
4. Deploy > Manage deployments > Edit > New version > Deploy (same URL).
5. Patroli repo: upload the new index.html and sw.js. Phones pick it up on the second open.

## Updating later
• Code.gs change: paste it, then Deploy > Manage deployments > Edit > New version.
• index.html change: upload to GitHub; phones pick it up on refresh.
• Settings (companies, departments, validity, daily cap per company, site lead name printed under Approval By): Config sheet.

## Notes
• Photos and signed copies are saved in the Drive folder "EcoOils Material Gate Pass" (created by setup). Roughly 0.5 MB per pass.
• Anyone with the link can raise a pass, so the control is the signed copy plus the guard's physical check, not the form. Limits: 30 new passes per 10 minutes for the whole site, daily cap per company (default 40), honeypot field, photo size limits.
• The token that lets an IC upload or cancel a pass is kept on that phone. A new phone: Find a pass (reference + vehicle number).
• The public repo contains no secrets. ADMIN_PIN, BRIDGE_SECRET and the token salt are script properties.
