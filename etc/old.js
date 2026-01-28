/* =========================================================
   main.js — cleaned + organized (UPDATED) 
   ✅ Chapter slider window UI when chapters > 15
   ✅ Mobile max = 5 numbers
   ✅ Arrows always usable to shift window (even before selecting)
   ✅ Clicking book title resets window back to 1
   ✅ To-top button works on ALL pages:
      - appears only if page is scrollable
      - appears only when user is near the bottom

   ✅ FIXED:
   - Desktop arrows appear when chapters > 9
   - Mobile arrows appear when chapters > 5
========================================================= */

/* =========================
   PASSKEY GATE
========================= */
(() => {
  const EXPECTED_SHA256_HEX =
    "f909c3dac1a16a3b51e445cb0510984ce400c59d8294bc43b395b9eadebb1013";
  const STORAGE_KEY = "pj_passkey_ok_v1";
  const STYLE_ID = "passkey-gate-styles";

  const isUnlocked = () => sessionStorage.getItem(STORAGE_KEY) === "1";
  const setUnlocked = () => sessionStorage.setItem(STORAGE_KEY, "1");

  const lockScroll = (locked) => {
    const val = locked ? "hidden" : "";
    document.documentElement.style.overflow = val;
    document.body.style.overflow = val;
  };

  const toHex = (buf) => {
    const bytes = new Uint8Array(buf);
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
    return out;
  };

  const sha256Hex = async (text) => {
    if (!window.crypto?.subtle) throw new Error("Crypto API unavailable");
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return toHex(digest);
  };

  const injectGateStyles = () => {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .passkey-gate{
        position: fixed; inset: 0; z-index: 999999;
        display: grid; place-items: center;
        background: rgba(0,0,0,0.72);
        backdrop-filter: blur(8px);
      }
      .passkey-card{
        width: min(520px, 92vw);
        border-radius: 20px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(7, 20, 36, 0.78);
        box-shadow: 0 30px 80px rgba(0,0,0,0.55);
        padding: 22px 22px 18px;
        color: rgba(233,242,255,0.95);
      }
      .passkey-title{ margin: 0 0 8px; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
      .passkey-sub{ margin: 0 0 16px; opacity: 0.85; line-height: 1.6; font-size: 14px; }
      .passkey-row{ display: grid; gap: 10px; }
      .passkey-input{
        width: 100%; box-sizing: border-box;
        padding: 12px 14px; border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.06);
        color: rgba(233,242,255,0.95);
        outline: none; font-size: 16px;
      }
      .passkey-input:focus{
        border-color: rgba(125, 195, 255, 0.55);
        box-shadow: 0 0 0 3px rgba(80, 160, 255, 0.18);
      }
      .passkey-actions{ display: flex; gap: 10px; margin-top: 12px; }
      .passkey-btn{
        flex: 1; padding: 12px 14px; border: 0;
        border-radius: 14px; cursor: pointer;
        font-weight: 800; font-size: 15px;
      }
      .passkey-btn--primary{ background: rgba(47, 96, 246, 1); color: #fff; }
      .passkey-btn--primary:hover{ filter: brightness(1.05); }
      .passkey-btn--ghost{
        background: rgba(255,255,255,0.06);
        color: rgba(233,242,255,0.92);
        border: 1px solid rgba(255,255,255,0.12);
      }
      .passkey-btn--ghost:hover{ background: rgba(255,255,255,0.09); }
      .passkey-error{ margin-top: 10px; font-size: 13px; color: #ffb3b3; min-height: 18px; }
      .passkey-shake{ animation: passkeyShake 280ms ease-in-out; }
      @keyframes passkeyShake{
        0%{ transform: translateX(0); }
        25%{ transform: translateX(-7px); }
        50%{ transform: translateX(7px); }
        75%{ transform: translateX(-5px); }
        100%{ transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  };

  const showGate = () => {
    injectGateStyles();
    lockScroll(true);

    const gate = document.createElement("div");
    gate.className = "passkey-gate";
    gate.id = "passkey-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");

    gate.innerHTML = `
      <div class="passkey-card" id="passkey-card">
        <h1 class="passkey-title">Wait a sec...</h1>
        <p class="passkey-sub">This site requires an access key to continue.</p>

        <form class="passkey-row" id="passkey-form">
          <input
            class="passkey-input"
            id="passkey-input"
            type="password"
            autocomplete="current-password"
            placeholder="Access key"
            aria-label="Access key"
            required
          />

          <div class="passkey-actions">
            <button class="passkey-btn passkey-btn--ghost" type="button" id="passkey-clear">Clear</button>
            <button class="passkey-btn passkey-btn--primary" type="submit" id="passkey-enter">Enter</button>
          </div>

          <div class="passkey-error" id="passkey-error"></div>
        </form>
      </div>
    `;

    document.body.appendChild(gate);

    const $ = (sel) => gate.querySelector(sel);
    const input = $("#passkey-input");
    const error = $("#passkey-error");
    const card = $("#passkey-card");
    const form = $("#passkey-form");
    const clearBtn = $("#passkey-clear");
    const enterBtn = $("#passkey-enter");

    const unlock = () => {
      gate.remove();
      lockScroll(false);
    };

    const fail = (msg) => {
      error.textContent = msg;
      card.classList.remove("passkey-shake");
      void card.offsetWidth;
      card.classList.add("passkey-shake");
      input.select();
    };

    clearBtn.addEventListener("click", () => {
      input.value = "";
      error.textContent = "";
      input.focus();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.textContent = "";

      const val = (input.value || "").trim();
      if (!val) return;

      enterBtn.disabled = true;
      enterBtn.textContent = "Checking…";

      try {
        const got = await sha256Hex(val);
        if (got === EXPECTED_SHA256_HEX) {
          setUnlocked();
          unlock();
        } else {
          fail("Incorrect key. Try again.");
        }
      } catch {
        fail("This browser can’t verify the key here.");
      } finally {
        enterBtn.disabled = false;
        enterBtn.textContent = "Enter";
      }
    });

    setTimeout(() => input.focus(), 0);
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (!isUnlocked()) showGate();
  });
})();

/* =========================
   APP: PARTIAL LOADER + INITS
========================= */
(() => {
  /* ---------- Utilities ---------- */
  const getSiteBaseHref = () => {
    const scripts = Array.from(document.scripts || []);
    const main =
      scripts.find((s) => s.src && s.src.endsWith("/js/main.js")) ||
      scripts.find((s) => s.src && s.src.endsWith("js/main.js"));

    if (main?.src) return new URL("../", new URL(main.src)).href;
    return new URL("./", window.location.href).href;
  };

  const SITE_BASE = getSiteBaseHref();

  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scrollTop = (opts = {}) => {
    const instant = !!opts.instant;
    const behavior = instant || prefersReducedMotion() ? "auto" : "smooth";
    window.scrollTo({ top: 0, behavior });
  };

  const setCurrentYear = (root) => {
    const year = String(new Date().getFullYear());
    root.querySelectorAll("[data-year]").forEach((el) => (el.textContent = year));
    const y = root.querySelector("#year");
    if (y) y.textContent = year;
  };

  async function loadPartial(mountId, relativeToBase, { transform } = {}) {
    const mount = document.getElementById(mountId);
    if (!mount) return false;

    try {
      const url = new URL(relativeToBase, SITE_BASE).href;
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let html = await res.text();
      if (typeof transform === "function") html = transform(html);

      mount.innerHTML = html;
      setCurrentYear(mount);
      return true;
    } catch (err) {
      console.warn(`Could not load partial for #${mountId}:`, err);
      return false;
    }
  }

  /* ---------- Nav Toggle ---------- */
  function initNavToggle() {
    const toggle = document.querySelector(".nav-toggle");
    const links = document.getElementById("nav-links");
    if (!toggle || !links) return;

    if (toggle.dataset.bound === "1") return;
    toggle.dataset.bound = "1";

    const closeMenu = () => {
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", (e) => {
      if (!links.classList.contains("is-open")) return;
      const inside = e.target.closest(".nav") || e.target.closest("#nav-links");
      if (!inside) closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 720) closeMenu();
    });
  }

  /* =========================================================
     ✅ To-top Button (UPDATED)
     - Works on ALL pages
     - Only appears if page is scrollable
     - Only appears when user is near the bottom
  ========================================================= */
  let requestToTopVisibilityUpdate = () => { };

  function initToTopButton() {
    const btn = document.getElementById("to-top");
    if (!btn) return;

    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";

    btn.addEventListener("click", () => {
      scrollTop();
      requestToTopVisibilityUpdate();
    });

    const BOTTOM_THRESHOLD_PX = 140;
    const MIN_SCROLLABLE_PX = 40;

    let ticking = false;

    const updateVisibility = () => {
      ticking = false;

      const doc = document.documentElement;
      const scrollY = window.scrollY || doc.scrollTop || 0;
      const viewportH = window.innerHeight || 0;

      const fullH = Math.max(
        doc.scrollHeight,
        doc.offsetHeight,
        document.body?.scrollHeight || 0,
        document.body?.offsetHeight || 0
      );

      const scrollable = fullH > viewportH + MIN_SCROLLABLE_PX;
      const distanceFromBottom = fullH - (scrollY + viewportH);
      const nearBottom = scrollable && distanceFromBottom <= BOTTOM_THRESHOLD_PX;

      btn.hidden = !nearBottom;
    };

    requestToTopVisibilityUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateVisibility);
    };

    window.addEventListener("scroll", requestToTopVisibilityUpdate, { passive: true });
    window.addEventListener("resize", requestToTopVisibilityUpdate);
    requestToTopVisibilityUpdate();
  }

  /* ---------- Scene Image Reveal ---------- */
  function initSceneImageRevealForMount(mountEl) {
    if (!document.querySelector("[data-book-reader]")) return () => { };

    document.documentElement.classList.add("js-scene-reveal");

    const imgs = Array.from(mountEl.querySelectorAll("img.scene-img"));
    if (!imgs.length) return () => { };

    imgs.forEach((img) => {
      img.classList.remove("is-revealed");
      img.classList.remove("no-anim");
      img.dataset.revealedOnce = "0";
    });

    let ticking = false;

    const update = () => {
      ticking = false;

      const vh = window.innerHeight || 0;
      if (!vh) return;

      const mid = vh / 2;
      const band = Math.min(180, Math.max(90, Math.round(vh * 0.14)));

      let revealedCount = 0;

      for (const img of imgs) {
        if (img.dataset.revealedOnce === "1") {
          revealedCount++;
          continue;
        }

        const r = img.getBoundingClientRect();
        const inMidBand = r.top >= mid - band && r.top <= mid + band;

        if (inMidBand) {
          img.classList.add("is-revealed");
          img.dataset.revealedOnce = "1";
          revealedCount++;
        }
      }

      if (revealedCount === imgs.length) cleanup();
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    const cleanup = () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    requestUpdate();
    return () => cleanup();
  }

  /* ---------- Book Reader ---------- */
  function initBookReader() {
    const page = document.querySelector("[data-book-reader]");
    if (!page) return;

    const mount = document.getElementById("chapter-mount");
    const reader = document.getElementById("reader");
    const hint = document.getElementById("chapter-hint");
    const synopsis = document.getElementById("book-synopsis");
    if (!mount || !reader || !hint) return;

    let cleanupSceneReveal = () => { };

    reader.setAttribute("aria-label", "Book reader");

    const topNav = page.querySelector('[data-chapters="top"]');
    const bottomNav = page.querySelector('[data-chapters="bottom"]');

    const templates = new Map();
    page.querySelectorAll("template[data-chapter]").forEach((tpl) => {
      templates.set(String(tpl.dataset.chapter), tpl);
    });

    const getAllChips = () =>
      Array.from(page.querySelectorAll(".chapter-chip[data-chapter]"));

    const getLastChapterNumber = () => {
      const numsFromChips = getAllChips()
        .map((a) => Number(a.dataset.chapter))
        .filter((n) => Number.isFinite(n) && n > 0);

      const numsFromTemplates = Array.from(templates.keys())
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n) && n > 0);

      const all = numsFromChips.concat(numsFromTemplates);
      return all.length ? Math.max(...all) : null;
    };

    const TOTAL_CHAPTERS = getLastChapterNumber() || 0;

    // ✅ Desktop shows 9 max, Mobile shows 5 max
    const getWindowSize = () => (window.innerWidth <= 720 ? 5 : 9);

    // ✅ FIX: slider turns on based on CURRENT window size
    const useSlider = () => TOTAL_CHAPTERS > getWindowSize();

    let activeChapter = null;
    let windowStart = 1;

    function setChapterStripsVisible(visible) {
      if (topNav) topNav.hidden = !visible;
      if (bottomNav) bottomNav.hidden = !visible;
    }

    function clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }

    function computeWindowStartForChapter(ch) {
      const size = getWindowSize();
      const centerSlot = Math.ceil(size / 2);

      const idealStart = ch - (centerSlot - 1);
      const maxStart = Math.max(1, TOTAL_CHAPTERS - size + 1);

      return clamp(idealStart, 1, maxStart);
    }

    function makeChipLi({ label, href, chapter, ariaLabel }) {
      const li = document.createElement("li");
      const a = document.createElement("a");

      a.className = "chapter-chip";
      a.textContent = label;

      if (ariaLabel) a.setAttribute("aria-label", ariaLabel);

      if (chapter != null) {
        a.dataset.chapter = String(chapter);
        a.href = href || `#ch-${chapter}`;
      } else {
        a.href = "#";
      }

      li.appendChild(a);
      return li;
    }

    function renderSliderStrip(navEl) {
      if (!navEl) return;

      const size = getWindowSize();
      const maxStart = Math.max(1, TOTAL_CHAPTERS - size + 1);

      const start = clamp(windowStart, 1, maxStart);
      const end = Math.min(TOTAL_CHAPTERS, start + size - 1);

      navEl.innerHTML = "";

      // wrapper row (arrows + list)
      const row = document.createElement("div");
      row.className = "chapter-strip-row";

      // numbers list
      const ol = document.createElement("ol");
      ol.className = "chapter-strip-list";

      // ✅ on mobile, allow scroll + hide scrollbar
      if (window.innerWidth <= 720) {
        ol.classList.add("is-slider");
      }

      const leftDisabled =
        Number.isFinite(activeChapter) ? activeChapter <= 1 : start <= 1;

      const rightDisabled =
        Number.isFinite(activeChapter)
          ? activeChapter >= TOTAL_CHAPTERS
          : end >= TOTAL_CHAPTERS;

      // prev arrow
      const prev = document.createElement("a");
      prev.className = "chapter-chip";
      prev.dataset.action = "prev";
      prev.href = "#";
      prev.textContent = "<";
      prev.setAttribute("aria-label", "Previous chapter");

      if (leftDisabled) {
        prev.classList.add("is-disabled");
        prev.setAttribute("aria-disabled", "true");
        prev.setAttribute("tabindex", "-1");
      }

      // next arrow
      const next = document.createElement("a");
      next.className = "chapter-chip";
      next.dataset.action = "next";
      next.href = "#";
      next.textContent = ">";
      next.setAttribute("aria-label", "Next chapter");

      if (rightDisabled) {
        next.classList.add("is-disabled");
        next.setAttribute("aria-disabled", "true");
        next.setAttribute("tabindex", "-1");
      }

      // chapter numbers
      for (let i = start; i <= end; i++) {
        ol.appendChild(
          makeChipLi({
            label: String(i),
            chapter: i,
            href: `#ch-${i}`,
            ariaLabel: `Chapter ${i}`,
          })
        );
      }

      row.appendChild(prev);
      row.appendChild(ol);
      row.appendChild(next);
      navEl.appendChild(row);
    }

    function syncStrips() {
      if (!useSlider()) {
        // ✅ if slider isn't needed, just hide strips if chapters <= 1
        if (TOTAL_CHAPTERS <= 1) setChapterStripsVisible(false);
        return;
      }

      renderSliderStrip(topNav);
      renderSliderStrip(bottomNav);

      const chips = Array.from(page.querySelectorAll(".chapter-chip[data-chapter]"));
      chips.forEach((a) => {
        const active =
          activeChapter != null && a.dataset.chapter === String(activeChapter);
        a.classList.toggle("is-active", active);
        if (active) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }

    function upsertTheEnd(ch) {
      mount.querySelectorAll(".the-end-wrap").forEach((el) => el.remove());

      const last = getLastChapterNumber();
      if (!last || Number(ch) !== Number(last)) return;

      const chapterEl =
        mount.querySelector(`[data-chapter="${String(ch)}"]`) ||
        mount.querySelector(`#ch-${String(ch)}`);

      const target = chapterEl?.querySelector(".chapter-text") || mount;

      const wrap = document.createElement("div");
      wrap.className = "the-end-wrap";
      wrap.innerHTML = `<p class="the-end" aria-label="The End">The End</p>`;
      target.appendChild(wrap);
    }

    function resetSliderWindow() {
      windowStart = 1;
      activeChapter = null;
      if (useSlider()) syncStrips();
    }

    function clearChapter() {
      cleanupSceneReveal();
      cleanupSceneReveal = () => { };

      mount.innerHTML = "";
      activeChapter = null;

      reader.hidden = true;

      if (TOTAL_CHAPTERS === 1) {
        setChapterStripsVisible(true);
      }

      if (bottomNav) bottomNav.hidden = true;

      hint.hidden = false;
      if (synopsis) synopsis.hidden = false;

      resetSliderWindow();
      requestToTopVisibilityUpdate();
    }

    function renderPlaceholder(ch) {
      const section = document.createElement("section");
      section.className = "chapter";
      section.id = `ch-${ch}`;
      section.dataset.chapter = String(ch);

      section.innerHTML = `
        <header class="chapter-head">
          <div class="chapter-num">${ch}</div>
          <h2 class="chapter-title">Chapter ${ch}</h2>
        </header>
        <div class="chapter-text">
          <hr class="scene-break" />
          <p><em>This chapter hasn’t been added yet.</em></p>
          <hr class="scene-break" />
        </div>
      `;
      return section;
    }

    function renderChapter(ch) {
      const key = String(ch);
      const tpl = templates.get(key);

      mount.innerHTML = "";
      mount.appendChild(tpl ? tpl.content.cloneNode(true) : renderPlaceholder(ch));
      upsertTheEnd(ch);

      cleanupSceneReveal();
      cleanupSceneReveal = initSceneImageRevealForMount(mount);

      activeChapter = ch;

      if (useSlider()) {
        windowStart = computeWindowStartForChapter(ch);
        syncStrips();
      }

      reader.hidden = false;

      if (TOTAL_CHAPTERS === 1) {
        setChapterStripsVisible(false);
      } else {
        if (bottomNav) bottomNav.hidden = false;
      }

      hint.hidden = true;
      if (synopsis) synopsis.hidden = true;

      const wantedHash = `#ch-${ch}`;
      if (location.hash !== wantedHash) history.replaceState(null, "", wantedHash);

      scrollTop({ instant: true });
      requestToTopVisibilityUpdate();
    }

    const titleLink = page.querySelector(".book-header a");
    if (titleLink) {
      titleLink.href = window.location.pathname + window.location.search;
      titleLink.addEventListener("click", (e) => {
        e.preventDefault();
        history.replaceState(null, "", window.location.pathname + window.location.search);
        clearChapter();
        scrollTop({ instant: true });
      });
    }

    const parseChapterFromHash = () => {
      const m = location.hash.match(/ch-(\d+)/i);
      return m && m[1] ? Number(m[1]) : null;
    };

    const handleNavClick = (e) => {
      const chip = e.target.closest(".chapter-chip");
      if (!chip) return;

      if (chip.classList.contains("is-disabled")) {
        e.preventDefault();
        return;
      }

      const action = chip.dataset.action;

      if (action === "prev" || action === "next") {
        e.preventDefault();

        if (Number.isFinite(activeChapter)) {
          const next =
            action === "prev"
              ? Math.max(1, activeChapter - 1)
              : Math.min(TOTAL_CHAPTERS, activeChapter + 1);

          if (next !== activeChapter) renderChapter(next);
          return;
        }

        const size = getWindowSize();
        const maxStart = Math.max(1, TOTAL_CHAPTERS - size + 1);

        windowStart =
          action === "prev"
            ? clamp(windowStart - size, 1, maxStart)
            : clamp(windowStart + size, 1, maxStart);

        syncStrips();
        return;
      }

      const chStr = chip.dataset.chapter;
      if (!chStr) return;

      e.preventDefault();
      const ch = Number(chStr);
      if (!Number.isFinite(ch) || ch <= 0) return;

      renderChapter(ch);
    };

    topNav?.addEventListener("click", handleNavClick);
    bottomNav?.addEventListener("click", handleNavClick);

    window.addEventListener("hashchange", () => {
      const ch = parseChapterFromHash();
      if (ch == null) clearChapter();
      else renderChapter(ch);
    });

    window.addEventListener("resize", () => {
      // ✅ slider can turn on/off when resizing now
      syncStrips();
      requestToTopVisibilityUpdate();
    });

    // initial render
    if (useSlider()) {
      resetSliderWindow();
      syncStrips();
    }

    const initial = parseChapterFromHash();
    if (initial == null) clearChapter();
    else renderChapter(initial);
  }

  /* ---------- Random Covers ---------- */
  function initRandomBookCovers() {
    const imgs = document.querySelectorAll("img[data-cover-dir][data-cover-count]");
    if (!imgs.length) return;

    imgs.forEach((img) => {
      const dir = String(img.dataset.coverDir || "").trim();
      const count = Number(img.dataset.coverCount || "0");
      const ext = String(img.dataset.coverExt || "png").trim();
      if (!dir || !Number.isFinite(count) || count < 1) return;

      const n = 1 + Math.floor(Math.random() * count);
      const chosen = new URL(`${dir}${n}.${ext}`, SITE_BASE).href;
      const fallback = new URL(`${dir}1.${ext}`, SITE_BASE).href;

      img.style.opacity = "0";
      const reveal = () => (img.style.opacity = "1");

      img.addEventListener("load", reveal, { once: true });
      img.addEventListener(
        "error",
        () => {
          if (img.src !== fallback) {
            img.addEventListener("load", reveal, { once: true });
            img.src = fallback;
          } else {
            reveal();
          }
        },
        { once: true }
      );

      img.src = chosen;
    });
  }

  /* =========================
     ✅ LIBRARY: ALPHABETICAL SORT (OPT-IN ONLY)
     - Only sorts lists with: data-alpha-sort="true"
  ========================= */
  function initLibraryAlphaSort() {
    const lists = Array.from(document.querySelectorAll('[data-alpha-sort="true"]'));
    if (!lists.length) return;

    lists.forEach((list) => {
      const items = Array.from(list.querySelectorAll("a.book-item"));
      if (items.length < 2) return;

      const getSortKey = (a) => {
        const aria = (a.getAttribute("aria-label") || "").trim();
        if (aria) return aria.replace(/^open\s+/i, "").trim();

        const imgAlt = (a.querySelector("img")?.getAttribute("alt") || "").trim();
        if (imgAlt) return imgAlt.replace(/^cover( art)?( for)?\s+/i, "").trim();

        return (a.getAttribute("href") || "").trim();
      };

      items.sort((a, b) =>
        getSortKey(a).localeCompare(getSortKey(b), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );

      items.forEach((a) => list.appendChild(a));
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    initRandomBookCovers();

    await loadPartial("site-header", "partials/header.html", {
      transform: (html) => html.replaceAll("__ROOT__", SITE_BASE),
    });

    await loadPartial("site-waves", "partials/ocean-waves.html");
    await loadPartial("site-to-top", "partials/to-top.html");
    await loadPartial("site-footer", "partials/footer.html");

    initNavToggle();
    initToTopButton();
    initBookReader();
    initLibraryAlphaSort();

    requestToTopVisibilityUpdate();

    document.documentElement.classList.remove("is-loading");
    document.documentElement.classList.add("is-ready");
  });
})();

/* =========================
   BASIC PROTECTION
========================= */
(() => {
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("dragstart", (e) => {
    const el = e.target;
    if (el && el.tagName === "IMG") e.preventDefault();
  });
})();