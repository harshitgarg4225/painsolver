(function painSolverPortalDemo() {
  var boards = [
    { id: "ad-reporting", name: "Ad Reporting and Attribution" },
    { id: "apis", name: "APIs" },
    { id: "app-marketplace", name: "App Marketplace" },
    { id: "voice-ai", name: "Voice AI" }
  ];

  var posts = [
    {
      id: "post-1",
      boardId: "ad-reporting",
      title: "Comments Bug, please sync comments of all planners.",
      details:
        "Currently, the platform only displays comments from posts published through the planner, but it does not show comments from posts scheduled directly in Meta. This is a serious issue.",
      status: "planned",
      votes: 297,
      mrr: 12400,
      capturedViaSupport: true,
      category: "Bug",
      createdAt: "2026-02-18T10:30:00.000Z",
      comments: [
        {
          author: "Wilberth Martinez",
          text: "We need to see comments regardless of where posts were scheduled.",
          createdAt: "2026-02-18T11:10:00.000Z"
        }
      ]
    },
    {
      id: "post-2",
      boardId: "apis",
      title: "Bulk Ticket Export API",
      details: "Add paginated JSON exports for support tickets and conversation metadata.",
      status: "in_progress",
      votes: 95,
      mrr: 9100,
      capturedViaSupport: true,
      category: "Feature",
      createdAt: "2026-02-16T08:20:00.000Z",
      comments: []
    },
    {
      id: "post-3",
      boardId: "voice-ai",
      title: "Conversation AI: Always-on interrupt routing",
      details: "Allow assistants to switch intent on interruption without losing context.",
      status: "planned",
      votes: 61,
      mrr: 7200,
      capturedViaSupport: false,
      category: "Feature",
      createdAt: "2026-02-15T12:05:00.000Z",
      comments: []
    },
    {
      id: "post-4",
      boardId: "app-marketplace",
      title: "Marketplace new app request flow",
      details: "Support public request forms and vote tracking per app provider.",
      status: "shipped",
      votes: 43,
      mrr: 4100,
      capturedViaSupport: false,
      category: "Feature",
      createdAt: "2026-02-13T14:00:00.000Z",
      comments: []
    },
    {
      id: "post-5",
      boardId: "ad-reporting",
      title: "Competitor analysis panel for social accounts",
      details: "Track competitor posting volume and engagement benchmarks in one view.",
      status: "planned",
      votes: 42,
      mrr: 5600,
      capturedViaSupport: true,
      category: "Feature",
      createdAt: "2026-02-12T14:00:00.000Z",
      comments: []
    }
  ];

  var changelog = [
    {
      id: "cl-1",
      title: "Documents & Contracts: Staff Selection in Templates",
      body: "Admins can now assign business-side signature fields to any staff member directly from templates.",
      date: "2026-02-18",
      tags: ["New", "Improved"]
    },
    {
      id: "cl-2",
      title: "Feedback list performance improvements",
      body: "Loaded feedback list virtualization for boards with over 5,000 posts.",
      date: "2026-02-12",
      tags: ["Improved"]
    },
    {
      id: "cl-3",
      title: "MRR-weighted roadmap sorting",
      body: "Roadmap now supports prioritization by attached MRR from implicit and explicit votes.",
      date: "2026-02-06",
      tags: ["New"]
    }
  ];

  var state = {
    activeTab: "feedback",
    selectedBoardId: boards[0].id,
    selectedPostId: posts[0].id,
    sortMode: "trending",
    feedbackSearch: "",
    changelogSearch: ""
  };

  var ui = {
    topNav: document.getElementById("top-nav"),
    tabFeedback: document.getElementById("tab-feedback"),
    tabRoadmap: document.getElementById("tab-roadmap"),
    tabChangelog: document.getElementById("tab-changelog"),
    boardList: document.getElementById("board-list"),
    composerTitle: document.getElementById("composer-title"),
    postTitleInput: document.getElementById("new-post-title"),
    postDetailsInput: document.getElementById("new-post-details"),
    createPostBtn: document.getElementById("create-post"),
    clearPostBtn: document.getElementById("clear-post"),
    sortMode: document.getElementById("sort-mode"),
    feedbackSearch: document.getElementById("search-feedback"),
    feedbackList: document.getElementById("feedback-list"),
    detailEmpty: document.getElementById("detail-empty"),
    detailView: document.getElementById("detail-view"),
    detailTitle: document.getElementById("detail-title"),
    detailMeta: document.getElementById("detail-meta"),
    detailBody: document.getElementById("detail-body"),
    detailStatus: document.getElementById("detail-status"),
    detailCategory: document.getElementById("detail-category"),
    commentList: document.getElementById("comment-list"),
    newComment: document.getElementById("new-comment"),
    addComment: document.getElementById("add-comment"),
    roadmapPlanned: document.getElementById("roadmap-planned"),
    roadmapProgress: document.getElementById("roadmap-progress"),
    roadmapShipped: document.getElementById("roadmap-shipped"),
    changelogSearch: document.getElementById("search-changelog"),
    changelogList: document.getElementById("changelog-list")
  };

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function getBoardById(boardId) {
    return boards.find(function (board) {
      return board.id === boardId;
    });
  }

  function getSelectedPost() {
    return posts.find(function (post) {
      return post.id === state.selectedPostId;
    }) || null;
  }

  function getBoardPostCount(boardId) {
    return posts.filter(function (post) {
      return post.boardId === boardId;
    }).length;
  }

  function getFeedbackPosts() {
    var list = posts.filter(function (post) {
      return post.boardId === state.selectedBoardId;
    });

    if (state.feedbackSearch.trim()) {
      var query = state.feedbackSearch.trim().toLowerCase();
      list = list.filter(function (post) {
        return (
          post.title.toLowerCase().includes(query) ||
          post.details.toLowerCase().includes(query) ||
          post.category.toLowerCase().includes(query)
        );
      });
    }

    if (state.sortMode === "newest") {
      list.sort(function (a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return list;
    }

    if (state.sortMode === "mrr") {
      list.sort(function (a, b) {
        return b.mrr - a.mrr;
      });
      return list;
    }

    list.sort(function (a, b) {
      if (b.votes !== a.votes) {
        return b.votes - a.votes;
      }
      return b.mrr - a.mrr;
    });

    return list;
  }

  function renderTabs() {
    Array.prototype.forEach.call(ui.topNav.querySelectorAll(".tab-btn"), function (btn) {
      var tab = btn.getAttribute("data-tab");
      btn.classList.toggle("is-active", tab === state.activeTab);
    });

    ui.tabFeedback.classList.toggle("is-active", state.activeTab === "feedback");
    ui.tabRoadmap.classList.toggle("is-active", state.activeTab === "roadmap");
    ui.tabChangelog.classList.toggle("is-active", state.activeTab === "changelog");
  }

  function renderBoards() {
    ui.boardList.innerHTML = boards
      .map(function (board) {
        var isActive = board.id === state.selectedBoardId;
        return (
          '<button class="board-btn ' + (isActive ? "is-active" : "") + '" data-board-id="' +
          esc(board.id) +
          '" type="button">' +
          '<span>' + esc(board.name) + '</span>' +
          '<span class="count-pill">' + esc(getBoardPostCount(board.id)) + '</span>' +
          '</button>'
        );
      })
      .join("");

    var board = getBoardById(state.selectedBoardId);
    ui.composerTitle.textContent = board ? board.name : "Feedback";
  }

  function renderFeedbackList() {
    var list = getFeedbackPosts();

    if (!list.length) {
      ui.feedbackList.innerHTML = '<div class="post-item"><p class="muted">No posts match this filter.</p></div>';
      return;
    }

    ui.feedbackList.innerHTML = list
      .map(function (post) {
        var isSelected = post.id === state.selectedPostId;

        return (
          '<article class="post-item ' + (isSelected ? "is-active" : "") + '" data-post-id="' + esc(post.id) + '">' +
          '<div>' +
          '<h3 class="post-title">' + esc(post.title) + '</h3>' +
          '<p class="post-desc">' + esc(post.details.slice(0, 130)) + '...</p>' +
          '<div class="post-meta">' +
          '<span>' + esc(post.category) + '</span>' +
          '<span>' + esc(formatCurrency(post.mrr)) + ' MRR</span>' +
          '<span>' + esc(formatDate(post.createdAt)) + '</span>' +
          (post.capturedViaSupport ? '<span class="support-badge">Captured via Support</span>' : '') +
          '</div>' +
          '</div>' +
          '<div class="vote-box">' +
          '<button class="vote-btn" data-vote-id="' + esc(post.id) + '" type="button">^</button>' +
          '<strong>' + esc(post.votes) + '</strong>' +
          '</div>' +
          '</article>'
        );
      })
      .join("");
  }

  function renderDetail() {
    var post = getSelectedPost();

    if (!post) {
      ui.detailEmpty.classList.remove("hidden");
      ui.detailView.classList.add("hidden");
      return;
    }

    ui.detailEmpty.classList.add("hidden");
    ui.detailView.classList.remove("hidden");

    ui.detailTitle.textContent = post.title;
    ui.detailMeta.textContent =
      post.category + " • " + post.votes + " votes • " + formatCurrency(post.mrr) + " attached MRR";
    ui.detailBody.textContent = post.details;
    ui.detailStatus.value = post.status;
    ui.detailCategory.value = post.category;

    ui.commentList.innerHTML = post.comments.length
      ? post.comments
          .map(function (comment) {
            return (
              '<article class="comment">' +
              '<div class="comment-author">' + esc(comment.author) + '</div>' +
              '<div class="muted">' + esc(formatDate(comment.createdAt)) + '</div>' +
              '<p>' + esc(comment.text) + '</p>' +
              '</article>'
            );
          })
          .join("")
      : '<p class="muted">No comments yet.</p>';
  }

  function renderRoadmap() {
    function template(post) {
      return (
        '<article class="roadmap-item">' +
        '<h3>' + esc(post.title) + '</h3>' +
        '<div class="muted">' + esc(post.category.toUpperCase()) + '</div>' +
        '<div class="muted">' + esc(post.votes) + ' votes • ' + esc(formatCurrency(post.mrr)) + '</div>' +
        '</article>'
      );
    }

    var planned = posts
      .filter(function (post) {
        return post.status === "planned";
      })
      .sort(function (a, b) {
        return b.votes - a.votes;
      });

    var progress = posts
      .filter(function (post) {
        return post.status === "in_progress";
      })
      .sort(function (a, b) {
        return b.votes - a.votes;
      });

    var shipped = posts
      .filter(function (post) {
        return post.status === "shipped";
      })
      .sort(function (a, b) {
        return b.votes - a.votes;
      });

    ui.roadmapPlanned.innerHTML = planned.length
      ? planned.map(template).join("")
      : '<p class="muted">No planned items.</p>';

    ui.roadmapProgress.innerHTML = progress.length
      ? progress.map(template).join("")
      : '<p class="muted">No in-progress items.</p>';

    ui.roadmapShipped.innerHTML = shipped.length
      ? shipped.map(template).join("")
      : '<p class="muted">No shipped items.</p>';
  }

  function renderChangelog() {
    var query = state.changelogSearch.trim().toLowerCase();
    var entries = changelog.filter(function (entry) {
      if (!query) {
        return true;
      }

      return (
        entry.title.toLowerCase().includes(query) ||
        entry.body.toLowerCase().includes(query) ||
        entry.tags.join(" ").toLowerCase().includes(query)
      );
    });

    ui.changelogList.innerHTML = entries.length
      ? entries
          .map(function (entry) {
            return (
              '<article class="log-item">' +
              '<div class="log-meta">' +
              '<strong>' + esc(formatDate(entry.date)) + '</strong>' +
              entry.tags
                .map(function (tag) {
                  return '<span class="log-tag">' + esc(tag) + '</span>';
                })
                .join("") +
              '</div>' +
              '<h2>' + esc(entry.title) + '</h2>' +
              '<p>' + esc(entry.body) + '</p>' +
              '</article>'
            );
          })
          .join("")
      : '<article class="log-item"><p class="muted">No changelog entries found.</p></article>';
  }

  function renderAll() {
    renderTabs();
    renderBoards();
    renderFeedbackList();
    renderDetail();
    renderRoadmap();
    renderChangelog();
  }

  function bindEvents() {
    ui.topNav.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(".tab-btn")) {
        return;
      }

      state.activeTab = target.getAttribute("data-tab") || "feedback";
      renderTabs();
    });

    ui.boardList.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var button = target.closest(".board-btn");
      if (!button) {
        return;
      }

      var boardId = button.getAttribute("data-board-id");
      if (!boardId) {
        return;
      }

      state.selectedBoardId = boardId;

      var firstInBoard = posts.find(function (post) {
        return post.boardId === boardId;
      });
      state.selectedPostId = firstInBoard ? firstInBoard.id : "";

      renderBoards();
      renderFeedbackList();
      renderDetail();
    });

    ui.sortMode.addEventListener("change", function () {
      state.sortMode = ui.sortMode.value;
      renderFeedbackList();
    });

    ui.feedbackSearch.addEventListener("input", function () {
      state.feedbackSearch = ui.feedbackSearch.value;
      renderFeedbackList();
    });

    ui.feedbackList.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var voteButton = target.closest(".vote-btn");
      if (voteButton) {
        var voteId = voteButton.getAttribute("data-vote-id");
        var postForVote = posts.find(function (post) {
          return post.id === voteId;
        });

        if (postForVote) {
          postForVote.votes += 1;
          renderFeedbackList();
          renderRoadmap();
          renderDetail();
        }

        return;
      }

      var postElement = target.closest(".post-item");
      if (!postElement) {
        return;
      }

      var postId = postElement.getAttribute("data-post-id");
      if (!postId) {
        return;
      }

      state.selectedPostId = postId;
      renderFeedbackList();
      renderDetail();
    });

    ui.createPostBtn.addEventListener("click", function () {
      var title = ui.postTitleInput.value.trim();
      var details = ui.postDetailsInput.value.trim();

      if (!title) {
        return;
      }

      var newPost = {
        id: "post-" + (posts.length + 1),
        boardId: state.selectedBoardId,
        title: title,
        details: details || "No details provided.",
        status: "planned",
        votes: 1,
        mrr: 0,
        capturedViaSupport: false,
        category: "Feature",
        createdAt: new Date().toISOString(),
        comments: []
      };

      posts.unshift(newPost);
      state.selectedPostId = newPost.id;

      ui.postTitleInput.value = "";
      ui.postDetailsInput.value = "";

      renderAll();
    });

    ui.clearPostBtn.addEventListener("click", function () {
      ui.postTitleInput.value = "";
      ui.postDetailsInput.value = "";
    });

    ui.detailStatus.addEventListener("change", function () {
      var post = getSelectedPost();
      if (!post) {
        return;
      }

      post.status = ui.detailStatus.value;
      renderFeedbackList();
      renderRoadmap();
    });

    ui.detailCategory.addEventListener("change", function () {
      var post = getSelectedPost();
      if (!post) {
        return;
      }

      post.category = ui.detailCategory.value.trim() || post.category;
      renderFeedbackList();
      renderRoadmap();
      renderDetail();
    });

    ui.addComment.addEventListener("click", function () {
      var post = getSelectedPost();
      if (!post) {
        return;
      }

      var text = ui.newComment.value.trim();
      if (!text) {
        return;
      }

      post.comments.unshift({
        author: "Support Team",
        text: text,
        createdAt: new Date().toISOString()
      });

      ui.newComment.value = "";
      renderDetail();
    });

    ui.changelogSearch.addEventListener("input", function () {
      state.changelogSearch = ui.changelogSearch.value;
      renderChangelog();
    });
  }

  bindEvents();
  renderAll();
})();
