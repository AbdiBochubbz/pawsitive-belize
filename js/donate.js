/* Shared sponsorship / donation session.
   Opening a modal never credits funds. addFunds runs only on explicit confirm, once per session. */
(function (root) {
  "use strict";

  var PRESETS = [10, 15, 25, 50, 100];
  var METHODS = ["DigiWallet", "Belize Bank", "Card"];

  function blank() {
    return {
      open: false,
      confirmed: false,
      mode: "general",
      catId: null,
      catName: null,
      savedNames: [],
      amount: 25,
      custom: false,
      freq: "once",
      method: METHODS[0]
    };
  }

  function snap(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function toAmount(n, fallback) {
    var amt = Math.round(Number(n));
    if (!isFinite(amt) || amt < 1) return fallback;
    return amt;
  }

  function createSession() {
    var state = blank();

    function open(opts) {
      opts = opts || {};
      state = blank();
      state.open = true;
      if (opts.catId) {
        state.mode = "cat";
        state.catId = opts.catId;
        state.catName = opts.catName || null;
        state.amount = toAmount(opts.amount, 15);
      } else if (opts.savedNames && opts.savedNames.length) {
        state.mode = "saved";
        state.savedNames = opts.savedNames.slice();
        state.amount = toAmount(opts.amount, 15);
      } else {
        state.mode = "general";
        state.amount = toAmount(opts.amount, 25);
      }
      state.custom = PRESETS.indexOf(state.amount) === -1;
      return snap(state);
    }

    function setAmount(n) {
      if (!state.open || state.confirmed) return snap(state);
      state.amount = toAmount(n, state.amount);
      state.custom = PRESETS.indexOf(state.amount) === -1;
      return snap(state);
    }

    function setCustom() {
      if (!state.open || state.confirmed) return snap(state);
      state.custom = true;
      return snap(state);
    }

    function setFreq(freq) {
      if (!state.open || state.confirmed) return snap(state);
      state.freq = freq === "monthly" ? "monthly" : "once";
      return snap(state);
    }

    function setMethod(method) {
      if (!state.open || state.confirmed) return snap(state);
      if (METHODS.indexOf(method) !== -1) state.method = method;
      return snap(state);
    }

    function cancel() {
      var before = snap(state);
      state = blank();
      return before;
    }

    function confirm(store) {
      if (!state.open || state.confirmed) {
        return { applied: false, reason: state.confirmed ? "already-confirmed" : "not-open", snapshot: snap(state) };
      }
      var amt = state.amount;
      if (amt < 1) return { applied: false, reason: "invalid-amount", snapshot: snap(state) };
      if (store && typeof store.addFunds === "function") {
        store.addFunds(amt, state.catId || undefined);
      }
      state.confirmed = true;
      state.open = false;
      return {
        applied: true,
        amount: amt,
        catId: state.catId,
        catName: state.catName,
        mode: state.mode,
        freq: state.freq,
        method: state.method,
        savedNames: state.savedNames.slice(),
        snapshot: snap(state)
      };
    }

    return {
      PRESETS: PRESETS,
      METHODS: METHODS,
      snapshot: function () { return snap(state); },
      open: open,
      openForCat: function (cat, amount) {
        if (!cat) return snap(state);
        return open({ catId: cat.id, catName: cat.name, amount: amount == null ? 15 : amount });
      },
      openGeneral: function (amount) {
        return open({ amount: amount == null ? 25 : amount });
      },
      openForSaved: function (names, amount) {
        return open({ savedNames: names || [], amount: amount == null ? 15 : amount });
      },
      setAmount: setAmount,
      setCustom: setCustom,
      setFreq: setFreq,
      setMethod: setMethod,
      cancel: cancel,
      confirm: confirm
    };
  }

  var api = {
    PRESETS: PRESETS,
    METHODS: METHODS,
    createSession: createSession
  };

  root.PawsitiveDonate = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
