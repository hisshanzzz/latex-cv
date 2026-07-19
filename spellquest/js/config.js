/**
 * SpellQuest runtime config.
 * Fill Asgardeo values after creating a Single-Page Application in Asgardeo.
 * Leave clientId empty to run in Guest mode (local progress only).
 *
 * Production site: https://spellquest-englishprohub.netlify.app
 *
 * IMPORTANT: englishprohub is on the EU region.
 *   Console: https://console.eu.asgardeo.io/t/englishprohub/...
 *   API:     https://api.eu.asgardeo.io/t/englishprohub
 *
 * Asgardeo Console → Applications → SpellQuest → Protocol:
 *   Authorized redirect URLs:
 *     https://spellquest-englishprohub.netlify.app/
 *     http://127.0.0.1:8888/
 *     http://localhost:8888/
 *   Allowed origins:
 *     https://spellquest-englishprohub.netlify.app
 *     http://127.0.0.1:8888
 *     http://localhost:8888
 *
 * Branding hex values (Asgardeo → Branding → Styles & Text → Dark theme):
 *   see setup.html#branding
 */
window.SPELLQUEST_CONFIG = {
  appName: "SpellQuest by English Pro Hub",
  hubWhatsApp: "https://wa.me/94774932692",
  hubEmail: "mailto:englishprohubclass@gmail.com",
  personalEmail: "mailto:hisshanm@yahoo.com",
  asgardeo: {
    // Root org NAME from console URL /t/<name>/ — not the UUID
    org: "englishprohub",
    // Optional: Organization Management UUID (child/B2B org). Not used in baseUrl.
    organizationId: "9c1bb48d-5cd8-426d-b4b7-f5df74ab77d2",
    // "eu" or "us" — englishprohub lives on EU (myaccount.eu.asgardeo.io)
    region: "eu",
    // Explicit EU baseUrl (preferred by auth.js)
    baseUrl: "https://api.eu.asgardeo.io/t/englishprohub",
    // From Asgardeo Console → Applications → SpellQuest → Client ID
    clientId: "7CLd15CM1Xw0HB6VKA6ZtFJaBX8a",
    // Dynamic: matches current host (prod Netlify or local netlify dev)
    signInRedirectURL: window.location.origin + "/",
    signOutRedirectURL: window.location.origin + "/",
    scope: ["openid", "profile", "email"],
  },
};
