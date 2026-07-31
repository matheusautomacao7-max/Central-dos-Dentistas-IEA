(function () {
  "use strict";

  if (window.__ieaCrmStateStabilityInstalled) return;
  window.__ieaCrmStateStabilityInstalled = true;

  var nativeFetch = window.fetch.bind(window);
  var activeConversationListRequest = null;

  function isConversationListRequest(input, init) {
    var url = typeof input === "string" ? input : input && input.url;
    var method =
      (init && init.method) ||
      (typeof input !== "string" && input && input.method) ||
      "GET";
    return (
      String(method).toUpperCase() === "GET" &&
      /\/api\/crm\/conversations(?:\?|$)/.test(String(url || ""))
    );
  }

  window.fetch = function (input, init) {
    if (!isConversationListRequest(input, init)) {
      return nativeFetch(input, init);
    }

    if (activeConversationListRequest) {
      activeConversationListRequest.abort();
    }

    var controller = new AbortController();
    var options = Object.assign({}, init || {});
    var originalSignal = options.signal;

    if (originalSignal) {
      if (originalSignal.aborted) {
        controller.abort();
      } else {
        originalSignal.addEventListener(
          "abort",
          function () {
            controller.abort();
          },
          { once: true }
        );
      }
    }

    options.signal = controller.signal;
    activeConversationListRequest = controller;

    return nativeFetch(input, options).finally(function () {
      if (activeConversationListRequest === controller) {
        activeConversationListRequest = null;
      }
    });
  };
})();
