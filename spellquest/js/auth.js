(() => {
  "use strict";

  const state = {
    ready: false,
    configured: false,
    signedIn: false,
    user: null,
    idToken: null,
    client: null,
  };

  function cfg() {
    return (window.SPELLQUEST_CONFIG && window.SPELLQUEST_CONFIG.asgardeo) || {};
  }

  function isConfigured() {
    const c = cfg();
    return Boolean(c.clientId && c.org);
  }

  async function init() {
    state.configured = isConfigured();
    if (!state.configured) {
      state.ready = true;
      renderAuthBar();
      return state;
    }

    if (!window.AsgardeoAuth || !window.AsgardeoAuth.AsgardeoSPAClient) {
      console.warn("Asgardeo SDK missing — Guest mode only.");
      state.configured = false;
      state.ready = true;
      renderAuthBar();
      return state;
    }

    const c = cfg();
    const client = window.AsgardeoAuth.AsgardeoSPAClient.getInstance();
    state.client = client;
    await client.initialize({
      signInRedirectURL: c.signInRedirectURL || window.location.origin + "/",
      signOutRedirectURL: c.signOutRedirectURL || window.location.origin + "/",
      clientID: c.clientId,
      baseUrl: `https://api.asgardeo.io/t/${c.org}`,
      scope: c.scope || ["openid", "profile", "email"],
    });

    try {
      const basic = await client.getBasicUserInfo();
      if (basic && (basic.sub || basic.email || basic.username)) {
        state.signedIn = true;
        state.user = {
          sub: basic.sub || basic.username || basic.email,
          name: basic.displayName || basic.username || basic.email || "Student",
          email: basic.email || "",
        };
        try {
          state.idToken = await client.getIDToken();
        } catch {
          state.idToken = null;
        }
      }
    } catch {
      /* not signed in */
    }

    // Handle redirect callback
    try {
      if (window.AsgardeoAuth.SPAUtils && window.AsgardeoAuth.SPAUtils.hasAuthSearchParamsInURL()) {
        await client.signIn();
        const basic = await client.getBasicUserInfo();
        state.signedIn = true;
        state.user = {
          sub: basic.sub || basic.username || basic.email,
          name: basic.displayName || basic.username || basic.email || "Student",
          email: basic.email || "",
        };
        state.idToken = await client.getIDToken();
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err) {
      console.warn("Asgardeo sign-in callback:", err);
    }

    state.ready = true;
    renderAuthBar();
    window.dispatchEvent(new CustomEvent("spellquest:auth", { detail: getAuth() }));
    return state;
  }

  async function signIn() {
    if (!state.configured || !state.client) {
      window.location.href = "setup.html#asgardeo";
      return;
    }
    await state.client.signIn();
  }

  async function signOut() {
    if (!state.client) return;
    await state.client.signOut();
  }

  function getAuth() {
    return {
      ready: state.ready,
      configured: state.configured,
      signedIn: state.signedIn,
      user: state.user,
      idToken: state.idToken,
    };
  }

  function authHeaders() {
    const h = { "Content-Type": "application/json" };
    if (state.idToken) h.Authorization = `Bearer ${state.idToken}`;
    return h;
  }

  function renderAuthBar() {
    const el = document.getElementById("auth-bar");
    if (!el) return;
    if (!state.configured) {
      el.innerHTML = `
        <span class="auth-pill">Guest mode</span>
        <a class="ghost-btn" href="setup.html#asgardeo">Enable Asgardeo login</a>
      `;
      return;
    }
    if (state.signedIn && state.user) {
      el.innerHTML = `
        <span class="auth-pill">Signed in · ${escapeHtml(state.user.name)}</span>
        <button type="button" class="ghost-btn" id="btn-signout">Sign out</button>
      `;
      const btn = document.getElementById("btn-signout");
      if (btn) btn.addEventListener("click", () => signOut());
      return;
    }
    el.innerHTML = `
      <button type="button" class="primary-btn auth-login-btn" id="btn-signin">Sign in with Asgardeo</button>
    `;
    const btn = document.getElementById("btn-signin");
    if (btn) btn.addEventListener("click", () => signIn());
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.SpellQuestAuth = {
    init,
    signIn,
    signOut,
    getAuth,
    authHeaders,
    renderAuthBar,
  };
})();
