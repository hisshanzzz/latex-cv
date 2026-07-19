(() => {
  "use strict";

  const WORDS = window.SPELLQUEST_WORDS || [];
  const STORAGE_KEY = "spellquest-progress-v1";

  const TRACKS = [
    {
      id: "starter",
      title: "Starter",
      grades: "Grades 1–5",
      blurb: "Short, friendly words to build confidence.",
    },
    {
      id: "builder",
      title: "Builder",
      grades: "Grades 6–9",
      blurb: "School vocabulary and spelling patterns.",
    },
    {
      id: "challenger",
      title: "Challenger",
      grades: "Grades 10–11",
      blurb: "Contest-ready words and tricky patterns.",
    },
    {
      id: "elite",
      title: "Elite",
      grades: "Grades 12–13",
      blurb: "Rare spellings and advanced vocabulary.",
    },
    {
      id: "open",
      title: "Open",
      grades: "Students & adults",
      blurb: "Speaking, study, and real-world words.",
    },
  ];

  const TIERS = [
    { id: 1, name: "Spark", words: 8, lives: 5, hints: 3 },
    { id: 2, name: "Flame", words: 10, lives: 4, hints: 2 },
    { id: 3, name: "Blaze", words: 12, lives: 3, hints: 2 },
    { id: 4, name: "Inferno", words: 12, lives: 3, hints: 1 },
    { id: 5, name: "Thunder", words: 15, lives: 3, hints: 1 },
    { id: 6, name: "Crown", words: 15, lives: 2, hints: 0 },
  ];

  const STAGES_PER_TIER = 5;

  const state = {
    track: null,
    mode: null,
    progress: loadProgress(),
    bee: null,
    hive: null,
  };

  const $ = (id) => document.getElementById(id);
  const screens = {
    home: $("screen-home"),
    how: $("screen-how"),
    track: $("screen-track"),
    mode: $("screen-mode"),
    map: $("screen-map"),
    bee: $("screen-bee"),
    hive: $("screen-hive"),
    result: $("screen-result"),
    leaderboard: $("screen-leaderboard"),
  };

  function loadProgress() {
    const base = defaultProgress();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      const cleared = { ...base.cleared };
      if (saved.cleared && typeof saved.cleared === "object") {
        TRACKS.forEach((t) => {
          cleared[t.id] = { ...(saved.cleared[t.id] || {}) };
        });
      }
      return {
        cleared,
        highScore: Number(saved.highScore) || 0,
        hiveBest: Number(saved.hiveBest) || 0,
      };
    } catch {
      return base;
    }
  }

  function defaultProgress() {
    const cleared = {};
    TRACKS.forEach((t) => {
      cleared[t.id] = {};
    });
    return { cleared, highScore: 0, hiveBest: 0 };
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    // Cloud sync when signed in (Asgardeo + Netlify API)
    const auth = window.SpellQuestAuth && window.SpellQuestAuth.getAuth();
    if (auth && auth.signedIn && window.SpellQuestAPI) {
      window.SpellQuestAPI.saveCloudProgress({
        cleared: state.progress.cleared,
        highScore: state.progress.highScore,
        hiveBest: state.progress.hiveBest,
        track: state.track,
        displayName: auth.user && auth.user.name,
      }).catch(() => {});
    }
  }

  async function mergeCloudProgress() {
    const auth = window.SpellQuestAuth && window.SpellQuestAuth.getAuth();
    if (!auth || !auth.signedIn || !window.SpellQuestAPI) return;
    const res = await window.SpellQuestAPI.loadCloudProgress();
    if (!res.ok || !res.data || !res.data.progress) return;
    const cloud = res.data.progress;
    const local = state.progress;
    const mergedCleared = { ...defaultProgress().cleared };
    TRACKS.forEach((t) => {
      mergedCleared[t.id] = {
        ...(cloud.cleared && cloud.cleared[t.id] ? cloud.cleared[t.id] : {}),
        ...(local.cleared[t.id] || {}),
      };
    });
    state.progress = {
      cleared: mergedCleared,
      highScore: Math.max(Number(cloud.highScore) || 0, Number(local.highScore) || 0),
      hiveBest: Math.max(Number(cloud.hiveBest) || 0, Number(local.hiveBest) || 0),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }

  async function refreshLeaderboard() {
    const list = $("leaderboard-list");
    if (!list || !window.SpellQuestAPI) return;
    list.innerHTML = "<li>Loading…</li>";
    const track = state.track || "all";
    const res = await window.SpellQuestAPI.getLeaderboard(track, "bee");
    if (!res.ok) {
      list.innerHTML =
        "<li>Leaderboard needs a Netlify deploy (or <code>npm run dev</code>). Guest play still works.</li>";
      return;
    }
    const scores = (res.data && res.data.scores) || [];
    if (!scores.length) {
      list.innerHTML = "<li>No scores yet — clear a bee stage to appear here.</li>";
      return;
    }
    list.innerHTML = scores
      .slice(0, 20)
      .map(
        (row, i) =>
          `<li><strong>#${i + 1}</strong> ${escapeText(row.name)} — ${row.score} pts <span class="lb-meta">${escapeText(row.track)} · ${new Date(row.at).toLocaleDateString()}</span></li>`
      )
      .join("");
  }

  function escapeText(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", key !== name);
    });
    if ($("btn-home")) $("btn-home").hidden = name === "home";
    if ($("btn-progress")) {
      $("btn-progress").hidden = name === "home" || name === "how" || !state.track;
    }
    if ($("btn-leaderboard")) {
      $("btn-leaderboard").hidden = name === "bee" || name === "hive";
    }
  }

  function trackLabel(id) {
    const t = TRACKS.find((x) => x.id === id);
    return t ? `${t.title} · ${t.grades}` : id;
  }

  function wordsForTrack(trackId) {
    return WORDS.filter((w) => w.track === trackId);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Browser TTS — slow contest pace, best English voice we can find */
  let cachedVoices = [];
  let speakTimer = null;
  let selectedVoiceURI = localStorage.getItem("spellquest-voice") || "";
  let speechWarm = false;

  function refreshVoices() {
    if (!window.speechSynthesis) return;
    cachedVoices = window.speechSynthesis.getVoices() || [];
  }

  function scoreVoice(v) {
    let score = 0;
    const name = v.name || "";
    const lang = v.lang || "";
    if (!/^en/i.test(lang) && !/english/i.test(name)) return -100;
    if (/en-GB|en-US|en-AU|en-IN/i.test(lang)) score += 20;
    if (/natural|neural|online \(natural\)/i.test(name)) score += 50;
    if (/google/i.test(name)) score += 35;
    if (/microsoft/i.test(name)) score += 30;
    if (/samantha|karen|moira|daniel|zira|aria|jenny|guy|sonia|ryan|libby/i.test(name)) score += 25;
    if (/female|woman/i.test(name)) score += 5;
    if (/compact|mobile|eloquence/i.test(name)) score -= 15;
    if (/en-GB/i.test(lang)) score += 4;
    return score;
  }

  function englishVoices() {
    if (!cachedVoices.length) refreshVoices();
    return cachedVoices
      .filter((v) => scoreVoice(v) > 0)
      .sort((a, b) => scoreVoice(b) - scoreVoice(a));
  }

  function pickEnglishVoice() {
    const list = englishVoices();
    if (!list.length) return null;
    if (selectedVoiceURI) {
      const chosen = list.find((v) => v.voiceURI === selectedVoiceURI);
      if (chosen) return chosen;
    }
    return list[0];
  }

  function fillVoiceSelect() {
    const sel = $("voice-select");
    if (!sel) return;
    refreshVoices();
    const list = englishVoices();
    const current = selectedVoiceURI || sel.value;
    sel.innerHTML = "";
    if (!list.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Default system voice";
      sel.appendChild(opt);
      return;
    }
    list.slice(0, 12).forEach((v, i) => {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = `${i === 0 ? "★ " : ""}${v.name} (${v.lang})`;
      sel.appendChild(opt);
    });
    if (current && [...sel.options].some((o) => o.value === current)) {
      sel.value = current;
      selectedVoiceURI = current;
    } else {
      sel.value = list[0].voiceURI;
      selectedVoiceURI = list[0].voiceURI;
    }
  }

  function setSpeechStatus(message, kind) {
    const el = $("bee-feedback");
    if (!el || screens.bee.classList.contains("hidden")) return;
    if (!message) {
      if (el.dataset.speech === "1") {
        el.textContent = "";
        el.className = "bee-feedback";
        delete el.dataset.speech;
      }
      return;
    }
    el.dataset.speech = "1";
    el.textContent = message;
    el.className = "bee-feedback" + (kind ? ` ${kind}` : "");
  }

  function setHearButtonsBusy(busy) {
    ["btn-hear", "btn-hear-slow"].forEach((id) => {
      const btn = $(id);
      if (!btn) return;
      btn.disabled = busy;
      if (id === "btn-hear") btn.textContent = busy ? "Speaking…" : "Hear word";
      if (id === "btn-hear-slow") btn.textContent = busy ? "Speaking…" : "Hear slowly";
    });
  }

  function speakWord(word, opts) {
    const options = opts || {};
    const fromUserClick = Boolean(options.fromUserClick);
    const slow = Boolean(options.slow);
    const clean = String(word || "").trim();
    if (!clean) return;

    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") {
      setSpeechStatus("Voice not available. Use Chrome or Edge.", "bad");
      return;
    }

    const synth = window.speechSynthesis;
    refreshVoices();

    if (speakTimer) {
      clearTimeout(speakTimer);
      speakTimer = null;
    }
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }

    setHearButtonsBusy(true);
    if (fromUserClick) setSpeechStatus(slow ? "Speaking slowly…" : "Speaking…", "ok");

    // Chromium needs a gap after cancel()
    speakTimer = setTimeout(() => {
      speakTimer = null;
      try {
        if (synth.paused) synth.resume();
        const voice = pickEnglishVoice();
        // Slow contest pace — never rush the word
        const rate = slow ? 0.48 : 0.58;
        const say = slow
          ? `Listen carefully. The word is. ${clean}. Again. ${clean}.`
          : `The word is. ${clean}.`;

        const utter = new SpeechSynthesisUtterance(say);
        if (voice) {
          utter.voice = voice;
          utter.lang = voice.lang || "en-US";
        } else {
          utter.lang = "en-US";
        }
        utter.rate = rate;
        utter.pitch = 0.95;
        utter.volume = 1;

        let finished = false;
        const finishUi = () => {
          if (finished) return;
          finished = true;
          setHearButtonsBusy(false);
          if (fromUserClick) setSpeechStatus("", "");
        };

        utter.onstart = () => {
          speechWarm = true;
          const label = voice ? `Voice: ${voice.name}` : "Speaking…";
          if (fromUserClick) setSpeechStatus(label, "ok");
        };
        utter.onend = finishUi;
        utter.onerror = () => {
          finishUi();
          setSpeechStatus("Voice error — unmute the tab, then try Hear word again.", "bad");
        };

        synth.speak(utter);
        setTimeout(() => {
          try {
            if (synth.paused) synth.resume();
          } catch {
            /* ignore */
          }
        }, 60);
        setTimeout(finishUi, slow ? 16000 : 10000);
      } catch {
        setHearButtonsBusy(false);
        setSpeechStatus("Voice failed. Click Hear word again.", "bad");
      }
    }, fromUserClick || speechWarm ? 150 : 280);
  }

  function speak(text, fromUserClick) {
    speakWord(text, { fromUserClick: Boolean(fromUserClick), slow: false });
  }

  function initSpeech() {
    if (!window.speechSynthesis) return;
    const sync = () => {
      refreshVoices();
      fillVoiceSelect();
    };
    sync();
    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", sync);
    } else {
      window.speechSynthesis.onvoiceschanged = sync;
    }
    setTimeout(sync, 200);
    setTimeout(sync, 800);
    setTimeout(sync, 2000);
  }

  function stageKey(tier, stage) {
    return `${tier}-${stage}`;
  }

  function isCleared(track, tier, stage) {
    return Boolean(state.progress.cleared[track]?.[stageKey(tier, stage)]);
  }

  function highestUnlocked(track) {
    let maxTier = 1;
    let maxStage = 1;
    for (let t = 1; t <= TIERS.length; t += 1) {
      for (let s = 1; s <= STAGES_PER_TIER; s += 1) {
        if (isCleared(track, t, s)) {
          maxTier = t;
          maxStage = s;
        }
      }
    }
    // next unlock
    if (isCleared(track, maxTier, maxStage)) {
      if (maxStage < STAGES_PER_TIER) return { tier: maxTier, stage: maxStage + 1 };
      if (maxTier < TIERS.length) return { tier: maxTier + 1, stage: 1 };
      return { tier: maxTier, stage: maxStage };
    }
    return { tier: 1, stage: 1 };
  }

  function canPlay(track, tier, stage) {
    if (tier === 1 && stage === 1) return true;
    if (stage === 1) return isCleared(track, tier - 1, STAGES_PER_TIER);
    return isCleared(track, tier, stage - 1);
  }

  /* ---------- HOME / NAV ---------- */
  function renderTracks() {
    const grid = $("track-grid");
    grid.innerHTML = "";
    TRACKS.forEach((track) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "track-card";
      btn.innerHTML = `<span>${track.grades}</span><strong>${track.title}</strong><p>${track.blurb}</p>`;
      btn.addEventListener("click", () => {
        state.track = track.id;
        $("mode-track-label").textContent = `Track: ${trackLabel(track.id)}`;
        showScreen("mode");
      });
      grid.appendChild(btn);
    });
  }

  function renderMap() {
    $("map-sub").textContent = `${trackLabel(state.track)} · unlock stages in order`;
    const list = $("tier-list");
    list.innerHTML = "";
    const unlocked = highestUnlocked(state.track);

    TIERS.forEach((tier) => {
      const block = document.createElement("div");
      block.className = "tier-block";
      block.innerHTML = `
        <h3>Tier ${tier.id} · ${tier.name}</h3>
        <p class="tier-meta">${tier.words} words · ${tier.lives} lives · ${tier.hints} hints</p>
        <div class="stage-row"></div>
      `;
      const row = block.querySelector(".stage-row");
      for (let s = 1; s <= STAGES_PER_TIER; s += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stage-btn";
        btn.textContent = String(s);
        const cleared = isCleared(state.track, tier.id, s);
        const playable = canPlay(state.track, tier.id, s);
        if (cleared) btn.classList.add("cleared");
        if (unlocked.tier === tier.id && unlocked.stage === s) btn.classList.add("current");
        btn.disabled = !playable;
        btn.addEventListener("click", () => startBee(tier.id, s));
        row.appendChild(btn);
      }
      list.appendChild(block);
    });
  }

  /* ---------- CLASSIC BEE ---------- */
  function startBee(tierId, stage) {
    const tier = TIERS.find((t) => t.id === tierId);
    if (!tier || !state.track) return;
    const pool = shuffle(wordsForTrack(state.track));
    if (pool.length < tier.words) {
      alert("Not enough words in this track. Try another track.");
      return;
    }
    const queue = pool.slice(0, tier.words);
    state.bee = {
      tier: tier.id,
      stage,
      tierMeta: tier,
      queue,
      index: 0,
      score: 0,
      lives: tier.lives,
      hints: tier.hints,
      usedHint: false,
      locked: false,
      suddenDeath: tier.id === 6 && stage === STAGES_PER_TIER,
    };
    showScreen("bee");
    $("bee-input").disabled = false;
    updateBeeHud();
    presentBeeWord();
  }

  function currentBeeWord() {
    return state.bee?.queue[state.bee.index] || null;
  }

  function updateBeeHud() {
    const b = state.bee;
    $("hud-tier").textContent = `${b.tier} ${b.tierMeta.name}`;
    $("hud-stage").textContent = String(b.stage);
    $("hud-word").textContent = `${b.index + 1}/${b.queue.length}`;
    $("hud-score").textContent = String(b.score);
    $("hud-lives").textContent = "♥".repeat(Math.max(0, b.lives)) || "—";
    $("hud-hints").textContent = String(b.hints);
  }

  function presentBeeWord() {
    const word = currentBeeWord();
    if (!word) return;
    state.bee.usedHint = false;
    $("bee-prompt").textContent = "Listen, then spell the word.";
    $("bee-def").textContent = `Definition: ${word.definition}`;
    $("bee-hint").hidden = true;
    $("bee-hint").textContent = "";
    $("bee-feedback").textContent = "";
    $("bee-feedback").className = "bee-feedback";
    $("bee-input").value = "";
    $("bee-input").focus();
    updateBeeHud();
    // Auto-speak may be blocked until the user clicks Hear word once
    setTimeout(() => speak(word.word, false), 300);
  }

  function useHint() {
    const b = state.bee;
    const word = currentBeeWord();
    if (!b || !word || b.hints <= 0 || b.usedHint) return;
    b.hints -= 1;
    b.usedHint = true;
    const first = word.word[0].toUpperCase();
    const syllables = Math.max(1, Math.ceil(word.word.length / 3));
    $("bee-hint").hidden = false;
    $("bee-hint").textContent = `Hint: starts with “${first}” · about ${syllables} syllable beat(s) · ${word.word.length} letters`;
    updateBeeHud();
  }

  function submitBee(event) {
    event.preventDefault();
    const b = state.bee;
    const word = currentBeeWord();
    if (!b || !word || b.locked) return;
    const guess = $("bee-input").value.trim().toLowerCase();
    if (!guess) return;

    b.locked = true;
    $("bee-input").disabled = true;

    if (guess === word.word) {
      const bonus = b.usedHint ? 8 : 15;
      b.score += bonus + word.word.length;
      $("bee-feedback").textContent = `Correct! +${bonus + word.word.length}`;
      $("bee-feedback").className = "bee-feedback ok";
      advanceBee();
    } else {
      b.lives -= 1;
      updateBeeHud();
      $("bee-feedback").textContent = `Not quite. Correct spelling: ${word.word}`;
      $("bee-feedback").className = "bee-feedback bad";
      if (b.lives <= 0) {
        setTimeout(() => endBee(false), 900);
        return;
      }
      advanceBee();
    }
  }

  function advanceBee() {
    const b = state.bee;
    if (!b) return;
    setTimeout(() => {
      b.index += 1;
      b.locked = false;
      $("bee-input").disabled = false;
      if (b.index >= b.queue.length) {
        endBee(true);
        return;
      }
      presentBeeWord();
    }, 850);
  }

  function endBee(won) {
    const b = state.bee;
    if (!b) return;
    b.locked = true;
    if (won) {
      if (!state.progress.cleared[state.track]) state.progress.cleared[state.track] = {};
      state.progress.cleared[state.track][stageKey(b.tier, b.stage)] = true;
      state.progress.highScore = Math.max(state.progress.highScore || 0, b.score);
      saveProgress();
      // Submit to cloud leaderboard (works for guests too on live Netlify)
      if (window.SpellQuestAPI) {
        const auth = window.SpellQuestAuth && window.SpellQuestAuth.getAuth();
        const name =
          (auth && auth.user && auth.user.name) ||
          localStorage.getItem("spellquest-display-name") ||
          "Guest";
        window.SpellQuestAPI.submitScore({
          name,
          score: b.score,
          track: state.track || "all",
          mode: "bee",
        }).catch(() => {});
      }
      $("result-eyebrow").textContent = "Stage clear";
      $("result-title").textContent = "Well spelled!";
      $("result-body").textContent = `You finished Tier ${b.tier} · Stage ${b.stage} with ${b.score} points and ${b.lives} life(s) left.`;
      $("result-primary").textContent = "Next stage";
      $("result-primary").onclick = () => {
        const next = highestUnlocked(state.track);
        startBee(next.tier, next.stage);
      };
    } else {
      $("result-eyebrow").textContent = "Bee over";
      $("result-title").textContent = "Out of lives";
      $("result-body").textContent = `Score: ${b.score}. Review the miss, then try the stage again.`;
      $("result-primary").textContent = "Retry stage";
      $("result-primary").onclick = () => startBee(b.tier, b.stage);
    }
    $("result-secondary").textContent = "Map";
    $("result-secondary").onclick = () => {
      renderMap();
      showScreen("map");
    };
    showScreen("result");
  }

  /* ---------- LETTER HIVE ---------- */
  function lettersOf(word) {
    return word.toLowerCase().replace(/[^a-z]/g, "").split("");
  }

  function uniqueLetters(word) {
    return [...new Set(lettersOf(word))];
  }

  function canMakeFrom(word, letters, center) {
    const chars = lettersOf(word);
    if (!chars.includes(center)) return false;
    // hive allows reuse of the 7 letters freely (classic spelling-bee style)
    return chars.every((ch) => letters.includes(ch));
  }

  function buildHivePuzzle(trackId) {
    const pool = wordsForTrack(trackId).filter((w) => w.word.length >= 4);
    const candidates = shuffle(pool).slice(0, 120);
    for (const seed of candidates) {
      const uniq = uniqueLetters(seed.word);
      if (uniq.length < 5 || uniq.length > 7) continue;
      let letters = uniq.slice();
      const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
      while (letters.length < 7) {
        const next = alphabet[Math.floor(Math.random() * alphabet.length)];
        if (!letters.includes(next)) letters.push(next);
      }
      letters = shuffle(letters).slice(0, 7);
      // Prefer a center letter that unlocks the most words
      let center = letters[0];
      let valid = [];
      letters.forEach((candidate) => {
        const matches = pool.filter(
          (w) => canMakeFrom(w.word, letters, candidate) && w.word.length >= 4
        );
        if (matches.length > valid.length) {
          valid = matches;
          center = candidate;
        }
      });
      if (valid.length >= 6) {
        return {
          letters,
          center,
          valid: valid.map((w) => w.word).sort(),
          found: [],
          score: 0,
          guess: "",
        };
      }
    }
    // fallback: use whole track letters from common vowels/consonants
    const fallbackLetters = ["a", "e", "r", "s", "t", "l", "n"];
    const center = "e";
    const valid = pool
      .filter((w) => canMakeFrom(w.word, fallbackLetters, center) && w.word.length >= 4)
      .map((w) => w.word);
    const safeValid =
      valid.length >= 4
        ? valid
        : pool.filter((w) => w.word.length >= 4).slice(0, 8).map((w) => w.word);
    return {
      letters: fallbackLetters,
      center,
      valid: safeValid.length ? [...new Set(safeValid)].sort() : ["star", "late", "near", "seal", "rent"],
      found: [],
      score: 0,
      guess: "",
    };
  }

  function startHive() {
    state.hive = buildHivePuzzle(state.track);
    $("hive-track").textContent = TRACKS.find((t) => t.id === state.track)?.title || state.track;
    showScreen("hive");
    renderHive();
  }

  function renderHive() {
    const h = state.hive;
    const grid = $("hex-grid");
    grid.innerHTML = "";
    const outer = h.letters.filter((l) => l !== h.center);
    while (outer.length < 6) outer.push(outer[0] || "e");

    // Layout: 3 outer, center, 3 outer (CSS places center on column 2)
    const order = [
      outer[0],
      outer[1],
      outer[2],
      h.center,
      outer[3],
      outer[4],
      outer[5],
    ];

    order.forEach((ch, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      // Index 3 is always the visual center tile
      btn.className = "hex" + (index === 3 ? " center" : "");
      btn.textContent = ch.toUpperCase();
      btn.addEventListener("click", () => addHiveLetter(ch));
      grid.appendChild(btn);
    });

    $("hive-guess").textContent = h.guess.toUpperCase();
    $("hive-found").textContent = String(h.found.length);
    $("hive-target").textContent = String(h.valid.length);
    $("hive-score").textContent = String(h.score);
    const list = $("hive-word-list");
    list.innerHTML = "";
    h.found
      .slice()
      .sort()
      .forEach((w) => {
        const li = document.createElement("li");
        li.textContent = w;
        list.appendChild(li);
      });
    $("hive-feedback").textContent = "";
    $("hive-feedback").className = "bee-feedback";
  }

  function addHiveLetter(ch) {
    state.hive.guess += ch;
    $("hive-guess").textContent = state.hive.guess.toUpperCase();
  }

  function hiveDelete() {
    state.hive.guess = state.hive.guess.slice(0, -1);
    $("hive-guess").textContent = state.hive.guess.toUpperCase();
  }

  function hiveShuffle() {
    const h = state.hive;
    const outer = shuffle(h.letters.filter((l) => l !== h.center));
    h.letters = [h.center, ...outer];
    renderHive();
  }

  function hiveEnter() {
    const h = state.hive;
    const guess = h.guess.toLowerCase();
    h.guess = "";
    $("hive-guess").textContent = "";
    const fb = $("hive-feedback");

    if (guess.length < 4) {
      fb.textContent = "Words need at least 4 letters.";
      fb.className = "bee-feedback bad";
      return;
    }
    if (!guess.includes(h.center)) {
      fb.textContent = `Must use center letter “${h.center.toUpperCase()}”.`;
      fb.className = "bee-feedback bad";
      return;
    }
    if (!canMakeFrom(guess, h.letters, h.center)) {
      fb.textContent = "Uses letters outside the hive.";
      fb.className = "bee-feedback bad";
      return;
    }
    if (!h.valid.includes(guess)) {
      fb.textContent = "Not in today’s SpellQuest pool.";
      fb.className = "bee-feedback bad";
      return;
    }
    if (h.found.includes(guess)) {
      fb.textContent = "Already found.";
      fb.className = "bee-feedback bad";
      return;
    }

    h.found.push(guess);
    const points = guess.length >= 7 ? 14 : guess.length;
    h.score += points;
    state.progress.hiveBest = Math.max(state.progress.hiveBest || 0, h.score);
    saveProgress();
    fb.textContent = `Nice! +${points}`;
    fb.className = "bee-feedback ok";
    $("hive-found").textContent = String(h.found.length);
    $("hive-score").textContent = String(h.score);
    const list = $("hive-word-list");
    const li = document.createElement("li");
    li.textContent = guess;
    list.appendChild(li);

    if (h.found.length >= h.valid.length) {
      $("result-eyebrow").textContent = "Hive complete";
      $("result-title").textContent = "You cleared the hive!";
      $("result-body").textContent = `Found all ${h.valid.length} words for ${h.score} points.`;
      $("result-primary").textContent = "New hive";
      $("result-primary").onclick = () => startHive();
      $("result-secondary").textContent = "Modes";
      $("result-secondary").onclick = () => showScreen("mode");
      showScreen("result");
    }
  }

  /* ---------- WIRE EVENTS ---------- */
  function wire() {
    renderTracks();

    $("btn-start").addEventListener("click", () => showScreen("track"));
    $("btn-how").addEventListener("click", () => showScreen("how"));
    $("btn-how-back").addEventListener("click", () => showScreen("track"));
    $("btn-home").addEventListener("click", () => showScreen("home"));
    $("brand-home").addEventListener("click", (e) => {
      e.preventDefault();
      showScreen("home");
    });
    $("btn-progress").addEventListener("click", () => {
      if (!state.track) {
        showScreen("track");
        return;
      }
      renderMap();
      showScreen("map");
    });

    $("mode-bee").addEventListener("click", () => {
      state.mode = "bee";
      renderMap();
      showScreen("map");
    });
    $("mode-hive").addEventListener("click", () => {
      state.mode = "hive";
      startHive();
    });
    $("btn-map-back").addEventListener("click", () => showScreen("mode"));

    $("btn-hear").addEventListener("click", () => {
      const word = currentBeeWord();
      if (!word) {
        setSpeechStatus("No word loaded yet. Pick a stage first.", "bad");
        return;
      }
      speakWord(word.word, { fromUserClick: true, slow: false });
    });
    $("btn-hear-slow").addEventListener("click", () => {
      const word = currentBeeWord();
      if (!word) {
        setSpeechStatus("No word loaded yet. Pick a stage first.", "bad");
        return;
      }
      speakWord(word.word, { fromUserClick: true, slow: true });
    });
    $("voice-select").addEventListener("change", (e) => {
      selectedVoiceURI = e.target.value || "";
      localStorage.setItem("spellquest-voice", selectedVoiceURI);
      const word = currentBeeWord();
      if (word) speakWord(word.word, { fromUserClick: true, slow: false });
    });
    $("btn-hint").addEventListener("click", useHint);
    $("bee-form").addEventListener("submit", submitBee);

    $("hive-delete").addEventListener("click", hiveDelete);
    $("hive-shuffle").addEventListener("click", hiveShuffle);
    $("hive-enter").addEventListener("click", hiveEnter);
    $("hive-new").addEventListener("click", startHive);

    document.addEventListener("keydown", (e) => {
      if (!screens.hive || screens.hive.classList.contains("hidden")) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const h = state.hive;
      if (!h) return;
      if (e.key === "Enter") {
        e.preventDefault();
        hiveEnter();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        hiveDelete();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const ch = e.key.toLowerCase();
        if (h.letters.includes(ch)) addHiveLetter(ch);
      }
    });
  }

  if (!WORDS.length) {
    console.error("SpellQuest word pool failed to load.");
    const lede = document.querySelector(".lede");
    if (lede) {
      lede.textContent = "Word pool failed to load. Refresh the page or check data/words.js.";
    }
  }
  initSpeech();
  wire();

  const lbBtn = $("btn-leaderboard");
  if (lbBtn) {
    lbBtn.addEventListener("click", () => {
      showScreen("leaderboard");
      refreshLeaderboard();
    });
  }
  const lbBack = $("btn-leaderboard-back");
  if (lbBack) lbBack.addEventListener("click", () => showScreen("home"));
  const lbRefresh = $("btn-leaderboard-refresh");
  if (lbRefresh) lbRefresh.addEventListener("click", () => refreshLeaderboard());

  async function boot() {
    if (window.SpellQuestAuth) {
      await window.SpellQuestAuth.init();
      await mergeCloudProgress();
      window.addEventListener("spellquest:auth", async () => {
        await mergeCloudProgress();
        window.SpellQuestAuth.renderAuthBar();
      });
    }
    showScreen("home");
  }
  boot();
})();
