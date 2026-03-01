(function painSolverAdmin(window, document) {
  var state = {
    adminKey: window.localStorage.getItem("painsolver.adminKey") || "",
    boards: [],
    posts: []
  };

  var el = {
    stats: document.getElementById("stats-grid"),
    postsTable: document.getElementById("posts-table"),
    triageList: document.getElementById("triage-list"),
    activityList: document.getElementById("activity-list"),
    boardSelect: document.getElementById("board-select"),
    categorySelect: document.getElementById("category-select"),
    createForm: document.getElementById("create-post-form"),
    saveAdminKey: document.getElementById("save-admin-key"),
    adminKeyInput: document.getElementById("admin-key"),
    refreshPosts: document.getElementById("refresh-posts"),
    refreshTriage: document.getElementById("refresh-triage")
  };

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function request(path, options) {
    var headers = {
      "Content-Type": "application/json"
    };

    if (state.adminKey) {
      headers["x-admin-key"] = state.adminKey;
    }

    return fetch(path, {
      method: (options && options.method) || "GET",
      headers: headers,
      body: options && options.body ? JSON.stringify(options.body) : undefined
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (body) {
          throw new Error(body || "Request failed");
        });
      }

      return response.json();
    });
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  function renderStats(metrics) {
    var cards = [
      ["Posts", metrics.postCount],
      ["Boards", metrics.boardCount],
      ["Companies", metrics.companyCount],
      ["Users", metrics.userCount],
      ["Triage", metrics.triageCount],
      ["Total MRR", formatCurrency(metrics.totalAttachedMrr)]
    ];

    el.stats.innerHTML = cards
      .map(function (card) {
        return (
          '<div class="metric">' +
          "<label>" +
          esc(card[0]) +
          "</label>" +
          "<strong>" +
          esc(card[1]) +
          "</strong>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderPosts(posts) {
    state.posts = posts;
    el.postsTable.innerHTML = posts
      .map(function (post) {
        var votes = (post.implicitVoteCount || 0) + (post.explicitVoteCount || 0);

        return (
          "<tr>" +
          "<td>" +
          "<strong>" +
          esc(post.title) +
          "</strong><br><span class=\"muted\">" +
          esc(post.category.name) +
          " • " +
          esc(post.board.name) +
          "</span></td>" +
          "<td>" +
          esc(post.status) +
          "</td>" +
          "<td>" +
          esc(votes) +
          "</td>" +
          "<td>" +
          esc(formatCurrency(post.totalAttachedMrr)) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (!posts.length) {
      el.postsTable.innerHTML = '<tr><td colspan="4" class="muted">No posts found.</td></tr>';
    }
  }

  function renderBoards(boards) {
    state.boards = boards;

    el.boardSelect.innerHTML = boards
      .map(function (board) {
        return '<option value="' + esc(board.id) + '">' + esc(board.name) + "</option>";
      })
      .join("");

    if (!boards.length) {
      el.boardSelect.innerHTML = '<option value="">Create a board first</option>';
      el.categorySelect.innerHTML = '<option value="">No categories</option>';
      return;
    }

    syncCategoryOptions();
  }

  function syncCategoryOptions() {
    var selectedBoardId = el.boardSelect.value;
    var board = state.boards.find(function (item) {
      return item.id === selectedBoardId;
    });

    var options = ['<option value="">Auto choose</option>'];

    if (board && board.categories) {
      board.categories.forEach(function (category) {
        options.push('<option value="' + esc(category.id) + '">' + esc(category.name) + "</option>");
      });
    }

    el.categorySelect.innerHTML = options.join("");
  }

  function renderTriage(painEvents) {
    if (!painEvents.length) {
      el.triageList.innerHTML = '<p class="muted">No events waiting for triage.</p>';
      return;
    }

    var template = document.getElementById("triage-item-template");
    el.triageList.innerHTML = "";

    painEvents.forEach(function (painEvent) {
      var node = template.content.firstElementChild.cloneNode(true);
      var meta = node.querySelector(".triage-meta");
      var text = node.querySelector(".triage-text");
      var picker = node.querySelector(".triage-post-picker");
      var mergeButton = node.querySelector(".triage-merge");

      meta.textContent = painEvent.user.email + " • " + formatCurrency(painEvent.user.company.monthlySpend);
      text.textContent = painEvent.rawText;

      picker.innerHTML = state.posts
        .map(function (post) {
          return '<option value="' + esc(post.id) + '">' + esc(post.title) + "</option>";
        })
        .join("");

      mergeButton.addEventListener("click", function () {
        mergeButton.disabled = true;
        request("/api/dashboard/pain-events/" + encodeURIComponent(painEvent.id) + "/merge", {
          method: "POST",
          body: {
            postId: picker.value
          }
        })
          .then(function () {
            return Promise.all([loadSummary(), loadPosts(), loadTriage()]);
          })
          .catch(function (error) {
            alert(error.message || "Failed to merge event");
            mergeButton.disabled = false;
          });
      });

      el.triageList.appendChild(node);
    });
  }

  function renderActivity(data) {
    var items = [];

    data.logs.forEach(function (log) {
      var ts = new Date(log.createdAt).getTime();
      items.push({
        label: "AI " + log.actionTaken,
        text: (log.painEvent.rawText || "").slice(0, 120),
        at: new Date(log.createdAt).toLocaleString(),
        ts: ts
      });
    });

    data.comments.forEach(function (comment) {
      var ts = new Date(comment.createdAt).getTime();
      items.push({
        label: "Comment",
        text: comment.author.name + " on " + comment.post.title,
        at: new Date(comment.createdAt).toLocaleString(),
        ts: ts
      });
    });

    data.changelog.forEach(function (entry) {
      var ts = new Date(entry.createdAt).getTime();
      items.push({
        label: "Changelog",
        text: entry.title + " (" + entry.post.title + ")",
        at: new Date(entry.createdAt).toLocaleString(),
        ts: ts
      });
    });

    items.sort(function (a, b) {
      return b.ts - a.ts;
    });

    el.activityList.innerHTML = items
      .slice(0, 12)
      .map(function (item) {
        return (
          '<article class="activity-item">' +
          "<strong>" +
          esc(item.label) +
          "</strong>" +
          "<div>" +
          esc(item.text) +
          "</div>" +
          '<div class="muted">' +
          esc(item.at) +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    if (!items.length) {
      el.activityList.innerHTML = '<p class="muted">No recent activity yet.</p>';
    }
  }

  function loadSummary() {
    return request("/api/dashboard/summary").then(function (result) {
      renderStats(result.metrics);
      if (result.topPosts) {
        renderPosts(result.topPosts);
      }
    });
  }

  function loadBoards() {
    return request("/api/dashboard/boards").then(function (result) {
      renderBoards(result.boards || []);
    });
  }

  function loadPosts() {
    return request("/api/dashboard/posts").then(function (result) {
      renderPosts(result.posts || []);
    });
  }

  function loadTriage() {
    return request("/api/dashboard/pain-events?status=needs_triage").then(function (result) {
      renderTriage(result.painEvents || []);
    });
  }

  function loadActivity() {
    return request("/api/dashboard/activity").then(function (result) {
      renderActivity(result);
    });
  }

  function bindEvents() {
    el.adminKeyInput.value = state.adminKey;

    el.saveAdminKey.addEventListener("click", function () {
      state.adminKey = el.adminKeyInput.value.trim();
      window.localStorage.setItem("painsolver.adminKey", state.adminKey);
      bootstrap();
    });

    el.boardSelect.addEventListener("change", syncCategoryOptions);

    el.createForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var payload = {
        boardId: el.boardSelect.value,
        categoryId: el.categorySelect.value || undefined,
        title: document.getElementById("post-title").value.trim(),
        description: document.getElementById("post-description").value.trim() || undefined
      };

      request("/api/dashboard/posts", {
        method: "POST",
        body: payload
      })
        .then(function () {
          el.createForm.reset();
          syncCategoryOptions();
          return Promise.all([loadSummary(), loadPosts()]);
        })
        .catch(function (error) {
          alert(error.message || "Failed to create post");
        });
    });

    el.refreshPosts.addEventListener("click", function () {
      Promise.all([loadSummary(), loadPosts()]).catch(function (error) {
        alert(error.message || "Failed to refresh posts");
      });
    });

    el.refreshTriage.addEventListener("click", function () {
      loadTriage().catch(function (error) {
        alert(error.message || "Failed to refresh triage");
      });
    });
  }

  function bootstrap() {
    Promise.all([loadSummary(), loadBoards(), loadPosts(), loadTriage(), loadActivity()]).catch(function (error) {
      console.error("Admin bootstrap failed", error);
      el.triageList.innerHTML = '<p class="muted">' + esc(error.message || "Failed to load data") + "</p>";
    });
  }

  bindEvents();
  bootstrap();
})(window, document);
