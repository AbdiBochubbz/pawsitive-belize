/* Shared UI helpers: modals, drawers, focus, ESC, mobile nav. */
(function (root) {
  "use strict";

  function placeholder(name) {
    var initials = String(name || "C").split(/\s+/).map(function (p) { return p.charAt(0); }).join("").slice(0, 2).toUpperCase();
    return '<div class="ph" aria-hidden="true">' + initials + "</div>";
  }

  function mediaHtml(cat, className) {
    var src = (root.PawsitiveStore && typeof PawsitiveStore.sanitizeImageSrc === "function")
      ? PawsitiveStore.sanitizeImageSrc(cat.img)
      : "";
    if (src) {
      return '<img class="' + (className || "") + '" src="' + src + '" alt="' + escapeHtml(cat.name) + '" onerror="this.outerHTML=this.dataset.ph" data-ph="">';
    }
    return placeholder(cat.name);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function openModal(id) {
    var root = document.getElementById(id);
    if (!root) return;
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    var focusable = root.querySelector("button, [href], input, select, textarea");
    if (focusable) focusable.focus();
    document.body.style.overflow = "hidden";
  }

  function closeModal(id) {
    var root = document.getElementById(id);
    if (!root) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal-root.is-open, .drawer-root.is-open")) {
      document.body.style.overflow = "";
    }
  }

  function closeAll() {
    document.querySelectorAll(".modal-root.is-open").forEach(function (el) {
      el.classList.remove("is-open");
      el.setAttribute("aria-hidden", "true");
    });
    document.querySelectorAll(".drawer-root.is-open").forEach(function (el) {
      el.classList.remove("is-open");
      el.setAttribute("aria-hidden", "true");
    });
    document.body.style.overflow = "";
  }

  function bindOverlay(id) {
    var root = document.getElementById(id);
    if (!root) return;
    root.addEventListener("click", function (e) {
      if (e.target === root || e.target.classList.contains("backdrop")) closeModal(id);
    });
  }

  if (typeof document !== "undefined") {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAll();
    });
  }

  function bindNav() {
    var btn = document.getElementById("menu-toggle");
    var nav = document.getElementById("site-nav");
    if (!btn || !nav) return;
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function money(n) {
    return "$" + Number(n || 0).toLocaleString() + " BZD";
  }

  var api = {
    placeholder: placeholder,
    mediaHtml: mediaHtml,
    escapeHtml: escapeHtml,
    openModal: openModal,
    closeModal: closeModal,
    closeAll: closeAll,
    bindOverlay: bindOverlay,
    bindNav: bindNav,
    money: money
  };
  root.PawsitiveUI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
