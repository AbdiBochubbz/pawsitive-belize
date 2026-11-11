(function () {
  "use strict";
  var store = PawsitiveStore.createStore();
  var UI = PawsitiveUI;
  var Photo = PawsitivePhoto;
  var editingId = null;
  var intakeDraft = Photo.createDraft("");
  var editDraft = Photo.createDraft("");

  function readTags(form, name) {
    return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (el) {
      return el.value;
    });
  }

  function setTags(form, name, tags) {
    var allowed = {};
    PawsitiveStore.normalizeTags(tags).forEach(function (tag) { allowed[tag] = true; });
    form.querySelectorAll('input[name="' + name + '"]').forEach(function (el) {
      el.checked = !!allowed[el.value];
    });
  }

  function badgeRow(cat, extraClass) {
    return '<div class="badge-row' + (extraClass ? " " + extraClass : "") + '">' +
      PawsitiveStore.visibleBadges(cat, { admin: true }).map(function (b) {
        return '<span class="badge ' + b.className + '">' + UI.escapeHtml(b.text) + "</span>";
      }).join("") +
    "</div>";
  }

  function imgTag(cat) {
    var src = Photo.displaySrc(cat && cat.img);
    return '<img src="' + src + '" alt="" onerror="this.src=\'assets/cats/placeholder.svg\'">';
  }

  function showPhotoError(prefix, message) {
    var el = document.getElementById(prefix + "-photo-error");
    if (!el) return;
    if (message) {
      el.hidden = false;
      el.textContent = message;
    } else {
      el.hidden = true;
      el.textContent = "";
    }
  }

  function renderPhotoPicker(prefix, draft) {
    var img = document.getElementById(prefix + "-photo-preview");
    var cap = document.getElementById(prefix + "-photo-caption");
    var remove = document.getElementById(prefix + "-photo-remove");
    if (img) img.src = draft.previewDisplay();
    if (cap) cap.textContent = draft.caption();
    if (remove) remove.hidden = !draft.hasPreview();
  }

  function bindPhotoPicker(prefix, getDraft) {
    function onFile(ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      showPhotoError(prefix, "");
      var checked = Photo.validateFile(file);
      if (!checked.ok) {
        showPhotoError(prefix, checked.error);
        renderPhotoPicker(prefix, getDraft());
        return;
      }
      var cap = document.getElementById(prefix + "-photo-caption");
      if (cap) cap.textContent = "Preparing photo…";
      Photo.processFile(file).then(function (result) {
        if (!result.ok) {
          showPhotoError(prefix, result.error);
          renderPhotoPicker(prefix, getDraft());
          return;
        }
        var applied = getDraft().setReplacement(result.dataUrl);
        if (!applied.ok) showPhotoError(prefix, applied.error);
        renderPhotoPicker(prefix, getDraft());
      });
    }
    document.getElementById(prefix + "-photo-capture").addEventListener("change", onFile);
    document.getElementById(prefix + "-photo-upload").addEventListener("change", onFile);
    document.getElementById(prefix + "-photo-remove").addEventListener("click", function () {
      getDraft().remove();
      showPhotoError(prefix, "");
      renderPhotoPicker(prefix, getDraft());
    });
  }

  function discardIntakePhoto() {
    intakeDraft.cancel();
    showPhotoError("intake", "");
    renderPhotoPicker("intake", intakeDraft);
  }

  function discardEditPhoto() {
    editDraft.cancel();
    showPhotoError("edit", "");
    renderPhotoPicker("edit", editDraft);
  }

  function renderMetrics() {
    var m = store.metrics();
    document.getElementById("stat-queue").textContent = m.intake;
    document.getElementById("stat-medical").textContent = m.medical;
    document.getElementById("stat-funds").textContent = UI.money(m.mealFunded);
    document.getElementById("stat-ready").textContent = m.listed;
    document.getElementById("stat-funds-sub").textContent = "Of " + UI.money(m.mealGoal) + " care-fund goals";
    document.getElementById("count-col1").textContent = m.intake;
    document.getElementById("count-col2").textContent = m.medical;
    document.getElementById("count-col3").textContent = m.ready;
  }

  function adoptionNotice(cat) {
    var total = cat.adoptionRequestCount || 0;
    if (total < 1) return "";
    var unread = cat.adoptionRequestUnread || 0;
    var countLabel = total === 1 ? "1 request" : total + " requests";
    var stateLabel = unread > 0 ? (unread === 1 ? "1 new" : unread + " new") : "Reviewed";
    var btn = unread > 0
      ? '<button type="button" class="btn btn-ghost btn-sm" data-review-adopt="' + cat.id + '">Mark reviewed</button>'
      : '<button type="button" class="btn btn-ghost btn-sm" data-unreview-adopt="' + cat.id + '">Mark unread</button>';
    var label = "View adoption requests for " + cat.name + ", " + countLabel + ", " + stateLabel + ". Opening this does not mark them reviewed.";
    return (
      '<div class="adopt-notice" data-adopt-notice="' + cat.id + '">' +
        '<button type="button" class="badge badge-request adopt-open' + (unread > 0 ? " is-new" : "") + '" data-open-adoptions="' + cat.id + '" aria-haspopup="dialog" aria-controls="adoption-apps-modal" aria-label="' + UI.escapeHtml(label) + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm2 3v2h12V7H6zm0 4v2h8v-2H6z"/></svg>' +
          " Adoption request received" +
        "</button>" +
        '<span class="meta">' + countLabel + " · " + stateLabel + "</span>" +
        btn +
      "</div>"
    );
  }

  function card(cat) {
    var pct = Math.min(100, Math.round((cat.fundedAmt / Math.max(1, cat.goalAmt)) * 100));
    var back = cat.column > 1 ? '<button type="button" class="btn btn-ghost btn-sm" data-move="' + cat.id + '" data-dir="-1">Back</button>' : "";
    var fwd = cat.column < 3 ? '<button type="button" class="btn btn-primary btn-sm" data-move="' + cat.id + '" data-dir="1">Advance</button>' : '<span class="meta">On the public list</span>';
    return (
      '<article class="staff-card" data-cat-id="' + cat.id + '">' +
        '<div class="staff-media">' + imgTag(cat) + "</div>" +
        "<h3>" + UI.escapeHtml(cat.name) + "</h3>" +
        '<p class="meta">' + UI.escapeHtml(cat.breed) + " · " + UI.escapeHtml(cat.location) + "</p>" +
        badgeRow(cat) +
        adoptionNotice(cat) +
        '<div class="fund-row"><span>Meal / care fund</span><span>' + UI.money(cat.fundedAmt) + " / " + UI.money(cat.goalAmt) + " · " + pct + "%</span></div>" +
        '<div class="progress" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
        '<p class="meta" style="margin-top:0.45rem">' + UI.escapeHtml(cat.medical) + "</p>" +
        '<div class="staff-actions">' +
          back + fwd +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + cat.id + '">Edit record</button>' +
        "</div>" +
      "</article>"
    );
  }

  function renderBoard() {
    var cols = { 1: [], 2: [], 3: [] };
    store.allCats().forEach(function (c) { (cols[c.column] || cols[1]).push(c); });
    document.getElementById("kanban-col-1").innerHTML = cols[1].map(card).join("") || '<p class="meta">No cats in intake.</p>';
    document.getElementById("kanban-col-2").innerHTML = cols[2].map(card).join("") || '<p class="meta">No cats in medical / meal tracking.</p>';
    document.getElementById("kanban-col-3").innerHTML = cols[3].map(card).join("") || '<p class="meta">No cats in the ready / public column.</p>';
  }

  function refresh() {
    renderMetrics();
    renderBoard();
    var modal = document.getElementById("adoption-apps-modal");
    if (viewingAdoptionCatId && modal && modal.classList.contains("is-open")) {
      renderAdoptionModal(viewingAdoptionCatId);
    }
  }

  function fillEdit(cat) {
    document.getElementById("edit-name").value = cat.name;
    document.getElementById("edit-breed").value = cat.breed;
    document.getElementById("edit-gender").value = cat.gender;
    document.getElementById("edit-age").value = cat.age;
    document.getElementById("edit-location").value = cat.location;
    document.getElementById("edit-status").value = cat.status;
    document.getElementById("edit-medical").value = cat.medical;
    document.getElementById("edit-story").value = cat.story;
    document.getElementById("edit-funded").value = cat.fundedAmt;
    document.getElementById("edit-goal").value = cat.goalAmt;
    document.getElementById("edit-listed").checked = !!cat.listedPublic;
    document.getElementById("edit-column").value = String(cat.column);
    setTags(document.getElementById("edit-form"), "edit-tags", cat.tags);
    editDraft = Photo.createDraft(cat.img);
    showPhotoError("edit", "");
    renderPhotoPicker("edit", editDraft);
  }

  var viewingAdoptionCatId = null;

  function renderAdoptionModal(catId) {
    var inbox = store.getAdoptionInbox(catId);
    var titleCat = document.getElementById("adoption-apps-cat");
    var list = document.getElementById("adoption-apps-list");
    if (!inbox || !list) return;
    viewingAdoptionCatId = catId;
    var countLabel = inbox.total === 1 ? "1 request" : inbox.total + " requests";
    var unreadLabel = inbox.unread > 0 ? inbox.unread + " new" : "all reviewed";
    titleCat.textContent = inbox.catName + " · " + inbox.catBreed + " · " + inbox.catStatus + " · " + countLabel + " · " + unreadLabel;
    var html = "";
    inbox.items.forEach(function (item) {
      if (item.kind === "legacy") {
        var n = item.count === 1 ? "1 earlier request." : item.count + " earlier requests.";
        html += '<article class="adopt-app adopt-app-legacy">' +
          "<h3>Earlier requests</h3>" +
          "<p>" + UI.escapeHtml(n + " " + item.message) + "</p>" +
        "</article>";
        return;
      }
      var nameText = item.blankName ? "No display name given" : item.displayName;
      var responseText = item.blankResponse ? "No response given" : item.response;
      var timeText = item.timeLabel || "Submission time unavailable";
      var stateText = item.reviewed ? "Reviewed" : "Unread";
      html += '<article class="adopt-app" data-request-id="' + UI.escapeHtml(item.id) + '">' +
        '<p class="meta">' + UI.escapeHtml(item.id) + " · " + UI.escapeHtml(stateText) + "</p>" +
        "<h3>" + UI.escapeHtml(nameText) + "</h3>" +
        '<p class="meta">' + UI.escapeHtml(timeText) + "</p>" +
        "<p>" + UI.escapeHtml(responseText) + "</p>" +
      "</article>";
    });
    list.innerHTML = html || "<p class='meta'>No adoption requests for this cat.</p>";
  }

  function openAdoptionModal(catId) {
    if (!store.getAdoptionInbox(catId)) return;
    renderAdoptionModal(catId);
    UI.openModal("adoption-apps-modal");
  }

  function onReady() {
    UI.bindNav();
    ["intake-modal", "edit-modal", "adoption-apps-modal"].forEach(UI.bindOverlay);
    bindPhotoPicker("intake", function () { return intakeDraft; });
    bindPhotoPicker("edit", function () { return editDraft; });
    document.getElementById("intake-modal").addEventListener("click", function (e) {
      if (e.target.id === "intake-modal") discardIntakePhoto();
    });
    document.getElementById("edit-modal").addEventListener("click", function (e) {
      if (e.target.id === "edit-modal") discardEditPhoto();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      discardIntakePhoto();
      discardEditPhoto();
    });

    document.body.addEventListener("click", function (e) {
      var t = e.target.closest("[data-move],[data-edit],[data-close],[data-open-intake],[data-reset],[data-review-adopt],[data-unreview-adopt],[data-open-adoptions]");
      if (!t) return;
      if (t.hasAttribute("data-open-adoptions")) {
        e.preventDefault();
        openAdoptionModal(Number(t.getAttribute("data-open-adoptions")));
      } else if (t.hasAttribute("data-review-adopt")) {
        store.reviewAdoptionRequests(Number(t.getAttribute("data-review-adopt")));
        refresh();
      } else if (t.hasAttribute("data-unreview-adopt")) {
        store.unreviewAdoptionRequests(Number(t.getAttribute("data-unreview-adopt")));
        refresh();
      } else if (t.hasAttribute("data-move")) {
        store.moveCat(Number(t.getAttribute("data-move")), Number(t.getAttribute("data-dir")));
        refresh();
      } else if (t.hasAttribute("data-edit")) {
        var cat = store.getCat(Number(t.getAttribute("data-edit")));
        if (!cat) return;
        editingId = cat.id;
        fillEdit(cat);
        UI.openModal("edit-modal");
      } else if (t.hasAttribute("data-close")) {
        var closeId = t.getAttribute("data-close");
        if (closeId === "intake-modal") discardIntakePhoto();
        if (closeId === "edit-modal") discardEditPhoto();
        UI.closeModal(closeId);
      } else if (t.hasAttribute("data-open-intake")) {
        document.getElementById("intake-form").reset();
        setTags(document.getElementById("intake-form"), "intake-tags", []);
        intakeDraft = Photo.createDraft("");
        showPhotoError("intake", "");
        renderPhotoPicker("intake", intakeDraft);
        UI.openModal("intake-modal");
      } else if (t.hasAttribute("data-reset")) {
        if (window.confirm("Reset all sample data in this browser to the original six cats? Local changes will be cleared.")) {
          store.reset();
          intakeDraft = Photo.createDraft("");
          editDraft = Photo.createDraft("");
          discardIntakePhoto();
          discardEditPhoto();
          refresh();
        }
      }
    });

    document.getElementById("intake-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var created = store.addIntake({
        name: document.getElementById("input-name").value,
        breed: document.getElementById("input-breed").value,
        gender: document.getElementById("input-gender").value,
        age: document.getElementById("input-age").value,
        location: document.getElementById("input-location").value,
        goalAmt: document.getElementById("input-meal-goal").value,
        ticks: document.getElementById("med-ticks").checked,
        vaccine: document.getElementById("med-vaccine").checked,
        medicalNote: document.getElementById("input-med-note").value,
        story: document.getElementById("input-story").value,
        tags: readTags(document.getElementById("intake-form"), "intake-tags"),
        img: intakeDraft.commitValue()
      });
      if (!created) {
        showPhotoError("intake", store.getWriteError() || "The intake could not be saved. The form was left open and no record was added.");
        return;
      }
      UI.closeModal("intake-modal");
      document.getElementById("intake-form").reset();
      setTags(document.getElementById("intake-form"), "intake-tags", []);
      intakeDraft = Photo.createDraft("");
      renderPhotoPicker("intake", intakeDraft);
      refresh();
    });

    document.getElementById("edit-form").addEventListener("submit", function (e) {
      e.preventDefault();
      if (editingId == null) return;
      var listed = document.getElementById("edit-listed").checked;
      var column = parseInt(document.getElementById("edit-column").value, 10);
      var updated = store.updateCat(editingId, {
        name: document.getElementById("edit-name").value.trim(),
        breed: document.getElementById("edit-breed").value.trim(),
        gender: document.getElementById("edit-gender").value.trim(),
        age: document.getElementById("edit-age").value.trim(),
        location: document.getElementById("edit-location").value,
        status: document.getElementById("edit-status").value,
        medical: document.getElementById("edit-medical").value.trim(),
        story: document.getElementById("edit-story").value.trim(),
        fundedAmt: Math.max(0, parseInt(document.getElementById("edit-funded").value, 10) || 0),
        goalAmt: Math.max(0, parseInt(document.getElementById("edit-goal").value, 10) || 0),
        listedPublic: listed,
        column: column,
        badge: document.getElementById("edit-status").value,
        tags: readTags(document.getElementById("edit-form"), "edit-tags"),
        img: editDraft.commitValue()
      });
      if (!updated) {
        showPhotoError("edit", store.getWriteError() || "The record could not be saved. The form was left open and the previous photo was left unchanged.");
        return;
      }
      UI.closeModal("edit-modal");
      editingId = null;
      editDraft = Photo.createDraft("");
      refresh();
    });

    window.addEventListener("storage", function (e) {
      if (e.key === PawsitiveStore.STORE_KEY) { store.load(); refresh(); }
    });
    refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();
