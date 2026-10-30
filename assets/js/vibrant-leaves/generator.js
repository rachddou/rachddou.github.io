/* Vibrant Leaves: dead leaves image generator, a JavaScript port of
 * dead_leaves_generation in https://github.com/rachddou/DeadLeavesPlus
 * (Achddou, Gousseau, Ladjal, Susstrunk, "VibrantLeaves: a principled
 * parametric image generator for training deep restoration models").
 *
 * Same algorithm as the Python code: the images follow the same distribution
 * but are not pixel-identical (another random generator, bilinear instead of
 * bicubic perspective warps, a coarser grid for the warp displacement fields).
 *
 * Exposes self.VibrantLeaves = { generateImage, shapeMask, textureSample }.
 * Needs Delaunator (global) for the concave hulls of the polygons.
 * Images are { w, h, data } with data an interleaved RGB Uint8Array.
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Random streams
  // ---------------------------------------------------------------------------

  function mix32(x) {
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  }

  // decorrelated 32-bit key from a list of integers
  function hashInts() {
    let h = 0x9e3779b9;
    for (let i = 0; i < arguments.length; i++) {
      h = mix32((h ^ mix32((arguments[i] >>> 0) + 0x632be5ab)) + 0x7f4a7c15);
    }
    return h;
  }

  // sfc32 generator
  function Rng(seed) {
    this.a = mix32(seed ^ 0xdeadbeef);
    this.b = mix32(this.a ^ 0x9e3779b9);
    this.c = mix32(this.b ^ 0x85ebca6b);
    this.d = 1;
    this.spare = null;
    for (let i = 0; i < 12; i++) this.next();
  }
  Rng.prototype.next = function () {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  };
  Rng.prototype.random = function () { return this.next() / 4294967296; };
  // integer in [lo, hi), like np.random.randint(lo, hi)
  Rng.prototype.int = function (lo, hi) { return lo + Math.floor(this.random() * (hi - lo)); };
  Rng.prototype.uniform = function (lo, hi) { return lo + (hi - lo) * this.random(); };
  Rng.prototype.bit = function () { return (this.next() & 1) === 1; };
  Rng.prototype.normal = function () {
    // Marsaglia's polar method
    if (this.spare !== null) { const s = this.spare; this.spare = null; return s; }
    let u, v, s;
    do {
      u = 2 * this.random() - 1;
      v = 2 * this.random() - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt(-2 * Math.log(s) / s);
    this.spare = v * f;
    return u * f;
  };
  // normal draw from a table of the inverse normal CDF (4096 quantiles, linear
  // interpolation): much faster, for the millions of draws of noise phases
  // and displacement fields, where the far tails do not matter
  const NORMAL_TABLE = (function () {
    // Acklam's rational approximation of the inverse normal CDF
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const inv = (p) => {
      if (p < 0.02425) {
        const q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
      }
      if (p > 1 - 0.02425) return -inv(1 - p);
      const q = p - 0.5, r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    };
    const n = 4096, t = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) t[i] = inv((i + 0.5) / (n + 1));
    return t;
  })();
  Rng.prototype.normalFast = function () {
    const x = this.random() * 4096, i = x | 0;
    return NORMAL_TABLE[i] + (x - i) * (NORMAL_TABLE[i + 1] - NORMAL_TABLE[i]);
  };
  // index drawn with the given probabilities
  Rng.prototype.pick = function (weights) {
    let u = this.random() * weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < weights.length; i++) { u -= weights[i]; if (u < 0) return i; }
    return weights.length - 1;
  };

  // ---------------------------------------------------------------------------
  // Colours (same formulas as skimage.color.rgb2lab / lab2rgb, D65)
  // ---------------------------------------------------------------------------

  const XYZ_FROM_RGB = [0.412453, 0.357580, 0.180423, 0.212671, 0.715160, 0.072169,
                        0.019334, 0.119193, 0.950227];
  const RGB_FROM_XYZ = (function (m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
            B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
            C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  })(XYZ_FROM_RGB);
  const WHITE = [0.95047, 1.0, 1.08883];
  const LINEAR = new Float64Array(256);
  for (let v = 0; v < 256; v++) {
    const x = v / 255;
    LINEAR[v] = x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
  }

  function labF(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }

  function rgbToLab(r, g, b, out, o) {
    const R = LINEAR[r], G = LINEAR[g], B = LINEAR[b], M = XYZ_FROM_RGB;
    const x = labF((M[0] * R + M[1] * G + M[2] * B) / WHITE[0]);
    const y = labF((M[3] * R + M[4] * G + M[5] * B) / WHITE[1]);
    const z = labF((M[6] * R + M[7] * G + M[8] * B) / WHITE[2]);
    out[o] = 116 * y - 16;
    out[o + 1] = 500 * (x - y);
    out[o + 2] = 200 * (y - z);
  }

  function labInv(t) { return t > 0.2068966 ? t * t * t : (t - 16 / 116) / 7.787; }

  // uint8(255 * lab2rgb(L, a, b)) written at out[o..o+2]
  function labToRgbU8(L, a, b, out, o) {
    const fy = (L + 16) / 116;
    let fz = fy - b / 200;
    if (fz < 0) fz = 0;
    const x = labInv(a / 500 + fy) * 0.95047, y = labInv(fy), z = labInv(fz) * 1.08883;
    const M = RGB_FROM_XYZ;
    for (let c = 0; c < 3; c++) {
      let v = M[3 * c] * x + M[3 * c + 1] * y + M[3 * c + 2] * z;
      v = v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v;
      out[o + c] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0;
    }
  }

  // interp * (lab2 - lab1) + lab1 -> RGB, on the pixels of region (r0, r1, c0, c1)
  // of a w x w map; lab1 / lab2 hold 3 values (constant colour) or 3 per pixel
  function mixLab(interp, w, h, lab1, lab2, region) {
    const out = { w: w, h: h, data: new Uint8Array(w * h * 3) };
    const [r0, r1, c0, c1] = region || [0, h, 0, w];
    const const1 = lab1.length === 3, const2 = lab2.length === 3;
    for (let i = r0; i < r1; i++) {
      for (let j = c0; j < c1; j++) {
        const k = i * w + j, m = interp[k];
        const o1 = const1 ? 0 : 3 * k, o2 = const2 ? 0 : 3 * k;
        labToRgbU8(lab1[o1] + m * (lab2[o2] - lab1[o1]),
                   lab1[o1 + 1] + m * (lab2[o2 + 1] - lab1[o1 + 1]),
                   lab1[o1 + 2] + m * (lab2[o2 + 2] - lab1[o1 + 2]), out.data, 3 * k);
      }
    }
    return out;
  }

  function imageToLab(img, region) {
    const lab = new Float64Array(img.w * img.h * 3);
    const [r0, r1, c0, c1] = region || [0, img.h, 0, img.w];
    const d = img.data;
    for (let i = r0; i < r1; i++) {
      for (let j = c0; j < c1; j++) {
        const k = 3 * (i * img.w + j);
        rgbToLab(d[k], d[k + 1], d[k + 2], lab, k);
      }
    }
    return lab;
  }

  // ---------------------------------------------------------------------------
  // Gaussian blurs
  // ---------------------------------------------------------------------------

  // cv2.getGaussianKernel
  function cvKernel(ksize, sigma) {
    if (!(sigma > 0)) sigma = 0.3 * ((ksize - 1) * 0.5 - 1) + 0.8;
    const k = new Float64Array(ksize), c = (ksize - 1) / 2;
    let s = 0;
    for (let i = 0; i < ksize; i++) { k[i] = Math.exp(-((i - c) * (i - c)) / (2 * sigma * sigma)); s += k[i]; }
    for (let i = 0; i < ksize; i++) k[i] /= s;
    return k;
  }

  // scipy.ndimage.gaussian_filter kernel (truncate = 4)
  function scipyKernel(sigma) {
    const radius = Math.floor(4 * sigma + 0.5), k = new Float64Array(2 * radius + 1);
    let s = 0;
    for (let i = -radius; i <= radius; i++) { k[i + radius] = Math.exp(-0.5 * i * i / (sigma * sigma)); s += k[i + radius]; }
    for (let i = 0; i < k.length; i++) k[i] /= s;
    return k;
  }

  function reflect101(i, n) {
    if (n === 1) return 0;
    while (i < 0 || i >= n) {
      if (i < 0) i = -i;
      if (i >= n) i = 2 * n - 2 - i;
    }
    return i;
  }
  function nearest(i, n) { return i < 0 ? 0 : i >= n ? n - 1 : i; }

  // separable correlation of an interleaved (h, w, ch) array with a symmetric kernel
  function blur(src, w, h, ch, kernel, border) {
    const r = kernel.length >> 1, ks = kernel.length;
    const tmp = new Float32Array(w * h * ch), out = new Float32Array(w * h * ch);
    const ix = new Int32Array(w * ks), iy = new Int32Array(h * ks);
    for (let x = 0; x < w; x++) for (let k = 0; k < ks; k++) ix[x * ks + k] = border(x + k - r, w);
    for (let y = 0; y < h; y++) for (let k = 0; k < ks; k++) iy[y * ks + k] = border(y + k - r, h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < ch; c++) {
          let s = 0;
          for (let k = 0; k < ks; k++) s += kernel[k] * src[(row + ix[x * ks + k]) * ch + c];
          tmp[(row + x) * ch + c] = s;
        }
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < ch; c++) {
          let s = 0;
          for (let k = 0; k < ks; k++) s += kernel[k] * tmp[(iy[y * ks + k] * w + x) * ch + c];
          out[(y * w + x) * ch + c] = s;
        }
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // FFT (sizes 2^a 3^b 5^c, Stockham autosort)
  // ---------------------------------------------------------------------------

  const fftPlans = new Map();
  function fftPlan(n) {
    let plan = fftPlans.get(n);
    if (plan) return plan;
    const factors = [];
    let m = n;
    while (m % 4 === 0) { factors.push(4); m /= 4; }
    while (m % 2 === 0) { factors.push(2); m /= 2; }
    while (m % 3 === 0) { factors.push(3); m /= 3; }
    while (m % 5 === 0) { factors.push(5); m /= 5; }
    if (m !== 1) throw new Error("FFT size must be 2^a 3^b 5^c, got " + n);
    // twiddles of each stage: w^(k q), w = exp(-2 pi i / len), for q < m, 1 <= k < p
    const stages = [];
    let len = n;
    for (const p of factors) {
      const mm = len / p, tr = new Float64Array(mm * (p - 1)), ti = new Float64Array(mm * (p - 1));
      for (let q = 0; q < mm; q++) {
        for (let k = 1; k < p; k++) {
          const a = -2 * Math.PI * k * q / len;
          tr[q * (p - 1) + k - 1] = Math.cos(a);
          ti[q * (p - 1) + k - 1] = Math.sin(a);
        }
      }
      stages.push({ p: p, m: mm, tr: tr, ti: ti });
      len = mm;
    }
    plan = { n: n, stages: stages, yr: new Float64Array(n), yi: new Float64Array(n), big: null };
    fftPlans.set(n, plan);
    return plan;
  }

  // smallest even 5-smooth integer >= n
  function fastLen(n) {
    for (let m = Math.max(2, n + (n & 1)); ; m += 2) {
      let k = m;
      for (const p of [2, 3, 5]) while (k % p === 0) k /= p;
      if (k === 1) return m;
    }
  }

  const C3 = Math.sqrt(3) / 2;
  const C51 = Math.cos(2 * Math.PI / 5), C52 = Math.cos(4 * Math.PI / 5);
  const S51 = Math.sin(2 * Math.PI / 5), S52 = Math.sin(4 * Math.PI / 5);

  // Stockham FFT of length plan.n along the slow axis of (n, V) arrays: every
  // element is a vector of V contiguous values (V = 1: a single 1D transform).
  // sign = -1: forward, +1: inverse (unscaled). The result ends in (xr, xi).
  function stockham(plan, xr, xi, yr, yi, V, sign) {
    const re0 = xr;
    let s = V;
    for (const st of plan.stages) {
      const p = st.p, m = st.m, d = s * m, tr = st.tr, ti = st.ti;
      for (let q = 0; q < m; q++) {
        const tw = q * (p - 1);
        // the tables hold the forward twiddles: conjugate them for the inverse
        const w1r = tr[tw], w1i = -sign * ti[tw];
        const w2r = p > 2 ? tr[tw + 1] : 1, w2i = p > 2 ? -sign * ti[tw + 1] : 0;
        const w3r = p > 3 ? tr[tw + 2] : 1, w3i = p > 3 ? -sign * ti[tw + 2] : 0;
        const w4r = p > 4 ? tr[tw + 3] : 1, w4i = p > 4 ? -sign * ti[tw + 3] : 0;
        const i0 = s * q, o0 = s * p * q;
        if (p === 4) {
          for (let j = 0; j < s; j++) {
            const a = i0 + j, o = o0 + j;
            const x0r = xr[a], x0i = xi[a], x1r = xr[a + d], x1i = xi[a + d];
            const x2r = xr[a + 2 * d], x2i = xi[a + 2 * d], x3r = xr[a + 3 * d], x3i = xi[a + 3 * d];
            const t0r = x0r + x2r, t0i = x0i + x2i, t1r = x0r - x2r, t1i = x0i - x2i;
            const t2r = x1r + x3r, t2i = x1i + x3i, t3r = x1r - x3r, t3i = x1i - x3i;
            const ur = -sign * t3i, ui = sign * t3r;     // sign * i * t3
            yr[o] = t0r + t2r; yi[o] = t0i + t2i;
            let br = t1r + ur, bi = t1i + ui;
            yr[o + s] = br * w1r - bi * w1i; yi[o + s] = br * w1i + bi * w1r;
            br = t0r - t2r; bi = t0i - t2i;
            yr[o + 2 * s] = br * w2r - bi * w2i; yi[o + 2 * s] = br * w2i + bi * w2r;
            br = t1r - ur; bi = t1i - ui;
            yr[o + 3 * s] = br * w3r - bi * w3i; yi[o + 3 * s] = br * w3i + bi * w3r;
          }
        } else if (p === 2) {
          for (let j = 0; j < s; j++) {
            const a = i0 + j, o = o0 + j;
            const x0r = xr[a], x0i = xi[a], x1r = xr[a + d], x1i = xi[a + d];
            yr[o] = x0r + x1r; yi[o] = x0i + x1i;
            const br = x0r - x1r, bi = x0i - x1i;
            yr[o + s] = br * w1r - bi * w1i; yi[o + s] = br * w1i + bi * w1r;
          }
        } else if (p === 3) {
          for (let j = 0; j < s; j++) {
            const a = i0 + j, o = o0 + j;
            const x0r = xr[a], x0i = xi[a], x1r = xr[a + d], x1i = xi[a + d], x2r = xr[a + 2 * d], x2i = xi[a + 2 * d];
            const sr = x1r + x2r, si = x1i + x2i;
            const mr = x0r - 0.5 * sr, mi = x0i - 0.5 * si;
            const dr = sign * C3 * (x1r - x2r), di = sign * C3 * (x1i - x2i);
            yr[o] = x0r + sr; yi[o] = x0i + si;
            let br = mr - di, bi = mi + dr;
            yr[o + s] = br * w1r - bi * w1i; yi[o + s] = br * w1i + bi * w1r;
            br = mr + di; bi = mi - dr;
            yr[o + 2 * s] = br * w2r - bi * w2i; yi[o + 2 * s] = br * w2i + bi * w2r;
          }
        } else {
          for (let j = 0; j < s; j++) {
            const a = i0 + j, o = o0 + j;
            const x0r = xr[a], x0i = xi[a];
            const a1r = xr[a + d] + xr[a + 4 * d], a1i = xi[a + d] + xi[a + 4 * d];
            const b1r = xr[a + d] - xr[a + 4 * d], b1i = xi[a + d] - xi[a + 4 * d];
            const a2r = xr[a + 2 * d] + xr[a + 3 * d], a2i = xi[a + 2 * d] + xi[a + 3 * d];
            const b2r = xr[a + 2 * d] - xr[a + 3 * d], b2i = xi[a + 2 * d] - xi[a + 3 * d];
            const m1r = x0r + C51 * a1r + C52 * a2r, m1i = x0i + C51 * a1i + C52 * a2i;
            const m2r = x0r + C52 * a1r + C51 * a2r, m2i = x0i + C52 * a1i + C51 * a2i;
            // sign * i * (s1 b1 + s2 b2) and sign * i * (s2 b1 - s1 b2)
            const n1r = -sign * (S51 * b1i + S52 * b2i), n1i = sign * (S51 * b1r + S52 * b2r);
            const n2r = -sign * (S52 * b1i - S51 * b2i), n2i = sign * (S52 * b1r - S51 * b2r);
            yr[o] = x0r + a1r + a2r; yi[o] = x0i + a1i + a2i;
            let br = m1r + n1r, bi = m1i + n1i;
            yr[o + s] = br * w1r - bi * w1i; yi[o + s] = br * w1i + bi * w1r;
            br = m2r + n2r; bi = m2i + n2i;
            yr[o + 2 * s] = br * w2r - bi * w2i; yi[o + 2 * s] = br * w2i + bi * w2r;
            br = m2r - n2r; bi = m2i - n2i;
            yr[o + 3 * s] = br * w3r - bi * w3i; yi[o + 3 * s] = br * w3i + bi * w3r;
            br = m1r - n1r; bi = m1i - n1i;
            yr[o + 4 * s] = br * w4r - bi * w4i; yi[o + 4 * s] = br * w4i + bi * w4r;
          }
        }
      }
      let t = xr; xr = yr; yr = t;
      t = xi; xi = yi; yi = t;
      s *= p;
    }
    // odd number of stages: the result is in the scratch buffers
    if (xr !== re0) { yr.set(xr); yi.set(xi); }
  }

  // in place complex FFT of (re, im) (length plan.n)
  function fft1d(plan, re, im, sign) { stockham(plan, re, im, plan.yr, plan.yi, 1, sign); }

  // in place 2D FFT of n x n complex data (inverse scaled by 1 / n^2)
  function fft2d(re, im, n, sign) {
    const plan = fftPlan(n);
    for (let r = 0; r < n; r++) fft1d(plan, re.subarray(r * n, r * n + n), im.subarray(r * n, r * n + n), sign);
    // columns: all at once, rows as vectors
    if (!plan.big) plan.big = [new Float64Array(n * n), new Float64Array(n * n)];
    stockham(plan, re, im, plan.big[0], plan.big[1], n, sign);
    if (sign > 0) {
      const sc = 1 / (n * n);
      for (let k = 0; k < n * n; k++) { re[k] *= sc; im[k] *= sc; }
    }
  }

  // ---------------------------------------------------------------------------
  // Colour sources: the user's images, or uniform random colours
  // ---------------------------------------------------------------------------

  function imageSource(img) {
    return {
      pixel: function (rng, out, o) {
        const k = 3 * (rng.int(0, img.h) * img.w + rng.int(0, img.w));
        out[o] = img.data[k]; out[o + 1] = img.data[k + 1]; out[o + 2] = img.data[k + 2];
      },
      // Textures.random_patch_selection: a 100 x 100 patch
      patch: function (rng) {
        const row = rng.int(0, Math.max(1, img.h - 101)), col = rng.int(0, Math.max(1, img.w - 101));
        const h = Math.min(100, img.h - row), w = Math.min(100, img.w - col);
        const data = new Uint8Array(w * h * 3);
        for (let i = 0; i < h; i++) data.set(img.data.subarray(3 * ((row + i) * img.w + col), 3 * ((row + i) * img.w + col + w)), 3 * i * w);
        return { w: w, h: h, data: data };
      },
    };
  }

  // the Python code draws colours from a random uint8 image (values 0-254)
  const randomSource = {
    pixel: function (rng, out, o) { out[o] = rng.int(0, 255); out[o + 1] = rng.int(0, 255); out[o + 2] = rng.int(0, 255); },
    patch: function (rng) {
      const data = new Uint8Array(100 * 100 * 3);
      for (let k = 0; k < data.length; k++) data[k] = rng.int(0, 255);
      return { w: 100, h: 100, data: data };
    },
  };

  function patchPixel(rng, patch) {
    const k = 3 * (rng.int(0, patch.h) * patch.w + rng.int(0, patch.w));
    return [patch.data[k], patch.data[k + 1], patch.data[k + 2]];
  }

  // ---------------------------------------------------------------------------
  // 1/f coloured noise (colored_noise.sample_color_noise)
  // ---------------------------------------------------------------------------

  // White noise made of the colours of a 50 x 50 window of patch keeps its
  // Fourier phase and gets the magnitude 1 / (|fx|^s + |fy|^s), then is rescaled
  // to the mean / std of the white noise. Synthesised on the next FFT-friendly
  // size and cropped to width x width; only region is converted to uint8.
  //
  // The Fourier coefficients of that white noise (sums of n^2 independent
  // pixels) are, by the central limit theorem, independent complex Gaussian
  // vectors across frequencies, with the covariance of the colours across
  // channels. Their phases are drawn directly, which saves the forward FFTs.
  function colorNoise(rng, patch, width, slope, region) {
    const n = fastLen(width), nn = n * n, p = 50;
    const xx = rng.int(0, patch.h - p), yy = rng.int(0, patch.w - p);
    // mean and covariance of the colours of the window
    const m = [0, 0, 0], C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        const k = 3 * ((xx + i) * patch.w + yy + j);
        for (let a = 0; a < 3; a++) m[a] += patch.data[k + a] / (p * p);
      }
    }
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        const k = 3 * ((xx + i) * patch.w + yy + j);
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[3 * a + b] += (patch.data[k + a] - m[a]) * (patch.data[k + b] - m[b]) / (p * p);
      }
    }
    const s = [Math.sqrt(C[0]), Math.sqrt(C[4]), Math.sqrt(C[8])];
    // Cholesky factor L (lower) of C, slightly regularised
    const eps = 1e-9 * Math.max(1, C[0] + C[4] + C[8]);
    const l00 = Math.sqrt(C[0] + eps), l10 = C[3] / l00, l20 = C[6] / l00;
    const l11 = Math.sqrt(Math.max(eps, C[4] + eps - l10 * l10)), l21 = (C[7] - l20 * l10) / l11;
    const l22 = Math.sqrt(Math.max(eps, C[8] + eps - l20 * l20 - l21 * l21));

    // channels R + iG and B + i0 are inverse transformed together
    const re1 = new Float64Array(nn), im1 = new Float64Array(nn), re2 = new Float64Array(nn), im2 = new Float64Array(nn);
    const g = new Float64Array(n);
    for (let k = 0; k < n; k++) g[k] = Math.pow(Math.abs((k <= n / 2 ? k : k - n) / n), slope);
    const unit = (x, y, mag, out, o) => {
      const a = Math.sqrt(x * x + y * y);
      if (a > 0) { out[o] = x * mag / a; out[o + 1] = y * mag / a; } else { out[o] = mag; out[o + 1] = 0; }
    };
    const c = new Float64Array(6);
    for (let u = 0; u < n; u++) {
      const un = (n - u) % n;
      for (let v = 0; v < n; v++) {
        const k = u * n + v, kn = un * n + (n - v) % n;
        if (kn < k || k === 0) continue;
        const mag = 1 / (1e-16 + g[u] + g[v]);
        const a0 = rng.normalFast(), a1 = rng.normalFast(), a2 = rng.normalFast();
        const x0 = l00 * a0, x1 = l10 * a0 + l11 * a1, x2 = l20 * a0 + l21 * a1 + l22 * a2;
        if (k === kn) {
          // self-conjugate frequency: real coefficients
          re1[k] = x0 >= 0 ? mag : -mag; im1[k] = x1 >= 0 ? mag : -mag; re2[k] = x2 >= 0 ? mag : -mag;
          continue;
        }
        const b0 = rng.normalFast(), b1 = rng.normalFast(), b2 = rng.normalFast();
        const y0 = l00 * b0, y1 = l10 * b0 + l11 * b1, y2 = l20 * b0 + l21 * b1 + l22 * b2;
        unit(x0, y0, mag, c, 0); unit(x1, y1, mag, c, 2); unit(x2, y2, mag, c, 4);
        // Z(k) = A + iB, Z(-k) = conj(A) + i conj(B)
        re1[k] = c[0] - c[3]; im1[k] = c[1] + c[2];
        re1[kn] = c[0] + c[3]; im1[kn] = c[2] - c[1];
        re2[k] = c[4]; im2[k] = c[5];
        re2[kn] = c[4]; im2[kn] = -c[5];
      }
    }
    fft2d(re1, im1, n, 1);
    fft2d(re2, im2, n, 1);

    const planes = [re1, im1, re2], mean = [0, 0, 0], std = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let s1 = 0, s2 = 0;
      for (let i = 0; i < width; i++) for (let j = 0; j < width; j++) { const y = planes[c][i * n + j]; s1 += y; s2 += y * y; }
      mean[c] = s1 / (width * width);
      std[c] = Math.sqrt(Math.max(1e-30, s2 / (width * width) - mean[c] * mean[c]));
    }
    const out = { w: width, h: width, data: new Uint8Array(width * width * 3) };
    const [r0, r1, c0, c1] = region || [0, width, 0, width];
    for (let i = r0; i < r1; i++) {
      for (let j = c0; j < c1; j++) {
        for (let c = 0; c < 3; c++) {
          const v = (planes[c][i * n + j] - mean[c]) / std[c] * s[c] + m[c];
          out.data[3 * (i * width + j) + c] = v <= 0 ? 0 : v >= 255 ? 255 : v | 0;
        }
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Interpolation maps (interpolation_maps.py) and their warps
  // ---------------------------------------------------------------------------

  function normalizeMap(x) {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < x.length; k++) { if (x[k] < lo) lo = x[k]; if (x[k] > hi) hi = x[k]; }
    if (hi === lo) { x.fill(1); return x; }
    for (let k = 0; k < x.length; k++) x[k] = (x[k] - lo) / (hi - lo);
    return x;
  }

  // sinusoid in [-1, 1] -> saturated above thresh, sharpened by a sigmoid, in [0, 1]
  function sinusoidTransfer(x, thresh, lam) {
    const s0 = 0.5, s1 = 1 / (1 + Math.exp(-lam));
    let v = 0.5 + 0.5 * x;
    if (v > thresh) v = 1;
    return (1 / (1 + Math.exp(-lam * v)) - s0) / (s1 - s0);
  }

  // A sinusoid of random period, rotated by angle on a (2 width)^2 canvas,
  // saturated and sharpened; half of the time multiplied by a second one along
  // angle1. The product is rotated by angle2 and its central width x width crop
  // normalised. The rotations of cv2.warpAffine are evaluated analytically.
  function sampleSinusoid(rng, width, angle, angle1, angle2) {
    const singleDim = rng.random() > 0.5;
    const thresh = [rng.uniform(0.05, 1), rng.uniform(0.05, 1)];
    const lam = [rng.uniform(1, 10), rng.uniform(1, 10)];
    const period1 = Math.floor(5 + 95 * rng.random());
    const period2 = singleDim ? 0 : Math.floor(5 + 95 * rng.random());
    const n = 2 * width, c = n >> 1, c0 = width >> 1, rad = Math.PI / 180;
    const a2 = Math.cos(angle2 * rad), b2 = Math.sin(angle2 * rad);
    const a = Math.cos(angle * rad), b = Math.sin(angle * rad);
    const a1 = Math.cos(angle1 * rad), b1 = Math.sin(angle1 * rad);
    const out = new Float32Array(width * width);
    const w1 = 2 * Math.PI / period1, w2 = singleDim ? 0 : 2 * Math.PI / period2;
    for (let i = 0; i < width; i++) {
      const dy = c0 + i - c;
      for (let j = 0; j < width; j++) {
        const dx = c0 + j - c;
        // inverse rotation by angle2, then by angle (column of the first sinusoid)
        const x1 = a2 * dx - b2 * dy, y1 = b2 * dx + a2 * dy;
        let v = sinusoidTransfer(Math.sin(w1 * (a * x1 - b * y1 + c)), thresh[0], lam[0]);
        if (!singleDim) v *= sinusoidTransfer(Math.sin(w2 * (b1 * x1 + a1 * y1 + c)), thresh[1], lam[1]);
        out[i * width + j] = v;
      }
    }
    return normalizeMap(out);
  }

  // grid lines (period(s), thickness 1-2), central crop of a 2 width canvas,
  // normalised, then rotated about the centre with black corners (rotate_cv)
  function sampleGrid(rng, width, periods, angle) {
    const thickness = rng.int(1, 3);
    function lines(period) {
      const x = new Float64Array(2 * width).fill(1);
      for (let i = 1; i <= Math.floor((2 * width) / (period + thickness)); i++) {
        for (let k = i * (period + thickness) - thickness; k < i * (period + thickness); k++) x[k] = 0;
      }
      return x.subarray(width >> 1, (width >> 1) + width);
    }
    const xs = lines(periods[0]), ys = periods.length === 2 ? lines(periods[1]) : new Float64Array(width).fill(1);
    // the crop is binary, so normalize only changes it when it has no line (all ones)
    let any0 = false;
    for (let i = 0; i < width && !any0; i++) for (let j = 0; j < width; j++) if (xs[j] * ys[i] === 0) { any0 = true; break; }
    const ones = new Float64Array(width).fill(1);
    const gx = any0 ? xs : ones, gy = any0 ? ys : ones;
    const lerp = (arr, t) => {
      const t0 = Math.floor(t), f = t - t0;
      const v0 = t0 >= 0 && t0 < width ? arr[t0] : 0, v1 = t0 + 1 >= 0 && t0 + 1 < width ? arr[t0 + 1] : 0;
      return v0 + f * (v1 - v0);
    };
    const c = width >> 1, a = Math.cos(angle * Math.PI / 180), b = Math.sin(angle * Math.PI / 180);
    const out = new Float32Array(width * width);
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < width; j++) {
        const sx = a * (j - c) - b * (i - c) + c, sy = b * (j - c) + a * (i - c) + c;
        out[i * width + j] = lerp(gx, sx) * lerp(gy, sy);
      }
    }
    return out;
  }

  // geometric_perturbation.generate_perturbation: every pixel takes the bilinear
  // interpolation of the map at a smoothly displaced position. The displacement
  // fields (white noise blurred by a 61-tap Gaussian of std s, rescaled to std
  // t pixels) are computed on a 2x coarser grid and upsampled: they are smooth.
  function perturb(rng, x, w) {
    const f = 2, nc = Math.ceil(w / f) + 2;
    const u0 = new Float32Array(nc * nc), v0 = new Float32Array(nc * nc);
    for (let k = 0; k < nc * nc; k++) u0[k] = rng.normalFast();
    for (let k = 0; k < nc * nc; k++) v0[k] = rng.normalFast();
    const s = rng.int(10, 20), t = rng.int(5, (s >> 1) + 1);
    const kernel = cvKernel(31, s / f);
    const fields = [blur(u0, nc, nc, 1, kernel, reflect101), blur(v0, nc, nc, 1, kernel, reflect101)].map((coarse) => {
      const fine = new Float64Array(w * w);
      let s1 = 0, s2 = 0;
      for (let i = 0; i < w; i++) {
        const yi = i / f, i0 = Math.floor(yi), fy = yi - i0;
        for (let j = 0; j < w; j++) {
          const xj = j / f, j0 = Math.floor(xj), fx = xj - j0, k = i0 * nc + j0;
          const v = (1 - fy) * ((1 - fx) * coarse[k] + fx * coarse[k + 1]) + fy * ((1 - fx) * coarse[k + nc] + fx * coarse[k + nc + 1]);
          fine[i * w + j] = v; s1 += v; s2 += v * v;
        }
      }
      const mean = s1 / (w * w), std = Math.sqrt(Math.max(1e-30, s2 / (w * w) - mean * mean));
      for (let k = 0; k < w * w; k++) fine[k] = (fine[k] - mean) * (t / std);
      return fine;
    });
    const u = fields[0], v = fields[1];
    let mn = Infinity;
    for (let k = 0; k < x.length; k++) if (x[k] < mn) mn = x[k];
    // warp_bilinear_clipped: corner indices clipped before computing the weights
    const out = new Float32Array(w * w);
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < w; j++) {
        const k = i * w + j, xx = u[k] + j, yy = v[k] + i;
        let x0 = Math.floor(xx), y0 = Math.floor(yy), x1 = x0 + 1, y1 = y0 + 1;
        x0 = nearest(x0, w); x1 = nearest(x1, w); y0 = nearest(y0, w); y1 = nearest(y1, w);
        const val = (x1 - xx) * (y1 - yy) * x[y0 * w + x0] + (x1 - xx) * (yy - y0) * x[y1 * w + x0]
                  + (xx - x0) * (y1 - yy) * x[y0 * w + x1] + (xx - x0) * (yy - y0) * x[y1 * w + x1] + mn;
        out[k] = val < 0 ? 0 : val > 1 ? 1 : val;
      }
    }
    return out;
  }

  function sampleInterpolationMap(rng, mix, width, warp) {
    let map;
    if (mix === "sin") {
      const angle = rng.uniform(-45, 45);
      const angle1 = angle + (rng.bit() ? 1 : -1) * rng.uniform(15, 45);
      const angle2 = rng.uniform(-22.5, 22.5);
      map = sampleSinusoid(rng, width, angle, angle1, angle2);
    } else {
      const angle = rng.uniform(-45, 45);
      const periods = rng.random() > 0.3 ? [rng.int(20, 100), rng.int(20, 100)] : [rng.int(20, 100)];
      map = sampleGrid(rng, width, periods, angle);
    }
    return warp ? perturb(rng, map, width) : map;
  }

  // ---------------------------------------------------------------------------
  // Textures (Textures.generate_texture)
  // ---------------------------------------------------------------------------

  function sampleSlope(rng, slopeRange) { return rng.uniform(slopeRange[0], slopeRange[1]); }

  // two colours or 1/f noises mixed in Lab by an interpolation map
  function bilevelMixer(rng, patch1, patch2, single1, single2, mix, width, warp, slopeRange, region) {
    const tex1 = single1 ? patchPixel(rng, patch1) : colorNoise(rng, patch1, width, sampleSlope(rng, slopeRange), region);
    const tex2 = single2 ? patchPixel(rng, patch2) : colorNoise(rng, patch2, width, sampleSlope(rng, slopeRange), region);
    const interp = sampleInterpolationMap(rng, mix, width, warp);
    const lab = (t) => {
      if (t.length === 3) { const l = new Float64Array(3); rgbToLab(t[0], t[1], t[2], l, 0); return l; }
      return imageToLab(t, region);
    };
    return mixLab(interp, width, width, lab(tex1), lab(tex2), region);
  }

  function sourceTexture(rng, source, cfg, type, width, region) {
    if (type === "freq_noise") {
      const slope = sampleSlope(rng, cfg.slopeRange);
      return colorNoise(rng, source.patch(rng), width, slope, region);
    }
    let single1 = true, single2 = true, mix = type;
    if (type === "texture_mixes") {
      single1 = rng.random() < 0.1;
      single2 = rng.random() < 0.1;
      mix = rng.random() < 0.9 ? "sin" : "grid";
    }
    const warp = cfg.applyWarp ? rng.random() < 0.5 : false;
    return bilevelMixer(rng, source.patch(rng), source.patch(rng), single1, single2, mix, width, warp,
                        cfg.slopeRange, region);
  }

  // perspective_shift: homography mapping the right half of a size x size image
  // (trapezoid) to the whole image; rows [beta, size - beta), columns
  // [0, size / 2) are kept, then flipped / rotated at random
  function perspectiveGeometry(size) {
    const beta = Math.floor(size / 4), h2 = size >> 1;
    const src = [[0, 0], [0, size], [h2, size - beta], [h2, beta]];
    const dst = [[0, 0], [0, size], [size, size], [size, 0]];
    // solve for H (h33 = 1): dst ~ H src; we need the inverse map dst -> src
    const A = [], bvec = [];
    for (let k = 0; k < 4; k++) {
      const [x, y] = dst[k], [u, v] = src[k];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); bvec.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); bvec.push(v);
    }
    for (let i = 0; i < 8; i++) {
      let p = i;
      for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [bvec[i], bvec[p]] = [bvec[p], bvec[i]];
      for (let r = 0; r < 8; r++) {
        if (r === i) continue;
        const f = A[r][i] / A[i][i];
        for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c];
        bvec[r] -= f * bvec[i];
      }
    }
    const h = bvec.map((v, i) => v / A[i][i]);
    return { inv: [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1], beta: beta };
  }

  function mapPoint(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }

  // part (r0, r1, c0, c1) of the source read by perspectiveShift
  function perspectiveSourceBox(size) {
    const g = perspectiveGeometry(size);
    const pts = [[0, g.beta], [(size >> 1) - 1, g.beta], [0, size - g.beta - 1], [(size >> 1) - 1, size - g.beta - 1]].map((p) => mapPoint(g.inv, p[0], p[1]));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), margin = 2;
    return [Math.max(0, Math.floor(Math.min(...ys)) - margin), Math.min(size, Math.floor(Math.max(...ys)) + margin + 1),
            Math.max(0, Math.floor(Math.min(...xs)) - margin), Math.min(size, Math.floor(Math.max(...xs)) + margin + 1)];
  }

  function perspectiveShift(rng, img) {
    const size = img.w, mode = rng.int(0, 3), g = perspectiveGeometry(size);
    const H = size - 2 * g.beta, W = size >> 1;
    const warped = new Uint8Array(H * W * 3), d = img.data;
    for (let i = 0; i < H; i++) {
      for (let j = 0; j < W; j++) {
        const H8 = g.inv, X = j, Y = g.beta + i, w = H8[6] * X + H8[7] * Y + H8[8];
        const sx = (H8[0] * X + H8[1] * Y + H8[2]) / w, sy = (H8[3] * X + H8[4] * Y + H8[5]) / w;
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
        const in00 = y0 >= 0 && y0 < size && x0 >= 0 && x0 < size, in01 = y0 >= 0 && y0 < size && x0 + 1 >= 0 && x0 + 1 < size;
        const in10 = y0 + 1 >= 0 && y0 + 1 < size && x0 >= 0 && x0 < size, in11 = y0 + 1 >= 0 && y0 + 1 < size && x0 + 1 >= 0 && x0 + 1 < size;
        const k00 = 3 * (y0 * size + x0), k01 = k00 + 3, k10 = k00 + 3 * size, k11 = k10 + 3;
        const w00 = (1 - fy) * (1 - fx), w01 = (1 - fy) * fx, w10 = fy * (1 - fx), w11 = fy * fx;
        for (let c = 0; c < 3; c++) {
          const v = (in00 ? w00 * d[k00 + c] : 0) + (in01 ? w01 * d[k01 + c] : 0) + (in10 ? w10 * d[k10 + c] : 0) + (in11 ? w11 * d[k11 + c] : 0);
          warped[3 * (i * W + j) + c] = Math.round(v);
        }
      }
    }
    if (mode === 2) return { w: W, h: H, data: warped };
    // mode 0: np.fliplr, mode 1: np.rot90 (counter-clockwise)
    const ow = mode === 0 ? W : H, oh = mode === 0 ? H : W, out = new Uint8Array(H * W * 3);
    for (let i = 0; i < oh; i++) {
      for (let j = 0; j < ow; j++) {
        const k = mode === 0 ? i * W + (W - 1 - j) : j * W + (W - 1 - i);
        out[3 * (i * ow + j)] = warped[3 * k]; out[3 * (i * ow + j) + 1] = warped[3 * k + 1]; out[3 * (i * ow + j) + 2] = warped[3 * k + 2];
      }
    }
    return { w: ow, h: oh, data: out };
  }

  function generateTexture(rng, source, cfg, width) {
    const type = cfg.textureTypes[cfg.textureTypes.length === 1 ? 0 : rng.pick(cfg.textureWeights)];
    const usePerspective = rng.random() > 0.5;
    if (usePerspective && cfg.applyPerspective) {
      // generated at twice the size: only the part read by the perspective crop
      const big = sourceTexture(rng, source, cfg, type, 2 * width, perspectiveSourceBox(2 * width));
      return perspectiveShift(rng, big);
    }
    return sourceTexture(rng, source, cfg, type, width);
  }

  // linear_color_gradient: smooth step in Lab between two colours along a
  // rotated ramp; only the window (row, col, h, w) of the size x size map
  function gradientCrop(c1, c2, size, angle, k, row, col, h, w) {
    const n = 2 * size, c = n >> 1, c0 = size >> 1;
    const a = Math.cos(angle * Math.PI / 180), b = Math.sin(angle * Math.PI / 180);
    const ramp = (X, Y) => (a * (X - c) - b * (Y - c) + c) / (n - 1);
    const corners = [ramp(c0, c0), ramp(c0 + size - 1, c0), ramp(c0, c0 + size - 1), ramp(c0 + size - 1, c0 + size - 1)];
    const lo = Math.min(...corners), hi = Math.max(...corners);
    const sLo = 1 / (1 + Math.exp(6 * k)), sHi = 1 / (1 + Math.exp(-6.1 * k));
    const interp = new Float32Array(w * h);
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        const x = hi > lo ? (ramp(c0 + col + j, c0 + row + i) - lo) / (hi - lo) : 1;
        interp[i * w + j] = (1 / (1 + Math.exp(-k * (12.1 * x - 6))) - sLo) / (sHi - sLo);
      }
    }
    const l1 = new Float64Array(3), l2 = new Float64Array(3);
    rgbToLab(c1[0], c1[1], c1[2], l1, 0);
    rgbToLab(c2[0], c2[1], c2[2], l2, 0);
    return mixLab(interp, w, h, l1, l2);
  }

  // ---------------------------------------------------------------------------
  // Shapes
  // ---------------------------------------------------------------------------

  const diskCache = new Map();
  function diskMask(r) {
    let m = diskCache.get(r);
    if (m) return m;
    const n = 2 * r + 1, data = new Uint8Array(n * n);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) data[(i + r) * n + j + r] = i * i + j * j <= r * r ? 1 : 0;
    m = { w: n, h: n, data: data };
    if (diskCache.size < 512) diskCache.set(r, m);
    return m;
  }

  // rectangle of area pi r^2 and aspect ratio in [0.5, 1], rotated at random
  // (make_rectangle_mask: any pixel touched by the bilinear warp is set)
  function rectangleMask(rng, r) {
    const area = Math.PI * r * r, ratio = rng.uniform(0.5, 1);
    const width = Math.floor(Math.sqrt(ratio * area)), L = Math.floor(Math.sqrt(area / ratio));
    const start = (L >> 1) - (width >> 1), end = Math.max(start + 1, (L >> 1) + (width >> 1));
    const angle = rng.uniform(0, 180) * Math.PI / 180, a = Math.cos(angle), b = Math.sin(angle);
    const S = Math.floor(Math.abs(a) * L + Math.abs(b) * L);
    const n = Math.max(1, 2 * (S >> 1) - 1), data = new Uint8Array(n * n);
    let any = false;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = x - S / 2, dy = y - S / 2;
        const sx = a * dx - b * dy + L / 2, sy = b * dx + a * dy + L / 2;
        if (sx > -1 && sx < L && sy > start - 1 && sy < end) { data[y * n + x] = 1; any = true; }
      }
    }
    if (!any) data[(n >> 1) * n + (n >> 1)] = 1;
    return { w: n, h: n, data: data };
  }

  // A simple binary max-heap of triangles keyed by size
  function Heap() { this.t = []; this.s = []; }
  Heap.prototype.push = function (t, s) {
    const T = this.t, S = this.s;
    let i = T.length;
    T.push(t); S.push(s);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (S[p] >= S[i]) break;
      [T[p], T[i]] = [T[i], T[p]]; [S[p], S[i]] = [S[i], S[p]];
      i = p;
    }
  };
  Heap.prototype.pop = function () {
    const T = this.t, S = this.s, top = [T[0], S[0]], lt = T.pop(), ls = S.pop();
    if (T.length) {
      T[0] = lt; S[0] = ls;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < T.length && S[l] > S[m]) m = l;
        if (r < T.length && S[r] > S[m]) m = r;
        if (m === i) break;
        [T[m], T[i]] = [T[i], T[m]]; [S[m], S[i]] = [S[i], S[m]];
        i = m;
      }
    }
    return top;
  };

  // Concave hull of points (GEOS / JTS ConcaveHull with an edge length ratio,
  // as shapely.concave_hull): the Delaunay triangles are eroded from the
  // border, longest border edge first, while it is longer than
  // min + ratio (max - min) of the edge lengths and the hull stays connected;
  // with allowHoles, long interior triangles are also eroded into holes.
  // Returns the kept triangles (vertex index triples) or null.
  function concaveHull(coords, ratio, allowHoles) {
    const del = new root.Delaunator(coords), tri = del.triangles, half = del.halfedges, nt = tri.length / 3;
    if (nt === 0) return null;
    const adj = new Int32Array(3 * nt), len = new Float64Array(3 * nt);
    const removed = new Uint8Array(nt), boundary = new Int32Array(coords.length / 2);
    let maxLen = -1, minLen = Infinity;
    for (let e = 0; e < 3 * nt; e++) {
      adj[e] = half[e] < 0 ? -1 : Math.floor(half[e] / 3);
      const p = tri[e], q = tri[e % 3 === 2 ? e - 2 : e + 1];
      len[e] = Math.hypot(coords[2 * p] - coords[2 * q], coords[2 * p + 1] - coords[2 * q + 1]);
      maxLen = Math.max(maxLen, len[e]); minLen = Math.min(minLen, len[e]);
      if (adj[e] < 0) { boundary[p]++; boundary[q]++; }
    }
    const threshold = ratio === 1 ? 2 * maxLen : ratio * (maxLen - minLen) + minLen;
    const vertex = (t, i) => tri[3 * t + (i % 3)];
    const numAdj = (t) => (adj[3 * t] >= 0) + (adj[3 * t + 1] >= 0) + (adj[3 * t + 2] >= 0);
    const boundaryIndex = (t) => (adj[3 * t] < 0 ? 0 : adj[3 * t + 1] < 0 ? 1 : 2);
    const isBorder = (t) => adj[3 * t] < 0 || adj[3 * t + 1] < 0 || adj[3 * t + 2] < 0;
    const longest = (t) => Math.max(len[3 * t], len[3 * t + 1], len[3 * t + 2]);
    function remove(t) {
      removed[t] = 1;
      for (let i = 0; i < 3; i++) {
        const e = 3 * t + i, p = vertex(t, i), q = vertex(t, i + 1), n = adj[e];
        if (n < 0) { boundary[p]--; boundary[q]--; continue; }
        for (let j = 0; j < 3; j++) if (adj[3 * n + j] === t) adj[3 * n + j] = -1;
        boundary[p]++; boundary[q]++;
      }
    }
    // the vertex opposite the border edge is on the border: removal disconnects
    const isConnecting = (t) => boundary[vertex(t, boundaryIndex(t) + 2)] > 0;
    // a vertex on the border whose two edges in t are not border edges
    function hasBoundaryTouch(t) {
      for (let i = 0; i < 3; i++) {
        if (adj[3 * t + i] < 0 || adj[3 * t + (i + 2) % 3] < 0) continue;
        if (boundary[vertex(t, i)] > 0) return true;
      }
      return false;
    }
    function addBorderTri(heap, t) {
      if (t < 0 || removed[t] || numAdj(t) !== 2) return;
      heap.push(t, len[3 * t + boundaryIndex(t)]);
    }
    function removeAndQueue(heap, t) {
      const n = [adj[3 * t], adj[3 * t + 1], adj[3 * t + 2]];
      remove(t);
      for (const x of n) addBorderTri(heap, x);
    }

    const heap = new Heap();
    for (let t = 0; t < nt; t++) addBorderTri(heap, t);
    while (heap.t.length) {
      const [t, size] = heap.pop();
      if (size < threshold) break;
      if (!removed[t] && numAdj(t) === 2 && !isConnecting(t)) removeAndQueue(heap, t);
    }
    if (allowHoles) {
      const candidates = [];
      for (let t = 0; t < nt; t++) if (!removed[t] && !isBorder(t) && longest(t) >= threshold) candidates.push(t);
      candidates.sort((x, y) => longest(y) - longest(x));
      for (const hole of candidates) {
        if (removed[hole] || isBorder(hole) || hasBoundaryTouch(hole)) continue;
        const hh = new Heap();
        hh.push(hole, longest(hole));
        while (hh.t.length) {
          const [t, size] = hh.pop();
          if (t !== hole && size < threshold) break;
          if (removed[t]) continue;
          if (t === hole || (numAdj(t) === 2 && !hasBoundaryTouch(t))) removeAndQueue(hh, t);
        }
      }
    }
    const kept = [];
    for (let t = 0; t < nt; t++) if (!removed[t]) kept.push(tri[3 * t], tri[3 * t + 1], tri[3 * t + 2]);
    return kept;
  }

  // pixels (row, col) whose centre (col + 0.5, row + 0.5) is in a triangle
  function rasterizeTriangles(coords, kept, size) {
    const data = new Uint8Array(size * size);
    for (let k = 0; k < kept.length; k += 3) {
      const ax = coords[2 * kept[k]], ay = coords[2 * kept[k] + 1];
      const bx = coords[2 * kept[k + 1]], by = coords[2 * kept[k + 1] + 1];
      const cx = coords[2 * kept[k + 2]], cy = coords[2 * kept[k + 2] + 1];
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (area === 0) continue;
      const sg = area > 0 ? 1 : -1;
      const r0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5)), r1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));
      const q0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5)), q1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
      for (let r = r0; r <= r1; r++) {
        const py = r + 0.5;
        for (let q = q0; q <= q1; q++) {
          const px = q + 0.5;
          if (sg * ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) >= 0 &&
              sg * ((cx - bx) * (py - by) - (cy - by) * (px - bx)) >= 0 &&
              sg * ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) >= 0) data[r * size + q] = 1;
        }
      }
    }
    return data;
  }

  // binary_polygon_generator: concave hull of n random points in a disk,
  // rasterised, optionally smoothed (Gaussian blur > 0.5)
  function polygonMaskOfSize(rng, size, n, allowHoles, smoothing) {
    const R = size >> 1, coords = new Float64Array(2 * n);
    for (let k = 0; k < n; k++) coords[2 * k] = rng.int(0, Math.max(1, R));
    for (let k = 0; k < n; k++) {
      const d = coords[2 * k], a = rng.uniform(-Math.PI, Math.PI);
      coords[2 * k] = R + d * Math.cos(a);
      coords[2 * k + 1] = R + d * Math.sin(a);
    }
    const kept = concaveHull(coords, 0.3, allowHoles);
    let data;
    if (kept && kept.length) data = rasterizeTriangles(coords, kept, size);
    else { data = new Uint8Array(size * size); data[R * size + R] = 1; }
    if (smoothing) {
      const sigma = rng.uniform(Math.max(0.5, 2 * (size / 200)), Math.min(10, 5 * (size / 200)));
      smoothThreshold(data, size, sigma);
    }
    return { w: size, h: size, data: data };
  }

  // mask <- gaussian_filter(mask, sigma, mode="nearest") > 0.5. For large sigma
  // the blur is computed on a grid f times coarser (box averages) and
  // interpolated back: only the smooth level line at 0.5 is kept.
  function smoothThreshold(data, size, sigma) {
    const f = Math.max(1, Math.floor(sigma / 2));
    if (f === 1) {
      const b = blur(data, size, size, 1, scipyKernel(sigma), nearest);
      for (let k = 0; k < b.length; k++) data[k] = b[k] > 0.5 ? 1 : 0;
      return;
    }
    const n = Math.ceil(size / f), coarse = new Float32Array(n * n);
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) coarse[Math.floor(i / f) * n + Math.floor(j / f)] += data[i * size + j];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const h = Math.min(f, size - i * f), w = Math.min(f, size - j * f);
        coarse[i * n + j] /= h * w;
      }
    }
    // a box of width f already has a variance of (f^2 - 1) / 12 pixels^2
    const s = Math.sqrt(Math.max(0.25, sigma * sigma - (f * f - 1) / 12)) / f;
    const b = blur(coarse, n, n, 1, scipyKernel(s), nearest);
    for (let i = 0; i < size; i++) {
      const y = Math.min(n - 1, Math.max(0, (i + 0.5) / f - 0.5)), y0 = Math.min(n - 2, Math.floor(y)), fy = y - y0;
      for (let j = 0; j < size; j++) {
        const x = Math.min(n - 1, Math.max(0, (j + 0.5) / f - 0.5)), x0 = Math.min(n - 2, Math.floor(x)), fx = x - x0;
        const k = y0 * n + x0;
        const v = n === 1 ? b[0] : (1 - fy) * ((1 - fx) * b[k] + fx * b[k + 1]) + fy * ((1 - fx) * b[k + n] + fx * b[k + n + 1]);
        data[i * size + j] = v > 0.5 ? 1 : 0;
      }
    }
  }

  // masks wider than 2 rmax + 100 are scaled down (cv2.INTER_AREA, rounded)
  function fitToMaxSize(mask, rmax) {
    const limit = 2 * rmax + 100;
    if (Math.max(mask.w, mask.h) < limit) return mask;
    const scale = limit / Math.max(mask.w, mask.h);
    const nh = Math.max(1, 2 * Math.floor(mask.h * scale / 2) - 1), nw = Math.max(1, 2 * Math.floor(mask.w * scale / 2) - 1);
    const data = new Uint8Array(nw * nh), sy = mask.h / nh, sx = mask.w / nw;
    for (let i = 0; i < nh; i++) {
      const y0 = Math.floor(i * sy), y1 = Math.max(y0 + 1, Math.floor((i + 1) * sy));
      for (let j = 0; j < nw; j++) {
        const x0 = Math.floor(j * sx), x1 = Math.max(x0 + 1, Math.floor((j + 1) * sx));
        let s = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += mask.data[y * mask.w + x];
        data[i * nw + j] = s * 2 >= (y1 - y0) * (x1 - x0) ? 1 : 0;
      }
    }
    return { w: nw, h: nh, data: data };
  }

  function polygonMaskSize(r, rmax) {
    let size = 2 * Math.floor(3 * r / 2) + 1;
    if (size >= 2 * rmax + 100) size = Math.floor(2 * Math.floor(size * ((2 * rmax + 100) / size) / 2) - 1);
    return size;
  }

  function shapeMask(rng, shape, r, rmax) {
    if (shape === "disk") return diskMask(r);
    if (shape === "rectangle") return fitToMaxSize(rectangleMask(rng, r), rmax);
    const n = rng.int(50, Math.max(100, Math.floor(0.9 * r)));
    const allowHoles = rng.bit(), smoothing = rng.bit();
    return fitToMaxSize(polygonMaskOfSize(rng, 2 * Math.floor(3 * r / 2) + 1, n, allowHoles, smoothing), rmax);
  }

  // ---------------------------------------------------------------------------
  // Number of leaves (utils.number_of_leaves): 99.9% of the image covered
  // after the three layers of 10 I, I and I / 2 shapes
  // ---------------------------------------------------------------------------

  // mean mask areas, as (radii, factors), see dead_leaves_class.SHAPE_AREA_FACTORS:
  // polygons relative to pi (3 r // 2)^2, rectangles relative to pi r^2
  const AREA_FACTORS = {
    poly: [[1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 60, 100, 125, 150, 200, 250, 300, 400, 500, 650, 800, 1000],
           [0.318, 0.246, 0.308, 0.335, 0.343, 0.362, 0.376, 0.384, 0.394, 0.401, 0.408, 0.412,
            0.416, 0.413, 0.44, 0.451, 0.483, 0.52, 0.532, 0.562, 0.61, 0.615, 0.704, 0.7]],
    rectangle: [[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30],
                [0.318, 0.249, 0.58, 0.723, 0.841, 0.887, 0.925, 0.941, 0.955, 0.979, 0.988, 0.998, 1.0]],
  };

  function areaFactors(shape, rmin, rmax) {
    if (shape === "disk") return null;
    const [radii, factors] = AREA_FACTORS[shape], kEnd = Math.max(rmax, rmin + 1);
    const out = new Float64Array(kEnd - rmin);
    for (let k = rmin; k < kEnd; k++) {
      const lk = Math.log(k);
      let a;
      if (k <= radii[0]) a = factors[0];
      else if (k >= radii[radii.length - 1]) a = factors[factors.length - 1];
      else {
        let i = 1;
        while (radii[i] < k) i++;
        const l0 = Math.log(radii[i - 1]), l1 = Math.log(radii[i]);
        a = factors[i - 1] + (factors[i] - factors[i - 1]) * (lk - l0) / (l1 - l0);
      }
      if (shape === "poly") {
        const h = Math.floor(3 * k / 2);
        a *= (h / k) * (h / k) * Math.pow(Math.min(1, (2 * rmax + 100) / (2 * h + 1)), 2);
      }
      out[k - rmin] = a;
    }
    return out;
  }

  const leafCounts = new Map();
  function numberOfLeaves(rmin, rmax, alpha, width, shapes, delta) {
    const key = [rmin, rmax, alpha, width, shapes.join("+"), delta].join(",");
    if (leafCounts.has(key)) return leafCounts.get(key);
    const e = alpha - 1, kEnd = Math.max(rmax, rmin + 1), nk = kEnd - rmin;
    const norm = Math.pow(rmin, -e) - Math.pow(rmax, -e);
    // P(radius >= k), 0 beyond the largest radius
    const survival = new Float64Array(nk + 1);
    for (let i = 0; i < nk; i++) survival[i] = norm > 0 ? (Math.pow(rmin + i, -e) - Math.pow(rmax, -e)) / norm : 1;
    // the shapes of radius k cover the offsets |y| <= reach[k]
    const reaches = shapes.map((s) => {
      const a = areaFactors(s, rmin, rmax), reach = new Float64Array(nk);
      let m = 0;
      for (let i = 0; i < nk; i++) { m = Math.max(m, a ? Math.sqrt(a[i]) * (rmin + i) : rmin + i); reach[i] = m; }
      return reach;
    });
    // only offsets within the image matter
    const R = Math.min(width - 1, Math.ceil(Math.max(...reaches.map((r) => r[nk - 1]))));
    // K (probability that a shape covers an offset) by squared distance
    const K = new Float64Array(2 * R * R + 1);
    for (const reach of reaches) {
      let j = 0;
      for (let d2 = 0; d2 < K.length; d2++) {
        const d = Math.sqrt(d2);
        while (j < nk && reach[j] < d) j++;
        K[d2] += survival[j] / reaches.length;
      }
    }
    const S = 2 * R + 2, integral = new Float64Array(S * S);
    for (let a = 0; a <= 2 * R; a++) {
      let row = 0;
      for (let b = 0; b <= 2 * R; b++) {
        row += K[(a - R) * (a - R) + (b - R) * (b - R)];
        integral[(a + 1) * S + b + 1] = integral[a * S + b + 1] + row;
      }
    }
    // p(x) = sum of K(x - c) over the centres c in the image / width^2, on one
    // quadrant (the image is symmetric), with the weight of its mirror copies
    const half = Math.ceil(width / 2), lo = new Int32Array(half), hi = new Int32Array(half), wt = new Float64Array(half);
    for (let x = 0; x < half; x++) {
      lo[x] = Math.min(Math.max(x - width + 1 + R, 0), 2 * R + 1);
      hi[x] = Math.min(Math.max(x + R + 1, 0), 2 * R + 1);
      wt[x] = width - 1 - x === x ? 1 : 2;
    }
    const logq = new Float64Array(half * half), weight = new Float64Array(half * half);
    for (let i = 0; i < half; i++) {
      for (let j = 0; j < half; j++) {
        const s = integral[hi[i] * S + hi[j]] - integral[lo[i] * S + hi[j]] - integral[hi[i] * S + lo[j]] + integral[lo[i] * S + lo[j]];
        logq[i * half + j] = Math.log1p(-Math.min(s / (width * width), 1 - 1e-12));
        weight[i * half + j] = wt[i] * wt[j] / (width * width);
      }
    }
    const uncovered = (n) => { let u = 0; for (let k = 0; k < logq.length; k++) u += weight[k] * Math.exp(n * logq[k]); return u; };
    const nShapes = (I) => 10 * I + I + Math.floor(I / 2);
    let a = 0, b = 1;
    while (uncovered(b) > delta) b *= 2;
    for (let it = 0; it < 60; it++) { const m = (a + b) / 2; if (uncovered(m) > delta) a = m; else b = m; }
    let I = Math.max(1, Math.ceil(b / 11.5));
    while (uncovered(nShapes(I)) > delta) I++;
    while (I > 1 && uncovered(nShapes(I - 1)) <= delta) I--;
    leafCounts.set(key, I);
    return I;
  }

  // ---------------------------------------------------------------------------
  // Dead leaves image (Deadleaves.compose_dead_leaves_depth_of_field)
  // ---------------------------------------------------------------------------

  const GEOMETRY = 0, FILL = 1;

  // params: shape_type, radius_min, radius_max, power_law_exponent,
  //   texture_enabled, texture_types, texture_weights, slope_min, slope_max,
  //   apply_warp, apply_perspective, grey, depth_of_field, extra_blur,
  //   downscale, image_size
  // seed: integer; sources: list of RGB images (empty: random colours).
  // Each leaf draws its geometry and its fill from separate random streams, so
  // that images made with different parameters stay comparable.
  // Returns { w, h, rgba } (Uint8ClampedArray).
  function generateImage(params, seed, sources) {
    const W = params.image_size, rmin = params.radius_min, rmax = params.radius_max;
    const e = params.power_law_exponent - 1, vamin = Math.pow(rmax, -e), vamax = Math.pow(rmin, -e);
    const cfg = {
      textureTypes: params.texture_types, textureWeights: params.texture_weights,
      slopeRange: [params.slope_min, params.slope_max],
      applyWarp: params.apply_warp, applyPerspective: params.apply_perspective,
    };
    const rng = new Rng(hashInts(seed, 7));
    const blurDraw = Math.pow(rng.random(), 2);      // np.random.power(0.5)
    const blurVal = params.depth_of_field ? 5 * blurDraw : 0;
    const source = sources && sources.length ? imageSource(sources[rng.int(0, sources.length)]) : randomSource;
    const base = rng.next();
    const shapes = params.shape_type === "mix" ? ["disk", "poly", "rectangle"] : [params.shape_type];
    const interval = numberOfLeaves(rmin, rmax, params.power_law_exponent, W, shapes, 1e-3);

    let canvas, uncovered, nUncovered;
    function clear() {
      canvas = new Uint8Array(W * W * 3).fill(1);
      uncovered = new Uint8Array(W * W).fill(1);
      nUncovered = W * W;
    }

    function sampleRadius(g) { return Math.floor(1 / Math.pow(vamin + (vamax - vamin) * g.random(), 1 / e)); }

    // window of a h x w mask centred on (pr, pc), clipped to the image
    function windowOf(pr, pc, h, w) {
      return [Math.max(0, pr - (h >> 1)), Math.min(W, 1 + pr + (h >> 1)), Math.max(0, pc - (w >> 1)), Math.min(W, 1 + pc + (w >> 1))];
    }

    function placeNextShape(g) {
      const radius = sampleRadius(g);
      const shape = shapes.length === 1 ? shapes[0] : shapes[g.int(0, 3)];
      let mask, pr, pc;
      if (shape === "poly") {
        // polygons are expensive: check the bounding box before drawing them
        const size = polygonMaskSize(radius, rmax);
        pr = g.int(0, W); pc = g.int(0, W);
        const [r0, r1, c0, c1] = windowOf(pr, pc, size, size);
        let any = false;
        for (let i = r0; i < r1 && !any; i++) for (let j = c0; j < c1; j++) if (uncovered[i * W + j]) { any = true; break; }
        if (!any) return null;
        mask = shapeMask(g, shape, radius, rmax);
      } else {
        mask = shapeMask(g, shape, radius, rmax);
        pr = g.int(0, W); pc = g.int(0, W);
      }
      const [r0, r1, c0, c1] = windowOf(pr, pc, mask.h, mask.w);
      const mr = (mask.h >> 1) - pr, mc = (mask.w >> 1) - pc, h = r1 - r0, w = c1 - c0;
      const visible = new Uint8Array(h * w);
      let count = 0;
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          const k = (r0 + i) * W + c0 + j;
          if (uncovered[k] && mask.data[(r0 + i + mr) * mask.w + c0 + j + mc]) { visible[i * w + j] = 1; uncovered[k] = 0; count++; }
        }
      }
      if (!count) return null;
      nUncovered -= count;
      return { r0: r0, c0: c0, h: h, w: w, visible: visible, radius: radius };
    }

    // flat colour for small leaves, else a gradient (5%, or always without
    // textures) or a texture
    function shapeFill(f, h, w, radius) {
      const color = new Uint8Array(3);
      source.pixel(f, color, 0);
      if (radius < 20) return color;
      const angle = f.int(0, 360), color2 = new Uint8Array(3);
      source.pixel(f, color2, 0);
      const gradVsTexture = params.texture_enabled ? f.random() : 1;
      if (gradVsTexture > 0.95) {
        const k = f.uniform(0.1, 0.5), size = 2 * Math.max(h, w) + 1;
        const row = f.int(0, Math.max(1, size - h)), col = f.int(0, Math.max(1, size - w));
        return gradientCrop(color, color2, size, angle, k, row, col, h, w);
      }
      const tex = generateTexture(f, source, cfg, 60 + Math.max(h, w));
      const row = f.int(0, Math.max(1, tex.h - h)), col = f.int(0, Math.max(1, tex.w - w));
      const out = new Uint8Array(h * w * 3);
      for (let i = 0; i < h; i++) out.set(tex.data.subarray(3 * ((row + i) * tex.w + col), 3 * ((row + i) * tex.w + col + w)), 3 * i * w);
      return { w: w, h: h, data: out };
    }

    // front to back: each shape paints the pixels not covered yet
    function stack(index, n) {
      let geometry = null;
      for (let s = 0; s < n && nUncovered > 0; s++) {
        // the geometry stream continues through hidden shapes and restarts after each fill
        if (!geometry) geometry = new Rng(hashInts(base, GEOMETRY, index, s));
        const placed = placeNextShape(geometry);
        if (!placed) continue;
        geometry = null;
        const fill = shapeFill(new Rng(hashInts(base, FILL, index, s)), placed.h, placed.w, placed.radius);
        const flat = fill.length === 3;
        for (let i = 0; i < placed.h; i++) {
          for (let j = 0; j < placed.w; j++) {
            if (!placed.visible[i * placed.w + j]) continue;
            const o = 3 * ((placed.r0 + i) * W + placed.c0 + j), q = 3 * (i * placed.w + j);
            canvas[o] = flat ? fill[0] : fill.data[q];
            canvas[o + 1] = flat ? fill[1] : fill.data[q + 1];
            canvas[o + 2] = flat ? fill[2] : fill.data[q + 2];
          }
        }
      }
      const covered = new Uint8Array(W * W);
      for (let k = 0; k < W * W; k++) covered[k] = 1 - uncovered[k];
      return { image: canvas, mask: covered };
    }

    // background (blurred), in-focus middle ground, foreground (blurred);
    // pixels covered by no layer keep the canvas value 1
    clear();
    const bg = stack(0, 10 * interval);
    clear();
    const plain = stack(1, interval);
    clear();
    const fg = stack(2, Math.floor(0.5 * interval));
    const n = W * W, kernel = params.depth_of_field ? cvKernel(11, blurVal) : null;
    const toU8 = (f) => { const o = new Uint8Array(f.length); for (let k = 0; k < f.length; k++) o[k] = Math.min(255, Math.max(0, Math.round(f[k]))); return o; };
    const bgImg = kernel ? toU8(blur(bg.image, W, W, 3, kernel, reflect101)) : bg.image;
    const plainImg = new Uint8Array(3 * n);
    for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) plainImg[3 * k + c] = plain.mask[k] ? plain.image[3 * k + c] : bgImg[3 * k + c];
    // foreground += (1 - fore_mask) * plainground, in uint8 as in the original
    let fgImg = new Uint8Array(3 * n);
    for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) fgImg[3 * k + c] = (fg.image[3 * k + c] + (fg.mask[k] ? 0 : plainImg[3 * k + c])) & 255;
    let fm = Float32Array.from(fg.mask);
    if (kernel) {
      fgImg = toU8(blur(fgImg, W, W, 3, kernel, reflect101));
      fm = blur(fm, W, W, 1, kernel, reflect101);
    }
    let res = new Float32Array(3 * n);
    for (let k = 0; k < n; k++) {
      for (let c = 0; c < 3; c++) {
        const v = plainImg[3 * k + c] * (1 - fm[k]) + fgImg[3 * k + c] * fm[k];
        res[3 * k + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    if (params.extra_blur) res = blur(res, W, W, 3, cvKernel(11, rng.uniform(1, 3)), reflect101);
    let outW = W;
    if (params.downscale) {
      outW = W >> 1;
      const small = new Float32Array(3 * outW * outW);
      for (let i = 0; i < outW; i++) {
        for (let j = 0; j < outW; j++) {
          for (let c = 0; c < 3; c++) {
            const a = 3 * ((2 * i) * W + 2 * j) + c;
            small[3 * (i * outW + j) + c] = (res[a] + res[a + 3] + res[a + 3 * W] + res[a + 3 * W + 3]) / 4;
          }
        }
      }
      res = small;
    }
    const rgba = new Uint8ClampedArray(4 * outW * outW);
    for (let k = 0; k < outW * outW; k++) {
      if (params.grey) {
        const v = Math.floor(0.2125 * res[3 * k] + 0.7154 * res[3 * k + 1] + 0.0721 * res[3 * k + 2]);
        rgba[4 * k] = rgba[4 * k + 1] = rgba[4 * k + 2] = v;
      } else {
        rgba[4 * k] = Math.floor(res[3 * k]); rgba[4 * k + 1] = Math.floor(res[3 * k + 1]); rgba[4 * k + 2] = Math.floor(res[3 * k + 2]);
      }
      rgba[4 * k + 3] = 255;
    }
    return { w: outW, h: outW, rgba: rgba, interval: interval };
  }

  // ---------------------------------------------------------------------------
  // Helpers for the page (icons)
  // ---------------------------------------------------------------------------

  // binary mask of a shape type ("poly", "disk", "rectangle") of radius r
  function shapeMaskSample(shape, r, seed) {
    return shapeMask(new Rng(hashInts(seed, 11)), shape, r, 10 * r);
  }

  // a width x width texture of the given type, colours from an RGB image (or random)
  function textureSample(type, width, seed, img, opts) {
    const cfg = { textureTypes: [type], textureWeights: [1], slopeRange: [opts.slope_min, opts.slope_max],
                  applyWarp: opts.apply_warp, applyPerspective: false };
    return sourceTexture(new Rng(hashInts(seed, 13)), img ? imageSource(img) : randomSource, cfg, type, width);
  }

  root.VibrantLeaves = {
    generateImage: generateImage,
    shapeMask: shapeMaskSample,
    textureSample: textureSample,
    numberOfLeaves: numberOfLeaves,
    _internal: { Rng: Rng, fft2d: fft2d, fft1d: fft1d, fftPlan: fftPlan, fastLen: fastLen, concaveHull: concaveHull,
                 rgbToLab: rgbToLab, labToRgbU8: labToRgbU8, colorNoise: colorNoise, randomSource: randomSource },
  };
})(typeof self !== "undefined" ? self : this);
