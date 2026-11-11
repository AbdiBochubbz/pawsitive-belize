/* Shared demo data + local persistence for public and staff pages.
   Browser-only storage; no network. Safe to load in Node with a memory adapter. */
(function (root) {
  "use strict";

  var STORE_KEY = "pawsitive-belize-demo-v1";
  var VERSION = 1;

  var STATUS = {
    READY: "Ready for Adoption",
    URGENT: "Urgent Medical",
    NURSERY: "Kitten Nursery",
    FOSTERED: "Fostered",
    INTAKE: "Intake"
  };

  /* Optional profile tags — distinct from board column, public status, and location.
     Labels use site/user canonical capitalization. Do not infer these from status. */
  var TAGS = [
    "Urgent Medical",
    "Kitten Nursery",
    "Fostered",
    "Paired Adoption"
  ];

  function normalizeTags(input) {
    var list = [];
    if (input == null || input === "") return list;
    var raw = Array.isArray(input) ? input : [input];
    var seen = {};
    raw.forEach(function (item) {
      var key = String(item == null ? "" : item).trim().toLowerCase();
      if (!key || seen[key]) return;
      var canonical = null;
      for (var i = 0; i < TAGS.length; i++) {
        if (TAGS[i].toLowerCase() === key) { canonical = TAGS[i]; break; }
      }
      if (!canonical) return;
      seen[key] = true;
      list.push(canonical);
    });
    return TAGS.filter(function (tag) { return list.indexOf(tag) !== -1; });
  }

  function tagClass(tag) {
    if (tag === STATUS.READY) return "badge-ready";
    if (tag === STATUS.URGENT) return "badge-urgent";
    if (tag === STATUS.NURSERY) return "badge-nursery";
    if (tag === STATUS.FOSTERED) return "badge-foster";
    if (tag === "Paired Adoption") return "badge-pair";
    return "badge-intake";
  }

  function visibleBadges(cat, opts) {
    opts = opts || {};
    var labels = [];
    function add(text, cls) {
      if (!text) return;
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].text === text) return;
      }
      labels.push({ text: text, className: cls || tagClass(text) });
    }
    if (cat) {
      add(cat.status);
      normalizeTags(cat.tags).forEach(function (tag) { add(tag); });
      if (opts.admin) {
        add(cat.listedPublic ? "Listed publicly" : "Not on public site", cat.listedPublic ? "badge-ready" : "badge-intake");
      }
    }
    return labels;
  }

  var PLACEHOLDER_IMG = "assets/cats/placeholder.svg";
  var MAX_IMAGE_DATA_CHARS = 450000;
  var ASSET_IMG_RE = /^assets\/cats\/placeholder\.svg$|^assets\/cats\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/;
  var DATA_IMG_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i;

  function sanitizeImageSrc(src) {
    if (src == null) return "";
    var s = String(src).trim();
    if (!s) return "";
    if (ASSET_IMG_RE.test(s)) return s;
    var compact = s.replace(/\s+/g, "");
    if (DATA_IMG_RE.test(compact) && compact.length <= MAX_IMAGE_DATA_CHARS) return compact;
    return "";
  }

  function displayImageSrc(src) {
    return sanitizeImageSrc(src) || PLACEHOLDER_IMG;
  }

  var PII_KEYS = [
    "applicant", "applicantName", "displayName", "email", "phone", "telephone",
    "whatsapp", "address", "message", "notes", "adoptName", "adoptNotes",
    "contact", "personal", "freeText"
  ];

  function toCount(n) {
    var v = Math.round(Number(n));
    return isFinite(v) && v > 0 ? v : 0;
  }

  var MAX_ADOPT_NAME = 80;
  var MAX_ADOPT_RESPONSE = 400;
  var LEGACY_DETAIL_MESSAGE = "Details unavailable for requests submitted before this update";
  var TZ_LABEL = "America/Guatemala";

  function clipText(value, max) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  function sanitizeAdoptionEntry(raw, catId) {
    if (!raw || typeof raw !== "object") return null;
    var submittedAt = Number(raw.submittedAt);
    if (!isFinite(submittedAt) || submittedAt <= 0) submittedAt = 0;
    var id = String(raw.id == null ? "" : raw.id).trim();
    if (id && !/^AR-\d{1,12}$/.test(id)) id = "";
    var displayName = clipText(raw.displayName, MAX_ADOPT_NAME);
    var response = clipText(raw.response, MAX_ADOPT_RESPONSE);
    if (!id && !displayName && !response && !submittedAt) return null;
    return {
      id: id,
      catId: catId || raw.catId || null,
      displayName: displayName,
      response: response,
      submittedAt: submittedAt,
      reviewed: !!raw.reviewed
    };
  }

  function formatAdoptionTime(ms) {
    var t = Number(ms);
    if (!isFinite(t) || t <= 0) return "";
    try {
      var formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ_LABEL,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date(t));
      return formatted + " (" + TZ_LABEL + ")";
    } catch (e) {
      return "";
    }
  }

  function normalizeAdoptionCounts(cat) {
    if (!Array.isArray(cat.adoptionRequests)) cat.adoptionRequests = [];
    else {
      var catId = cat.id;
      cat.adoptionRequests = cat.adoptionRequests.map(function (row) {
        return sanitizeAdoptionEntry(row, catId);
      }).filter(Boolean);
    }
    var detailed = cat.adoptionRequests.length;
    var count = toCount(cat.adoptionRequestCount);
    if (count < detailed) count = detailed;
    cat.adoptionRequestCount = count;
    var detailedUnread = 0;
    cat.adoptionRequests.forEach(function (row) { if (!row.reviewed) detailedUnread += 1; });
    var unread = toCount(cat.adoptionRequestUnread);
    if (unread < detailedUnread) unread = detailedUnread;
    if (unread > count) unread = count;
    cat.adoptionRequestUnread = unread;
  }

  function visibleAdoptionItems(cat) {
    if (!cat) return [];
    normalizeAdoptionCounts(cat);
    var items = [];
    var legacy = Math.max(0, cat.adoptionRequestCount - cat.adoptionRequests.length);
    if (legacy > 0) {
      items.push({
        kind: "legacy",
        count: legacy,
        message: LEGACY_DETAIL_MESSAGE,
        displayName: "",
        response: "",
        submittedAt: 0,
        timeLabel: "",
        reviewed: null
      });
    }
    cat.adoptionRequests.forEach(function (row) {
      items.push({
        kind: "detail",
        id: row.id,
        catId: row.catId || cat.id,
        displayName: row.displayName,
        response: row.response,
        submittedAt: row.submittedAt,
        timeLabel: formatAdoptionTime(row.submittedAt),
        reviewed: !!row.reviewed,
        blankName: !row.displayName,
        blankResponse: !row.response
      });
    });
    return items;
  }

  function stripApplicantFields(cat) {
    PII_KEYS.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(cat, k)) delete cat[k]; });
  }

  function createRequestGuard() {
    var locks = {};
    return {
      begin: function (id) {
        var key = String(id);
        if (!id || locks[key]) return false;
        locks[key] = "pending";
        return true;
      },
      complete: function (id) { locks[String(id)] = "done"; },
      release: function (id) {
        var key = String(id);
        if (locks[key] === "pending") delete locks[key];
      },
      reset: function (id) { delete locks[String(id)]; },
      isBlocked: function (id) { return !!locks[String(id)]; }
    };
  }

  function normalizeCat(cat) {
    if (!cat || typeof cat !== "object") return cat;
    cat.tags = normalizeTags(cat.tags);
    cat.img = sanitizeImageSrc(cat.img);
    normalizeAdoptionCounts(cat);
    stripApplicantFields(cat);
    return cat;
  }

  function seedCats() {
    return [
      { id: 1, name: "Misha", breed: "Calico Domestic Shorthair", gender: "Female", age: "1 Year", location: "San Martin Neighborhood", status: STATUS.READY, img: "assets/cats/misha.jpg", story: "Found near a fruit stand in San Martin, Belmopan. Misha is extremely affectionate, loves lap cuddles, and enjoys sleeping in sunny spots.", medical: "Spayed, rabies vaccinated, dewormed.", fundedAmt: 35, goalAmt: 50, fav: false, column: 3, listedPublic: true, tags: [], badge: "Ready for adoption" },
      { id: 2, name: "Simba & Milo", breed: "Orange Tabby Brothers", gender: "Male pair", age: "3 Months (kittens)", location: "Salvapan Area Intake", status: STATUS.NURSERY, img: "assets/cats/simba-milo.jpg", story: "Rescued during a thunderstorm near Salvapan school. They are inseparable playmates who require kitten growth formula and wet food.", medical: "First vaccination booster done, flea free.", fundedAmt: 20, goalAmt: 60, fav: false, column: 2, listedPublic: true, tags: [], badge: "Kitten nursery" },
      { id: 3, name: "Cleo", breed: "Siamese Mix", gender: "Female", age: "2 Years", location: "Belmopan Civic Center", status: STATUS.URGENT, img: "assets/cats/cleo.jpg", story: "Rescued with an eye infection and mild dehydration near Belmopan Civic Center. Currently receiving antibiotics and eye ointment daily.", medical: "Undergoing antibiotic treatment.", fundedAmt: 45, goalAmt: 90, fav: false, column: 2, listedPublic: true, tags: [], badge: "Urgent medical" },
      { id: 4, name: "Felix", breed: "Tuxedo Cat", gender: "Male", age: "3 Years", location: "Forest Drive Rescue", status: STATUS.READY, img: "assets/cats/felix.jpg", story: "Friendly neighbourhood stray that frequented Forest Drive homes. Neutered and loves purring loudly whenever stroked.", medical: "Neutered, microchipped, fully healthy.", fundedAmt: 50, goalAmt: 50, fav: false, column: 3, listedPublic: true, tags: [], badge: "Ready for adoption" },
      { id: 5, name: "Luna", breed: "Tortoiseshell", gender: "Female", age: "8 Months", location: "Maya Mopan Area", status: STATUS.FOSTERED, img: "assets/cats/luna.jpg", story: "Currently living with a local foster volunteer in Maya Mopan. Shy at first, but loves feathers and string toys.", medical: "Spayed, indoor trained.", fundedAmt: 40, goalAmt: 40, fav: false, column: 3, listedPublic: true, tags: [], badge: "In foster" },
      { id: 6, name: "Oliver", breed: "Ginger Tabby", gender: "Male", age: "5 Years", location: "Belmopan Central", status: STATUS.URGENT, img: "assets/cats/oliver.jpg", story: "Senior stray found with dental issues. Requires a special soft-food diet and a dental cleaning at a local vet.", medical: "Needs dental care and soft food formula.", fundedAmt: 30, goalAmt: 100, fav: false, column: 2, listedPublic: true, tags: [], badge: "Urgent medical" }
    ];
  }

  function defaultState() {
    return {
      version: VERSION,
      cats: seedCats(),
      fundsPool: 3420,
      demoStats: { rescued: 114, meals: 1850, homes: 78 },
      nextId: 7,
      nextAdoptionId: 1
    };
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function isQuotaError(err) {
    if (!err) return false;
    return err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED" || err.code === 22 || err.code === 1014;
  }

  function memoryAdapter() {
    var mem = null;
    return {
      get: function () { return mem ? JSON.parse(mem) : null; },
      set: function (data) { mem = JSON.stringify(data); return { ok: true }; },
      clear: function () { mem = null; }
    };
  }

  function localStorageAdapter() {
    return {
      get: function () {
        try {
          var raw = root.localStorage.getItem(STORE_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
      },
      set: function (data) {
        try {
          root.localStorage.setItem(STORE_KEY, JSON.stringify(data));
          return { ok: true };
        } catch (e) {
          return { ok: false, quota: isQuotaError(e), error: e };
        }
      },
      clear: function () {
        try { root.localStorage.removeItem(STORE_KEY); } catch (e) {}
      }
    };
  }

  function createStore(adapter) {
    var storeAdapter = adapter || (typeof root.localStorage !== "undefined" ? localStorageAdapter() : memoryAdapter());
    var state = defaultState();
    var listeners = [];
    var lastWriteError = null;

    function validState(s) {
      return s && s.version === VERSION && Array.isArray(s.cats) && s.cats.length > 0;
    }

    function syncAdoptionIds() {
      if (!state.nextAdoptionId || state.nextAdoptionId < 1) state.nextAdoptionId = 1;
      state.cats.forEach(function (cat) {
        (cat.adoptionRequests || []).forEach(function (app) {
          if (!app.id) app.id = "AR-" + state.nextAdoptionId++;
          else {
            var n = parseInt(String(app.id).replace(/^AR-/, ""), 10);
            if (isFinite(n) && n >= state.nextAdoptionId) state.nextAdoptionId = n + 1;
          }
          if (!app.catId) app.catId = cat.id;
        });
      });
    }

    function load() {
      var saved = storeAdapter.get();
      state = validState(saved) ? saved : defaultState();
      if (!state.nextAdoptionId) state.nextAdoptionId = 1;
      state.cats.forEach(normalizeCat);
      syncAdoptionIds();
      return getState();
    }

    function writeResult(result) {
      if (result && typeof result === "object" && "ok" in result) return result;
      return { ok: true };
    }

    function persist() {
      var snapshot = null;
      return persistFrom(snapshot, false);
    }

    function persistFrom(snapshot, rollback) {
      var result;
      try {
        result = writeResult(storeAdapter.set(state));
      } catch (e) {
        result = { ok: false, quota: isQuotaError(e), error: e };
      }
      if (!result.ok) {
        if (rollback && snapshot) state = snapshot;
        lastWriteError = result.quota
          ? "This browser does not have enough storage space for that photo. The saved record was left unchanged. Try a smaller image, or remove the photo and save again."
          : "The photo could not be saved in this browser. The previous record was left unchanged.";
        return false;
      }
      lastWriteError = null;
      listeners.forEach(function (fn) { try { fn(getState()); } catch (e) {} });
      return true;
    }

    function transact(fn) {
      var snapshot = clone(state);
      var value = fn();
      if (!persistFrom(snapshot, true)) return null;
      return value;
    }

    function getState() { return clone(state); }

    function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }

    function reset() {
      storeAdapter.clear();
      state = defaultState();
      state.cats.forEach(normalizeCat);
      syncAdoptionIds();
      persist();
      return getState();
    }

    function findCat(id) {
      return state.cats.find(function (c) { return c.id === id; });
    }

    function updateCat(id, patch) {
      if (!findCat(id)) return null;
      return transact(function () {
        var cat = findCat(id);
        Object.keys(patch || {}).forEach(function (k) {
          if (k === "id" || PII_KEYS.indexOf(k) !== -1) return;
          if (k === "tags") cat.tags = normalizeTags(patch.tags);
          else if (k === "img") cat.img = sanitizeImageSrc(patch.img);
          else if (k === "adoptionRequestCount" || k === "adoptionRequestUnread" || k === "adoptionRequests") return;
          else cat[k] = patch[k];
        });
        normalizeCat(cat);
        return clone(cat);
      });
    }

    function addIntake(fields) {
      var medicalParts = [];
      if (fields.ticks) medicalParts.push("Tick and flea treatment required");
      if (fields.vaccine) medicalParts.push("Vaccination pending");
      if (fields.medicalNote) medicalParts.push(fields.medicalNote);
      return transact(function () {
      var id = state.nextId++;
      var cat = {
        id: id,
        name: String(fields.name || "").trim() || ("Cat #" + id),
        breed: fields.breed || "Domestic shorthair",
        gender: fields.gender || "Unknown",
        age: fields.age || "Unknown",
        location: fields.location || "Belmopan Central",
        status: STATUS.INTAKE,
        img: sanitizeImageSrc(fields.img),
        story: fields.story || "Newly registered staff intake. Profile details can be completed in the staff portal.",
        medical: medicalParts.join(". ") || "Registered for intake assessment.",
        fundedAmt: 0,
        goalAmt: Math.max(0, parseInt(fields.goalAmt, 10) || 40),
        fav: false,
        column: 1,
        listedPublic: false,
        badge: "New intake",
        tags: normalizeTags(fields.tags),
        adoptionRequestCount: 0,
        adoptionRequestUnread: 0,
        adoptionRequests: []
      };
        state.cats.unshift(cat);
        return clone(cat);
      });
    }

    function moveCat(id, direction) {
      var cat = findCat(id);
      if (!cat) return null;
      var next = cat.column + direction;
      if (next < 1 || next > 3) return clone(cat);
      cat.column = next;
      if (next === 1) {
        cat.badge = "Intake";
        if (cat.status === STATUS.READY) cat.status = STATUS.INTAKE;
      } else if (next === 2) {
        cat.badge = "Medical / feeding";
        if (cat.status === STATUS.INTAKE || cat.status === STATUS.READY) cat.status = STATUS.URGENT;
      } else if (next === 3) {
        cat.listedPublic = true;
        if (cat.status === STATUS.INTAKE || cat.status === STATUS.URGENT) {
          cat.status = STATUS.READY;
        }
        cat.badge = cat.status;
      }
      persist();
      return clone(cat);
    }

    function toggleFav(id) {
      var cat = findCat(id);
      if (!cat) return null;
      cat.fav = !cat.fav;
      persist();
      return clone(cat);
    }

    function addFunds(amount, catId) {
      var amt = Math.max(0, Number(amount) || 0);
      state.fundsPool += amt;
      if (catId) {
        var cat = findCat(catId);
        if (cat) cat.fundedAmt += amt;
      }
      persist();
      return state.fundsPool;
    }

    function recordAdoptionRequest(id, fields) {
      if (!findCat(id)) return null;
      fields = fields || {};
      return transact(function () {
        var cat = findCat(id);
        var status = cat.status;
        var column = cat.column;
        var listed = cat.listedPublic;
        normalizeAdoptionCounts(cat);
        if (!state.nextAdoptionId) state.nextAdoptionId = 1;
        var entry = {
          id: "AR-" + state.nextAdoptionId++,
          catId: cat.id,
          displayName: clipText(fields.displayName, MAX_ADOPT_NAME),
          response: clipText(fields.response, MAX_ADOPT_RESPONSE),
          submittedAt: Date.now(),
          reviewed: false
        };
        cat.adoptionRequests.push(entry);
        cat.adoptionRequestCount += 1;
        cat.adoptionRequestUnread += 1;
        cat.status = status;
        cat.column = column;
        cat.listedPublic = listed;
        stripApplicantFields(cat);
        return clone(cat);
      });
    }

    function reviewAdoptionRequests(id) {
      if (!findCat(id)) return null;
      return transact(function () {
        var cat = findCat(id);
        normalizeAdoptionCounts(cat);
        cat.adoptionRequests.forEach(function (row) { row.reviewed = true; });
        cat.adoptionRequestUnread = 0;
        return clone(cat);
      });
    }

    function unreviewAdoptionRequests(id) {
      if (!findCat(id)) return null;
      return transact(function () {
        var cat = findCat(id);
        normalizeAdoptionCounts(cat);
        cat.adoptionRequests.forEach(function (row) { row.reviewed = false; });
        cat.adoptionRequestUnread = cat.adoptionRequestCount;
        return clone(cat);
      });
    }

    function getAdoptionInbox(id) {
      var cat = findCat(id);
      if (!cat) return null;
      normalizeAdoptionCounts(cat);
      return {
        catId: cat.id,
        catName: cat.name,
        catBreed: cat.breed,
        catStatus: cat.status,
        catImg: displayImageSrc(cat.img),
        total: cat.adoptionRequestCount,
        unread: cat.adoptionRequestUnread,
        legacyCount: Math.max(0, cat.adoptionRequestCount - cat.adoptionRequests.length),
        legacyMessage: LEGACY_DETAIL_MESSAGE,
        items: visibleAdoptionItems(cat)
      };
    }

    function publicCats() {
      return state.cats.filter(function (c) { return c.listedPublic; }).map(clone);
    }

    function locations() {
      var set = {};
      state.cats.forEach(function (c) { if (c.location) set[c.location] = true; });
      return Object.keys(set).sort();
    }

    function metrics() {
      var c1 = 0, c2 = 0, c3 = 0, meals = 0, goals = 0;
      state.cats.forEach(function (c) {
        if (c.column === 1) c1++;
        else if (c.column === 2) c2++;
        else c3++;
        meals += Number(c.fundedAmt) || 0;
        goals += Number(c.goalAmt) || 0;
      });
      return {
        intake: c1,
        medical: c2,
        ready: c3,
        total: state.cats.length,
        mealFunded: meals,
        mealGoal: goals,
        fundsPool: state.fundsPool,
        listed: state.cats.filter(function (c) { return c.listedPublic; }).length
      };
    }

    load();

    return {
      STATUS: STATUS,
      STORE_KEY: STORE_KEY,
      load: load,
      reset: reset,
      getState: getState,
      subscribe: subscribe,
      updateCat: updateCat,
      addIntake: addIntake,
      moveCat: moveCat,
      toggleFav: toggleFav,
      addFunds: addFunds,
      recordAdoptionRequest: recordAdoptionRequest,
      reviewAdoptionRequests: reviewAdoptionRequests,
      unreviewAdoptionRequests: unreviewAdoptionRequests,
      getAdoptionInbox: getAdoptionInbox,
      publicCats: publicCats,
      allCats: function () { return clone(state.cats); },
      getCat: function (id) { var c = findCat(id); return c ? clone(c) : null; },
      locations: locations,
      metrics: metrics,
      defaultState: defaultState,
      seedCats: seedCats,
      normalizeTags: normalizeTags,
      visibleBadges: visibleBadges,
      sanitizeImageSrc: sanitizeImageSrc,
      displayImageSrc: displayImageSrc,
      getWriteError: function () { return lastWriteError; },
      PLACEHOLDER_IMG: PLACEHOLDER_IMG,
      MAX_IMAGE_DATA_CHARS: MAX_IMAGE_DATA_CHARS
    };
  }

  var api = {
    STATUS: STATUS,
    TAGS: TAGS,
    STORE_KEY: STORE_KEY,
    createStore: createStore,
    memoryAdapter: memoryAdapter,
    defaultState: defaultState,
    seedCats: seedCats,
    normalizeTags: normalizeTags,
    tagClass: tagClass,
    visibleBadges: visibleBadges,
    sanitizeImageSrc: sanitizeImageSrc,
    displayImageSrc: displayImageSrc,
    createRequestGuard: createRequestGuard,
    formatAdoptionTime: formatAdoptionTime,
    visibleAdoptionItems: visibleAdoptionItems,
    sanitizeAdoptionEntry: sanitizeAdoptionEntry,
    clipText: clipText,
    MAX_ADOPT_NAME: MAX_ADOPT_NAME,
    MAX_ADOPT_RESPONSE: MAX_ADOPT_RESPONSE,
    LEGACY_DETAIL_MESSAGE: LEGACY_DETAIL_MESSAGE,
    PLACEHOLDER_IMG: PLACEHOLDER_IMG,
    MAX_IMAGE_DATA_CHARS: MAX_IMAGE_DATA_CHARS,
    badgeClass: function (status) {
      return tagClass(status);
    }
  };

  root.PawsitiveStore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
