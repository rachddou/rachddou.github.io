/* Vibrant Leaves Generator page: a menu of parameters, 9 images generated in
 * parallel web workers (worker.js / generator.js), colours from images dropped
 * by the user or random colours. */
(function () {
  "use strict";

  const VL = window.VibrantLeaves;
  const BASE = document.currentScript.src.replace(/[^/]*$/, "");
  const N_IMAGES = 9;
  const IMAGE_SIZES = [256, 384, 512, 768];
  const N_WORKERS = Math.max(2, Math.min(N_IMAGES, (navigator.hardwareConcurrency || 4) - 1));
  const SHAPE_TYPES = ["poly", "disk", "rectangle", "mix"];
  const SHAPE_LABELS = { poly: "Polygon", disk: "Disk", rectangle: "Rectangle", mix: "Mix" };
  const SHAPE_HINTS = {
    poly: "Concave polygons (concave hull of random points, optionally smoothed)",
    disk: "Disks (classical dead leaves)",
    rectangle: "Rotated rectangles",
    mix: "Polygons, disks and rectangles, in equal proportions",
  };
  const TEXTURE_TYPES = ["sin", "freq_noise", "texture_mixes"];
  const TEXTURE_LABELS = { sin: "Sinusoids", freq_noise: "1/f noise", texture_mixes: "Mixes" };
  const TEXTURE_HINTS = {
    sin: "Two colours mixed by thresholded sinusoids",
    freq_noise: "Coloured noise with a 1/f spectrum",
    texture_mixes: "Two 1/f noises mixed by sinusoids (or a grid)",
  };
  const TEXTURE_COLORS = ["#d9822b", "#3b7dd8", "#8a5cc2"];
  // settings of config/default.yaml in the Python code, except textures: off at
  // first, as they are the slowest part of the generation
  const DEFAULTS = {
    shape_type: "poly", radius_min: 10, radius_max: 500, power_law_exponent: 3,
    texture_enabled: false, texture_shares: { sin: 0.16, freq_noise: 0.67, texture_mixes: 0.17 },
    slope_min: 0.5, slope_max: 2.5, apply_warp: true, apply_perspective: true,
    grey: false, depth_of_field: true, extra_blur: false, downscale: true, image_size: 512,
  };

  const $ = (id) => document.getElementById(id);
  const state = JSON.parse(JSON.stringify(DEFAULTS));
  let sources = [];       // RGB images { w, h, data } dropped by the user
  let seedBase = 0;       // "New images" changes it; parameters changes keep it

  /* ---------- multi-handle slider ----------
   * values: sorted handle positions; segments (optional): one style per interval
   * between [min, handles..., max]. */
  class MultiSlider {
    constructor(el, { min, max, step, values, log = false, minGap = 0, partition = false, onChange }) {
      Object.assign(this, { el, min, max, step, log, minGap, partition, onChange });
      el.classList.toggle("vl-partition", partition);
      el.innerHTML = '<div class="vl-track"></div>';
      this.track = el.firstChild;
      this.track.addEventListener("pointerdown", (e) => this.onTrack(e));
      this.setValues(values);
    }
    toPos(v) {
      if (!this.log) return (v - this.min) / (this.max - this.min);
      return Math.log(v / this.min) / Math.log(this.max / this.min);
    }
    fromPos(p) {
      p = Math.min(1, Math.max(0, p));
      const v = this.log ? this.min * Math.pow(this.max / this.min, p) : this.min + p * (this.max - this.min);
      return Math.round(v / this.step) * this.step;
    }
    setValues(values, segments) {
      this.values = values.slice();
      if (segments) this.segments = segments;
      this.render();
    }
    render() {
      const edges = [this.min, ...this.values, this.max];
      this.track.querySelectorAll(".vl-seg").forEach((s) => s.remove());
      (this.segments || [null, {}, null]).forEach((seg, i) => {
        if (!seg) return;
        const left = this.toPos(edges[i]), right = this.toPos(edges[i + 1]);
        const div = document.createElement("div");
        div.className = "vl-seg";
        div.style.left = `${left * 100}%`;
        div.style.width = `${(right - left) * 100}%`;
        div.style.background = seg.color || "var(--vl-accent)";
        if (seg.title) div.title = seg.title;
        this.track.appendChild(div);
        // longest label that fits: "name NN%", then "NN%", then nothing
        for (const text of [seg.label, seg.short, ""]) {
          if (text === undefined) continue;
          div.textContent = text;
          if (div.scrollWidth <= div.clientWidth) break;
        }
      });
      // handles are only re-created when their number changes, so that a drag
      // in progress keeps its element (and pointer capture)
      if (!this.handles || this.handles.length !== this.values.length) {
        (this.handles || []).forEach((h) => h.remove());
        this.handles = this.values.map((v, i) => {
          const h = document.createElement("button");
          h.className = "vl-handle";
          h.type = "button";
          h.setAttribute("role", "slider");
          h.setAttribute("aria-valuemin", this.min);
          h.setAttribute("aria-valuemax", this.max);
          h.addEventListener("pointerdown", (e) => this.startDrag(e, i));
          h.addEventListener("keydown", (e) => this.onKey(e, i));
          this.el.appendChild(h);
          return h;
        });
      }
      this.handles.forEach((h, i) => {
        h.style.left = `${this.toPos(this.values[i]) * 100}%`;
        h.setAttribute("aria-valuenow", this.values[i]);
      });
    }
    bounds(i) {
      const lo = i === 0 ? this.min : this.values[i - 1] + this.minGap;
      const hi = i === this.values.length - 1 ? this.max : this.values[i + 1] - this.minGap;
      return [lo, hi];
    }
    move(i, v) {
      const [lo, hi] = this.bounds(i);
      v = Math.min(hi, Math.max(lo, v));
      if (v === this.values[i]) return;
      this.values[i] = +v.toFixed(6);
      this.onChange(this.values.slice());
    }
    posFromEvent(e) {
      const r = this.track.getBoundingClientRect();
      return (e.clientX - r.left) / r.width;
    }
    startDrag(e, i) {
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      const onMove = (ev) => this.move(i, this.fromPos(this.posFromEvent(ev)));
      const onUp = () => { handle.removeEventListener("pointermove", onMove); handle.removeEventListener("pointerup", onUp); };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
    }
    onTrack(e) {
      // move the closest handle to the click
      const v = this.fromPos(this.posFromEvent(e));
      let best = 0;
      this.values.forEach((x, i) => { if (Math.abs(this.toPos(x) - this.toPos(v)) < Math.abs(this.toPos(this.values[best]) - this.toPos(v))) best = i; });
      this.move(best, v);
    }
    onKey(e, i) {
      const delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (!delta) return;
      e.preventDefault();
      const v = this.fromPos(this.toPos(this.values[i]) + delta * 0.01);
      this.move(i, v === this.values[i] ? this.values[i] + delta * this.step : v);
    }
  }

  /* ---------- texture shares ---------- */
  const activeTextures = () => TEXTURE_TYPES.filter((t) => state.texture_shares[t] > 0);
  const textureColor = (t) => TEXTURE_COLORS[TEXTURE_TYPES.indexOf(t)];
  let shareSlider;

  function renderShares() {
    const types = activeTextures();
    const cuts = [];
    let acc = 0;
    types.slice(0, -1).forEach((t) => { acc += state.texture_shares[t]; cuts.push(acc); });
    const segments = types.map((t) => ({
      color: textureColor(t),
      label: `${TEXTURE_LABELS[t]} ${Math.round(state.texture_shares[t] * 100)}%`,
      short: `${Math.round(state.texture_shares[t] * 100)}%`,
      title: TEXTURE_LABELS[t],
    }));
    shareSlider.setValues(cuts, segments);
    $("vl-share-legend").innerHTML = types.length
      ? types.map((t) => `<span style="--c:${textureColor(t)}"><i></i>${TEXTURE_LABELS[t]} ${(state.texture_shares[t] * 100).toFixed(0)}%</span>`).join("")
      : '<span class="vl-bad">Select at least one texture type.</span>';
    document.querySelectorAll("#vl-texture-picker .vl-option").forEach((b) => b.setAttribute("aria-pressed", state.texture_shares[b.dataset.type] > 0));
  }

  function onSharesDragged(cuts) {
    const types = activeTextures();
    const edges = [0, ...cuts, 1];
    types.forEach((t, i) => { state.texture_shares[t] = +(edges[i + 1] - edges[i]).toFixed(4); });
    renderShares();
  }

  function toggleTexture(t) {
    const shares = state.texture_shares;
    if (shares[t] > 0) {
      // removed: its share goes to the others, proportionally
      shares[t] = 0;
      const rest = activeTextures();
      const total = rest.reduce((s, x) => s + shares[x], 0);
      rest.forEach((x) => { shares[x] = total > 0 ? shares[x] / total : 1 / rest.length; });
    } else {
      // added: gets an equal share, taken proportionally from the others
      const n = activeTextures().length + 1;
      activeTextures().forEach((x) => { shares[x] *= (n - 1) / n; });
      shares[t] = 1 / n;
    }
    renderShares();
  }

  /* ---------- icons, drawn with the generator ---------- */
  function rgbToCanvas(img) {
    const c = document.createElement("canvas");
    c.width = img.w; c.height = img.h;
    const id = c.getContext("2d").createImageData(img.w, img.h);
    for (let k = 0; k < img.w * img.h; k++) {
      id.data[4 * k] = img.data[3 * k]; id.data[4 * k + 1] = img.data[3 * k + 1]; id.data[4 * k + 2] = img.data[3 * k + 2]; id.data[4 * k + 3] = 255;
    }
    c.getContext("2d").putImageData(id, 0, 0);
    return c;
  }

  function maskToCanvas(mask) {
    const c = document.createElement("canvas");
    c.width = mask.w; c.height = mask.h;
    const id = c.getContext("2d").createImageData(mask.w, mask.h);
    for (let k = 0; k < mask.w * mask.h; k++) { id.data[4 * k] = id.data[4 * k + 1] = id.data[4 * k + 2] = 255; id.data[4 * k + 3] = mask.data[k] ? 255 : 0; }
    c.getContext("2d").putImageData(id, 0, 0);
    return c;
  }

  function shapeIcons() {
    const poly = maskToCanvas(VL.shapeMask("poly", 40, 5)), disk = maskToCanvas(VL.shapeMask("disk", 40, 0));
    const rect = maskToCanvas(VL.shapeMask("rectangle", 40, 3));
    const s = 128, c = s / 2;
    const layouts = {
      poly: [[poly, c, c, 0.85 * s]], disk: [[disk, c, c, 0.7 * s]], rectangle: [[rect, c, c, 0.8 * s]],
      mix: [[poly, 0.32 * s, 0.32 * s, 0.5 * s], [disk, 0.72 * s, 0.3 * s, 0.36 * s], [rect, 0.62 * s, 0.7 * s, 0.48 * s]],
    };
    const icons = {};
    for (const [name, parts] of Object.entries(layouts)) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = s;
      const ctx = canvas.getContext("2d");
      for (const [m, x, y, size] of parts) {
        const scale = size / Math.max(m.width, m.height), w = m.width * scale, h = m.height * scale;
        ctx.drawImage(m, x - w / 2, y - h / 2, w, h);
      }
      icons[name] = canvas.toDataURL();
    }
    return icons;
  }

  // colours of the texture icons: the first image dropped, or an autumn palette
  function paletteImage() {
    const colors = ["#7f2a1d", "#c4452c", "#e98a2e", "#f2c14e", "#6f8f3a", "#2e5e4e", "#f4ead5", "#3d3a4b"]
      .map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
    const n = 120, data = new Uint8Array(n * n * 3);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const col = colors[(Math.floor(i / 15) * 3 + Math.floor(j / 20) * 5) % colors.length];
        data.set(col, 3 * (i * n + j));
      }
    }
    return { w: n, h: n, data: data };
  }

  function textureIcons() {
    const img = sources[0] || paletteImage(), icons = {};
    for (const t of TEXTURE_TYPES) {
      icons[t] = rgbToCanvas(VL.textureSample(t, 128, TEXTURE_TYPES.indexOf(t) + 1, img,
                                             { slope_min: 0.5, slope_max: 2.5, apply_warp: true })).toDataURL();
    }
    return icons;
  }

  function renderTextureIcons() {
    const icons = textureIcons();
    document.querySelectorAll("#vl-texture-picker .vl-option").forEach((b) => {
      b.querySelector(".vl-texture-icon").style.backgroundImage = `url(${icons[b.dataset.type]})`;
    });
  }

  /* ---------- menu ---------- */
  function picker(container, items, { multi, icon, onClick }) {
    container.innerHTML = "";
    items.forEach((item) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "vl-option";
      b.dataset.type = item.key;
      b.title = item.hint;
      if (!multi) b.setAttribute("role", "radio");
      b.innerHTML = icon(item) + `<span>${item.label}</span>`;
      b.addEventListener("click", () => onClick(item.key));
      container.appendChild(b);
    });
  }

  function segmented(container, options, value, onPick) {
    container.innerHTML = "";
    options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = o.label;
      b.setAttribute("aria-pressed", o.value === value);
      b.addEventListener("click", () => {
        container.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        onPick(o.value);
      });
      container.appendChild(b);
    });
  }

  function bindToggle(id, key, after) {
    const el = $(id);
    el.checked = !!state[key];
    el.addEventListener("change", () => { state[key] = el.checked; if (after) after(); });
  }

  function refreshDependent() {
    $("vl-texture-controls").classList.toggle("vl-disabled", !state.texture_enabled);
    $("vl-texture-off-hint").hidden = state.texture_enabled;
    const size = state.downscale ? state.image_size / 2 : state.image_size;
    $("vl-output-size").textContent = `output ${size}×${size} px`;
  }

  function buildMenu() {
    const shapes = shapeIcons();
    picker($("vl-shape-picker"), SHAPE_TYPES.map((k) => ({ key: k, label: SHAPE_LABELS[k], hint: SHAPE_HINTS[k], icon: shapes[k] })), {
      icon: (it) => `<span class="vl-shape-icon" style="--icon:url(${it.icon})"></span>`,
      onClick: (k) => { state.shape_type = k; markShape(); },
    });
    const markShape = () => document.querySelectorAll("#vl-shape-picker .vl-option").forEach((b) => b.setAttribute("aria-checked", b.dataset.type === state.shape_type));
    markShape();

    const radius = new MultiSlider($("vl-radius-slider"), {
      min: 1, max: 1000, step: 1, log: true, minGap: 1, values: [state.radius_min, state.radius_max],
      onChange: ([a, b]) => { state.radius_min = a; state.radius_max = b; showRadius(); radius.setValues([a, b]); },
    });
    const showRadius = () => ($("vl-radius-value").textContent = `${state.radius_min} – ${state.radius_max} px`);
    showRadius();

    const exponent = $("vl-exponent");
    exponent.value = state.power_law_exponent;
    const showExponent = () => ($("vl-exponent-value").textContent = (+state.power_law_exponent).toFixed(1));
    exponent.addEventListener("input", () => { state.power_law_exponent = +exponent.value; showExponent(); });
    showExponent();

    bindToggle("vl-texture-enabled", "texture_enabled", refreshDependent);
    picker($("vl-texture-picker"), TEXTURE_TYPES.map((k) => ({ key: k, label: TEXTURE_LABELS[k], hint: TEXTURE_HINTS[k] })), {
      multi: true,
      icon: (it) => `<span class="vl-swatch" style="--c:${textureColor(it.key)}"></span><span class="vl-texture-icon"></span>`,
      onClick: toggleTexture,
    });
    renderTextureIcons();
    shareSlider = new MultiSlider($("vl-share-slider"), { min: 0, max: 1, step: 0.01, minGap: 0.01, partition: true, values: [], onChange: onSharesDragged });
    renderShares();

    const slope = new MultiSlider($("vl-slope-slider"), {
      min: 0, max: 4, step: 0.05, minGap: 0.05, values: [state.slope_min, state.slope_max],
      onChange: ([a, b]) => { state.slope_min = a; state.slope_max = b; showSlope(); slope.setValues([a, b]); },
    });
    const showSlope = () => ($("vl-slope-value").textContent = `${(+state.slope_min).toFixed(2)} – ${(+state.slope_max).toFixed(2)}`);
    showSlope();
    bindToggle("vl-apply-warp", "apply_warp");
    bindToggle("vl-apply-perspective", "apply_perspective");
    bindToggle("vl-grey", "grey");
    bindToggle("vl-dof", "depth_of_field");
    bindToggle("vl-extra-blur", "extra_blur");
    bindToggle("vl-downscale", "downscale", refreshDependent);
    segmented($("vl-image-size"), IMAGE_SIZES.map((s) => ({ value: s, label: String(s) })), state.image_size, (v) => { state.image_size = v; refreshDependent(); });
    refreshDependent();

    const grid = $("vl-grid");
    grid.innerHTML = "";
    for (let i = 0; i < N_IMAGES; i++) grid.insertAdjacentHTML("beforeend", '<div class="vl-slot"></div>');
  }

  function generatorParams() {
    const types = activeTextures(), total = types.reduce((s, t) => s + state.texture_shares[t], 0);
    return {
      shape_type: state.shape_type, radius_min: state.radius_min, radius_max: state.radius_max,
      power_law_exponent: state.power_law_exponent, texture_enabled: state.texture_enabled,
      texture_types: types, texture_weights: types.map((t) => state.texture_shares[t] / total),
      slope_min: state.slope_min, slope_max: state.slope_max, apply_warp: state.apply_warp,
      apply_perspective: state.apply_perspective, grey: state.grey, depth_of_field: state.depth_of_field,
      extra_blur: state.extra_blur, downscale: state.downscale, image_size: state.image_size,
    };
  }

  /* ---------- colour source images ---------- */
  async function loadImage(file) {
    const bitmap = await createImageBitmap(file);
    // at most 1024 px (colours are sampled from 100 px patches), at least 128 px
    let scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    if (Math.min(bitmap.width, bitmap.height) * scale < 128) scale = 128 / Math.min(bitmap.width, bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const rgba = ctx.getImageData(0, 0, w, h).data, data = new Uint8Array(w * h * 3);
    for (let k = 0; k < w * h; k++) { data[3 * k] = rgba[4 * k]; data[3 * k + 1] = rgba[4 * k + 1]; data[3 * k + 2] = rgba[4 * k + 2]; }
    const thumb = document.createElement("canvas");
    thumb.width = thumb.height = 40;
    const side = Math.min(w, h);
    thumb.getContext("2d").drawImage(canvas, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 40, 40);
    return { w: w, h: h, data: data, thumb: thumb.toDataURL() };
  }

  async function addFiles(files) {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    $("vl-sources-text").textContent = "Loading…";
    const loaded = [];
    let failed = 0;
    for (const f of images) {
      try { loaded.push(await loadImage(f)); } catch (err) { failed++; }
    }
    sources = sources.concat(loaded);
    renderSources(failed);
    sendSources();
    renderTextureIcons();
    generate();
  }

  function renderSources(failed) {
    $("vl-sources").hidden = !sources.length;
    $("vl-drop-text").innerHTML = sources.length ? "Drop more images or <u>browse</u>" : "Drop images here or <u>browse</u>";
    $("vl-thumbs").innerHTML = sources.slice(0, 12).map((s) => `<img src="${s.thumb}" alt="">`).join("") +
      (sources.length > 12 ? `<span>+${sources.length - 12}</span>` : "");
    $("vl-sources-text").textContent = `${sources.length} image${sources.length > 1 ? "s" : ""}` + (failed ? ` (${failed} could not be read)` : "");
    $("vl-colour-mode").textContent = sources.length ? "from your images" : "random";
  }

  function sendSources() {
    const plain = sources.map((s) => ({ w: s.w, h: s.h, data: s.data }));
    pool.forEach((p) => p.worker.postMessage({ type: "sources", sources: plain }));
  }

  function setupDrop() {
    const drop = $("vl-drop"), input = $("vl-files");
    drop.addEventListener("click", () => input.click());
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("vl-over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("vl-over"); }));
    drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
    $("vl-clear").addEventListener("click", () => {
      sources = [];
      renderSources(0);
      sendSources();
      renderTextureIcons();
      generate();
    });
  }

  /* ---------- generation ---------- */
  let pool = [];
  let job = 0, queue = [], t0 = 0, done = 0, failedImages = 0, timer = null;

  function makePool() {
    pool.forEach((p) => p.worker.terminate());
    const plain = sources.map((s) => ({ w: s.w, h: s.h, data: s.data }));
    pool = Array.from({ length: N_WORKERS }, () => {
      const p = { worker: new Worker(BASE + "worker.js"), busy: false };
      p.worker.onmessage = (e) => onResult(p, e.data);
      p.worker.onerror = (e) => { e.preventDefault(); onResult(p, { type: "error", job: p.job, index: p.index, message: e.message || "worker error" }); };
      p.worker.postMessage({ type: "sources", sources: plain });
      return p;
    });
  }

  function dispatch() {
    const params = generatorParams();
    for (const p of pool) {
      if (p.busy || !queue.length) continue;
      const index = queue.shift();
      Object.assign(p, { busy: true, job: job, index: index });
      p.worker.postMessage({ type: "generate", job: job, index: index, params: params, seed: 1000 * seedBase + index });
    }
  }

  function status() {
    const s = ((performance.now() - t0) / 1000).toFixed(1);
    $("vl-status").textContent = done < N_IMAGES ? `Generating… ${done}/${N_IMAGES} · ${s} s` : `${N_IMAGES} images in ${s} s`;
  }

  function generate() {
    $("vl-error").textContent = "";
    if (state.texture_enabled && !activeTextures().length) {
      $("vl-error").textContent = "Select at least one texture type.";
      return;
    }
    // images still being generated belong to the previous request: restart the workers
    if (pool.some((p) => p.busy)) makePool();
    job++;
    queue = [...Array(N_IMAGES).keys()];
    done = 0;
    failedImages = 0;
    t0 = performance.now();
    document.querySelectorAll(".vl-slot").forEach((s) => { s.innerHTML = ""; s.classList.add("vl-loading"); });
    clearInterval(timer);
    timer = setInterval(status, 200);
    status();
    dispatch();
  }

  function onResult(p, msg) {
    if (msg.job !== job) return;
    p.busy = false;
    const slot = document.querySelectorAll(".vl-slot")[msg.index];
    slot.classList.remove("vl-loading");
    if (msg.type === "image") {
      const canvas = document.createElement("canvas");
      canvas.width = msg.w; canvas.height = msg.h;
      canvas.getContext("2d").putImageData(new ImageData(msg.rgba, msg.w, msg.h), 0, 0);
      canvas.title = "Click to enlarge";
      canvas.setAttribute("aria-label", `Generated image ${msg.index + 1}`);
      canvas.addEventListener("click", () => openLightbox(canvas, msg.index));
      slot.appendChild(canvas);
    } else {
      slot.innerHTML = `<div class="vl-err"></div>`;
      slot.firstChild.textContent = msg.message;
      failedImages++;
    }
    done++;
    if (done === N_IMAGES) {
      clearInterval(timer);
      status();
      if (failedImages) $("vl-error").textContent = `${failedImages} image(s) failed.`;
    }
    dispatch();
  }

  function openLightbox(canvas, index) {
    const url = canvas.toDataURL("image/png");
    const box = $("vl-lightbox");
    box.querySelector("img").src = url;
    $("vl-download").href = url;
    $("vl-download").download = `vibrant_leaves_${seedBase}_${index + 1}.png`;
    box.classList.add("vl-open");
  }

  function init() {
    buildMenu();
    setupDrop();
    makePool();
    $("vl-close").addEventListener("click", () => $("vl-lightbox").classList.remove("vl-open"));
    $("vl-lightbox").addEventListener("click", (e) => { if (e.target.id === "vl-lightbox") e.currentTarget.classList.remove("vl-open"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("vl-lightbox").classList.remove("vl-open"); });
    $("vl-generate").addEventListener("click", generate);
    $("vl-new").addEventListener("click", () => { seedBase++; generate(); });
    generate();
  }

  init();
})();
