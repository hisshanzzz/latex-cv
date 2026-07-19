(() => {
  "use strict";

  async function request(path, options = {}) {
    const headers = Object.assign(
      {},
      (window.SpellQuestAuth && window.SpellQuestAuth.authHeaders()) || {
        "Content-Type": "application/json",
      },
      options.headers || {}
    );
    try {
      const res = await fetch(path, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        data: { error: "Network error — are you on Netlify Dev / a live deploy?" },
        err,
      };
    }
  }

  async function loadCloudProgress() {
    return request("/api/progress", { method: "GET" });
  }

  async function saveCloudProgress(progress) {
    return request("/api/progress", {
      method: "POST",
      body: JSON.stringify(progress),
    });
  }

  async function getLeaderboard(track = "all", mode = "bee") {
    return request(
      `/api/leaderboard?track=${encodeURIComponent(track)}&mode=${encodeURIComponent(mode)}`,
      { method: "GET" }
    );
  }

  async function submitScore({ name, score, track, mode }) {
    return request("/api/leaderboard", {
      method: "POST",
      body: JSON.stringify({ name, score, track, mode }),
    });
  }

  async function teacherOverview(pin) {
    return request("/api/teacher?action=overview", {
      method: "GET",
      headers: { "X-Teacher-Pin": pin },
    });
  }

  async function createClassroom(pin, { code, name, track }) {
    return request("/api/teacher", {
      method: "POST",
      headers: { "X-Teacher-Pin": pin },
      body: JSON.stringify({ action: "classroom", code, name, track }),
    });
  }

  window.SpellQuestAPI = {
    loadCloudProgress,
    saveCloudProgress,
    getLeaderboard,
    submitScore,
    teacherOverview,
    createClassroom,
  };
})();
