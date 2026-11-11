(function () {
  "use strict";
  var store = PawsitiveStore.createStore();
  var UI = PawsitiveUI;
  var donate = PawsitiveDonate.createSession();
  var activeFilter = "all";
  var selectedCatId = null;
  var adoptGuard = PawsitiveStore.createRequestGuard();

  function cats() { return store.publicCats(); }

  function badge(status) {
    return '<span class="badge ' + PawsitiveStore.badgeClass(status) + '">' + UI.escapeHtml(status) + "</span>";
  }

  function badgeRow(cat, extraClass) {
    var labels = PawsitiveStore.visibleBadges(cat);
    if (!labels.length) return "";
    return '<div class="badge-row' + (extraClass ? " " + extraClass : "") + '">' +
      labels.map(function (b) {
        return '<span class="badge ' + b.className + '">' + UI.escapeHtml(b.text) + "</span>";
      }).join("") +
    "</div>";
  }

  function imgTag(cat, cls) {
    var src = PawsitiveStore.displayImageSrc(cat && cat.img);
    return '<img class="' + (cls || "") + '" src="' + src + '" alt="' + UI.escapeHtml(cat.name) + '" onerror="this.src=\'assets/cats/placeholder.svg\'">';
  }

  function fillLocations() {
    var sel = document.getElementById("location-select");
    var current = sel.value;
    var opts = '<option value="">All Belmopan rescue areas</option>';
    store.locations().forEach(function (loc) {
      opts += '<option value="' + UI.escapeHtml(loc) + '">' + UI.escapeHtml(loc) + "</option>";
    });
    sel.innerHTML = opts;
    if (current && store.locations().indexOf(current) !== -1) sel.value = current;
  }

  function renderStats() {
    var s = store.getState();
    document.getElementById("stat-donated-pool").textContent = UI.money(s.fundsPool);
    document.getElementById("stat-cats-rescued").textContent = String(s.demoStats.rescued);
    document.getElementById("stat-meals-provided").textContent = Number(s.demoStats.meals).toLocaleString() + "+";
    document.getElementById("stat-adopted").textContent = String(s.demoStats.homes);
    var urgent = cats().filter(function (c) { return c.status === store.STATUS.URGENT; }).map(function (c) { return c.name; });
    var el = document.getElementById("urgent-need");
    if (!el) return;
    if (urgent.length) {
      el.innerHTML = "<strong>Current urgent need:</strong> " + UI.escapeHtml(urgent.join(", ")) + ".";
    } else {
      el.innerHTML = "<strong>Sample figures</strong> — not official shelter records.";
    }
  }

  function renderCards() {
    fillLocations();
    var q = document.getElementById("search-input").value.toLowerCase().trim();
    var loc = document.getElementById("location-select").value;
    var list = cats().filter(function (cat) {
      var okStatus = activeFilter === "all" || cat.status === activeFilter;
      var okLoc = !loc || cat.location === loc;
      var blob = (cat.name + " " + cat.breed + " " + cat.location + " " + cat.story).toLowerCase();
      var okQ = !q || blob.indexOf(q) !== -1;
      return okStatus && okLoc && okQ;
    });
    var box = document.getElementById("cat-cards-container");
    if (!list.length) {
      box.innerHTML = '<div class="empty"><h3>No cats match those filters</h3><p>Try another area or reset the search.</p><p style="margin-top:0.8rem"><button class="btn btn-primary btn-sm" type="button" id="reset-filters">Reset filters</button></p></div>';
      var r = document.getElementById("reset-filters");
      if (r) r.addEventListener("click", resetFilters);
      return;
    }
    box.innerHTML = list.map(function (cat) {
      var pct = Math.min(100, Math.round((cat.fundedAmt / Math.max(1, cat.goalAmt)) * 100));
      return (
        '<article class="cat-card">' +
          '<div class="cat-media">' + imgTag(cat) +
            '<div class="media-badges">' + badgeRow(cat) + "</div>" +
            '<button type="button" class="icon-btn media-fav" data-fav="' + cat.id + '" aria-pressed="' + (cat.fav ? "true" : "false") + '" aria-label="' + (cat.fav ? "Remove " : "Save ") + UI.escapeHtml(cat.name) + '">' + (cat.fav ? heartOn() : heartOff()) + "</button>" +
          "</div>" +
          '<div class="cat-body">' +
            "<h3>" + UI.escapeHtml(cat.name) + "</h3>" +
            '<p class="meta">' + UI.escapeHtml(cat.breed) + " · " + UI.escapeHtml(cat.location) + "</p>" +
            '<div class="fund-row"><span>Care fund</span><span>' + UI.money(cat.fundedAmt) + " / " + UI.money(cat.goalAmt) + " · " + pct + "%</span></div>" +
            '<div class="progress" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
            '<div class="card-actions">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-profile="' + cat.id + '">View profile</button>' +
              '<button type="button" class="btn btn-primary btn-sm" data-sponsor="' + cat.id + '">Sponsor $15</button>' +
            "</div>" +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  function heartOn() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-6.4-3.7-9.2-8.1C1 10.2 1.4 6.8 4.1 5.2 6.3 3.9 8.8 4.6 12 7.4c3.2-2.8 5.7-3.5 7.9-2.2 2.7 1.6 3.1 5 1.3 7.7C18.4 17.3 12 21 12 21z"/></svg>';
  }
  function heartOff() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12.1 8.1C9.2 5 6.5 5.1 5 6.6 3.2 8.3 3.3 11 5.2 13.2 7.4 15.7 12 19.2 12 19.2s4.6-3.5 6.8-6c1.9-2.2 2-4.9.2-6.6-1.5-1.5-4.2-1.6-6.9 1.5z"/></svg>';
  }

  function updateFavBadge() {
    var n = store.allCats().filter(function (c) { return c.fav; }).length;
    var el = document.getElementById("fav-count");
    if (el) el.textContent = String(n);
  }

  function renderFavDrawer() {
    var box = document.getElementById("fav-drawer-content");
    var wrap = document.getElementById("fav-donate-wrap");
    var favs = store.publicCats().filter(function (c) { return c.fav; });
    if (wrap) wrap.hidden = !favs.length;
    if (!favs.length) {
      box.innerHTML = "<p class='meta'>No saved cats yet. Heart a profile to keep a shortlist.</p>";
      return;
    }
    box.innerHTML = "<ul>" + favs.map(function (cat) {
      return "<li>" + imgTag(cat) + "<div><strong>" + UI.escapeHtml(cat.name) + "</strong>" + badgeRow(cat) + "</div>" +
        '<button type="button" class="btn btn-primary btn-sm" data-sponsor="' + cat.id + '">Sponsor $15</button></li>';
    }).join("") + "</ul>";
  }

  function openProfile(id) {
    var cat = store.getCat(id);
    if (!cat || !cat.listedPublic) return;
    selectedCatId = id;
    var pct = Math.min(100, Math.round((cat.fundedAmt / Math.max(1, cat.goalAmt)) * 100));
    document.getElementById("modal-cat-content").innerHTML =
      imgTag(cat, "hero-pic") +
      badgeRow(cat) +
      "<h3 style='margin-top:0.6rem'>" + UI.escapeHtml(cat.name) + "</h3>" +
      "<p class='meta'>" + UI.escapeHtml(cat.breed) + " · " + UI.escapeHtml(cat.gender) + " · " + UI.escapeHtml(cat.age) + " · " + UI.escapeHtml(cat.location) + "</p>" +
      "<p style='margin-top:0.8rem'>" + UI.escapeHtml(cat.story) + "</p>" +
      "<p class='meta' style='margin-top:0.8rem'><strong>Health:</strong> " + UI.escapeHtml(cat.medical) + "</p>" +
      '<div class="fund-row" style="margin-top:0.9rem"><span>Care fund</span><span>' + UI.money(cat.fundedAmt) + " / " + UI.money(cat.goalAmt) + " · " + pct + "%</span></div>" +
      '<div class="progress" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
      "<p class='meta' style='margin-top:0.5rem'>$15 BZD covers a week of meals and routine care for " + UI.escapeHtml(cat.name) + ".</p>" +
      '<div class="form-actions">' +
        '<button type="button" class="btn btn-accent" data-sponsor="' + cat.id + '">Sponsor $15 (simulated)</button>' +
        '<button type="button" class="btn btn-primary" data-adopt="' + cat.id + '">Adoption application</button>' +
      "</div>";
    UI.openModal("cat-detail-modal");
  }

  function syncDonateUI() {
    var s = donate.snapshot();
    var title = document.getElementById("donate-title");
    var sub = document.getElementById("donate-subtitle");
    var ctx = document.getElementById("donate-cat-context");
    var saved = document.getElementById("donate-saved-context");
    var confirmBtn = document.getElementById("confirm-donate");
    if (s.mode === "cat") {
      title.textContent = "Sponsor " + (s.catName || "this cat");
      sub.textContent = "Simulated sponsorship — choose an amount, then confirm. Nothing is charged yet.";
      var cat = s.catId ? store.getCat(s.catId) : null;
      if (cat && ctx) {
        ctx.hidden = false;
        var img = document.getElementById("donate-cat-img");
        if (img) {
          img.src = PawsitiveStore.displayImageSrc(cat.img);
          img.alt = cat.name;
        }
        document.getElementById("donate-cat-name").textContent = cat.name;
        var pct = Math.min(100, Math.round((cat.fundedAmt / Math.max(1, cat.goalAmt)) * 100));
        document.getElementById("donate-cat-meta").textContent =
          UI.money(cat.fundedAmt) + " / " + UI.money(cat.goalAmt) + " care fund · " + pct + "%. $15 BZD covers a week of meals for " + cat.name + ".";
      }
      if (saved) saved.hidden = true;
      if (confirmBtn) confirmBtn.textContent = "Confirm simulated sponsorship";
    } else if (s.mode === "saved") {
      title.textContent = "Sponsor saved cats";
      sub.textContent = "Simulated gift to the general care fund in honour of your saved list. Nothing is charged yet.";
      if (ctx) ctx.hidden = true;
      if (saved) {
        saved.hidden = false;
        saved.textContent = s.savedNames.length
          ? ("Saved cats: " + s.savedNames.join(", ") + ". This credits the general fund, not individual care meters.")
          : "No saved cats yet.";
      }
      if (confirmBtn) confirmBtn.textContent = "Confirm simulated sponsorship";
    } else {
      title.textContent = "Care fund (simulated)";
      sub.textContent = "Choose an amount, then confirm. Nothing is charged yet.";
      if (ctx) ctx.hidden = true;
      if (saved) saved.hidden = true;
      if (confirmBtn) confirmBtn.textContent = "Confirm simulated donation";
    }
    if (confirmBtn) confirmBtn.disabled = !!s.confirmed;
    document.getElementById("custom-amt-wrap").hidden = !s.custom;
    if (s.custom) {
      var input = document.getElementById("custom-amt-input");
      if (input && document.activeElement !== input) input.value = String(s.amount);
    }
    document.querySelectorAll("#donate-modal [data-tier]").forEach(function (b) {
      var v = b.getAttribute("data-tier");
      var on = s.custom ? v === "custom" : v === String(s.amount);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll("#donate-modal [data-freq]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-freq") === s.freq ? "true" : "false");
    });
    document.querySelectorAll("#donate-modal [data-method]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-method") === s.method ? "true" : "false");
    });
    document.querySelectorAll(".fund-panel [data-tier]").forEach(function (b) {
      var v = b.getAttribute("data-tier");
      if (!v) return;
      b.setAttribute("aria-pressed", !s.custom && v === String(s.amount) ? "true" : "false");
    });
  }

  function openSponsorModal(id) {
    var cat = store.getCat(id);
    if (!cat || !cat.listedPublic) return;
    selectedCatId = id;
    donate.openForCat(cat, 15);
    syncDonateUI();
    UI.closeModal("cat-detail-modal");
    UI.closeModal("fav-drawer");
    UI.openModal("donate-modal");
  }

  function openGeneralDonate(amount, savedNames) {
    if (savedNames && savedNames.length) donate.openForSaved(savedNames, amount == null ? 15 : amount);
    else donate.openGeneral(amount == null ? 25 : amount);
    syncDonateUI();
    UI.closeModal("cat-detail-modal");
    UI.closeModal("fav-drawer");
    UI.openModal("donate-modal");
  }

  function closeDonateModal() {
    if (!donate.snapshot().confirmed) donate.cancel();
    UI.closeModal("donate-modal");
  }

  function confirmDonation() {
    var s = donate.snapshot();
    if (s.custom) {
      donate.setAmount(document.getElementById("custom-amt-input").value);
    }
    var result = donate.confirm(store);
    if (!result.applied) return;
    UI.closeAll();
    var freq = result.freq === "monthly" ? "monthly (not recurring) " : "";
    var method = result.method ? " Preferred method shown: " + result.method + " (not processed)." : "";
    var msg;
    if (result.mode === "cat" && result.catName) {
      msg = "Your " + freq + "sponsorship of " + UI.money(result.amount) + " for " + result.catName + " was recorded in this browser. No payment was taken." + method + " Thank you for supporting the care fund.";
    } else if (result.mode === "saved") {
      msg = "Your " + freq + "sponsorship of " + UI.money(result.amount) + " toward the care fund" + (result.savedNames.length ? " in honour of " + result.savedNames.join(", ") : "") + " was recorded in this browser. No payment was processed." + method;
    } else {
      msg = "Your " + freq + "donation of " + UI.money(result.amount) + " to the Belmopan care fund was recorded in this browser. No payment was processed." + method;
    }
    showThanks(msg);
  }

  function showThanks(msg) {
    document.getElementById("thankyou-msg").textContent = msg;
    document.getElementById("receipt-id").textContent = "PB-" + Math.floor(1000 + Math.random() * 9000);
    UI.openModal("thankyou-modal");
    refresh();
  }

  function resetFilters() {
    activeFilter = "all";
    document.getElementById("search-input").value = "";
    document.getElementById("location-select").value = "";
    document.querySelectorAll(".chip[data-filter]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-filter") === "all" ? "true" : "false");
    });
    renderCards();
  }

  function refresh() {
    renderStats();
    renderCards();
    updateFavBadge();
    renderFavDrawer();
  }

  function onReady() {
    UI.bindNav();
    ["cat-detail-modal", "adopt-modal", "donate-modal", "thankyou-modal", "fav-drawer"].forEach(UI.bindOverlay);
    document.getElementById("search-input").addEventListener("input", renderCards);
    document.getElementById("location-select").addEventListener("change", renderCards);
    document.querySelectorAll(".chip[data-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeFilter = btn.getAttribute("data-filter");
        document.querySelectorAll(".chip[data-filter]").forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        renderCards();
      });
    });
    document.body.addEventListener("click", function (e) {
      var t = e.target.closest("[data-fav],[data-profile],[data-sponsor],[data-sponsor-saved],[data-adopt],[data-close],[data-open-donate],[data-open-saved],[data-tier],[data-freq],[data-method]");
      if (!t) return;
      if (t.hasAttribute("data-fav")) {
        store.toggleFav(Number(t.getAttribute("data-fav")));
        refresh();
      } else if (t.hasAttribute("data-profile")) {
        openProfile(Number(t.getAttribute("data-profile")));
      } else if (t.hasAttribute("data-sponsor")) {
        e.preventDefault();
        openSponsorModal(Number(t.getAttribute("data-sponsor")));
      } else if (t.hasAttribute("data-sponsor-saved")) {
        e.preventDefault();
        var names = store.publicCats().filter(function (c) { return c.fav; }).map(function (c) { return c.name; });
        openGeneralDonate(15, names);
      } else if (t.hasAttribute("data-adopt")) {
        var cat = store.getCat(Number(t.getAttribute("data-adopt")));
        selectedCatId = cat ? cat.id : null;
        document.getElementById("adopt-modal-cat-name").textContent = cat ? ("Applying for " + cat.name) : "Adoption application";
        document.getElementById("adopt-form").reset();
        var adoptErr = document.getElementById("adopt-form-error");
        if (adoptErr) { adoptErr.hidden = true; adoptErr.textContent = ""; }
        if (selectedCatId) adoptGuard.reset(selectedCatId);
        UI.openModal("adopt-modal");
      } else if (t.hasAttribute("data-close")) {
        var closeId = t.getAttribute("data-close");
        if (closeId === "donate-modal" || closeId === "bulk-donate-modal") closeDonateModal();
        else UI.closeModal(closeId);
      } else if (t.hasAttribute("data-open-donate")) {
        var preset = t.getAttribute("data-tier");
        var amt = preset && preset !== "custom" ? Number(preset) : 25;
        openGeneralDonate(preset === "custom" ? 35 : amt);
        if (preset === "custom") {
          donate.setCustom();
          donate.setAmount(document.getElementById("custom-amt-input").value || 35);
          syncDonateUI();
        }
      } else if (t.hasAttribute("data-open-saved")) {
        e.preventDefault();
        renderFavDrawer();
        UI.openModal("fav-drawer");
      } else if (t.hasAttribute("data-tier")) {
        var v = t.getAttribute("data-tier");
        if (v === "custom") donate.setCustom();
        else donate.setAmount(Number(v));
        syncDonateUI();
        if (v === "custom") {
          var input = document.getElementById("custom-amt-input");
          if (input) input.focus();
        }
      } else if (t.hasAttribute("data-freq")) {
        donate.setFreq(t.getAttribute("data-freq"));
        syncDonateUI();
      } else if (t.hasAttribute("data-method")) {
        donate.setMethod(t.getAttribute("data-method"));
        syncDonateUI();
      }
    });
    document.getElementById("confirm-donate").addEventListener("click", confirmDonation);
    var customInput = document.getElementById("custom-amt-input");
    if (customInput) {
      customInput.addEventListener("input", function () {
        donate.setCustom();
        donate.setAmount(customInput.value);
        syncDonateUI();
      });
    }
    var donateRoot = document.getElementById("donate-modal");
    if (donateRoot) {
      donateRoot.addEventListener("click", function (e) {
        if (e.target === donateRoot) closeDonateModal();
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && donate.snapshot().open && !donate.snapshot().confirmed) donate.cancel();
    });
    document.getElementById("adopt-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var ack = document.getElementById("adopt-ack");
      var err = document.getElementById("adopt-form-error");
      if (err) { err.hidden = true; err.textContent = ""; }
      if (!ack.checked) { ack.focus(); return; }
      var catId = selectedCatId;
      if (!catId || !store.getCat(catId)) {
        document.getElementById("adopt-form").reset();
        UI.closeAll();
        showThanks("No request was recorded because no cat was selected.");
        return;
      }
      if (!adoptGuard.begin(catId)) return;
      var displayName = document.getElementById("adopt-name").value;
      var response = document.getElementById("adopt-notes").value;
      var recorded = store.recordAdoptionRequest(catId, { displayName: displayName, response: response });
      displayName = "";
      response = "";
      if (!recorded) {
        adoptGuard.release(catId);
        if (err) {
          err.hidden = false;
          err.textContent = store.getWriteError() || "The request could not be saved in this browser. The form was left open so you can try again.";
        }
        return;
      }
      adoptGuard.complete(catId);
      var cat = store.getCat(catId);
      document.getElementById("adopt-form").reset();
      UI.closeAll();
      showThanks("An adoption request" + (cat ? " for " + cat.name : "") + " was recorded, including the optional fictional display name and response you entered (or left blank). This is not a real application.");
    });
    window.addEventListener("storage", function (e) {
      if (e.key === PawsitiveStore.STORE_KEY) { store.load(); refresh(); }
    });
    refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();
