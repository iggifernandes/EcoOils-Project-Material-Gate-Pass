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
• 2 photos: front of the vehicle, and the material in the truck (passes before v1.3 hold 4 and are still read). The printed pass carries both photos on one page, no URL, no browser header/footer, page number only. Signatures are physical (driver, IC rep, EcoOils rep, Site Lead). Print = one A4 page that follows FM003, with QR.
• Public QR page shows status only.

## Files
• index.html built from index.src.html + app.js + app.i18n.js + qrcode.js (Patroli repo copy) + logo (dev/logo.txt) with dev/build.py. Edit the sources, rebuild, run the tests.
• Code.gs backend. Actions: config, create, mine, get, find, signed, cancel, verify (public); a_list, a_get, a_cancel, a_log (Admin PIN); b_list, b_get, b_release (BRIDGE_SECRET, used by Patroli).
• dev/t01.js backend, dev/ui.js phone app (needs playwright), dev/t02_patroli.js real Gate Pass + real Patroli (PATROLI_DIR).

## Version history
• v1.0 (26 Oct 2026): first release.
• v1.1 (26 Oct 2026): contractor code in the pass ID; each pass gets its own Drive subfolder (photos + signed copy).
• v1.2 (26 Oct 2026): ID document is KTP (16 digits) or SIM (12 digits), validated in the form and on the server, stored as 'KTP 1271...'; print shows ID NO (KTP/SIM). Owner pushes: Claude has push access to this repo (GitHub App), so commit and push updates directly; Code.gs is pasted into Apps Script by the owner.

• v1.3 (26 Oct 2026): IC responsible person phone (required); 2 photos instead of 4; photo viewer with zoom in/out/pinch/drag; printed pass includes the photos and fits one A4 page (@page margin 0, own 'Page 1 of 1', no URL); validity = the day of issue only and is not shown; separate QTY and UNIT columns with a unit dropdown (Config UNITS); signed copy is captured with an in-app document scanner (camera, page frame, crop, clean-up; falls back to the file chooser). Patroli v1.46 matches (2 photos, zoom, IC phone, 5 checks).
• v1.4 (26 Oct 2026): quick reasons dropdown for 'purpose of taking the items out' (6 for A, 7 for B, plus Other) with optional details; stored as one English text. Front end only, Code.gs unchanged (v1.3).
• v1.5 (27 Oct 2026): vehicle photos must be landscape (portrait refused at capture). Print has two modes: 'both sides' = 2 pages (page 1 the FM003 form, page 2 the two photos at 8 cm height each, landscape, no crop, QR and ref repeated; 1 sheet double-sided) and 'one side' = 1 page with small photos. Front end only; Code.gs unchanged (v1.3).
• v1.6 (27 Oct 2026): live digit counter under the ID field: KTP must be exactly 16 digits, SIM exactly 12 (owner confirmed). Front end only; Code.gs unchanged (v1.3).
