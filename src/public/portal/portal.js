(function portalApp(window, document) {
  var DEFAULT_EMAIL = "customer@example.com";
  var DEFAULT_NAME = "Customer User";
  var DEFAULT_APP_USER_ID = "portal-user";
  var DEFAULT_SEGMENTS = ["beta", "agency"];

  var state = {
    activeTab: "feedback",
    boardId: "",
    sort: "trending",
    filter: "all",
    query: "",
    changelogQuery: "",
    isLoggedIn: window.localStorage.getItem("painsolver.portal.loggedIn") === "true",
    email: window.localStorage.getItem("painsolver.portal.email") || DEFAULT_EMAIL,
    userName: window.localStorage.getItem("painsolver.portal.name") || DEFAULT_NAME,
    appUserId: window.localStorage.getItem("painsolver.portal.appUserId") || DEFAULT_APP_USER_ID,
    segments: (function () {
      try {
        var raw = window.localStorage.getItem("painsolver.portal.segments");
        var parsed = raw ? JSON.parse(raw) : DEFAULT_SEGMENTS;
        return Array.isArray(parsed) ? parsed : DEFAULT_SEGMENTS;
      } catch (_err) {
        return DEFAULT_SEGMENTS;
      }
    })(),
    expandedPostId: "",
    replyTargets: {},
    feedbackError: "",
    roadmapError: "",
    notificationError: "",
    changelogError: "",
    notifications: [],
    unreadCount: 0,
    notificationPreferences: {
      productUpdates: true,
      commentReplies: true,
      mentions: true,
      weeklyDigest: true
    },
    boards: [],
    feedback: [],
    roadmap: {
      planned: [],
      in_progress: [],
      complete: []
    },
    changelogEntries: [],
    loading: {
      boards: false,
      feedback: false,
      roadmap: false,
      changelog: false,
      notifications: false
    }
  };

  var el = {
    tabs: document.getElementById("tabs"),
    pages: {
      feedback: document.getElementById("feedback-page"),
      roadmap: document.getElementById("roadmap-page"),
      changelog: document.getElementById("changelog-page"),
      notifications: document.getElementById("notifications-page")
    },
    loginBtn: document.getElementById("login-btn"),
    notifyCountPill: document.getElementById("notify-count-pill"),
    accessTitle: document.getElementById("access-title"),
    accessCopy: document.getElementById("access-copy"),
    sessionMeta: document.getElementById("session-meta"),
    requestAccessBtn: document.getElementById("request-access-btn"),
    boardList: document.getElementById("board-list"),
    composerBoardName: document.getElementById("composer-board-name"),
    newTitle: document.getElementById("new-title"),
    newDetails: document.getElementById("new-details"),
    createPost: document.getElementById("create-post"),
    clearNewPost: document.getElementById("clear-new-post"),
    sortFilterBtn: document.getElementById("sort-filter-btn"),
    sortFilterMenu: document.getElementById("sort-filter-menu"),
    statusFilterChips: document.getElementById("status-filter-chips"),
    searchInput: document.getElementById("search-input"),
    feedbackList: document.getElementById("feedback-list"),
    roadmapPlanned: document.getElementById("roadmap-planned"),
    roadmapProgress: document.getElementById("roadmap-progress"),
    roadmapComplete: document.getElementById("roadmap-complete"),
    changelogSearch: document.getElementById("changelog-search"),
    changelogList: document.getElementById("changelog-list"),
    prefProductUpdates: document.getElementById("pref-product-updates"),
    prefCommentReplies: document.getElementById("pref-comment-replies"),
    prefMentions: document.getElementById("pref-mentions"),
    prefWeeklyDigest: document.getElementById("pref-weekly-digest"),
    saveNotificationPrefs: document.getElementById("save-notification-prefs"),
    markAllRead: document.getElementById("mark-all-read"),
    notificationList: document.getElementById("notification-list")
  };

  var loadingCounts = {};
  var toastHost = null;

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeHtml(raw) {
    var value = String(raw || "");
    value = value.replace(/<script[\s\S]*?<\/script>/gi, "");
    value = value.replace(/\son[a-z]+="[^"]*"/gi, "");
    value = value.replace(/\son[a-z]+='[^']*'/gi, "");
    value = value.replace(/javascript:/gi, "");
    return value;
  }

  function parseJsonOrNull(value) {
    try {
      return JSON.parse(value);
    } catch (_err) {
      return null;
    }
  }

  function normalizeEmail(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function parseSegments(value) {
    if (typeof value !== "string") {
      return [];
    }

    var unique = {};
    return value
      .split(",")
      .map(function (item) {
        return item.trim().toLowerCase();
      })
      .filter(function (item) {
        if (!item || unique[item]) {
          return false;
        }

        unique[item] = true;
        return true;
      });
  }

  function ensureToastHost() {
    if (toastHost) {
      return toastHost;
    }

    toastHost = document.createElement("div");
    toastHost.className = "toast-stack";
    document.body.appendChild(toastHost);
    return toastHost;
  }

  function pushToast(level, message) {
    if (!message) {
      return;
    }

    var host = ensureToastHost();
    var toast = document.createElement("div");
    toast.className = "toast toast-" + (level || "info");
    toast.textContent = String(message);
    host.appendChild(toast);

    window.requestAnimationFrame(function () {
      toast.classList.add("is-visible");
    });

    window.setTimeout(function () {
      toast.classList.remove("is-visible");
      window.setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 220);
    }, 3000);
  }

  function renderStateCard(kind, title, description) {
    var desc = description
      ? "<p>" + esc(description) + "</p>"
      : "";
    var detail = "";

    if (kind === "loading") {
      detail =
        '<div class="state-skeleton">' +
        '<span class="skeleton-line"></span>' +
        '<span class="skeleton-line"></span>' +
        '<span class="skeleton-line"></span>' +
        "</div>";
    }

    return (
      '<article class="state-card is-' +
      esc(kind || "empty") +
      '">' +
      "<h4>" +
      esc(title) +
      "</h4>" +
      desc +
      detail +
      "</article>"
    );
  }

  function setLoading(key, isActive) {
    if (!key) {
      return;
    }

    var next = loadingCounts[key] || 0;
    if (isActive) {
      next += 1;
    } else {
      next = Math.max(0, next - 1);
    }

    loadingCounts[key] = next;
    state.loading[key] = next > 0;
  }

  function setButtonBusy(button, isBusy, busyLabel) {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    if (isBusy) {
      button.dataset.originalLabel = button.textContent || "";
      button.dataset.wasDisabled = button.disabled ? "true" : "false";
      button.classList.add("is-busy");
      if (busyLabel) {
        button.textContent = busyLabel;
      }
      button.disabled = true;
      return;
    }

    button.classList.remove("is-busy");
    if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }

    var wasDisabled = button.dataset.wasDisabled === "true";
    delete button.dataset.wasDisabled;
    button.disabled = wasDisabled;
  }

  function shortText(value, max) {
    var text = String(value || "").trim();
    if (text.length <= max) {
      return text;
    }
    return text.slice(0, Math.max(0, max - 1)).trim() + "...";
  }

  function statusLabel(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .trim();
  }

  function boardVisibilityLabel(value) {
    if (value === "custom") {
      return "Custom";
    }

    if (value === "private") {
      return "Private";
    }

    return "Public";
  }

  function boardAccessLabel(value) {
    if (value === "request") {
      return "Request";
    }

    if (value === "locked") {
      return "Locked";
    }

    return "Open";
  }

  function notificationTypeLabel(value) {
    if (value === "status_change") {
      return "Status update";
    }

    if (value === "comment_reply") {
      return "Comment reply";
    }

    if (value === "mention") {
      return "Mention";
    }

    if (value === "access_approved") {
      return "Access approved";
    }

    return "Announcement";
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  function formatDateTime(value) {
    if (!value) {
      return "";
    }

    var dt = new Date(value);
    if (Number.isNaN(dt.getTime())) {
      return "";
    }

    return dt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function defaultSessionState() {
    if (!state.isLoggedIn) {
      return;
    }

    if (!state.email) {
      state.email = DEFAULT_EMAIL;
    }

    if (!state.userName) {
      state.userName = DEFAULT_NAME;
    }

    if (!state.appUserId) {
      state.appUserId = DEFAULT_APP_USER_ID;
    }

    if (!Array.isArray(state.segments)) {
      state.segments = DEFAULT_SEGMENTS.slice();
    }
  }

  function persistSession() {
    window.localStorage.setItem("painsolver.portal.loggedIn", String(state.isLoggedIn));
    window.localStorage.setItem("painsolver.portal.email", state.email || "");
    window.localStorage.setItem("painsolver.portal.name", state.userName || "");
    window.localStorage.setItem("painsolver.portal.appUserId", state.appUserId || "");
    window.localStorage.setItem("painsolver.portal.segments", JSON.stringify(state.segments || []));
  }

  function getSelectedBoard() {
    return (
      state.boards.find(function (board) {
        return board.id === state.boardId;
      }) || null
    );
  }

  function getBoardById(boardId) {
    return (
      state.boards.find(function (board) {
        return board.id === boardId;
      }) || null
    );
  }

  function getSelectedBoardAccess() {
    var board = getSelectedBoard();
    if (!board) {
      return {
        canRead: false,
        canPost: false,
        canRequest: false,
        access: "locked"
      };
    }

    return {
      canRead: board.access === "granted",
      canPost: Boolean(board.canPost),
      canRequest: board.access === "request",
      access: board.access
    };
  }

  function setBoardAccess(boardId, access) {
    if (!boardId || !access) {
      return;
    }

    state.boards = state.boards.map(function (board) {
      if (board.id !== boardId) {
        return board;
      }

      return {
        id: board.id,
        name: board.name,
        visibility: board.visibility,
        allowedSegments: board.allowedSegments || [],
        access: access.access || board.access,
        canPost: typeof access.canPost === "boolean" ? access.canPost : board.canPost,
        postCount: board.postCount
      };
    });
  }

  function ensureBoardSelection() {
    if (!state.boards.length) {
      state.boardId = "";
      return;
    }

    var hasCurrent = state.boards.some(function (board) {
      return board.id === state.boardId;
    });

    if (hasCurrent) {
      return;
    }

    var preferred = state.boards.find(function (board) {
      return board.access === "granted";
    });

    state.boardId = preferred ? preferred.id : state.boards[0].id;
  }

  function renderNotificationPill() {
    if (!el.notifyCountPill) {
      return;
    }

    if (!state.unreadCount || !state.isLoggedIn) {
      el.notifyCountPill.classList.add("hidden");
      el.notifyCountPill.textContent = "0";
      return;
    }

    el.notifyCountPill.classList.remove("hidden");
    el.notifyCountPill.textContent = String(state.unreadCount);
  }

  function renderNotificationPreferences() {
    var disabled = !state.isLoggedIn;
    el.prefProductUpdates.checked = !!state.notificationPreferences.productUpdates;
    el.prefCommentReplies.checked = !!state.notificationPreferences.commentReplies;
    el.prefMentions.checked = !!state.notificationPreferences.mentions;
    el.prefWeeklyDigest.checked = !!state.notificationPreferences.weeklyDigest;

    el.prefProductUpdates.disabled = disabled;
    el.prefCommentReplies.disabled = disabled;
    el.prefMentions.disabled = disabled;
    el.prefWeeklyDigest.disabled = disabled;
    el.saveNotificationPrefs.disabled = disabled;
    el.markAllRead.disabled = disabled || state.unreadCount === 0;
  }

  function headers() {
    return {
      "Content-Type": "application/json",
      "x-painsolver-role": state.isLoggedIn ? "customer" : "anonymous",
      "x-painsolver-auth": state.isLoggedIn ? "true" : "false",
      "x-painsolver-user-id": state.isLoggedIn ? state.appUserId : "",
      "x-painsolver-app-user-id": state.isLoggedIn ? state.appUserId : "",
      "x-painsolver-email": state.isLoggedIn ? state.email : "",
      "x-painsolver-name": state.isLoggedIn ? state.userName : "",
      "x-painsolver-segments": state.isLoggedIn ? (state.segments || []).join(",") : ""
    };
  }

  function request(path, options) {
    return fetch(path, {
      method: (options && options.method) || "GET",
      headers: headers(),
      body: options && options.body ? JSON.stringify(options.body) : undefined
    }).then(function (response) {
      return response.text().then(function (rawText) {
        var payload = rawText ? parseJsonOrNull(rawText) : {};
        var data = payload && typeof payload === "object" ? payload : {};

        if (!response.ok) {
          var fallback = rawText || "Request failed";
          var message = data.error || fallback;
          var error = new Error(message);
          error.status = response.status;
          error.payload = data;
          throw error;
        }

        return data;
      });
    });
  }

  function accessHint(access) {
    if (!state.isLoggedIn) {
      return "Log in to request access.";
    }

    if (access && access.canRequest) {
      return "Access is restricted for this board. Use Request Access.";
    }

    return "You do not have permission to view this board.";
  }

  function updateAccessUi() {
    var board = getSelectedBoard();
    var access = getSelectedBoardAccess();
    var boardName = board ? board.name : "Feedback";
    var canPost = state.isLoggedIn && access.canPost;

    el.loginBtn.textContent = state.isLoggedIn ? "Log out" : "Log in";
    el.composerBoardName.textContent = boardName;

    if (!state.isLoggedIn) {
      if (access.canRead) {
        el.accessTitle.textContent = "Read-only access";
        el.accessCopy.textContent = "Login to upvote, comment, and create feedback posts.";
      } else {
        el.accessTitle.textContent = "Restricted board";
        el.accessCopy.textContent = "This board needs account access. Log in to request entry.";
      }
    } else if (access.canPost) {
      el.accessTitle.textContent = "Write access enabled";
      el.accessCopy.textContent = "You can upvote, create feedback, and comment on " + boardName + ".";
    } else if (access.canRequest) {
      el.accessTitle.textContent = "Board access required";
      el.accessCopy.textContent = "You are signed in. Request access to unlock posting and comments.";
    } else {
      el.accessTitle.textContent = "Board locked";
      el.accessCopy.textContent = "This board is currently unavailable for your account.";
    }

    if (!state.isLoggedIn) {
      el.sessionMeta.textContent = "No SSO session";
    } else {
      var segmentText = (state.segments || []).length ? (state.segments || []).join(", ") : "none";
      el.sessionMeta.textContent = "Signed in as " + state.userName + " (" + state.email + ") - Segments: " + segmentText;
    }

    el.newTitle.disabled = !canPost;
    el.newDetails.disabled = !canPost;
    el.createPost.disabled = !canPost;

    if (!state.isLoggedIn) {
      el.requestAccessBtn.textContent = "Log in to Request";
      el.requestAccessBtn.disabled = true;
    } else if (access.canRequest) {
      el.requestAccessBtn.textContent = "Request Access";
      el.requestAccessBtn.disabled = false;
    } else if (access.canPost) {
      el.requestAccessBtn.textContent = "Access Granted";
      el.requestAccessBtn.disabled = true;
    } else {
      el.requestAccessBtn.textContent = "Locked";
      el.requestAccessBtn.disabled = true;
    }

    renderNotificationPill();
    renderNotificationPreferences();
  }

  function refreshSortFilterLabel() {
    var labels = {
      trending: "Trending",
      top: "Top",
      new: "New"
    };

    var filterLabels = {
      all: "All",
      under_review: "Under Review",
      upcoming: "Upcoming",
      planned: "Planned",
      in_progress: "In Progress",
      complete: "Complete"
    };

    el.sortFilterBtn.textContent = "Showing " + labels[state.sort] + " - " + filterLabels[state.filter];
  }

  function renderFilterChips() {
    if (!el.statusFilterChips) {
      return;
    }

    Array.prototype.forEach.call(el.statusFilterChips.querySelectorAll(".chip"), function (button) {
      var filter = button.getAttribute("data-filter-chip");
      button.classList.toggle("is-active", filter === state.filter);
    });
  }

  function renderTabs() {
    Array.prototype.forEach.call(el.tabs.querySelectorAll(".tab"), function (button) {
      var tab = button.getAttribute("data-tab");
      button.classList.toggle("is-active", tab === state.activeTab);
    });

    Object.keys(el.pages).forEach(function (key) {
      el.pages[key].classList.toggle("is-active", state.activeTab === key);
    });
  }

  function renderBoards() {
    if (state.loading.boards) {
      el.boardList.innerHTML = renderStateCard("loading", "Loading boards", "Syncing workspace boards and access.");
      return;
    }

    if (!state.boards.length) {
      el.boardList.innerHTML = renderStateCard("empty", "No boards available", "Create a board to start collecting feedback.");
      return;
    }

    el.boardList.innerHTML = state.boards
      .map(function (board) {
        var isActive = board.id === state.boardId;
        var isLocked = board.access !== "granted";
        var allowedSegments = Array.isArray(board.allowedSegments) && board.allowedSegments.length
          ? board.allowedSegments.join(", ")
          : "";
        var segmentHint = allowedSegments ? '<span class="board-sub">Segments: ' + esc(allowedSegments) + "</span>" : "";

        return (
          '<button class="board-item ' +
          (isActive ? "is-active " : "") +
          (isLocked ? "is-locked" : "") +
          '" data-board-id="' +
          esc(board.id) +
          '" type="button">' +
          '<div class="board-main">' +
          '<span class="board-name">' +
          esc(board.name) +
          "</span>" +
          '<span class="board-meta">' +
          '<span class="board-badge board-visibility-' +
          esc(board.visibility) +
          '">' +
          esc(boardVisibilityLabel(board.visibility)) +
          "</span>" +
          '<span class="board-badge board-access-' +
          esc(board.access) +
          '">' +
          esc(boardAccessLabel(board.access)) +
          "</span>" +
          "</span>" +
          segmentHint +
          "</div>" +
          '<span class="pill board-post-count">' +
          esc(board.postCount) +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderFeedback() {
    var access = getSelectedBoardAccess();
    if (state.loading.feedback) {
      el.feedbackList.innerHTML = [
        renderStateCard("loading", "Loading feedback", "Fetching posts, votes, and comments."),
        renderStateCard("loading", "Loading feedback", ""),
        renderStateCard("loading", "Loading feedback", "")
      ].join("");
      return;
    }

    if (state.feedbackError) {
      var hint = accessHint(access);
      el.feedbackList.innerHTML = renderStateCard("error", state.feedbackError, hint);
      return;
    }

    if (!state.feedback.length) {
      el.feedbackList.innerHTML = renderStateCard("empty", "No posts found", "Try adjusting filters, search, or board access.");
      return;
    }

    el.feedbackList.innerHTML = state.feedback
      .map(function (post) {
        var isExpanded = state.expandedPostId === post.id;
        var comments = Array.isArray(post.comments) ? post.comments : [];
        var replyTarget = state.replyTargets[post.id] || null;
        var postTags = Array.isArray(post.tags) ? post.tags : [];
        var commentsHtml = comments.length
          ? comments
              .map(function (comment) {
                var replyToHtml = comment.replyToAuthorName
                  ? '<p class="thread-reply-to">Replying to ' + esc(comment.replyToAuthorName) + "</p>"
                  : "";

                return (
                  '<article class="thread-comment">' +
                  '<div class="thread-head">' +
                  "<strong>" +
                  esc(comment.authorName || "Customer") +
                  "</strong>" +
                  "<span>" +
                  esc(formatDateTime(comment.createdAt)) +
                  "</span>" +
                  "</div>" +
                  replyToHtml +
                  "<p>" +
                  esc(comment.body || "") +
                  "</p>" +
                  (state.isLoggedIn && access.canPost
                    ? '<button class="ghost small thread-reply-btn" data-reply-post-id="' +
                      esc(post.id) +
                      '" data-reply-comment-id="' +
                      esc(comment.id) +
                      '" data-reply-author-name="' +
                      esc(comment.authorName || "Customer") +
                      '" type="button">Reply</button>'
                    : "") +
                  "</article>"
                );
              })
              .join("")
          : '<p class="feedback-empty-comments">No comments yet.</p>';

        var replyContext = replyTarget
          ? '<div class="reply-context">' +
            "<span>Replying to " +
            esc(replyTarget.authorName || "comment") +
            "</span>" +
            '<button class="ghost small reply-clear-btn" data-reply-clear-post-id="' +
            esc(post.id) +
            '" type="button">Clear</button>' +
            "</div>"
          : "";

        var commentComposer = state.isLoggedIn && access.canPost
          ? '<div class="thread-compose">' +
            replyContext +
            '<textarea class="thread-input" data-comment-input="' +
            esc(post.id) +
            '" rows="2" placeholder="' +
            esc(replyTarget ? "Write your reply..." : "Add your comment...") +
            '"></textarea>' +
            '<button class="primary thread-submit" data-comment-post-id="' +
            esc(post.id) +
            '" type="button">Comment</button>' +
            "</div>"
          : '<p class="feedback-empty-comments">' + esc(state.isLoggedIn ? "You need board write access to comment." : "Log in to comment.") + "</p>";

        return (
          '<article class="feedback-item ' +
          (isExpanded ? "is-expanded" : "") +
          '" data-post-id="' +
          esc(post.id) +
          '">' +
          '<div class="feedback-main" data-expand-id="' +
          esc(post.id) +
          '" role="button" tabindex="0" aria-expanded="' +
          (isExpanded ? "true" : "false") +
          '">' +
          "<h3>" +
          esc(post.title) +
          "</h3>" +
          "<p>" +
          esc(shortText(post.details, 200)) +
          "</p>" +
          '<div class="meta">' +
          "<span>" +
          esc(statusLabel(post.status)) +
          "</span>" +
          "<span>" +
          esc(post.commentCount) +
          " comments</span>" +
          "<span>" +
          esc(formatCurrency(post.attachedMrr)) +
          " MRR</span>" +
          (post.capturedViaSupport ? '<span class="badge">Captured via Support</span>' : "") +
          "</div>" +
          "</div>" +
          '<div class="vote-stack">' +
          '<button class="vote-btn" data-vote-id="' +
          esc(post.id) +
          '" type="button" ' +
          (!state.isLoggedIn || !access.canPost ? "disabled" : "") +
          ">^</button>" +
          "<strong>" +
          esc(post.voteCount) +
          "</strong>" +
          "</div>" +
          '<div class="feedback-actions">' +
          '<button class="ghost small expand-toggle" data-expand-id="' +
          esc(post.id) +
          '" type="button">' +
          esc(isExpanded ? "Hide Details" : "View Details") +
          "</button>" +
          "</div>" +
          '<section class="feedback-detail ' +
          (isExpanded ? "" : "hidden") +
          '">' +
          "<h4>Post Details</h4>" +
          '<p class="detail-copy">' +
          esc(post.details) +
          "</p>" +
          '<div class="meta detail-meta">' +
          "<span>Owner: " +
          esc(post.ownerName || "Unassigned") +
          "</span>" +
          "<span>ETA: " +
          esc(post.eta ? formatDateTime(post.eta) : "TBD") +
          "</span>" +
          (postTags.length
            ? "<span>Tags: " +
              esc(postTags.join(", ")) +
              "</span>"
            : "") +
          "</div>" +
          "<h4>Comment Thread</h4>" +
          '<div class="comment-thread">' +
          commentsHtml +
          "</div>" +
          commentComposer +
          "</section>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderRoadmap(roadmap) {
    function template(post) {
      return (
        '<article class="roadmap-item">' +
        "<h4>" +
        esc(post.title) +
        "</h4>" +
        "<p>" +
        esc(post.voteCount) +
        " votes - " +
        esc(formatCurrency(post.attachedMrr)) +
        "</p>" +
        "</article>"
      );
    }

    if (state.loading.roadmap) {
      var loadingCard = renderStateCard("loading", "Loading roadmap", "Pulling latest status columns.");
      el.roadmapPlanned.innerHTML = loadingCard;
      el.roadmapProgress.innerHTML = loadingCard;
      el.roadmapComplete.innerHTML = loadingCard;
      return;
    }

    if (state.roadmapError) {
      var message = renderStateCard("error", state.roadmapError, "Try refreshing this board.");
      el.roadmapPlanned.innerHTML = message;
      el.roadmapProgress.innerHTML = message;
      el.roadmapComplete.innerHTML = message;
      return;
    }

    el.roadmapPlanned.innerHTML = roadmap.planned.length
      ? roadmap.planned.map(template).join("")
      : renderStateCard("empty", "No planned items", "Items marked planned will appear here.");

    el.roadmapProgress.innerHTML = roadmap.in_progress.length
      ? roadmap.in_progress.map(template).join("")
      : renderStateCard("empty", "No in-progress items", "Move work into In Progress to track active delivery.");

    el.roadmapComplete.innerHTML = roadmap.complete.length
      ? roadmap.complete.map(template).join("")
      : renderStateCard("empty", "No complete items", "Completed roadmap items will appear here.");
  }

  function renderChangelog(entries) {
    if (state.loading.changelog) {
      el.changelogList.innerHTML = [
        renderStateCard("loading", "Loading changelog", "Fetching release entries."),
        renderStateCard("loading", "Loading changelog", "")
      ].join("");
      return;
    }

    if (state.changelogError) {
      el.changelogList.innerHTML = renderStateCard("error", state.changelogError, "Try again in a moment.");
      return;
    }

    el.changelogList.innerHTML = entries.length
      ? entries
          .map(function (entry) {
            var safeContent = sanitizeHtml(entry.content || "");
            return (
              '<article class="changelog-item">' +
              '<div class="tags">' +
              (entry.tags || [])
                .map(function (tag) {
                  return '<span class="tag">' + esc(tag) + "</span>";
                })
                .join("") +
              "</div>" +
              "<h3>" +
              esc(entry.title) +
              "</h3>" +
              '<div class="changelog-entry-body">' +
              safeContent +
              "</div>" +
              "</article>"
            );
          })
          .join("")
      : renderStateCard("empty", "No changelog entries found", "Published updates will appear here.");
  }

  function renderNotifications() {
    if (!state.isLoggedIn) {
      el.notificationList.innerHTML = renderStateCard(
        "empty",
        "Log in to view notifications",
        "Product updates, mentions, and access changes appear after sign-in."
      );
      return;
    }

    if (state.loading.notifications) {
      el.notificationList.innerHTML = renderStateCard("loading", "Loading notifications", "Syncing your inbox.");
      return;
    }

    if (state.notificationError) {
      el.notificationList.innerHTML = renderStateCard("error", state.notificationError, "Retry after refreshing notifications.");
      return;
    }

    if (!state.notifications.length) {
      el.notificationList.innerHTML = renderStateCard("empty", "You are all caught up", "No notifications right now.");
      return;
    }

    el.notificationList.innerHTML = state.notifications
      .map(function (item) {
        var board = getBoardById(item.boardId);
        var isUnread = !item.readAt;
        var boardName = board ? board.name : item.boardId;
        return (
          '<article class="notification-item ' +
          (isUnread ? "unread" : "") +
          '" data-notification-id="' +
          esc(item.id) +
          '">' +
          "<h4>" +
          esc(item.title) +
          "</h4>" +
          "<p>" +
          esc(item.body) +
          "</p>" +
          '<div class="notification-meta">' +
          "<span>" +
          esc(notificationTypeLabel(item.type)) +
          " - " +
          esc(boardName) +
          "</span>" +
          "<span>" +
          esc(formatDateTime(item.createdAt)) +
          "</span>" +
          (isUnread
            ? '<button class="ghost small" data-read-notification-id="' +
              esc(item.id) +
              '" type="button">Mark read</button>'
            : "") +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function setActiveBoard(boardId) {
    if (!boardId || boardId === state.boardId) {
      return;
    }

    state.boardId = boardId;
    state.expandedPostId = "";
    state.replyTargets = {};
    state.feedbackError = "";
    state.roadmapError = "";
  }

  function loadSession() {
    return request("/api/portal/session")
      .then(function (result) {
        if (state.isLoggedIn && result.profile) {
          if (result.profile.email) {
            state.email = normalizeEmail(result.profile.email);
          }

          if (result.profile.name) {
            state.userName = result.profile.name;
          }

          if (result.profile.appUserId) {
            state.appUserId = result.profile.appUserId;
          }

          if (Array.isArray(result.profile.segments)) {
            state.segments = result.profile.segments;
          }
        }

        if (result.notificationPreferences) {
          state.notificationPreferences = {
            productUpdates: !!result.notificationPreferences.productUpdates,
            commentReplies: !!result.notificationPreferences.commentReplies,
            mentions: !!result.notificationPreferences.mentions,
            weeklyDigest: !!result.notificationPreferences.weeklyDigest
          };
        }

        persistSession();
        updateAccessUi();
        renderNotificationPreferences();
      })
      .catch(function (_error) {
        updateAccessUi();
        renderNotificationPreferences();
      });
  }

  function loadBoards() {
    setLoading("boards", true);
    renderBoards();

    return request("/api/portal/boards")
      .then(function (result) {
        state.boards = (result.boards || []).map(function (board) {
          return {
            id: board.id,
            name: board.name,
            visibility: board.visibility || "public",
            allowedSegments: Array.isArray(board.allowedSegments) ? board.allowedSegments : [],
            access: board.access || "locked",
            canPost: !!board.canPost,
            postCount: Number(board.postCount || 0)
          };
        });

        ensureBoardSelection();
        state.feedbackError = "";
        state.roadmapError = "";
      })
      .catch(function (error) {
        state.boards = [];
        state.boardId = "";
        state.feedback = [];
        state.feedbackError = "Unable to load boards right now.";
        state.roadmapError = "Unable to load boards right now.";
        pushToast("error", error.message || "Failed to load boards.");
      })
      .finally(function () {
        setLoading("boards", false);
        renderBoards();
        updateAccessUi();
        renderFeedback();
        renderRoadmap(state.roadmap);
      });
  }

  function loadFeedback() {
    if (!state.boardId) {
      state.feedback = [];
      state.feedbackError = "Select a board to view feedback.";
      renderFeedback();
      updateAccessUi();
      return Promise.resolve();
    }

    setLoading("feedback", true);
    state.feedbackError = "";
    renderFeedback();

    var query = new URLSearchParams({
      sort: state.sort,
      filter: state.filter,
      q: state.query
    });

    return request("/api/portal/boards/" + encodeURIComponent(state.boardId) + "/feedback?" + query.toString())
      .then(function (result) {
        if (result.access) {
          setBoardAccess(state.boardId, result.access);
        }

        state.feedbackError = "";
        state.feedback = result.posts || [];

        if (
          state.expandedPostId &&
          !state.feedback.some(function (post) {
            return post.id === state.expandedPostId;
          })
        ) {
          state.expandedPostId = "";
        }

      })
      .catch(function (error) {
        state.feedback = [];
        state.expandedPostId = "";

        if (error.status === 403) {
          var access = error.payload && error.payload.access ? error.payload.access : null;
          if (access) {
            setBoardAccess(state.boardId, access);
            renderBoards();
          }

          state.feedbackError = accessHint(access);
        } else {
          state.feedbackError = error.message || "Failed to load feedback.";
        }

      })
      .finally(function () {
        setLoading("feedback", false);
        renderBoards();
        updateAccessUi();
        renderFeedback();
      });
  }

  function loadRoadmap() {
    if (!state.boardId) {
      state.roadmapError = "Select a board to view roadmap items.";
      state.roadmap = { planned: [], in_progress: [], complete: [] };
      renderRoadmap({ planned: [], in_progress: [], complete: [] });
      return Promise.resolve();
    }

    setLoading("roadmap", true);
    state.roadmapError = "";
    renderRoadmap({ planned: [], in_progress: [], complete: [] });

    return request("/api/portal/boards/" + encodeURIComponent(state.boardId) + "/roadmap")
      .then(function (result) {
        if (result.access) {
          setBoardAccess(state.boardId, result.access);
        }

        state.roadmap = result.roadmap || { planned: [], in_progress: [], complete: [] };
      })
      .catch(function (error) {
        if (error.status === 403) {
          var access = error.payload && error.payload.access ? error.payload.access : null;
          if (access) {
            setBoardAccess(state.boardId, access);
            renderBoards();
          }
          state.roadmapError = accessHint(access);
        } else {
          state.roadmapError = error.message || "Failed to load roadmap.";
        }

        state.roadmap = { planned: [], in_progress: [], complete: [] };
      })
      .finally(function () {
        setLoading("roadmap", false);
        renderBoards();
        updateAccessUi();
        renderRoadmap(state.roadmap);
      });
  }

  function loadChangelog() {
    setLoading("changelog", true);
    state.changelogError = "";
    renderChangelog([]);

    var query = new URLSearchParams({ q: state.changelogQuery });
    return request("/api/portal/changelog?" + query.toString())
      .then(function (result) {
        state.changelogEntries = result.entries || [];
      })
      .catch(function (error) {
        state.changelogEntries = [];
        state.changelogError = error.message || "Failed to load changelog.";
      })
      .finally(function () {
        setLoading("changelog", false);
        renderChangelog(state.changelogEntries);
      });
  }

  function loadNotificationPreferences() {
    if (!state.isLoggedIn) {
      state.notificationPreferences = {
        productUpdates: true,
        commentReplies: true,
        mentions: true,
        weeklyDigest: true
      };
      renderNotificationPreferences();
      return Promise.resolve();
    }

    return request("/api/portal/notification-preferences")
      .then(function (result) {
        if (result.preferences) {
          state.notificationPreferences = {
            productUpdates: !!result.preferences.productUpdates,
            commentReplies: !!result.preferences.commentReplies,
            mentions: !!result.preferences.mentions,
            weeklyDigest: !!result.preferences.weeklyDigest
          };
        }
        renderNotificationPreferences();
      })
      .catch(function () {
        renderNotificationPreferences();
      });
  }

  function loadNotifications() {
    if (!state.isLoggedIn) {
      state.notifications = [];
      state.unreadCount = 0;
      state.notificationError = "";
      renderNotificationPill();
      renderNotifications();
      renderNotificationPreferences();
      return Promise.resolve();
    }

    setLoading("notifications", true);
    state.notificationError = "";
    renderNotifications();
    renderNotificationPreferences();

    return request("/api/portal/notifications")
      .then(function (result) {
        state.notifications = result.notifications || [];
        state.unreadCount = Number(result.unreadCount || 0);
      })
      .catch(function (error) {
        state.notifications = [];
        state.unreadCount = 0;
        state.notificationError = error.message || "Failed to load notifications.";
      })
      .finally(function () {
        setLoading("notifications", false);
        renderNotificationPill();
        renderNotifications();
        renderNotificationPreferences();
      });
  }

  function refreshBoardData() {
    return Promise.all([loadFeedback(), loadRoadmap()]);
  }

  function startLoginFlow() {
    var defaultEmail = state.email && state.email !== DEFAULT_EMAIL ? state.email : "";
    var emailInput = window.prompt("Enter your work email", defaultEmail);
    if (emailInput === null) {
      return Promise.resolve(false);
    }

    var email = normalizeEmail(emailInput);
    if (!email) {
      pushToast("error", "Email is required.");
      return Promise.resolve(false);
    }

    var nameInput = window.prompt("Display name", state.userName || email.split("@")[0] || DEFAULT_NAME);
    if (nameInput === null) {
      return Promise.resolve(false);
    }

    var appUserInput = window.prompt("App user ID (optional)", state.appUserId || "");
    if (appUserInput === null) {
      return Promise.resolve(false);
    }

    var segmentsInput = window.prompt("Segments (comma separated, optional)", (state.segments || []).join(", "));
    if (segmentsInput === null) {
      return Promise.resolve(false);
    }

    var payload = {
      email: email,
      name: String(nameInput || "").trim() || email,
      appUserId: String(appUserInput || "").trim() || undefined,
      segments: parseSegments(segmentsInput)
    };

    return request("/api/portal/sso/start", {
      method: "POST",
      body: payload
    })
      .then(function (result) {
        var session = result.session || {};
        state.isLoggedIn = true;
        state.email = normalizeEmail(session.email || payload.email);
        state.userName = session.name || payload.name || DEFAULT_NAME;
        state.appUserId = session.appUserId || payload.appUserId || DEFAULT_APP_USER_ID;
        state.segments = Array.isArray(session.segments) ? session.segments : payload.segments;
        state.replyTargets = {};
        persistSession();
        defaultSessionState();
        return true;
      })
      .catch(function (error) {
        pushToast("error", error.message || "Failed to start SSO session.");
        return false;
      });
  }

  function logoutFlow() {
    state.isLoggedIn = false;
    state.replyTargets = {};
    state.expandedPostId = "";
    state.notifications = [];
    state.unreadCount = 0;
    state.notificationError = "";
    persistSession();

    return request("/api/portal/sso/logout", { method: "POST" })
      .catch(function () {
        return { ok: true };
      })
      .then(function () {
        return Promise.all([loadSession(), loadBoards()]);
      })
      .then(function () {
        return Promise.all([refreshBoardData(), loadNotifications()]);
      });
  }

  function toggleExpand(postId) {
    if (!postId) {
      return;
    }

    state.expandedPostId = state.expandedPostId === postId ? "" : postId;
    renderFeedback();
  }

  function bindEvents() {
    el.tabs.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement) || !target.closest(".tab")) {
        return;
      }

      var button = target.closest(".tab");
      if (!button) {
        return;
      }

      state.activeTab = button.getAttribute("data-tab") || "feedback";
      renderTabs();

      if (state.activeTab === "feedback") {
        void loadFeedback();
        return;
      }

      if (state.activeTab === "roadmap") {
        void loadRoadmap();
        return;
      }

      if (state.activeTab === "changelog") {
        void loadChangelog();
        return;
      }

      if (state.activeTab === "notifications") {
        void Promise.all([loadNotificationPreferences(), loadNotifications()]);
      }
    });

    el.loginBtn.addEventListener("click", function () {
      if (state.isLoggedIn) {
        void logoutFlow();
        return;
      }

      startLoginFlow().then(function (loggedIn) {
        if (!loggedIn) {
          return;
        }

        void Promise.all([loadSession(), loadBoards()])
          .then(function () {
            return Promise.all([refreshBoardData(), loadNotificationPreferences(), loadNotifications()]);
          })
          .catch(function (error) {
            pushToast("error", error.message || "Failed to refresh portal session.");
          });
      });
    });

    el.requestAccessBtn.addEventListener("click", function () {
      var access = getSelectedBoardAccess();
      if (!state.isLoggedIn) {
        pushToast("info", "Log in first to request access.");
        return;
      }

      if (!state.boardId) {
        pushToast("info", "Choose a board first.");
        return;
      }

      if (!access.canRequest) {
        pushToast("info", "Access request is not needed for this board.");
        return;
      }

      var reason = window.prompt("What access do you need?");
      if (!reason) {
        return;
      }

      setButtonBusy(el.requestAccessBtn, true, "Requesting...");
      request("/api/portal/access/request", {
        method: "POST",
        body: {
          boardId: state.boardId,
          reason: reason,
          email: state.email
        }
      })
        .then(function () {
          pushToast("success", "Access request submitted.");
          setBoardAccess(state.boardId, {
            canRead: false,
            canPost: false,
            canRequest: true,
            access: "request"
          });
          renderBoards();
          updateAccessUi();
          renderFeedback();
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to submit request.");
        })
        .finally(function () {
          setButtonBusy(el.requestAccessBtn, false);
          updateAccessUi();
        });
    });

    el.boardList.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var button = target.closest(".board-item");
      if (!button) {
        return;
      }

      setActiveBoard(button.getAttribute("data-board-id") || state.boardId);
      renderBoards();
      updateAccessUi();
      void refreshBoardData();
    });

    el.sortFilterBtn.addEventListener("click", function () {
      el.sortFilterMenu.classList.toggle("hidden");
    });

    el.sortFilterMenu.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches("button")) {
        return;
      }

      var sort = target.getAttribute("data-sort");
      var filter = target.getAttribute("data-filter");

      if (sort) {
        state.sort = sort;
      }

      if (filter) {
        state.filter = filter;
      }

      refreshSortFilterLabel();
      renderFilterChips();
      el.sortFilterMenu.classList.add("hidden");
      void loadFeedback();
    });

    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (!target.closest(".sort-filter-wrap")) {
        el.sortFilterMenu.classList.add("hidden");
      }
    });

    el.searchInput.addEventListener("input", function () {
      state.query = el.searchInput.value;
      void loadFeedback();
    });

    if (el.statusFilterChips) {
      el.statusFilterChips.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var chip = target.closest("[data-filter-chip]");
        if (!chip) {
          return;
        }

        state.filter = chip.getAttribute("data-filter-chip") || "all";
        refreshSortFilterLabel();
        renderFilterChips();
        void loadFeedback();
      });
    }

    el.feedbackList.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var voteBtn = target.closest(".vote-btn");
      if (voteBtn) {
        if (!state.isLoggedIn) {
          pushToast("info", "Please log in to upvote.");
          return;
        }

        var boardAccess = getSelectedBoardAccess();
        if (!boardAccess.canPost) {
          pushToast("info", "You do not have board access to vote.");
          return;
        }

        var votePostId = voteBtn.getAttribute("data-vote-id");
        if (!votePostId) {
          return;
        }

        setButtonBusy(voteBtn, true);
        request("/api/portal/votes", {
          method: "POST",
          body: { postId: votePostId }
        })
          .then(function () {
            return Promise.all([loadFeedback(), loadRoadmap()]);
          })
          .catch(function (error) {
            pushToast("error", error.message || "Failed to vote.");
          })
          .finally(function () {
            setButtonBusy(voteBtn, false);
          });
        return;
      }

      var clearReplyBtn = target.closest(".reply-clear-btn");
      if (clearReplyBtn) {
        var clearPostId = clearReplyBtn.getAttribute("data-reply-clear-post-id");
        if (clearPostId) {
          delete state.replyTargets[clearPostId];
          renderFeedback();
        }
        return;
      }

      var replyBtn = target.closest(".thread-reply-btn");
      if (replyBtn) {
        if (!state.isLoggedIn) {
          pushToast("info", "Please log in to reply.");
          return;
        }

        var replyPostId = replyBtn.getAttribute("data-reply-post-id");
        var replyCommentId = replyBtn.getAttribute("data-reply-comment-id");
        var replyAuthorName = replyBtn.getAttribute("data-reply-author-name");
        if (!replyPostId || !replyCommentId) {
          return;
        }

        state.replyTargets[replyPostId] = {
          commentId: replyCommentId,
          authorName: replyAuthorName || "comment"
        };
        state.expandedPostId = replyPostId;
        renderFeedback();

        var replyInput = el.feedbackList.querySelector('textarea[data-comment-input="' + replyPostId + '"]');
        if (replyInput) {
          replyInput.focus();
        }
        return;
      }

      var commentBtn = target.closest(".thread-submit");
      if (commentBtn) {
        if (!state.isLoggedIn) {
          pushToast("info", "Please log in to comment.");
          return;
        }

        var commentPostId = commentBtn.getAttribute("data-comment-post-id");
        if (!commentPostId) {
          return;
        }

        var input = el.feedbackList.querySelector('textarea[data-comment-input="' + commentPostId + '"]');
        if (!input) {
          return;
        }

        var body = input.value.trim();
        if (!body) {
          return;
        }

        setButtonBusy(commentBtn, true, "Posting...");
        request("/api/portal/comments", {
          method: "POST",
          body: {
            postId: commentPostId,
            body: body,
            replyToCommentId: state.replyTargets[commentPostId] ? state.replyTargets[commentPostId].commentId : undefined
          }
        })
          .then(function () {
            delete state.replyTargets[commentPostId];
            state.expandedPostId = commentPostId;
            return Promise.all([loadFeedback(), loadNotifications()]);
          })
          .catch(function (error) {
            pushToast("error", error.message || "Failed to add comment.");
          })
          .finally(function () {
            setButtonBusy(commentBtn, false);
          });
        return;
      }

      var expandBtn = target.closest(".expand-toggle");
      if (expandBtn) {
        toggleExpand(expandBtn.getAttribute("data-expand-id"));
        return;
      }

      var main = target.closest(".feedback-main");
      if (main) {
        toggleExpand(main.getAttribute("data-expand-id"));
      }
    });

    el.feedbackList.addEventListener("keydown", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains("feedback-main")) {
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleExpand(target.getAttribute("data-expand-id"));
    });

    el.createPost.addEventListener("click", function () {
      if (!state.isLoggedIn) {
        pushToast("info", "Please log in to create a post.");
        return;
      }

      var access = getSelectedBoardAccess();
      if (!access.canPost) {
        pushToast("info", "You do not have write access for this board.");
        return;
      }

      var title = el.newTitle.value.trim();
      var details = el.newDetails.value.trim();
      if (!title || !details) {
        return;
      }

      setButtonBusy(el.createPost, true, "Creating...");
      request("/api/portal/posts", {
        method: "POST",
        body: {
          boardId: state.boardId,
          title: title,
          details: details
        }
      })
        .then(function () {
          el.newTitle.value = "";
          el.newDetails.value = "";
          return Promise.all([loadBoards(), loadFeedback(), loadRoadmap()]);
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to create post.");
        })
        .finally(function () {
          setButtonBusy(el.createPost, false);
        });
    });

    el.clearNewPost.addEventListener("click", function () {
      el.newTitle.value = "";
      el.newDetails.value = "";
    });

    el.changelogSearch.addEventListener("input", function () {
      state.changelogQuery = el.changelogSearch.value;
      void loadChangelog();
    });

    el.saveNotificationPrefs.addEventListener("click", function () {
      if (!state.isLoggedIn) {
        pushToast("info", "Please log in first.");
        return;
      }

      setButtonBusy(el.saveNotificationPrefs, true, "Saving...");
      request("/api/portal/notification-preferences", {
        method: "PATCH",
        body: {
          productUpdates: el.prefProductUpdates.checked,
          commentReplies: el.prefCommentReplies.checked,
          mentions: el.prefMentions.checked,
          weeklyDigest: el.prefWeeklyDigest.checked
        }
      })
        .then(function (result) {
          if (result.preferences) {
            state.notificationPreferences = {
              productUpdates: !!result.preferences.productUpdates,
              commentReplies: !!result.preferences.commentReplies,
              mentions: !!result.preferences.mentions,
              weeklyDigest: !!result.preferences.weeklyDigest
            };
            renderNotificationPreferences();
          }
          pushToast("success", "Notification preferences saved.");
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to update preferences.");
        })
        .finally(function () {
          setButtonBusy(el.saveNotificationPrefs, false);
        });
    });

    el.markAllRead.addEventListener("click", function () {
      if (!state.isLoggedIn) {
        return;
      }

      setButtonBusy(el.markAllRead, true, "Marking...");
      request("/api/portal/notifications/read-all", { method: "POST" })
        .then(function () {
          return loadNotifications();
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to mark notifications as read.");
        })
        .finally(function () {
          setButtonBusy(el.markAllRead, false);
        });
    });

    el.notificationList.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var readBtn = target.closest("[data-read-notification-id]");
      if (!readBtn) {
        return;
      }

      var notificationId = readBtn.getAttribute("data-read-notification-id");
      if (!notificationId) {
        return;
      }

      var readButton = readBtn instanceof HTMLButtonElement ? readBtn : null;
      if (readButton) {
        setButtonBusy(readButton, true, "Reading...");
      }

      request("/api/portal/notifications/" + encodeURIComponent(notificationId) + "/read", {
        method: "PATCH"
      })
        .then(function () {
          return loadNotifications();
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to mark notification as read.");
        })
        .finally(function () {
          if (readButton) {
            setButtonBusy(readButton, false);
          }
        });
    });
  }

  function bootstrap() {
    defaultSessionState();
    updateAccessUi();
    refreshSortFilterLabel();
    renderFilterChips();
    renderTabs();
    renderFeedback();
    renderNotifications();

    Promise.all([loadSession(), loadBoards()])
      .then(function () {
        return Promise.all([loadFeedback(), loadRoadmap(), loadChangelog(), loadNotificationPreferences(), loadNotifications()]);
      })
      .catch(function (error) {
        console.error("Portal bootstrap failed", error);
      });
  }

  bindEvents();
  bootstrap();
})(window, document);
