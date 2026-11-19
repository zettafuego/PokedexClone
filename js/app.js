/* Pokédex Clone — UI estilo pokemon.com/el/pokedex */
(function () {
  "use strict";

  /** @type {Array<any>} */
  let ALL = [];
  let filtered = [];
  let activeTypes = new Set();
  let sortMode = "num-asc";
  let query = "";

  const $ = (s, r = document) => r.querySelector(s);
  const grid = $("#grid");
  const status = $("#status");
  const modalBg = $("#modalBg");
  const detailCache = new Map();

  function typeClass(en) {
    return "t-" + String(en || "normal").toLowerCase();
  }

  function spriteUrl(p) {
    // local first, then remote official artwork
    if (p.sprite && !p._localFail) return p.sprite;
    return (
      p.sprite_remote ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`
    );
  }

  function renderTypes(types) {
    return (types || [])
      .map(
        (t) =>
          `<span class="badge ${typeClass(t.en)}">${escapeHtml(t.es || t.en)}</span>`
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cardHTML(p) {
    const legend =
      p.is_legendary || p.is_mythical
        ? `<span class="tag-legend">${p.is_mythical ? "Mítico" : "Legendario"}</span>`
        : "";
    return `
      <article class="card" data-id="${p.id}" tabindex="0" role="button" aria-label="${escapeHtml(p.name_es)}">
        <div class="card-img">
          <img src="${spriteUrl(p)}" alt="${escapeHtml(p.name_es)}" loading="lazy"
            onerror="this.onerror=null;this.src='${p.sprite_remote || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`}'" />
        </div>
        <div class="card-body">
          <div class="card-num">N.º ${escapeHtml(p.number || String(p.id).padStart(4, "0"))}</div>
          <div class="card-name">${escapeHtml(p.name_es || p.name)}${legend}</div>
          <div class="card-types">${renderTypes(p.types)}</div>
        </div>
      </article>`;
  }

  function applyFilters() {
    const q = query.trim().toLowerCase();
    filtered = ALL.filter((p) => {
      if (activeTypes.size) {
        const ens = (p.types || []).map((t) => t.en);
        for (const t of activeTypes) {
          if (!ens.includes(t)) return false;
        }
      }
      if (!q) return true;
      return (
        String(p.id).includes(q) ||
        String(p.number || "").includes(q) ||
        (p.name || "").includes(q) ||
        (p.name_es || "").toLowerCase().includes(q)
      );
    });

    filtered.sort((a, b) => {
      if (sortMode === "num-asc") return a.id - b.id;
      if (sortMode === "num-desc") return b.id - a.id;
      if (sortMode === "az")
        return (a.name_es || a.name).localeCompare(b.name_es || b.name, "es");
      if (sortMode === "za")
        return (b.name_es || b.name).localeCompare(a.name_es || a.name, "es");
      return 0;
    });

    renderGrid();
  }

  function renderGrid() {
    if (!filtered.length) {
      grid.innerHTML = "";
      status.innerHTML =
        '<div class="empty"><strong>Ningún Pokémon coincide con tu búsqueda.</strong><p>Reduce filtros o prueba otro nombre/número.</p></div>';
      $("#countLabel").textContent = "0 resultados";
      return;
    }
    status.innerHTML = "";
    $("#countLabel").textContent = `${filtered.length} Pokémon`;
    // virtualize lightly: first 200, load more button
    const page = window.__page || 60;
    const slice = filtered.slice(0, page);
    grid.innerHTML = slice.map(cardHTML).join("");
    if (slice.length < filtered.length) {
      status.innerHTML = `<div style="text-align:center;margin:20px 0">
        <button class="btn btn-primary" id="btnMore">Cargar más Pokémon (${slice.length}/${filtered.length})</button>
      </div>`;
      $("#btnMore").onclick = () => {
        window.__page = page + 60;
        renderGrid();
      };
    }
  }

  async function loadIndex() {
    status.innerHTML = '<div class="loading">Cargando Pokédex…</div>';
    try {
      const res = await fetch("data/pokemon_index.json");
      if (!res.ok) throw new Error("No se encontró data/pokemon_index.json. Ejecuta scrape_pokedex.py");
      ALL = await res.json();
      filtered = ALL.slice();
      window.__page = 60;
      buildTypeChips();
      applyFilters();
    } catch (e) {
      status.innerHTML = `<div class="empty"><strong>Sin datos locales</strong><p>${escapeHtml(e.message)}</p>
        <p>Ejecuta: <code>python scrape_pokedex.py</code> y luego abre con el servidor local.</p></div>`;
    }
  }

  function buildTypeChips() {
    const box = $("#typeChips");
    if (!box) return;
    const types = [
      "normal","fire","water","electric","grass","ice","fighting","poison",
      "ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy",
    ];
    const labels = {
      normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico",
      grass: "Planta", ice: "Hielo", fighting: "Lucha", poison: "Veneno",
      ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho",
      rock: "Roca", ghost: "Fantasma", dragon: "Dragón", dark: "Siniestro",
      steel: "Acero", fairy: "Hada",
    };
    box.innerHTML = types
      .map(
        (t) =>
          `<button type="button" class="chip ${typeClass(t)}" data-type="${t}">${labels[t]}</button>`
      )
      .join("");
    box.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.type;
        if (activeTypes.has(t)) {
          activeTypes.delete(t);
          btn.classList.remove("active");
        } else {
          activeTypes.add(t);
          btn.classList.add("active");
        }
        window.__page = 60;
        applyFilters();
      });
    });
  }

  async function openDetail(id) {
    modalBg.classList.add("open");
    const body = $("#modalContent");
    body.innerHTML = '<div class="loading">Cargando ficha…</div>';

    let p = detailCache.get(id);
    if (!p) {
      try {
        const res = await fetch(
          `data/pokemon/${String(id).padStart(4, "0")}.json`
        );
        if (res.ok) {
          p = await res.json();
          detailCache.set(id, p);
        }
      } catch (_) {}
    }
    // fallback: index card only
    if (!p) {
      p = ALL.find((x) => x.id === id);
      if (!p) {
        body.innerHTML = '<div class="empty">No encontrado</div>';
        return;
      }
    }

    const img =
      p.sprites?.official ||
      p.sprites?.home ||
      p.sprite_remote ||
      spriteUrl(p);
    const stats = p.stats || {};
    const statOrder = [
      "hp",
      "attack",
      "defense",
      "special-attack",
      "special-defense",
      "speed",
    ];
    const statsHtml = statOrder
      .map((k) => {
        const s = stats[k];
        if (!s) return "";
        const v = s.value || 0;
        const pct = Math.min(100, Math.round((v / 255) * 100));
        return `<div class="stat-row">
          <span>${escapeHtml(s.name_es || k)}</span>
          <div class="stat-track"><div class="stat-fill" style="width:${pct}%"></div></div>
          <strong>${v}</strong>
        </div>`;
      })
      .join("");

    const abs = (p.abilities || [])
      .map(
        (a) =>
          `${escapeHtml(a.name_es || a.name)}${a.is_hidden ? " (oculta)" : ""}`
      )
      .join(", ");

    const weak = (p.weaknesses || [])
      .map((w) => `<span class="badge ${typeClass(w.en)}">${escapeHtml(w.es)}</span>`)
      .join(" ");

    body.innerHTML = `
      <button class="modal-close" id="modalClose" aria-label="Cerrar">×</button>
      <div class="modal-hero">
        <img src="${img}" alt="${escapeHtml(p.name_es || p.name)}" />
        <div class="num">N.º ${escapeHtml(p.number || String(p.id).padStart(4, "0"))}</div>
        <h2>${escapeHtml(p.name_es || p.name)}</h2>
        <div class="genus">${escapeHtml(p.genus_es || "")}</div>
        <div class="card-types" style="justify-content:center">${renderTypes(p.types)}</div>
      </div>
      <div class="modal-body">
        ${p.flavor_es ? `<p class="flavor">${escapeHtml(p.flavor_es)}</p>` : ""}
        <div class="kv">
          <div class="box"><label>Altura</label><div>${p.height_m != null ? p.height_m + " m" : "—"}</div></div>
          <div class="box"><label>Peso</label><div>${p.weight_kg != null ? p.weight_kg + " kg" : "—"}</div></div>
          <div class="box"><label>Habilidades</label><div>${abs || "—"}</div></div>
          <div class="box"><label>Debilidades</label><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${weak || "—"}</div></div>
        </div>
        <h3 style="margin:0 0 10px;font-size:0.95rem">Estadísticas base</h3>
        ${statsHtml || "<p>Sin stats en índice. Ejecuta el scraper completo.</p>"}
      </div>`;

    $("#modalClose").onclick = closeModal;
  }

  function closeModal() {
    modalBg.classList.remove("open");
  }

  function surprise() {
    if (!ALL.length) return;
    const p = ALL[Math.floor(Math.random() * ALL.length)];
    openDetail(p.id);
  }

  function wire() {
    $("#search").addEventListener("input", (e) => {
      query = e.target.value;
      window.__page = 60;
      applyFilters();
    });
    $("#sort").addEventListener("change", (e) => {
      sortMode = e.target.value;
      applyFilters();
    });
    $("#btnSurprise").addEventListener("click", surprise);
    $("#btnReset").addEventListener("click", () => {
      query = "";
      activeTypes.clear();
      sortMode = "num-asc";
      $("#search").value = "";
      $("#sort").value = "num-asc";
      document.querySelectorAll(".chip.active").forEach((c) => c.classList.remove("active"));
      window.__page = 60;
      applyFilters();
    });

    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (card) openDetail(Number(card.dataset.id));
    });
    grid.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const card = e.target.closest(".card");
        if (card) {
          e.preventDefault();
          openDetail(Number(card.dataset.id));
        }
      }
    });
    modalBg.addEventListener("click", (e) => {
      if (e.target === modalBg) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    loadIndex();
  }

  document.addEventListener("DOMContentLoaded", wire);
})();
