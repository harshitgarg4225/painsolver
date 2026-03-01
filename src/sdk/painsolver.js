(function painSolverSdkBootstrap(window, document) {
  var state = {
    apiBaseUrl: "",
    userId: null,
    identifyPayload: null,
    stylesInjected: false
  };

  function buildUrl(path) {
    return state.apiBaseUrl + path;
  }

  function ensureStyles() {
    if (state.stylesInjected) {
      return;
    }

    var style = document.createElement("style");
    style.id = "painsolver-widget-style";
    style.textContent = [
      ".ps-root { font-family: 'Space Grotesk', 'Helvetica Neue', sans-serif; color: #0b130c; }",
      ".ps-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }",
      ".ps-card { border: 1px solid #d7e0d7; border-radius: 14px; background: linear-gradient(180deg, #ffffff, #f7faf6); padding: 14px; box-shadow: 0 10px 24px rgba(21, 31, 23, 0.08); }",
      ".ps-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 7px; }",
      ".ps-title { font-size: 17px; font-weight: 700; margin: 0; color: #1f2f22; }",
      ".ps-status { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 7px; border-radius: 999px; background: #e6ece5; color: #324535; }",
      ".ps-description { color: #425545; margin: 0 0 10px; line-height: 1.42; font-size: 14px; }",
      ".ps-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
      ".ps-btn { border: 1px solid #567257; background: linear-gradient(135deg, #3f5942, #5f7a60); color: #fff; border-radius: 10px; padding: 7px 12px; cursor: pointer; font-weight: 600; }",
      ".ps-btn[disabled] { opacity: 0.55; cursor: not-allowed; }",
      ".ps-vote-meta { font-size: 12px; color: #4e6451; }",
      ".ps-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #111; color: #fff; }",
      ".ps-empty { border: 1px dashed #97ac98; border-radius: 12px; padding: 14px; color: #4a614d; background: #f8fbf7; }"
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

  function vote(postId) {
    if (!state.userId) {
      throw new Error("Call PainSolver('identify', ...) before voting.");
    }

    return request("/api/v1/votes/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: state.userId,
        postId: postId
      })
    });
  }

  function renderBoard(payload) {
    var selector = payload && payload.selector;
    if (!selector) {
      throw new Error("render requires a selector, e.g. { selector: '#board' }");
    }

    var root = document.querySelector(selector);
    if (!root) {
      throw new Error("PainSolver render selector not found: " + selector);
    }

    ensureStyles();
    root.classList.add("ps-root");
    root.innerHTML = '<div class="ps-empty">Loading PainSolver board...</div>';

    var query = state.userId ? "?userId=" + encodeURIComponent(state.userId) : "";

    return request("/api/v1/sdk/posts" + query, {
      method: "GET"
    }).then(function (result) {
      var posts = result.posts || [];

      if (posts.length === 0) {
        root.innerHTML = '<div class="ps-empty">No roadmap items yet.</div>';
        return;
      }

      var html = posts
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

          var buttonLabel = !state.userId
            ? "Identify to vote"
            : post.userVoteType === "explicit"
              ? "Voted"
              : "Upvote";

          return (
            '<li class="ps-card">' +
            '<div class="ps-top">' +
            '<p class="ps-title">' +
            post.title +
            "</p>" +
            '<span class="ps-status">' +
            post.status +
            "</span>" +
            "</div>" +
            '<p class="ps-description">' +
            (post.description || "") +
            "</p>" +
            '<div class="ps-row">' +
            '<button data-post-id="' +
            post.id +
            '" class="ps-btn" ' +
            (!state.userId || post.userVoteType === "explicit" ? "disabled" : "") +
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

      root.innerHTML = '<ul class="ps-list">' + html + "</ul>";

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
              return renderBoard(payload);
            })
            .catch(function (error) {
              console.error("PainSolver vote failed", error);
              button.disabled = false;
            });
        });
      });
    });
  }

  function painSolver(command, payload) {
    if (command === "config") {
      state.apiBaseUrl = (payload && payload.apiBaseUrl) || "";
      return Promise.resolve({ ok: true });
    }

    if (command === "identify") {
      return identify(payload);
    }

    if (command === "render") {
      return renderBoard(payload);
    }

    return Promise.reject(new Error("Unsupported PainSolver command: " + command));
  }

  window.PainSolver = painSolver;
})(window, document);
