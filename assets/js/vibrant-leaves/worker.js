/* Vibrant Leaves: generates one image per message, see generator.js. */
importScripts("delaunator.min.js", "generator.js");

let sources = [];

self.onmessage = function (e) {
  const msg = e.data;
  if (msg.type === "sources") {
    sources = msg.sources;
    return;
  }
  if (msg.type === "generate") {
    try {
      const t0 = performance.now();
      const out = self.VibrantLeaves.generateImage(msg.params, msg.seed, sources);
      self.postMessage({ type: "image", job: msg.job, index: msg.index, w: out.w, h: out.h, rgba: out.rgba,
                         ms: performance.now() - t0 }, [out.rgba.buffer]);
    } catch (err) {
      self.postMessage({ type: "error", job: msg.job, index: msg.index, message: String((err && err.message) || err) });
    }
  }
};
