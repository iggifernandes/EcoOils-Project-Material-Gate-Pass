# EcoOils Material Gate Pass - project guide for Claude sessions

Owner: Iggy (Ignatius Ambrosio Viegas e Fernandes), HSSE Manager, Mentari Project, PT EcoOils Jaya Indonesia, Sei Mangkei SEZ. Form EOSM-HSSE-FM003 (non-returnable material out of site).

## Owner preferences (apply always)
• Free options first; no pay-as-you-go API use. Hosting GitHub Pages (iggifernandes); backend Google Sheets + Apps Script on the personal Gmail, not the work email.
• EN / ID / MS toggle; version number top right directly above the toggle; Jost, minimal Shell style; titles Jost light uppercase wide letter-spacing grey.
• Lists as plain "•" bullets. End every update with "Action needed: ..." or "No action required".
• Never ask the owner to paste secrets or PINs into chat.

## Decisions (24-26 Oct 2026)
• Serial number is NOT typed by the IC: the server creates MGP-<contractor code>-YYMM-NNNN (e.g. MGP-GSB-2610-0001, numbering per contractor per month) when the request is submitted; then Print.
• Anyone with the link can raise a request. Final approval to leave = the scanned signed copy checked against the paper original by a guard.
• Gate Pass is a separate app (own repo, Sheet, Apps Script). The guard side lives in the Patroli app (v1.45, Gate pass button; guard ticks 5 checks incl. KTP/SIM number) and calls this backend server to server with the shared secret.
• 4 photos: front, top, left, right. Signatures are physical (driver, IC rep, EcoOils rep, Site Lead). Print = one A4 page that follows FM003, with QR.
• Public QR page shows status only.

## Files
• index.html built from index.src.html + app.js + app.i18n.js + qrcode.js (Patroli repo copy) + logo (dev/logo.txt) with dev/build.py. Edit the sources, rebuild, run the tests.
• Code.gs backend. Actions: config, create, mine, get, find, signed, cancel, verify (public); a_list, a_get, a_cancel, a_log (Admin PIN); b_list, b_get, b_release (BRIDGE_SECRET, used by Patroli).
• dev/t01.js backend, dev/ui.js phone app (needs playwright), dev/t02_patroli.js real Gate Pass + real Patroli (PATROLI_DIR).

## Version history
• v1.0 (26 Oct 2026): first release.
• v1.1 (26 Oct 2026): contractor code in the pass ID; each pass gets its own Drive subfolder (photos + signed copy).
• v1.2 (26 Oct 2026): ID document is KTP (16 digits) or SIM (12 digits), validated in the form and on the server, stored as 'KTP 1271...'; print shows ID NO (KTP/SIM). Owner pushes: Claude has push access to this repo (GitHub App), so commit and push updates directly; Code.gs is pasted into Apps Script by the owner.
