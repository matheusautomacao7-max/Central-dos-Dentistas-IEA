(function () {
  "use strict";

  var nativeFetch = window.fetch.bind(window);
  var activeConversationId = null;
  var mediaItems = [];
  var refreshTimer = null;
  var renderTimer = null;
  var observer = null;
  var mediaSignature = "";
  var renderingMedia = false;

  function mediaType(item) {
    var value = String((item && (item.message_type || item.type)) || "").toLowerCase();
    if (value.indexOf("audio") >= 0 || value === "ptt") return "audio";
    if (value.indexOf("image") >= 0) return "image";
    if (value.indexOf("video") >= 0) return "video";
    if (value.indexOf("document") >= 0 || value.indexOf("file") >= 0) return "document";
    return "";
  }

  function mediaUrl(item) {
    return item && (item.media_url || item.url || item.file_url || item.download_url);
  }

  function itemId(item, index) {
    return String(
      (item && (item.id || item.message_id || item.external_message_id)) ||
        [mediaType(item), mediaUrl(item), item && item.created_at, index].join("|")
    );
  }

  function itemTimestamp(item) {
    var raw = item && (item.created_at || item.timestamp || item.sent_at);
    var parsed = raw ? new Date(raw) : null;
    return parsed && !isNaN(parsed.getTime()) ? parsed : null;
  }

  function formatTime(item) {
    var date = itemTimestamp(item);
    if (!date) return "";
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function isOutbound(item) {
    return Boolean(
      item &&
        (item.from_me === true ||
          item.fromMe === true ||
          item.direction === "outbound" ||
          item.sender_type === "agent")
    );
  }

  function isVisible(element) {
    if (!element || !element.isConnected || !element.getClientRects().length) return false;
    var style = window.getComputedStyle(element);
    var rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }

  function composerInput() {
    var inputs = document.querySelectorAll(
      'textarea[placeholder*="mensagem" i], input[placeholder*="mensagem" i], [contenteditable="true"][data-placeholder*="mensagem" i]'
    );
    return (
      Array.prototype.find.call(inputs, function (input) {
        return isVisible(input);
      }) || null
    );
  }

  function findTimeline() {
    var input = composerInput();
    if (!input) return null;

    var node = input;
    for (var i = 0; i < 8 && node; i += 1) {
      var parent = node.parentElement;
      if (!parent) break;
      var previous = parent.previousElementSibling;
      if (previous) {
        var rect = previous.getBoundingClientRect();
        if (isVisible(previous) && rect.height > 180 && rect.width > 320) return previous;
      }
      node = parent;
    }

    var center = input.closest("main, section, article, div");
    while (center && center.parentElement) {
      var siblings = Array.prototype.slice.call(center.parentElement.children);
      var candidate = siblings.find(function (element) {
        if (element === center) return false;
        var rect = element.getBoundingClientRect();
        return isVisible(element) && rect.height > 250 && rect.width > 400;
      });
      if (candidate) return candidate;
      center = center.parentElement;
    }
    return null;
  }

  function removeLegacyPanels() {
    document.querySelectorAll("[data-iea-media-history]").forEach(function (element) {
      element.remove();
    });
  }

  function removeOrphanedMedia() {
    document
      .querySelectorAll(
        '[data-iea-inline-media-message], [data-iea-inline-media-fallback="true"], [data-iea-inline-media-history]'
      )
      .forEach(function (element) {
        element.remove();
      });
  }

  function timelineElement() {
    removeLegacyPanels();
    var timeline = findTimeline();
    if (!timeline) return null;
    timeline.querySelectorAll("[data-iea-inline-media-history]").forEach(function (element) {
      element.remove();
    });
    return timeline;
  }

  function mediaElement(item) {
    var type = mediaType(item);
    var url = mediaUrl(item);
    var element;

    if (type === "audio") {
      element = document.createElement("audio");
      element.controls = true;
      element.preload = "metadata";
      element.src = url;
      element.style.width = "280px";
      element.style.maxWidth = "100%";
      element.addEventListener("loadedmetadata", function () {
        element.setAttribute("aria-label", "Áudio de " + Math.round(element.duration || 0) + " segundos");
      });
      return element;
    }

    if (type === "image") {
      element = document.createElement("img");
      element.src = url;
      element.alt = "Imagem enviada na conversa";
      Object.assign(element.style, {
        display: "block",
        maxWidth: "280px",
        maxHeight: "300px",
        borderRadius: "8px",
        objectFit: "cover"
      });
      return element;
    }

    if (type === "video") {
      element = document.createElement("video");
      element.controls = true;
      element.preload = "metadata";
      element.src = url;
      Object.assign(element.style, {
        display: "block",
        width: "280px",
        maxWidth: "100%",
        maxHeight: "300px",
        borderRadius: "8px"
      });
      return element;
    }

    element = document.createElement("a");
    element.href = url;
    element.target = "_blank";
    element.rel = "noopener noreferrer";
    element.textContent = (item && (item.file_name || item.filename || item.caption)) || "Abrir arquivo";
    Object.assign(element.style, {
      color: "#0b5cab",
      fontWeight: "700",
      textDecoration: "none",
      overflowWrap: "anywhere"
    });
    return element;
  }

  function createBubble(item, index) {
    var outbound = isOutbound(item);
    var row = document.createElement("div");
    row.setAttribute("data-iea-inline-media-message", itemId(item, index));
    Object.assign(row.style, {
      display: "flex",
      justifyContent: outbound ? "flex-end" : "flex-start",
      width: "100%"
    });

    var bubble = document.createElement("div");
    Object.assign(bubble.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      maxWidth: "340px",
      padding: "9px 10px 7px",
      borderRadius: "11px",
      background: outbound ? "#d7ffd1" : "#ffffff",
      border: outbound ? "1px solid #c4efbe" : "1px solid #e5e7eb",
      boxShadow: "0 1px 2px rgba(15, 23, 42, .08)"
    });

    if (outbound && item && (item.sender_name || item.author_name)) {
      var author = document.createElement("strong");
      author.textContent = item.sender_name || item.author_name;
      Object.assign(author.style, {
        color: "#3987ff",
        fontSize: "12px"
      });
      bubble.appendChild(author);
    }

    bubble.appendChild(mediaElement(item));

    var metadata = document.createElement("div");
    metadata.textContent = formatTime(item);
    Object.assign(metadata.style, {
      alignSelf: "flex-end",
      minHeight: "12px",
      color: "#78909c",
      fontSize: "10px",
      lineHeight: "1"
    });
    bubble.appendChild(metadata);
    row.appendChild(bubble);
    return row;
  }

  function matchingEmptyBubble(timeline, item) {
    var time = formatTime(item);
    if (!time) return null;
    var outbound = isOutbound(item);
    var timelineRect = timeline.getBoundingClientRect();
    var candidates = Array.prototype.filter.call(timeline.querySelectorAll("*"), function (element) {
      return element.children.length === 0 && String(element.textContent || "").trim() === time;
    });

    for (var c = candidates.length - 1; c >= 0; c -= 1) {
      var timeElement = candidates[c];
      var node = timeElement.parentElement;
      for (var depth = 0; node && node !== timeline && depth < 5; depth += 1, node = node.parentElement) {
        var rect = node.getBoundingClientRect();
        var onExpectedSide = outbound
          ? rect.left > timelineRect.left + timelineRect.width * 0.48
          : rect.right < timelineRect.left + timelineRect.width * 0.58;
        var compactBubble = rect.width > 35 && rect.width < 480 && rect.height > 24 && rect.height < 190;
        if (onExpectedSide && compactBubble) {
          return { bubble: node, timeElement: timeElement };
        }
      }
    }
    return null;
  }

  function hydrateBubble(match, item, id) {
    var bubble = match.bubble;
    if (bubble.querySelector("[data-iea-inline-media-control]")) return true;
    var control = mediaElement(item);
    control.setAttribute("data-iea-inline-media-control", id);
    bubble.insertBefore(control, match.timeElement);
    bubble.setAttribute("data-iea-inline-media-message", id);
    Object.assign(bubble.style, {
      minWidth: "220px",
      maxWidth: "340px",
      height: "auto",
      overflow: "visible",
      gap: "6px"
    });
    return true;
  }

  function renderMedia() {
    if (!activeConversationId || !composerInput()) {
      return;
    }
    var timeline = timelineElement();
    if (!timeline || !isVisible(timeline)) {
      return;
    }
    var distanceFromBottom = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight;
    var keepAtBottom = distanceFromBottom < 120;
    var changed = false;
    var orderedItems = mediaItems.slice().sort(function (a, b) {
      var aDate = itemTimestamp(a);
      var bDate = itemTimestamp(b);
      return (aDate ? aDate.getTime() : 0) - (bDate ? bDate.getTime() : 0);
    });
    var desiredIds = new Set(
      orderedItems.map(function (item, index) {
        return itemId(item, index);
      })
    );

    renderingMedia = true;
    try {
      timeline.querySelectorAll("[data-iea-inline-media-message]").forEach(function (element) {
        var id = element.getAttribute("data-iea-inline-media-message");
        if (id && !desiredIds.has(id)) {
          element.remove();
          changed = true;
        }
      });

      orderedItems.forEach(function (item, index) {
        var id = itemId(item, index);
        var existing = timeline.querySelector(
          '[data-iea-inline-media-message="' + CSS.escape(id) + '"]'
        );
        if (existing && existing.querySelector("[data-iea-inline-media-control]")) return;

        var match = matchingEmptyBubble(timeline, item);
        if (match) {
          hydrateBubble(match, item, id);
          changed = true;
          return;
        }

        var row = createBubble(item, index);
        row.setAttribute("data-iea-inline-media-fallback", "true");
        row.querySelector("audio, img, video, a")?.setAttribute(
          "data-iea-inline-media-control",
          id
        );
        timeline.appendChild(row);
        changed = true;
      });
    } finally {
      renderingMedia = false;
    }

    if (changed && keepAtBottom && mediaItems.length) {
      requestAnimationFrame(function () {
        timeline.scrollTop = timeline.scrollHeight;
      });
    }
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderMedia, 60);
  }

  function ingestMessages(payload) {
    var list = Array.isArray(payload)
      ? payload
      : payload && (payload.messages || payload.items || payload.data);
    if (!Array.isArray(list)) return;

    var nextMediaItems = list.filter(function (item) {
      return Boolean(mediaType(item) && mediaUrl(item));
    });
    var nextSignature = JSON.stringify(
      nextMediaItems.map(function (item, index) {
        return [itemId(item, index), mediaUrl(item), itemTimestamp(item)?.getTime() || 0];
      })
    );
    if (nextSignature === mediaSignature) return;
    mediaSignature = nextSignature;
    mediaItems = nextMediaItems;
    scheduleRender();
  }

  function parseConversationId(url) {
    var match = String(url || "").match(/\/api\/crm\/conversations\/(\d+)\/messages(?:\?|$)/);
    return match ? Number(match[1]) : null;
  }

  window.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : input && input.url;
    var conversationId = parseConversationId(url);
    var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();

    if (conversationId && method === "GET") {
      if (activeConversationId && activeConversationId !== conversationId) {
        removeOrphanedMedia();
        mediaItems = [];
        mediaSignature = "";
      }
      activeConversationId = conversationId;
    }

    var response = await nativeFetch(input, init);

    if (conversationId && method === "GET") {
      response
        .clone()
        .json()
        .then(ingestMessages)
        .catch(function () {});
    }

    if (conversationId && init && String(init.method || "").toUpperCase() === "POST") {
      response
        .clone()
        .json()
        .then(function () {
          setTimeout(refreshActiveConversation, 400);
        })
        .catch(function () {});
    }
    return response;
  };

  async function refreshActiveConversation() {
    if (!activeConversationId || !composerInput()) {
      return;
    }
    try {
      var response = await nativeFetch(
        "/api/crm/conversations/" + activeConversationId + "/messages?media_refresh=" + Date.now(),
        { credentials: "same-origin", cache: "no-store" }
      );
      if (response.ok) ingestMessages(await response.json());
    } catch (_error) {}
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(function (mutations) {
      if (renderingMedia) return;
      if (!composerInput()) {
        return;
      }
      var needsRender = mutations.some(function (mutation) {
        return Array.prototype.some.call(mutation.removedNodes || [], function (node) {
          return (
            node.nodeType === 1 &&
            (node.matches?.("[data-iea-inline-media-message]") ||
              node.querySelector?.("[data-iea-inline-media-message]"))
          );
        });
      });
      if (needsRender) {
        scheduleRender();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    removeLegacyPanels();
    removeOrphanedMedia();
    startObserver();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshActiveConversation, 8000);
    document.addEventListener(
      "click",
      function () {
        setTimeout(function () {
          if (!composerInput()) {
            return;
          }
          scheduleRender();
        }, 0);
      },
      true
    );
    scheduleRender();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
