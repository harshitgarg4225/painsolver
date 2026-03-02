/* =============================================
   PainSolver – User Profile JS
   ============================================= */

(function () {
  "use strict";

  // State
  var state = {
    user: null,
    submissions: [],
    votes: [],
    comments: [],
    activeTab: "submissions",
    selectedPost: null
  };

  // DOM Elements
  var el = {
    userAvatar: document.getElementById("user-avatar"),
    userName: document.getElementById("user-name"),
    userEmail: document.getElementById("user-email"),
    userCompany: document.getElementById("user-company"),
    statSubmissions: document.getElementById("stat-submissions"),
    statVotes: document.getElementById("stat-votes"),
    statComments: document.getElementById("stat-comments"),
    tabSubmissionsCount: document.getElementById("tab-submissions-count"),
    tabVotesCount: document.getElementById("tab-votes-count"),
    tabCommentsCount: document.getElementById("tab-comments-count"),
    submissionsList: document.getElementById("submissions-list"),
    votesList: document.getElementById("votes-list"),
    commentsList: document.getElementById("comments-list"),
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

  function getStatusIcon(status) {
    var icons = {
      open: "help",
      planned: "lightbulb",
      in_progress: "engineering",
      complete: "check_circle"
    };
    return icons[status] || "help";
  }

  function truncate(str, len) {
    if (!str) return "";
    if (str.length <= len) return str;
    return str.substring(0, len) + "...";
  }

  // =============================================
  // API Calls
  // =============================================

  function api(endpoint, options) {
    var baseUrl = window.location.origin;
    return fetch(baseUrl + endpoint, options)
      .then(function (res) {
        if (!res.ok) throw new Error("API Error: " + res.status);
        return res.json();
      });
  }

  function loadUserProfile() {
    return api("/api/portal/me")
      .then(function (data) {
        state.user = data.user || data;
        renderUserInfo();
        return state.user;
      })
      .catch(function () {
        // Not logged in or error - show placeholder
        state.user = {
          name: "Guest User",
          email: "Sign in to track your activity"
        };
        renderUserInfo();
      });
  }

  function loadSubmissions() {
    if (!state.user || !state.user.id) {
      renderEmptyState(el.submissionsList, "Sign in to see your submissions");
      return Promise.resolve();
    }

    return api("/api/portal/users/" + state.user.id + "/submissions")
      .then(function (data) {
        state.submissions = data.submissions || data.posts || [];
        renderSubmissions();
        updateCounts();
      })
      .catch(function (err) {
        console.error("Failed to load submissions:", err);
        renderEmptyState(el.submissionsList, "Failed to load submissions");
      });
  }

  function loadVotes() {
    if (!state.user || !state.user.id) {
      renderEmptyState(el.votesList, "Sign in to see your votes");
      return Promise.resolve();
    }

    return api("/api/portal/users/" + state.user.id + "/votes")
      .then(function (data) {
        state.votes = data.votes || data.posts || [];
        renderVotes();
        updateCounts();
      })
      .catch(function (err) {
        console.error("Failed to load votes:", err);
        renderEmptyState(el.votesList, "Failed to load votes");
      });
  }

  function loadComments() {
    if (!state.user || !state.user.id) {
      renderEmptyState(el.commentsList, "Sign in to see your comments");
      return Promise.resolve();
    }

    return api("/api/portal/users/" + state.user.id + "/comments")
      .then(function (data) {
        state.comments = data.comments || [];
        renderComments();
        updateCounts();
      })
      .catch(function (err) {
        console.error("Failed to load comments:", err);
        renderEmptyState(el.commentsList, "Failed to load comments");
      });
  }

  function loadPostDetail(postId) {
    return api("/api/portal/posts/" + postId)
      .then(function (data) {
        state.selectedPost = data.post || data;
        renderPostModal();
        openModal();
      })
      .catch(function (err) {
        console.error("Failed to load post:", err);
      });
  }

  // =============================================
  // Rendering
  // =============================================

  function renderUserInfo() {
    var user = state.user;
    if (!user) return;

    // Avatar
    if (user.name) {
      var initial = user.name.charAt(0).toUpperCase();
      el.userAvatar.innerHTML = initial;
      el.userAvatar.classList.add("has-initial");
    }

    el.userName.textContent = user.name || "Guest";
    el.userEmail.textContent = user.email || "";
    
    if (user.company) {
      el.userCompany.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">business</span> ' + esc(user.company.name || user.company);
    }
  }

  function updateCounts() {
    el.statSubmissions.textContent = state.submissions.length;
    el.statVotes.textContent = state.votes.length;
    el.statComments.textContent = state.comments.length;
    el.tabSubmissionsCount.textContent = state.submissions.length;
    el.tabVotesCount.textContent = state.votes.length;
    el.tabCommentsCount.textContent = state.comments.length;
  }

  function renderEmptyState(container, message) {
    container.innerHTML = 
      '<div class="empty-state">' +
        '<span class="material-symbols-outlined">inbox</span>' +
        '<p>' + esc(message) + '</p>' +
      '</div>';
  }

  function renderSubmissions() {
    if (state.submissions.length === 0) {
      renderEmptyState(el.submissionsList, "You haven't submitted any ideas yet");
      return;
    }

    el.submissionsList.innerHTML = state.submissions
      .map(function (post) {
        return renderPostCard(post);
      })
      .join("");
  }

  function renderVotes() {
    if (state.votes.length === 0) {
      renderEmptyState(el.votesList, "You haven't voted on any ideas yet");
      return;
    }

    el.votesList.innerHTML = state.votes
      .map(function (item) {
        var post = item.post || item;
        return renderPostCard(post);
      })
      .join("");
  }

  function renderPostCard(post) {
    return (
      '<article class="post-card status-' + esc(post.status || "open") + '" data-post-id="' + esc(post.id) + '">' +
        '<div class="post-header">' +
          '<h3 class="post-title">' + esc(post.title) + '</h3>' +
          '<span class="post-status ' + esc(post.status || "open") + '">' +
            '<span class="material-symbols-outlined">' + getStatusIcon(post.status || "open") + '</span>' +
            statusLabel(post.status || "open") +
          '</span>' +
        '</div>' +
        '<p class="post-description">' + esc(truncate(post.description || post.body || "", 150)) + '</p>' +
        '<div class="post-meta">' +
          '<span><span class="material-symbols-outlined">thumb_up</span> ' + (post.voteCount || 0) + '</span>' +
          '<span><span class="material-symbols-outlined">chat</span> ' + (post.commentCount || 0) + '</span>' +
          '<span><span class="material-symbols-outlined">calendar_month</span> ' + relativeTime(post.createdAt) + '</span>' +
          (post.board ? '<span class="post-board">' + esc(post.board.name || post.boardName) + '</span>' : '') +
        '</div>' +
      '</article>'
    );
  }

  function renderComments() {
    if (state.comments.length === 0) {
      renderEmptyState(el.commentsList, "You haven't left any comments yet");
      return;
    }

    el.commentsList.innerHTML = state.comments
      .map(function (comment) {
        var postTitle = comment.post?.title || comment.postTitle || "Post";
        return (
          '<article class="comment-card" data-post-id="' + esc(comment.postId) + '">' +
            '<div class="comment-card-header">' +
              '<span class="material-symbols-outlined">chat_bubble</span>' +
              '<span class="comment-post-title">' + esc(postTitle) + '</span>' +
              '<span class="comment-date">' + relativeTime(comment.createdAt) + '</span>' +
            '</div>' +
            '<div class="comment-body">' + esc(comment.body || comment.content) + '</div>' +
          '</article>'
        );
      })
      .join("");
  }

  function renderPostModal() {
    var post = state.selectedPost;
    if (!post) return;

    var statusClass = post.status || "open";

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
        (post.board ? 
          '<div class="modal-meta-item">' +
            '<span class="material-symbols-outlined">dashboard</span>' +
            '<span>' + esc(post.board.name || post.boardName) + '</span>' +
          '</div>' : '') +
      '</div>';
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
  // Tabs
  // =============================================

  function switchTab(tabName) {
    state.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.classList.toggle("active", tab.getAttribute("data-tab") === tabName);
    });

    // Update tab content
    document.querySelectorAll(".tab-content").forEach(function (content) {
      content.classList.toggle("active", content.id === "content-" + tabName);
    });
  }

  // =============================================
  // Event Handlers
  // =============================================

  function handleTabClick(e) {
    var tab = e.target.closest(".tab");
    if (!tab) return;
    
    var tabName = tab.getAttribute("data-tab");
    if (tabName) {
      switchTab(tabName);
    }
  }

  function handlePostClick(e) {
    var card = e.target.closest(".post-card, .comment-card");
    if (!card) return;
    
    var postId = card.getAttribute("data-post-id");
    if (postId) {
      loadPostDetail(postId);
    }
  }

  // =============================================
  // Initialize
  // =============================================

  function init() {
    // Event listeners
    document.querySelector(".tabs-container").addEventListener("click", handleTabClick);
    el.submissionsList.addEventListener("click", handlePostClick);
    el.votesList.addEventListener("click", handlePostClick);
    el.commentsList.addEventListener("click", handlePostClick);
    el.modalClose.addEventListener("click", closeModal);
    el.postModal.addEventListener("click", function (e) {
      if (e.target === el.postModal) closeModal();
    });

    // Keyboard
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });

    // Load data
    loadUserProfile()
      .then(function () {
        return Promise.all([
          loadSubmissions(),
          loadVotes(),
          loadComments()
        ]);
      });
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

