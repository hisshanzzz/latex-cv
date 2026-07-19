/**
 * SpellQuest runtime config.
 * Fill Asgardeo values after creating a Single-Page Application in Asgardeo.
 * Leave clientId empty to run in Guest mode (local progress only).
 *
 * Production site: https://spellquest-englishprohub.netlify.app
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
 * Paste your org name + Client ID below when ready (do not invent values).
 * Then set Netlify env ASGARDEO_ORG to the same org name.
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
    // Organization name from Asgardeo Console URL: https://console.asgardeo.io/t/<org>/...
    org: "SpellQuest",
    // From Asgardeo Console → Applications → SpellQuest → Client ID
    clientId: "7CLd15CM1Xw0HB6VKA6ZtFJaBX8a",
    // Dynamic: matches current host (prod Netlify or local netlify dev)
    signInRedirectURL: window.location.origin + "/",
    signOutRedirectURL: window.location.origin + "/",
    scope: ["openid", "profile", "email"],
  },
};

