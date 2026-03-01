(function painSolverSdkBootstrap(window, document) {
  var state = {
    apiBaseUrl: "",
    boardToken: "",
    boardId: "",
    ssoToken: "",
    userId: null,
    identifyPayload: null,
    stylesInjected: false,
    onLoadCallback: null,
    changelogOpenCallbacks: [],
    changelogSelector: ""
  };

  function buildUrl(path) {
    return state.apiBaseUrl + path;
  }

  function isFunction(value) {
    return typeof value === "function";
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toQuery(params) {
    var search = new URLSearchParams();

    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === "") {
        return;
      }
      search.set(key, String(value));
    });

    var query = search.toString();
    return query ? "?" + query : "";
  }

  function ensureStyles() {
    if (state.stylesInjected) {
      return;
    }

    var style = document.createElement("style");
    style.id = "painsolver-widget-style";
    style.textContent = [
      ".ps-root { font-family: 'Space Grotesk', 'Helvetica Neue', sans-serif; color: #0f1720; }",
      ".ps-shell { border: 1px solid #d8dee5; border-radius: 18px; background: #fff; box-shadow: 0 10px 30px rgba(16, 24, 40, 0.06); overflow: hidden; }",
      ".ps-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #e7ebef; }",
      ".ps-head h3 { margin: 0; font-size: 17px; letter-spacing: -0.01em; }",
      ".ps-search { border: 1px solid #d6dde5; border-radius: 10px; padding: 8px 10px; min-width: 180px; font-size: 13px; }",
      ".ps-list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }",
      ".ps-card { padding: 14px 16px; border-top: 1px solid #edf1f5; background: #fff; }",
      ".ps-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }",
      ".ps-title { font-size: 16px; font-weight: 700; margin: 0; color: #111827; }",
      ".ps-status { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 8px; border-radius: 999px; background: #edf2f7; color: #334155; }",
      ".ps-description { color: #475467; margin: 0 0 10px; line-height: 1.45; font-size: 14px; }",
      ".ps-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
      ".ps-btn { border: 1px solid #111827; background: #111827; color: #fff; border-radius: 10px; padding: 7px 12px; cursor: pointer; font-weight: 600; font-size: 13px; }",
      ".ps-btn.ghost { border-color: #d3d9e1; background: #fff; color: #344054; }",
      ".ps-btn[disabled] { opacity: 0.5; cursor: not-allowed; }",
      ".ps-vote-meta { font-size: 12px; color: #667085; }",
      ".ps-badge { font-size: 11px; padding: 3px 8px; border-radius: 999px; background: #101828; color: #fff; }",
      ".ps-empty { border: 1px dashed #cfd8e3; border-radius: 12px; padding: 14px; color: #667085; background: #f8fafc; margin: 8px; }",
      ".ps-cl-list { display: grid; gap: 10px; padding: 12px 14px 14px; }",
      ".ps-cl-item { border: 1px solid #e5eaf0; border-radius: 12px; padding: 12px; background: #fff; }",
      ".ps-cl-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }",
      ".ps-tag { font-size: 11px; border: 1px solid #d0d7e2; border-radius: 999px; padding: 2px 7px; color: #475467; }",
      ".ps-time { font-size: 11px; color: #98a2b3; }",
      ".ps-cl-title { margin: 0 0 4px; font-size: 15px; color: #111827; }",
      ".ps-cl-body { margin: 0; font-size: 13px; line-height: 1.45; color: #475467; }",
      ".ps-cl-controls { display: flex; align-items: center; gap: 8px; }"
    ].join("\n");

    document.head.appendChild(style);
    state.stylesInjected = true;
  }

  function request(path, options) {
    return fetch(buildUrl(path), options).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (bodyText) {
          throw new Error(bodyText || "Request failed");
        });
      }

      return response.json();
    });
  }

  function applyConfig(payload) {
    var config = payload || {};
    state.apiBaseUrl = config.apiBaseUrl || state.apiBaseUrl || "";
    state.boardToken = config.boardToken || state.boardToken || "";
    state.boardId = config.boardId || state.boardId || "";
    state.ssoToken = config.ssoToken || state.ssoToken || "";
    state.onLoadCallback = isFunction(config.onLoadCallback) ? config.onLoadCallback : state.onLoadCallback;

    return {
      apiBaseUrl: state.apiBaseUrl,
      boardToken: state.boardToken,
      boardId: state.boardId,
      hasSsoToken: Boolean(state.ssoToken)
    };
  }

  function identify(payload) {
    state.identifyPayload = payload;

    return request("/api/v1/sdk/identify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }).then(function (result) {
      state.userId = result.userId;
      return result;
    });
  }

  function authenticate(payload) {
    var authPayload = payload || {};

    if (authPayload.ssoToken) {
      state.ssoToken = authPayload.ssoToken;
      return request("/api/v1/sdk/sso/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ssoToken: state.ssoToken })
      }).then(function (result) {
        state.userId = result.userId;
        return result;
      });
    }

    if (authPayload.user && authPayload.company && authPayload.hash) {
      return identify(authPayload);
    }

    return Promise.reject(new Error("authenticate requires either { ssoToken } or identify payload"));
  }

  function ensureSession() {
    if (state.userId) {
      return Promise.resolve({ userId: state.userId });
    }

    if (state.ssoToken) {
      return authenticate({ ssoToken: state.ssoToken });
    }

    return Promise.resolve({ userId: null });
  }

  function vote(postId) {
    return ensureSession().then(function () {
      return request("/api/v1/sdk/votes/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: state.userId,
          ssoToken: state.ssoToken || undefined,
          postId: postId
        })
      });
    });
  }

  function loadPosts() {
    return request(
      "/api/v1/sdk/posts" +
        toQuery({
          userId: state.userId || undefined,
          ssoToken: state.ssoToken || undefined,
          boardToken: state.boardToken || undefined,
          boardId: state.boardId || undefined
        }),
      {
        method: "GET"
      }
    );
  }

  function renderFeedback(payload) {
    var options = payload || {};
    var selector = options.selector;
    if (!selector) {
      throw new Error("render requires a selector, e.g. { selector: '#board' }");
    }

    var root = document.querySelector(selector);
    if (!root) {
      throw new Error("PainSolver render selector not found: " + selector);
    }

    ensureStyles();
    root.classList.add("ps-root");
    root.innerHTML = '<div class="ps-empty">Loading PainSolver feedback...</div>';

    return ensureSession()
      .then(function () {
        return loadPosts();
      })
      .then(function (result) {
        var posts = result.posts || [];
        var query = String(options.query || "").trim().toLowerCase();
        var visiblePosts = query
          ? posts.filter(function (post) {
              var hay = String(post.title || "") + " " + String(post.description || "");
              return hay.toLowerCase().indexOf(query) >= 0;
            })
          : posts;

        if (visiblePosts.length === 0) {
          root.innerHTML = '<div class="ps-empty">No feedback items found.</div>';
          return;
        }

        var html = visiblePosts
          .map(function (post) {
            var badge = post.capturedViaSupport
              ? '<span class="ps-badge">Captured via Support</span>'
              : "";

            var votes = (post.implicitVoteCount || 0) + (post.explicitVoteCount || 0);
            var mrr = Number(post.totalAttachedMrr || 0).toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0
            });

            var buttonLabel = !state.userId && !state.ssoToken
              ? "Authenticate"
              : post.userVoteType === "explicit"
                ? "Voted"
                : "Upvote";

            return (
              '<li class="ps-card">' +
              '<div class="ps-top">' +
              '<p class="ps-title">' +
              esc(post.title) +
              "</p>" +
              '<span class="ps-status">' +
              esc(post.status) +
              "</span>" +
              "</div>" +
              '<p class="ps-description">' +
              esc(post.description || "") +
              "</p>" +
              '<div class="ps-row">' +
              '<button data-post-id="' +
              esc(post.id) +
              '" class="ps-btn" ' +
              ((post.userVoteType === "explicit") ? "disabled" : "") +
              ">" +
              buttonLabel +
              "</button>" +
              '<span class="ps-vote-meta">Votes: ' +
              votes +
              "</span>" +
              '<span class="ps-vote-meta">MRR: ' +
              mrr +
              "</span>" +
              badge +
              "</div>" +
              "</li>"
            );
          })
          .join("");

        root.innerHTML =
          '<section class="ps-shell">' +
          '<div class="ps-head"><h3>Feedback</h3></div>' +
          '<ul class="ps-list">' +
          html +
          "</ul></section>";

        var buttons = root.querySelectorAll("button[data-post-id]");
        Array.prototype.forEach.call(buttons, function (button) {
          button.addEventListener("click", function () {
            var postId = button.getAttribute("data-post-id");
            if (!postId) {
              return;
            }

            button.disabled = true;
            vote(postId)
              .then(function () {
                return renderFeedback(payload);
              })
              .catch(function (error) {
                console.error("PainSolver vote failed", error);
                button.disabled = false;
              });
          });
        });

        if (isFunction(state.onLoadCallback)) {
          state.onLoadCallback({ type: "feedback", selector: selector, count: visiblePosts.length });
        }
      });
  }

  function extractTextFromHtml(value) {
    var html = String(value || "");
    var doc = document.createElement("div");
    doc.innerHTML = html;
    return (doc.textContent || "").trim();
  }

  function loadChangelog(payload) {
    var options = payload || {};
    return request(
      "/api/v1/sdk/changelog" +
        toQuery({
          q: options.query || "",
          limit: options.limit || 20,
          boardToken: state.boardToken || undefined,
          boardId: state.boardId || undefined,
          userId: state.userId || undefined,
          ssoToken: state.ssoToken || undefined
        }),
      {
        method: "GET"
      }
    );
  }

  function markChangelogSeen() {
    return request("/api/v1/sdk/changelog/seen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: state.userId || undefined,
        ssoToken: state.ssoToken || undefined,
        boardToken: state.boardToken || undefined,
        boardId: state.boardId || undefined,
        seenAt: new Date().toISOString()
      })
    });
  }

  function initChangelog(payload) {
    var options = payload || {};
    var selector = options.selector;
    if (!selector) {
      throw new Error("initChangelog requires a selector");
    }

    state.changelogSelector = selector;

    var root = document.querySelector(selector);
    if (!root) {
      throw new Error("PainSolver changelog selector not found: " + selector);
    }

    ensureStyles();
    root.classList.add("ps-root");
    root.innerHTML = '<div class="ps-empty">Loading changelog...</div>';

    return ensureSession()
      .then(function () {
        return loadChangelog(options);
      })
      .then(function (result) {
        var entries = result.entries || [];

        if (!entries.length) {
          root.innerHTML = '<div class="ps-empty">No changelog entries yet.</div>';
          return;
        }

        var html = entries
          .map(function (entry) {
            var tags = (entry.tags || [])
              .map(function (tag) {
                return '<span class="ps-tag">' + esc(tag) + "</span>";
              })
              .join("");
            var body = extractTextFromHtml(entry.content || "");
            var excerpt = body.length > 220 ? body.slice(0, 219).trim() + "…" : body;

            return (
              '<article class="ps-cl-item">' +
              '<div class="ps-cl-meta">' +
              tags +
              '<span class="ps-time">' +
              new Date(entry.releasedAt).toLocaleDateString() +
              "</span>" +
              "</div>" +
              '<h4 class="ps-cl-title">' +
              esc(entry.title) +
              "</h4>" +
              '<p class="ps-cl-body">' +
              esc(excerpt) +
              "</p>" +
              "</article>"
            );
          })
          .join("");

        root.innerHTML =
          '<section class="ps-shell">' +
          '<div class="ps-head">' +
          '<h3>Changelog</h3>' +
          '<div class="ps-cl-controls"><button class="ps-btn ghost" data-ps-close-changelog="true">Close</button></div>' +
          "</div>" +
          '<div class="ps-cl-list">' +
          html +
          "</div>" +
          "</section>";

        state.changelogOpenCallbacks.forEach(function (callback) {
          try {
            callback({ selector: selector, entries: entries });
          } catch (error) {
            console.error("PainSolver changelog callback failed", error);
          }
        });

        var closeBtn = root.querySelector("[data-ps-close-changelog='true']");
        if (closeBtn) {
          closeBtn.addEventListener("click", function () {
            root.style.display = "none";
          });
        }

        if (state.userId || state.ssoToken) {
          markChangelogSeen().catch(function (error) {
            console.error("PainSolver changelog seen update failed", error);
          });
        }

        if (isFunction(state.onLoadCallback)) {
          state.onLoadCallback({ type: "changelog", selector: selector, count: entries.length });
        }
      });
  }

  function hasUnseenEntries(payload) {
    var options = payload || {};
    return ensureSession().then(function () {
      return request(
        "/api/v1/sdk/changelog/unseen" +
          toQuery({
            userId: state.userId || undefined,
            ssoToken: state.ssoToken || undefined,
            boardToken: state.boardToken || undefined,
            boardId: state.boardId || undefined
          }),
        {
          method: "GET"
        }
      ).then(function (result) {
        if (isFunction(options.callback)) {
          options.callback(result.hasUnseenEntries, result);
        }

        return result;
      });
    });
  }

  function closeChangelog(payload) {
    var options = payload || {};
    var selector = options.selector || state.changelogSelector;
    if (!selector) {
      return Promise.resolve({ ok: true });
    }

    var root = document.querySelector(selector);
    if (!root) {
      return Promise.resolve({ ok: true });
    }

    root.style.display = "none";
    return Promise.resolve({ ok: true });
  }

  function registerOnChangelogOpenCallback(payload) {
    var callback = isFunction(payload) ? payload : payload && payload.callback;
    if (!isFunction(callback)) {
      return Promise.reject(new Error("registerOnChangelogOpenCallback requires a function"));
    }

    state.changelogOpenCallbacks.push(callback);
    return Promise.resolve({ ok: true });
  }

  function painSolver(command, payload) {
    if (command === "init" || command === "config") {
      return Promise.resolve(applyConfig(payload));
    }

    if (command === "identify") {
      return identify(payload);
    }

    if (command === "authenticate") {
      return authenticate(payload);
    }

    if (command === "render") {
      return renderFeedback(payload);
    }

    if (command === "initChangelog") {
      return initChangelog(payload);
    }

    if (command === "hasUnseenEntries") {
      return hasUnseenEntries(payload);
    }

    if (command === "closeChangelog") {
      return closeChangelog(payload);
    }

    if (command === "registerOnChangelogOpenCallback") {
      return registerOnChangelogOpenCallback(payload);
    }

    return Promise.reject(new Error("Unsupported PainSolver command: " + command));
  }

  window.PainSolver = painSolver;
})(window, document);
