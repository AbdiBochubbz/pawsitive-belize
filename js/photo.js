/* Local cat photo helpers: draft state, file validation, and in-browser compression.
   No network upload. Safe to load in Node for draft/validation tests. */
(function (root) {
  "use strict";

  var MAX_INPUT_BYTES = 8 * 1024 * 1024;
  var MAX_EDGE = 1024;
  var ALLOWED_TYPES = {
    "image/jpeg": true,
    "image/jpg": true,
    "image/png": true,
    "image/webp": true
  };

  function storeApi() {
    return root.PawsitiveStore || {};
  }

  function sanitize(src) {
    var fn = storeApi().sanitizeImageSrc;
    return fn ? fn(src) : "";
  }

  function displaySrc(src) {
    var fn = storeApi().displayImageSrc;
    return fn ? fn(src) : (sanitize(src) || "assets/cats/placeholder.svg");
  }

  function placeholder() {
    return storeApi().PLACEHOLDER_IMG || "assets/cats/placeholder.svg";
  }

  function maxDataChars() {
    return storeApi().MAX_IMAGE_DATA_CHARS || 450000;
  }

  function validateFile(file) {
    if (!file) return { ok: false, error: "No file was selected." };
    var type = String(file.type || "").toLowerCase();
    var name = String(file.name || "").toLowerCase();
    if (type === "image/svg+xml" || /\.svg$/.test(name)) {
      return { ok: false, error: "SVG files are not accepted. Please choose a JPEG, PNG, or WebP photo." };
    }
    var typeOk = ALLOWED_TYPES[type];
    var extOk = /\.(jpe?g|png|webp)$/.test(name);
    if (!typeOk && !extOk) {
      return { ok: false, error: "Please choose a JPEG, PNG, or WebP photo." };
    }
    var size = Number(file.size) || 0;
    if (size > MAX_INPUT_BYTES) {
      return { ok: false, error: "That photo is larger than 8 MB. Please choose a smaller image." };
    }
    return { ok: true };
  }

  function createDraft(savedSrc) {
    var saved = sanitize(savedSrc);
    var pending = null;
    var removed = false;

    function preview() {
      if (removed) return "";
      if (pending != null) return pending;
      return saved;
    }

    return {
      preview: preview,
      previewDisplay: function () { return displaySrc(preview()); },
      setReplacement: function (dataUrl) {
        var clean = sanitize(dataUrl);
        if (!clean || ASSET_LIKE(clean)) {
          /* Replacements must be compressed raster data URLs, not arbitrary paths. */
          if (!clean || !/^data:image\//.test(clean)) return { ok: false, error: "That photo could not be used." };
        }
        if (!clean) return { ok: false, error: "That photo could not be used." };
        pending = clean;
        removed = false;
        return { ok: true };
      },
      remove: function () {
        pending = null;
        removed = true;
      },
      cancel: function () {
        pending = null;
        removed = false;
        return saved;
      },
      commitValue: function () {
        if (removed) return "";
        if (pending != null) return pending;
        return saved;
      },
      changed: function () {
        return removed || pending != null;
      },
      caption: function () {
        if (removed) return "Photo will be removed when you save.";
        if (pending != null) return "New photo ready — save the form to keep it in this browser.";
        if (saved) return "Current photo. Save is not needed unless you change it.";
        return "No photo yet.";
      },
      hasPreview: function () {
        return !!preview();
      },
      saved: function () { return saved; }
    };
  }

  function ASSET_LIKE(src) {
    return /^assets\//.test(src || "");
  }

  function processFile(file, helpers) {
    var checked = validateFile(file);
    if (!checked.ok) return Promise.resolve(checked);
    helpers = helpers || {};
    var ImageImpl = helpers.Image || (typeof Image !== "undefined" ? Image : null);
    var doc = helpers.document || (typeof document !== "undefined" ? document : null);
    var URLImpl = helpers.URL || (typeof URL !== "undefined" ? URL : null);
    if (!ImageImpl || !doc || !URLImpl || typeof URLImpl.createObjectURL !== "function") {
      return Promise.resolve({ ok: false, error: "Photo compression is not available in this browser. Try a smaller JPEG or PNG, or another device." });
    }

    return new Promise(function (resolve) {
      var objectUrl;
      try { objectUrl = URLImpl.createObjectURL(file); }
      catch (e) {
        resolve({ ok: false, error: "That file could not be opened as an image." });
        return;
      }
      var img = new ImageImpl();
      var cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        try { URLImpl.revokeObjectURL(objectUrl); } catch (e) {}
      }
      img.onload = function () {
        cleanup();
        var w = img.naturalWidth || img.width || 0;
        var h = img.naturalHeight || img.height || 0;
        if (!w || !h) {
          resolve({ ok: false, error: "That file could not be read as an image." });
          return;
        }
        var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = doc.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext("2d");
        if (!ctx || typeof canvas.toDataURL !== "function") {
          resolve({ ok: false, error: "This browser cannot compress photos. Try uploading a smaller JPEG." });
          return;
        }
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, cw, ch);
        try { ctx.drawImage(img, 0, 0, cw, ch); }
        catch (e) {
          resolve({ ok: false, error: "That file could not be read as an image." });
          return;
        }
        var quality = 0.82;
        var data = "";
        try {
          while (quality >= 0.5) {
            data = canvas.toDataURL("image/jpeg", quality);
            if (data.length <= maxDataChars()) break;
            quality -= 0.12;
          }
        } catch (e) {
          resolve({ ok: false, error: "That photo could not be compressed in this browser." });
          return;
        }
        var clean = sanitize(data);
        if (!clean) {
          resolve({ ok: false, error: "That photo is still too large after compression, or the format was not accepted. Try a smaller image." });
          return;
        }
        resolve({ ok: true, dataUrl: clean, width: cw, height: ch });
      };
      img.onerror = function () {
        cleanup();
        resolve({ ok: false, error: "That file could not be read as an image." });
      };
      img.src = objectUrl;
    });
  }

  var api = {
    MAX_INPUT_BYTES: MAX_INPUT_BYTES,
    MAX_EDGE: MAX_EDGE,
    validateFile: validateFile,
    createDraft: createDraft,
    processFile: processFile,
    sanitizeImageSrc: function (src) { return sanitize(src); },
    displaySrc: displaySrc,
    placeholder: placeholder
  };

  root.PawsitivePhoto = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
