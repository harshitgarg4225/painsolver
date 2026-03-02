/* =============================================
   PainSolver – Public Roadmap JS
   ============================================= */

(function () {
  "use strict";

  // State
  var state = {
    companySlug: null,
    boards: [],
    selectedBoardId: null,
    posts: [],
    selectedPost: null
  };

  // DOM Elements
  var el = {
    companyName: document.getElementById("company-name"),
    boardSelect: document.getElementById("board-select"),
    statPlanned: document.getElementById("stat-planned"),
    statProgress: document.getElementById("stat-progress"),
    statComplete: document.getElementById("stat-complete"),
    itemsPlanned: document.getElementById("items-planned"),
    itemsProgress: document.getElementById("items-progress"),
    itemsComplete: document.getElementById("items-complete"),
    countPlanned: document.getElementById("count-planned"),
    countProgress: document.getElementById("count-progress"),
    countComplete: document.getElementById("count-complete"),
    postModal: document.getElementById("post-modal"),
    modalClose: document.getElementById("modal-close"),
    modalBody: document.getElementById("modal-body")
  };

  // =============================================
  // Utilities
  // =============================================

  function esc(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function shortDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function relativeTime(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    var now = new Date();
    var diffMs = now - d;
    var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return diffDays + " days ago";
    if (diffDays < 30) return Math.floor(diffDays / 7) + " weeks ago";
    if (diffDays < 365) return Math.floor(diffDays / 30) + " months ago";
    return Math.floor(diffDays / 365) + " years ago";
  }

  function statusLabel(status) {
    var labels = {
      open: "Open",
      planned: "Planned",
      in_progress: "In Progress",
      complete: "Complete"
    };
    return labels[status] || status;
  }

  // =============================================
  // API Calls
  // =============================================

  function getCompanySlug() {
    // Extract from URL: /roadmap/[slug] or query param ?company=[slug]
    var path = window.location.pathname;
    var match = path.match(/\/roadmap\/([^\/]+)/);
    if (match) return match[1];
    
    var params = new URLSearchParams(window.location.search);
    return params.get("company") || params.get("slug");
  }

  function api(endpoint) {
    var baseUrl = window.location.origin;
    return fetch(baseUrl + endpoint)
      .then(function (res) {
        if (!res.ok) throw new Error("API Error: " + res.status);
        return res.json();
      });
  }

  function loadCompanyInfo() {
    if (!state.companySlug) {
      // Default demo mode - use first available workspace
      return api("/api/portal/workspaces")
        .then(function (data) {
          if (data.workspaces && data.workspaces.length > 0) {
            var ws = data.workspaces[0];
            state.companySlug = ws.slug || ws.id;
            el.companyName.textContent = ws.name || "Product";
            document.title = (ws.name || "Product") + " Roadmap - PainSolver";
            return ws;
          }
          throw new Error("No workspaces found");
        });
    }
    
    return api("/api/portal/workspaces/" + state.companySlug)
      .then(function (ws) {
        el.companyName.textContent = ws.name || "Product";
        document.title = (ws.name || "Product") + " Roadmap - PainSolver";
        return ws;
      });
  }

  function loadBoards() {
    return api("/api/portal/boards")
      .then(function (data) {
        state.boards = data.boards || [];
        renderBoardSelector();
        
        if (state.boards.length > 0) {
          state.selectedBoardId = state.boards[0].id;
          return loadRoadmapData();
        }
      });
  }

  function loadRoadmapData() {
    if (!state.selectedBoardId) return Promise.resolve();

    return api("/api/portal/boards/" + state.selectedBoardId + "/posts?status=planned,in_progress,complete&limit=200")
      .then(function (data) {
        state.posts = data.posts || [];
        renderRoadmap();
        updateStats();
      })
      .catch(function (err) {
        console.error("Failed to load roadmap:", err);
        renderError();
      });
  }

  function loadPostDetail(postId) {
    return api("/api/portal/posts/" + postId)
      .then(function (data) {
        state.selectedPost = data.post || data;
        return loadPostComments(postId);
      })
      .then(function (commentsData) {
        state.selectedPost.comments = commentsData.comments || [];
        renderPostModal();
        openModal();
      })
      .catch(function (err) {
        console.error("Failed to load post:", err);
      });
  }

  function loadPostComments(postId) {
    return api("/api/portal/posts/" + postId + "/comments?limit=20")
      .catch(function () {
        return { comments: [] };
      });
  }

  // =============================================
  // Rendering
  // =============================================

  function renderBoardSelector() {
    if (state.boards.length === 0) {
      el.boardSelect.innerHTML = '<option value="">No boards available</option>';
      return;
    }

    el.boardSelect.innerHTML = state.boards
      .map(function (board) {
        return '<option value="' + esc(board.id) + '">' + esc(board.name) + '</option>';
      })
      .join("");
  }

  function renderRoadmap() {
    var planned = [];
    var inProgress = [];
    var complete = [];

    state.posts.forEach(function (post) {
      if (post.status === "planned") planned.push(post);
      else if (post.status === "in_progress") inProgress.push(post);
      else if (post.status === "complete") complete.push(post);
    });

    renderColumn("planned", planned, el.itemsPlanned, el.countPlanned);
    renderColumn("progress", inProgress, el.itemsProgress, el.countProgress);
    renderColumn("complete", complete, el.itemsComplete, el.countComplete);
  }

  function renderColumn(type, posts, container, countEl) {
    countEl.textContent = posts.length;

    if (posts.length === 0) {
      container.innerHTML = 
        '<div class="empty-state">' +
          '<span class="material-symbols-outlined">inbox</span>' +
          '<p>Nothing here yet</p>' +
        '</div>';
      return;
    }

    container.innerHTML = posts
      .map(function (post) {
        var tags = (post.tags || []).slice(0, 3);
        var tagsHtml = tags.length 
          ? '<div class="item-tags">' + 
              tags.map(function (t) { 
                return '<span class="item-tag">' + esc(t.name || t) + '</span>'; 
              }).join("") + 
            '</div>'
          : "";

        return (
          '<article class="roadmap-item status-' + esc(post.status) + '" data-post-id="' + esc(post.id) + '">' +
            '<h3 class="item-title">' + esc(post.title) + '</h3>' +
            '<div class="item-meta">' +
              '<span><span class="material-symbols-outlined">thumb_up</span> ' + (post.voteCount || 0) + '</span>' +
              '<span><span class="material-symbols-outlined">chat</span> ' + (post.commentCount || 0) + '</span>' +
            '</div>' +
            tagsHtml +
          '</article>'
        );
      })
      .join("");
  }

  function updateStats() {
    var planned = 0, progress = 0, complete = 0;
    
    state.posts.forEach(function (post) {
      if (post.status === "planned") planned++;
      else if (post.status === "in_progress") progress++;
      else if (post.status === "complete") complete++;
    });

    el.statPlanned.textContent = planned;
    el.statProgress.textContent = progress;
    el.statComplete.textContent = complete;
  }

  function renderError() {
    var errorHtml = 
      '<div class="empty-state">' +
        '<span class="material-symbols-outlined">error</span>' +
        '<p>Failed to load roadmap</p>' +
      '</div>';
    
    el.itemsPlanned.innerHTML = errorHtml;
    el.itemsProgress.innerHTML = errorHtml;
    el.itemsComplete.innerHTML = errorHtml;
  }

  function renderPostModal() {
    var post = state.selectedPost;
    if (!post) return;

    var statusClass = post.status || "open";
    var commentsHtml = "";

    if (post.comments && post.comments.length > 0) {
      commentsHtml = 
        '<div class="modal-comments">' +
          '<h3><span class="material-symbols-outlined">chat</span> Comments (' + post.comments.length + ')</h3>' +
          '<div class="comment-list">' +
            post.comments.map(function (c) {
              var authorName = c.author?.name || c.authorName || "Anonymous";
              var initial = authorName.charAt(0).toUpperCase();
              return (
                '<div class="comment-item">' +
                  '<div class="comment-header">' +
                    '<div class="comment-avatar">' + esc(initial) + '</div>' +
                    '<span class="comment-author">' + esc(authorName) + '</span>' +
                    '<span class="comment-time">' + relativeTime(c.createdAt) + '</span>' +
                  '</div>' +
                  '<div class="comment-body">' + esc(c.body || c.content) + '</div>' +
                '</div>'
              );
            }).join("") +
          '</div>' +
        '</div>';
    }

    el.modalBody.innerHTML = 
      '<span class="modal-status ' + esc(statusClass) + '">' +
        '<span class="material-symbols-outlined">' + getStatusIcon(statusClass) + '</span>' +
        statusLabel(statusClass) +
      '</span>' +
      '<h2 class="modal-title">' + esc(post.title) + '</h2>' +
      '<p class="modal-description">' + esc(post.description || post.body || "No description provided.") + '</p>' +
      '<div class="modal-meta">' +
        '<div class="modal-meta-item">' +
          '<span class="material-symbols-outlined">thumb_up</span>' +
          '<span>' + (post.voteCount || 0) + ' votes</span>' +
        '</div>' +
        '<div class="modal-meta-item">' +
          '<span class="material-symbols-outlined">chat</span>' +
          '<span>' + (post.commentCount || 0) + ' comments</span>' +
        '</div>' +
        '<div class="modal-meta-item">' +
          '<span class="material-symbols-outlined">calendar_month</span>' +
          '<span>Created ' + shortDate(post.createdAt) + '</span>' +
        '</div>' +
      '</div>' +
      commentsHtml;
  }

  function getStatusIcon(status) {
    var icons = {
      planned: "lightbulb",
      in_progress: "engineering",
      complete: "check_circle",
      open: "help"
    };
    return icons[status] || "help";
  }

  // =============================================
  // Modal
  // =============================================

  function openModal() {
    el.postModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    el.postModal.classList.remove("active");
    document.body.style.overflow = "";
    state.selectedPost = null;
  }

  // =============================================
  // Event Handlers
  // =============================================

  function handleBoardChange(e) {
    state.selectedBoardId = e.target.value;
    loadRoadmapData();
  }

  function handleItemClick(e) {
    var item = e.target.closest(".roadmap-item");
    if (!item) return;
    
    var postId = item.getAttribute("data-post-id");
    if (postId) {
      loadPostDetail(postId);
    }
  }

  // =============================================
  // Initialize
  // =============================================

  function init() {
    state.companySlug = getCompanySlug();

    // Event listeners
    el.boardSelect.addEventListener("change", handleBoardChange);
    el.modalClose.addEventListener("click", closeModal);
    el.postModal.addEventListener("click", function (e) {
      if (e.target === el.postModal) closeModal();
    });

    // Item clicks
    el.itemsPlanned.addEventListener("click", handleItemClick);
    el.itemsProgress.addEventListener("click", handleItemClick);
    el.itemsComplete.addEventListener("click", handleItemClick);

    // Keyboard
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });

    // Load data
    loadCompanyInfo()
      .then(loadBoards)
      .catch(function (err) {
        console.error("Failed to initialize roadmap:", err);
        el.companyName.textContent = "Product";
        loadBoards();
      });
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

