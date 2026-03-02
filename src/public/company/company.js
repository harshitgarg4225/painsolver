(function companyApp(window, document) {
  var state = {
    tab: "feedback",
    view: "all",
    boardId: "",
    roadmapBoardId: "",
    roadmapQuery: "",
    roadmapCounts: {
      planned: 0,
      in_progress: 0,
      complete: 0,
      total: 0
    },
    sort: "trending",
    filter: "all",
    query: "",
    changelogQuery: "",
    changelogBoardId: "all",
    changelogStatus: "all",
    changelogTag: "",
    changelogEntries: [],
    selectedChangelogId: "",
    roadmap: {
      planned: [],
      in_progress: [],
      complete: []
    },
    accessRequests: [],
    triageEvents: [],
    aiInboxTab: "incoming",
    triageConfig: [],
    freshdeskConnection: {
      connected: false,
      domain: null,
      hasApiKey: false,
      filterField: null,
      filterValue: null,
      lastFieldSyncAt: null,
      lastTicketSyncAt: null
    },
    freshdeskParams: [],
    zoomConnection: {
      connected: false,
      zoomUserEmail: null,
      zoomUserId: null,
      zoomAccountId: null,
      expiresAt: null,
      connectedAt: null,
      lastSyncedAt: null
    },
    slackConnection: {
      connected: false,
      teamId: null,
      teamName: null,
      userId: null,
      userName: null,
      channelCount: 0,
      channelNames: [],
      connectedAt: null,
      lastSyncedAt: null
    },
    slackChannels: [],
    triageStatus: "needs_triage",
    triageSource: "all",
    triageQuery: "",
    triageMinMrr: 0,
    triageSummary: {
      needsTriage: 0,
      merged: 0,
      total: 0
    },
    filterSupportOnly: false,
    filterCommentsOnly: false,
    filterMinMrr: 0,
    filterOwner: "",
    boards: [],
    boardSettings: [],
    members: [],
    posts: [],
    customSavedFilters: [],
    selectedPostIds: [],
    mergedSources: [],
    voterInsightsByPostId: {},
    customerRelationships: [],
    customerRelationshipSummary: {
      totalCustomers: 0,
      totalLinkedIdeas: 0,
      totalCustomerMrr: 0
    },
    customerViewQuery: "",
    customerViewBoardId: "all",
    customerViewMinMrr: 0,
    opportunities: [],
    selectedPostId: "",
    summary: {
      boardCount: 0,
      postCount: 0,
      triageCount: 0,
      totalAttachedMrr: 0
    },
    reportingPosts: [],
    commentReplyTarget: null,
    changelogPreview: false,
    loading: {
      feedback: false,
      roadmap: false,
      accessRequests: false,
      boardSettings: false,
      members: false,
      changelog: false,
      triage: false,
      freshdesk: false,
      zoom: false,
      slack: false,
      voterInsights: false,
      customers: false,
      reporting: false
    },
    errors: {
      feedback: "",
      roadmap: "",
      accessRequests: "",
      boardSettings: "",
      members: "",
      changelog: "",
      triage: "",
      freshdesk: "",
      zoom: "",
      slack: "",
      voterInsights: "",
      customers: "",
      reportingSummary: "",
      reportingPosts: "",
      reportingOpportunities: ""
    }
  };

  var el = {
    nav: document.getElementById("company-nav"),
    openComposer: document.getElementById("open-composer"),
    pages: {
      feedback: document.getElementById("company-feedback"),
      roadmap: document.getElementById("company-roadmap"),
      access: document.getElementById("company-access"),
      changelog: document.getElementById("company-changelog"),
      autopilot: document.getElementById("company-autopilot"),
      reporting: document.getElementById("company-reporting")
    },
    savedViews: document.getElementById("saved-views"),
    customSavedFilters: document.getElementById("custom-saved-filters"),
    deckMetrics: document.getElementById("deck-metrics"),
    boardList: document.getElementById("company-board-list"),
    toggleCreateBoard: document.getElementById("toggle-create-board"),
    createBoardForm: document.getElementById("create-board-form"),
    newBoardName: document.getElementById("new-board-name"),
    newBoardVisibility: document.getElementById("new-board-visibility"),
    newBoardSegments: document.getElementById("new-board-segments"),
    createBoardSubmit: document.getElementById("create-board-submit"),
    createBoardCancel: document.getElementById("create-board-cancel"),
    streamCount: document.getElementById("stream-count"),
    composer: document.getElementById("stream-composer"),
    newTitle: document.getElementById("company-new-title"),
    newDetails: document.getElementById("company-new-details"),
    composerBoardPill: document.getElementById("composer-board-pill"),
    clearPost: document.getElementById("company-clear-post"),
    createPost: document.getElementById("company-create-post"),
    feedbackSearch: document.getElementById("company-feedback-search"),
    feedbackFilter: document.getElementById("company-feedback-filter"),
    feedbackSort: document.getElementById("company-feedback-sort"),
    filterSupportOnly: document.getElementById("filter-support-only"),
    filterCommentsOnly: document.getElementById("filter-comments-only"),
    filterMinMrr: document.getElementById("filter-min-mrr"),
    filterOwner: document.getElementById("filter-owner"),
    clearFilters: document.getElementById("clear-filters"),
    saveCurrentFilter: document.getElementById("save-current-filter"),
    bulkActions: document.getElementById("bulk-actions"),
    bulkCount: document.getElementById("bulk-count"),
    bulkStatus: document.getElementById("bulk-status"),
    bulkOwner: document.getElementById("bulk-owner"),
    bulkAddTags: document.getElementById("bulk-add-tags"),
    bulkRemoveTags: document.getElementById("bulk-remove-tags"),
    bulkApply: document.getElementById("bulk-apply"),
    bulkClear: document.getElementById("bulk-clear"),
    feedbackList: document.getElementById("company-feedback-list"),
    detailEmpty: document.getElementById("detail-empty"),
    detailView: document.getElementById("detail-view"),
    detailTitle: document.getElementById("detail-title"),
    detailCopy: document.getElementById("detail-copy"),
    detailStatus: document.getElementById("detail-status"),
    detailOwner: document.getElementById("detail-owner"),
    detailEta: document.getElementById("detail-eta"),
    detailTags: document.getElementById("detail-tags"),
    saveStatus: document.getElementById("save-status"),
    mergeTargetPost: document.getElementById("merge-target-post"),
    mergePost: document.getElementById("merge-post"),
    mergedSources: document.getElementById("merged-sources"),
    detailVoterSummary: document.getElementById("detail-voter-summary"),
    detailVoterList: document.getElementById("detail-voter-list"),
    detailComments: document.getElementById("detail-comments"),
    commentReplyContext: document.getElementById("comment-reply-context"),
    newComment: document.getElementById("new-comment"),
    addComment: document.getElementById("add-comment"),
    roadmapBoardFilter: document.getElementById("roadmap-board-filter"),
    roadmapSearch: document.getElementById("roadmap-search"),
    roadmapContext: document.getElementById("roadmap-context"),
    roadmapCountPlanned: document.getElementById("roadmap-count-planned"),
    roadmapCountProgress: document.getElementById("roadmap-count-progress"),
    roadmapCountComplete: document.getElementById("roadmap-count-complete"),
    roadmapCountTotal: document.getElementById("roadmap-count-total"),
    roadmapPlanned: document.getElementById("company-roadmap-planned"),
    roadmapProgress: document.getElementById("company-roadmap-progress"),
    roadmapComplete: document.getElementById("company-roadmap-complete"),
    accessRequestList: document.getElementById("access-request-list"),
    boardSettingsList: document.getElementById("board-settings-list"),
    companyMemberList: document.getElementById("company-member-list"),
    chBoard: document.getElementById("ch-board"),
    chTitle: document.getElementById("ch-title"),
    chTags: document.getElementById("ch-tags"),
    chEditingId: document.getElementById("ch-editing-id"),
    chContentEditor: document.getElementById("ch-content-editor"),
    chImageUpload: document.getElementById("ch-image-upload"),
    chVideoUpload: document.getElementById("ch-video-upload"),
    rtePreview: document.getElementById("rte-preview"),
    rteToolbar: document.getElementById("rte-toolbar"),
    chClear: document.getElementById("ch-clear"),
    chSaveDraft: document.getElementById("ch-save-draft"),
    chCreate: document.getElementById("ch-create"),
    changelogQuery: document.getElementById("changelog-query"),
    changelogBoardFilter: document.getElementById("changelog-board-filter"),
    changelogStatusFilter: document.getElementById("changelog-status-filter"),
    changelogTagFilter: document.getElementById("changelog-tag-filter"),
    changelogRefresh: document.getElementById("changelog-refresh"),
    changelogList: document.getElementById("company-changelog-list"),
    changelogPreviewPanel: document.getElementById("changelog-preview-panel"),
    chPreviewTags: document.getElementById("ch-preview-tags"),
    chPreviewTitle: document.getElementById("ch-preview-title"),
    chPreviewMeta: document.getElementById("ch-preview-meta"),
    chPreviewBody: document.getElementById("ch-preview-body"),
    chEditEntry: document.getElementById("ch-edit-entry"),
    aiInboxTabs: document.getElementById("ai-inbox-tabs"),
    aiInboxIncoming: document.getElementById("ai-inbox-incoming"),
    aiInboxConfiguration: document.getElementById("ai-inbox-configuration"),
    triageSummaryNeeds: document.getElementById("triage-summary-needs"),
    triageSummaryMerged: document.getElementById("triage-summary-merged"),
    triageSummaryTotal: document.getElementById("triage-summary-total"),
    triageStatusFilter: document.getElementById("triage-status-filter"),
    triageSourceFilter: document.getElementById("triage-source-filter"),
    triageSearch: document.getElementById("triage-search"),
    triageMinMrr: document.getElementById("triage-min-mrr"),
    triageRefresh: document.getElementById("triage-refresh"),
    triageList: document.getElementById("triage-list"),
    triageConfigList: document.getElementById("triage-config-list"),
    metrics: document.getElementById("metrics"),
    reportingTopPosts: document.getElementById("reporting-top-posts"),
    opportunitiesList: document.getElementById("opportunities-list"),
    customerViewQuery: document.getElementById("customer-view-query"),
    customerViewBoard: document.getElementById("customer-view-board"),
    customerViewMinMrr: document.getElementById("customer-view-min-mrr"),
    customerViewRefresh: document.getElementById("customer-view-refresh"),
    customerViewSummary: document.getElementById("customer-view-summary"),
    customerViewList: document.getElementById("customer-view-list"),
    exportPostsCsv: document.getElementById("export-posts-csv"),
    exportCommentsCsv: document.getElementById("export-comments-csv")
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
    var desc = description ? "<p>" + esc(description) + "</p>" : "";
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

  function currency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  function escapeCsvField(value) {
    if (value === null || value === undefined) {
      return "";
    }
    var str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function exportVotersToCsv(postId) {
    var insights = state.voterInsightsByPostId[postId];
    if (!insights || !insights.voters || !insights.voters.length) {
      pushToast("error", "No voter data to export.");
      return;
    }

    var ideaTitle = insights.canonicalPostTitle || "Idea";
    var headers = [
      "Name",
      "Email",
      "Company",
      "MRR",
      "Joined Date",
      "Vote Type",
      "Other Upvoted Ideas Count",
      "Other Upvoted Ideas"
    ];

    var rows = insights.voters.map(function (voter) {
      var otherIdeasList = (voter.otherUpvotedIdeas || [])
        .map(function (idea) {
          return (idea.title || "Untitled") + " (" + (idea.boardName || "Unknown") + ")";
        })
        .join("; ");

      return [
        escapeCsvField(voter.userName || "Unknown"),
        escapeCsvField(voter.userEmail || ""),
        escapeCsvField(voter.companyName || "Unknown"),
        voter.companyMrr || 0,
        voter.userCreatedAt ? new Date(voter.userCreatedAt).toLocaleDateString() : "",
        (voter.voteTypesInIdea || []).join(", "),
        (voter.otherUpvotedIdeas || []).length,
        escapeCsvField(otherIdeasList)
      ].join(",");
    });

    var csvContent = headers.join(",") + "\n" + rows.join("\n");
    var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    var filename = "voters-" + ideaTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    pushToast("success", "Exported " + insights.voters.length + " voters to CSV.");
  }

  function shortDate(value) {
    if (!value) {
      return "";
    }

    var dt = new Date(value);
    if (Number.isNaN(dt.getTime())) {
      return "";
    }

    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  }

  function fullDate(value) {
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

  function sanitizeHtml(raw) {
    var value = String(raw || "");
    value = value.replace(/<script[\s\S]*?<\/script>/gi, "");
    value = value.replace(/\son[a-z]+="[^"]*"/gi, "");
    value = value.replace(/\son[a-z]+='[^']*'/gi, "");
    value = value.replace(/javascript:/gi, "");
    return value;
  }

  function isHttpUrl(value) {
    try {
      var url = new URL(String(value || "").trim());
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_error) {
      return false;
    }
  }

  function youtubeEmbedUrl(rawUrl) {
    var value = String(rawUrl || "").trim();
    var watchMatch = value.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    if (watchMatch) {
      return "https://www.youtube.com/embed/" + watchMatch[1];
    }

    var shortMatch = value.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
    if (shortMatch) {
      return "https://www.youtube.com/embed/" + shortMatch[1];
    }

    var embedMatch = value.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
    if (embedMatch) {
      return "https://www.youtube.com/embed/" + embedMatch[1];
    }

    return "";
  }

  function vimeoEmbedUrl(rawUrl) {
    var match = String(rawUrl || "").trim().match(/vimeo\.com\/(\d+)/);
    return match ? "https://player.vimeo.com/video/" + match[1] : "";
  }

  function videoEmbedHtml(url) {
    var youtube = youtubeEmbedUrl(url);
    if (youtube) {
      return (
        '<figure class="rte-media">' +
        '<iframe src="' +
        esc(youtube) +
        '" title="Embedded video" loading="lazy" allowfullscreen></iframe>' +
        '<figcaption>YouTube video</figcaption>' +
        "</figure>"
      );
    }

    var vimeo = vimeoEmbedUrl(url);
    if (vimeo) {
      return (
        '<figure class="rte-media">' +
        '<iframe src="' +
        esc(vimeo) +
        '" title="Embedded video" loading="lazy" allowfullscreen></iframe>' +
        '<figcaption>Vimeo video</figcaption>' +
        "</figure>"
      );
    }

    return (
      '<figure class="rte-media">' +
      '<video controls src="' +
      esc(url) +
      '"></video>' +
      '<figcaption>Attached video</figcaption>' +
      "</figure>"
    );
  }

  function insertHtmlIntoEditor(html) {
    el.chContentEditor.focus();
    document.execCommand("insertHTML", false, html);
    if (state.changelogPreview) {
      el.rtePreview.innerHTML = sanitizeHtml(el.chContentEditor.innerHTML);
    }
  }

  function insertImageByUrl(url) {
    insertHtmlIntoEditor(
      '<figure class="rte-media">' +
      '<img src="' +
      esc(url) +
      '" alt="Changelog image" loading="lazy" />' +
      '<figcaption>Image</figcaption>' +
      "</figure>"
    );
  }

  function insertVideoByUrl(url) {
    insertHtmlIntoEditor(videoEmbedHtml(url));
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Failed to read file."));
      };
      reader.readAsDataURL(file);
    });
  }

  function uploadMediaFile(file, kind) {
    return readFileAsDataUrl(file).then(function (dataUrl) {
      return request("/api/company/media/upload", {
        method: "POST",
        body: {
          fileName: file.name,
          fileType: file.type,
          fileData: dataUrl,
          kind: kind
        }
      });
    });
  }

  function getEditorHtml() {
    return sanitizeHtml(el.chContentEditor.innerHTML);
  }

  function renderCommentReplyContext() {
    if (!el.commentReplyContext) {
      return;
    }

    if (!state.commentReplyTarget) {
      el.commentReplyContext.classList.add("hidden");
      el.commentReplyContext.innerHTML = "";
      return;
    }

    el.commentReplyContext.classList.remove("hidden");
    el.commentReplyContext.innerHTML =
      '<span>Replying to ' +
      esc(state.commentReplyTarget.authorName || "comment") +
      '</span>' +
      '<button class="ghost small" data-clear-comment-reply="true" type="button">Clear</button>';
  }

  function setChangelogPreviewState(enabled) {
    state.changelogPreview = enabled;

    if (state.changelogPreview) {
      el.chContentEditor.classList.add("hidden");
      el.rtePreview.classList.remove("hidden");
      el.rtePreview.innerHTML = sanitizeHtml(el.chContentEditor.innerHTML);
      return;
    }

    el.rtePreview.classList.add("hidden");
    el.rtePreview.innerHTML = "";
    el.chContentEditor.classList.remove("hidden");
  }

  function resetChangelogComposer() {
    if (el.chEditingId) {
      el.chEditingId.value = "";
    }
    el.chTitle.value = "";
    el.chTags.value = "";
    el.chContentEditor.innerHTML = "";
    if (state.boardId) {
      el.chBoard.value = state.boardId;
    }
    state.selectedChangelogId = "";
    setChangelogPreviewState(false);
  }

  function applyChangelogEntryToComposer(entry) {
    if (!entry) {
      return;
    }

    if (el.chEditingId) {
      el.chEditingId.value = entry.id;
    }
    if (entry.boardId) {
      el.chBoard.value = entry.boardId;
    }
    el.chTitle.value = entry.title || "";
    el.chTags.value = (entry.tags || []).join(", ");
    el.chContentEditor.innerHTML = sanitizeHtml(entry.content || "");
    setChangelogPreviewState(false);
    el.chTitle.focus();
  }

  function headers() {
    return {
      "Content-Type": "application/json",
      "x-painsolver-role": "member",
      "x-painsolver-auth": "true",
      "x-painsolver-user-id": "company-member",
      "x-painsolver-email": "member@painsolver.io"
    };
  }

  function request(path, options) {
    return fetch(path, {
      method: (options && options.method) || "GET",
      headers: headers(),
      body: options && options.body ? JSON.stringify(options.body) : undefined
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (text) {
          var message = text || "Request failed";
          if (text) {
            try {
              var parsed = JSON.parse(text);
              if (parsed && typeof parsed.error === "string" && parsed.error.trim()) {
                message = parsed.error;
              }
            } catch (_error) {
              message = text;
            }
          }
          throw new Error(message);
        });
      }

      return response.json();
    });
  }

  function getSelectedPost() {
    return state.posts.find(function (post) {
      return post.id === state.selectedPostId;
    }) || null;
  }

  function applySavedView(posts) {
    if (state.view === "high_mrr") {
      return posts.filter(function (post) {
        return post.attachedMrr >= 5000;
      });
    }

    if (state.view === "needs_attention") {
      return posts.filter(function (post) {
        return post.status === "under_review" || post.capturedViaSupport;
      });
    }

    if (state.view === "my_posts") {
      return posts.filter(function (post) {
        return post.ownerName === "Aarav (You)";
      });
    }

    return posts;
  }

  function renderTabs() {
    Array.prototype.forEach.call(el.nav.querySelectorAll(".nav-item"), function (button) {
      var tab = button.getAttribute("data-tab");
      button.classList.toggle("is-active", tab === state.tab);
    });

    Object.keys(el.pages).forEach(function (key) {
      el.pages[key].classList.toggle("is-active", state.tab === key);
    });
  }

  function renderSavedViews() {
    Array.prototype.forEach.call(el.savedViews.querySelectorAll(".saved-view"), function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-view") === state.view);
    });
  }

  function renderCustomSavedFilters() {
    if (!el.customSavedFilters) {
      return;
    }

    if (!state.customSavedFilters.length) {
      el.customSavedFilters.innerHTML = "";
      return;
    }

    el.customSavedFilters.innerHTML = state.customSavedFilters
      .map(function (saved) {
        return (
          '<article class="saved-filter-chip">' +
          '<button class="ghost small" data-saved-filter-id="' +
          esc(saved.id) +
          '" type="button">' +
          esc(saved.name) +
          "</button>" +
          '<button class="ghost small" data-delete-saved-filter-id="' +
          esc(saved.id) +
          '" type="button">x</button>' +
          "</article>"
        );
      })
      .join("");
  }

  function renderBulkActions() {
    var count = state.selectedPostIds.length;
    el.bulkCount.textContent = count + " selected";
    el.bulkActions.classList.toggle("hidden", count === 0);
  }

  function csvToList(value) {
    return String(value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function reportingError() {
    return (
      state.errors.reportingSummary ||
      state.errors.reportingPosts ||
      state.errors.reportingOpportunities ||
      ""
    );
  }

  function renderDeckMetrics() {
    el.deckMetrics.innerHTML = [
      ["Boards", state.summary.boardCount],
      ["Posts", state.summary.postCount],
      ["AI Inbox", state.summary.triageCount],
      ["Attached MRR", currency(state.summary.totalAttachedMrr)]
    ]
      .map(function (item) {
        return (
          '<article class="deck-metric">' +
          '<h4>' + esc(item[0]) + '</h4>' +
          '<strong>' + esc(item[1]) + '</strong>' +
          '</article>'
        );
      })
      .join("");
  }

  function renderBoards() {
    el.boardList.innerHTML = state.boards
      .map(function (board) {
        var selected = board.id === state.boardId;
        return (
          '<button class="board-item ' + (selected ? "is-active" : "") + '" data-board-id="' +
          esc(board.id) +
          '" type="button">' +
          '<span>' + esc(board.name) + '</span>' +
          '<span class="pill">' + esc(board.postCount || 0) + '</span>' +
          '</button>'
        );
      })
      .join("");

    var boardOptions = state.boards
      .map(function (board) {
        return '<option value="' + esc(board.id) + '">' + esc(board.name) + '</option>';
      })
      .join("");

    el.chBoard.innerHTML = boardOptions;
    el.roadmapBoardFilter.innerHTML = '<option value="all">All boards</option>' + boardOptions;
    el.changelogBoardFilter.innerHTML = '<option value="all">All boards</option>' + boardOptions;
    if (el.customerViewBoard) {
      el.customerViewBoard.innerHTML = '<option value="all">All boards</option>' + boardOptions;
    }

    if (state.boardId) {
      el.chBoard.value = state.boardId;
    }

    if (state.roadmapBoardId) {
      el.roadmapBoardFilter.value = state.roadmapBoardId;
    } else if (state.boardId) {
      el.roadmapBoardFilter.value = state.boardId;
    }

    if (state.changelogBoardId) {
      el.changelogBoardFilter.value = state.changelogBoardId;
    }

    if (el.customerViewBoard) {
      el.customerViewBoard.value = state.customerViewBoardId || "all";
    }

    renderRoadmapContext();
    renderComposerContext();
  }

  function renderRoadmapContext() {
    if (!el.roadmapContext) {
      return;
    }

    if (state.roadmapBoardId === "all") {
      el.roadmapContext.textContent = "Roadmap showing all boards.";
      return;
    }

    if (state.roadmapBoardId && state.roadmapBoardId !== "all") {
      var roadmapBoard = state.boards.find(function (board) {
        return board.id === state.roadmapBoardId;
      });
      el.roadmapContext.textContent = roadmapBoard
        ? "Roadmap synced to board: " + roadmapBoard.name
        : "Roadmap synced to selected board.";
      return;
    }

    if (state.boardId) {
      var selectedBoard = state.boards.find(function (board) {
        return board.id === state.boardId;
      });
      el.roadmapContext.textContent = selectedBoard
        ? "Roadmap synced to board: " + selectedBoard.name
        : "Roadmap synced to selected board.";
      return;
    }

    el.roadmapContext.textContent = "Roadmap is synced with feedback board selection.";
  }

  function renderComposerContext() {
    if (!el.composerBoardPill) {
      return;
    }

    var board = state.boards.find(function (item) {
      return item.id === state.boardId;
    });
    el.composerBoardPill.textContent = board ? "Board: " + board.name : "Board: -";
  }

  function renderCreateBoardSegments() {
    if (!el.newBoardVisibility || !el.newBoardSegments) {
      return;
    }

    var isCustom = el.newBoardVisibility.value === "custom";
    el.newBoardSegments.classList.toggle("hidden", !isCustom);
    if (!isCustom) {
      el.newBoardSegments.value = "";
    }
  }

  function resetCreateBoardForm() {
    if (!el.createBoardForm || !el.newBoardName || !el.newBoardVisibility || !el.newBoardSegments) {
      return;
    }

    el.newBoardName.value = "";
    el.newBoardVisibility.value = "public";
    el.newBoardSegments.value = "";
    el.createBoardForm.classList.add("hidden");
    renderCreateBoardSegments();
  }

  function setCreateBoardFormOpen(open) {
    if (!el.createBoardForm) {
      return;
    }

    el.createBoardForm.classList.toggle("hidden", !open);
    renderCreateBoardSegments();
    if (open && el.newBoardName) {
      el.newBoardName.focus();
    }
  }

  function renderOwnerFilter() {
    var selected = state.filterOwner || "";
    var bulkSelected = el.bulkOwner.value || "";
    var options = ['<option value="">Any owner</option>'].concat(
      state.members.map(function (member) {
        return '<option value="' + esc(member.name) + '">' + esc(member.name) + '</option>';
      })
    );

    el.filterOwner.innerHTML = options.join("");
    el.filterOwner.value = selected;

    el.bulkOwner.innerHTML = ['<option value="">Owner (no change)</option>']
      .concat(
        state.members.map(function (member) {
          return '<option value="' + esc(member.name) + '">' + esc(member.name) + '</option>';
        })
      )
      .join("");
    el.bulkOwner.value = bulkSelected;
  }

  function renderMemberDirectory() {
    if (!el.companyMemberList) {
      return;
    }

    if (state.loading.members) {
      el.companyMemberList.innerHTML = renderStateCard("loading", "Loading teammates", "Fetching workspace members.");
      return;
    }

    if (state.errors.members) {
      el.companyMemberList.innerHTML = renderStateCard("error", state.errors.members, "Please retry in a moment.");
      return;
    }

    el.companyMemberList.innerHTML = state.members.length
      ? state.members
          .map(function (member) {
            return (
              '<article class="request-item">' +
              '<strong>' +
              esc(member.name) +
              '</strong>' +
              '<p class="muted">' +
              esc(member.email) +
              " • " +
              esc(member.role) +
              "</p>" +
              "</article>"
            );
          })
          .join("")
      : '<article class="request-item"><p>No teammates found.</p></article>';
  }

  function statusLabel(value) {
    return (value || "").replace(/_/g, " ");
  }

  function applyAdvancedFilters(posts) {
    return posts.filter(function (post) {
      if (state.filterSupportOnly && !post.capturedViaSupport) {
        return false;
      }

      if (state.filterCommentsOnly && !(post.commentCount > 0)) {
        return false;
      }

      if (state.filterMinMrr > 0 && Number(post.attachedMrr || 0) < state.filterMinMrr) {
        return false;
      }

      if (state.filterOwner && post.ownerName !== state.filterOwner) {
        return false;
      }

      return true;
    });
  }

  function renderFeedbackList() {
    if (state.loading.feedback) {
      el.streamCount.textContent = "Loading requests...";
      el.feedbackList.innerHTML = [
        renderStateCard("loading", "Loading feedback stream", "Fetching posts and conversation context."),
        renderStateCard("loading", "Loading feedback stream", ""),
        renderStateCard("loading", "Loading feedback stream", "")
      ].join("");
      return;
    }

    if (state.errors.feedback) {
      el.streamCount.textContent = "0 requests";
      el.feedbackList.innerHTML = renderStateCard("error", state.errors.feedback, "Check your board, filters, or connection.");
      return;
    }

    var list = applySavedView(state.posts);
    list = applyAdvancedFilters(list);
    var visibleIds = list.map(function (post) { return post.id; });

    state.selectedPostIds = state.selectedPostIds.filter(function (id) {
      return visibleIds.indexOf(id) !== -1;
    });

    if (state.selectedPostId && !list.some(function (post) { return post.id === state.selectedPostId; })) {
      state.selectedPostId = list[0] ? list[0].id : "";
    }

    if (!state.selectedPostId && list.length) {
      state.selectedPostId = list[0].id;
    }

    el.streamCount.textContent = list.length + " requests";
    renderBulkActions();

    if (!list.length) {
      el.feedbackList.innerHTML = renderStateCard("empty", "No feedback found", "Try a different filter, board, or search query.");
      return;
    }

    el.feedbackList.innerHTML = list
      .map(function (post) {
        var isActive = post.id === state.selectedPostId;
        var isSelected = state.selectedPostIds.indexOf(post.id) !== -1;
        var tags = Array.isArray(post.tags) ? post.tags : [];
        var mergedCount = Array.isArray(post.mergedSourcePostIds) ? post.mergedSourcePostIds.length : 0;

        return (
          '<article class="feedback-card ' + (isActive ? "is-active" : "") + '" data-post-id="' + esc(post.id) + '">' +
          '<div class="feedback-card-head">' +
          '<label class="select-post">' +
          '<input class="post-select" data-select-post-id="' + esc(post.id) + '" type="checkbox" ' + (isSelected ? "checked" : "") + " />" +
          "</label>" +
          '<h4>' + esc(post.title) + '</h4>' +
          '<span class="status-pill status-' + esc(post.status) + '">' + esc(statusLabel(post.status)) + '</span>' +
          '</div>' +
          '<p>' + esc(post.details) + '</p>' +
          '<div class="meta-row">' +
          '<span>' + esc(post.voteCount) + ' votes</span>' +
          '<span>' + esc(post.commentCount) + ' comments</span>' +
          '<span>' + esc(currency(post.attachedMrr)) + ' MRR</span>' +
          '<span>Owner: ' + esc(post.ownerName || "Unassigned") + '</span>' +
          '<span>ETA: ' + esc(shortDate(post.eta) || "TBD") + '</span>' +
          (post.capturedViaSupport ? '<span class="support-pill">Captured via Support</span>' : "") +
          (mergedCount ? '<span class="tag-pill">Merged ' + esc(mergedCount) + "</span>" : "") +
          '</div>' +
          '<div class="tag-row">' +
          tags.map(function (tag) {
            return '<span class="tag-pill">' + esc(tag) + '</span>';
          }).join("") +
          '</div>' +
          '</article>'
        );
      })
      .join("");
  }

  function renderDetail() {
    var post = getSelectedPost();

    if (!post) {
      if (state.loading.feedback) {
        el.detailEmpty.textContent = "Loading request details...";
      } else if (state.errors.feedback) {
        el.detailEmpty.textContent = "Unable to load request details right now.";
      } else {
        el.detailEmpty.textContent = "Select a request to inspect context, ownership, and thread.";
      }
      el.detailEmpty.classList.remove("hidden");
      el.detailView.classList.add("hidden");
      el.mergeTargetPost.innerHTML = '<option value="">Merge this post into...</option>';
      el.mergedSources.innerHTML = renderStateCard("empty", "No merged posts", "Merged sources will appear after a merge action.");
      if (el.detailVoterSummary) {
        el.detailVoterSummary.innerHTML = "";
      }
      if (el.detailVoterList) {
        el.detailVoterList.innerHTML = renderStateCard(
          "empty",
          "No customer signal selected",
          "Select an idea to inspect voters, MRR, and their other upvotes."
        );
      }
      return;
    }

    el.detailEmpty.classList.add("hidden");
    el.detailView.classList.remove("hidden");

    el.detailTitle.textContent = post.title;
    el.detailCopy.textContent = post.details;

    el.detailOwner.innerHTML = state.members
      .map(function (member) {
        return '<option value="' + esc(member.name) + '">' + esc(member.name) + '</option>';
      })
      .join("");

    if (!state.members.some(function (member) { return member.name === post.ownerName; })) {
      el.detailOwner.innerHTML += '<option value="Unassigned">Unassigned</option>';
    }

    el.detailStatus.value = post.status;
    el.detailOwner.value = post.ownerName || "Unassigned";
    el.detailEta.value = post.eta || "";
    el.detailTags.value = Array.isArray(post.tags) ? post.tags.join(", ") : "";

    el.mergeTargetPost.innerHTML =
      '<option value="">Merge this post into...</option>' +
      state.posts
        .filter(function (candidate) {
          return candidate.id !== post.id && candidate.boardId === post.boardId;
        })
        .map(function (candidate) {
          return '<option value="' + esc(candidate.id) + '">' + esc(candidate.title) + "</option>";
        })
        .join("");

    el.mergedSources.innerHTML = state.mergedSources.length
      ? state.mergedSources
          .map(function (merged) {
            return (
              '<article class="merged-source">' +
              '<strong>' + esc(merged.title) + "</strong>" +
              '<p class="muted">' + esc(merged.voteCount) + " votes • " + esc(currency(merged.attachedMrr)) + " MRR</p>" +
              '<button class="ghost small" data-unmerge-source-id="' + esc(merged.id) + '" type="button">Unmerge</button>' +
              "</article>"
            );
          })
          .join("")
      : renderStateCard("empty", "No merged posts", "Merged sources will appear after a merge action.");

    renderVoterInsights(post.id);

    if (
      state.commentReplyTarget &&
      !post.comments.some(function (comment) {
        return comment.id === state.commentReplyTarget.commentId;
      })
    ) {
      state.commentReplyTarget = null;
    }

    el.detailComments.innerHTML = post.comments.length
      ? post.comments
          .map(function (comment) {
            var replyToHtml = comment.replyToAuthorName
              ? '<p class="reply-to">Replying to ' + esc(comment.replyToAuthorName) + '</p>'
              : "";

            return (
              '<article class="comment">' +
              '<div class="comment-head">' +
              '<strong>' + esc(comment.authorName) + '</strong>' +
              '<span>' + esc(fullDate(comment.createdAt)) + '</span>' +
              '</div>' +
              replyToHtml +
              '<p>' + esc(comment.body) + '</p>' +
              '<button class="ghost small reply-btn" data-reply-comment-id="' +
              esc(comment.id) +
              '" data-reply-author="' +
              esc(comment.authorName) +
              '" type="button">Reply</button>' +
              '</article>'
            );
          })
          .join("")
      : renderStateCard("empty", "No conversation yet", "Add a comment to start collaboration.");

    renderCommentReplyContext();
  }

  function voterBadge(type) {
    return type === "explicit" ? "Explicit vote" : "Captured via support";
  }

  function renderVoterInsights(postId) {
    if (!el.detailVoterList || !el.detailVoterSummary) {
      return;
    }

    var insights = state.voterInsightsByPostId[postId] || null;
    var isLoading = state.loading.voterInsights;
    var hasError = state.errors.voterInsights;

    if (isLoading && !insights) {
      el.detailVoterSummary.innerHTML = "";
      el.detailVoterList.innerHTML = renderStateCard(
        "loading",
        "Loading voter signals",
        "Collecting voters, customer MRR, and cross-voted ideas."
      );
      return;
    }

    if (hasError && !insights) {
      el.detailVoterSummary.innerHTML = "";
      el.detailVoterList.innerHTML = renderStateCard(
        "error",
        hasError,
        "Retry by selecting the idea again."
      );
      return;
    }

    if (!insights) {
      el.detailVoterSummary.innerHTML = "";
      el.detailVoterList.innerHTML = renderStateCard(
        "empty",
        "No voter signals yet",
        "Once votes are added, customer intelligence appears here."
      );
      return;
    }

    var mergedIdeaCount = Array.isArray(insights.mergedIdeaPostIds) ? insights.mergedIdeaPostIds.length : 1;
    var summary = insights.summary || { totalVoters: 0, uniqueCompanies: 0, totalCompanyMrr: 0 };

    el.detailVoterSummary.innerHTML =
      '<div class="voter-summary-header">' +
      '<article class="voter-summary-card">' +
      '<strong>' +
      esc(summary.totalVoters) +
      " voters</strong>" +
      '<span class="muted">' +
      esc(summary.uniqueCompanies) +
      " companies</span>" +
      '<span class="muted">' +
      esc(currency(summary.totalCompanyMrr)) +
      " customer MRR</span>" +
      '<span class="muted">' +
      esc(mergedIdeaCount) +
      " merged idea nodes</span>" +
      "</article>" +
      '<button class="ghost small export-voters-btn" data-export-voters type="button">' +
      '<span class="ms">download</span> Export CSV' +
      '</button>' +
      '</div>' +
      '<p class="muted voter-summary-canonical">Canonical idea: <strong>' +
      esc(insights.canonicalPostTitle || "") +
      "</strong></p>";

    if (!insights.voters || !insights.voters.length) {
      el.detailVoterList.innerHTML = renderStateCard(
        "empty",
        "No votes on this idea yet",
        "Share this idea to collect demand signals."
      );
      return;
    }

    el.detailVoterList.innerHTML = insights.voters
      .map(function (voter) {
        var voteTypes = (voter.voteTypesInIdea || [])
          .map(function (type) {
            return '<span class="tag-pill">' + esc(voterBadge(type)) + "</span>";
          })
          .join("");

        var votedTitles = (voter.votedIdeaPostTitles || []).join(", ");
        var otherIdeas = voter.otherUpvotedIdeas || [];
        var joinedDate = voter.userCreatedAt ? fullDate(voter.userCreatedAt) : "Unknown";
        var otherIdeasCount = otherIdeas.length;
        
        var otherIdeasHtml = otherIdeas.length
          ? otherIdeas
              .map(function (idea) {
                var statusClass = "status-" + (idea.status || "under_review").replace(/_/g, "-");
                return (
                  '<button class="voter-idea-link" data-open-post-id="' +
                  esc(idea.postId) +
                  '" data-open-board-id="' +
                  esc(idea.boardId) +
                  '" type="button">' +
                  '<span class="voter-idea-title">' + esc(idea.title) + '</span>' +
                  '<span class="voter-idea-meta">' +
                  '<span class="' + statusClass + '">' + esc(idea.status || "under_review").replace(/_/g, " ") + '</span>' +
                  ' • ' + esc(idea.boardName) +
                  (idea.attachedMrr ? ' • ' + esc(currency(idea.attachedMrr)) : '') +
                  '</span>' +
                  '</button>'
                );
              })
              .join("")
          : '<p class="muted">No other upvotes yet.</p>';

        var safeUserName = voter.userName || "Unknown";
        var safeUserEmail = voter.userEmail || "";
        var safeCompanyName = voter.companyName || "Unknown";
        
        return (
          '<article class="voter-card voter-card-expanded">' +
          '<div class="voter-card-header">' +
          '<div class="voter-avatar">' + esc(safeUserName.charAt(0).toUpperCase()) + '</div>' +
          '<div class="voter-info">' +
          '<strong class="voter-name">' + esc(safeUserName) + '</strong>' +
          '<span class="voter-email">' + esc(safeUserEmail) + '</span>' +
          '</div>' +
          '<div class="voter-mrr-badge">' +
          '<span class="mrr-value">' + esc(currency(voter.companyMrr || 0)) + '</span>' +
          '<span class="mrr-label">MRR</span>' +
          '</div>' +
          '</div>' +
          '<div class="voter-details-grid">' +
          '<div class="voter-detail">' +
          '<span class="ms">business</span>' +
          '<div><strong>Company</strong><span>' + esc(safeCompanyName) + '</span></div>' +
          '</div>' +
          '<div class="voter-detail">' +
          '<span class="ms">calendar_today</span>' +
          '<div><strong>Joined</strong><span>' + esc(joinedDate) + '</span></div>' +
          '</div>' +
          '<div class="voter-detail">' +
          '<span class="ms">thumb_up</span>' +
          '<div><strong>Other Ideas</strong><span>' + otherIdeasCount + ' upvoted</span></div>' +
          '</div>' +
          '<div class="voter-detail">' +
          '<span class="ms">how_to_vote</span>' +
          '<div><strong>Vote Type</strong><span>' + voteTypes + '</span></div>' +
          '</div>' +
          '</div>' +
          (votedTitles && votedTitles !== voter.votedIdeaPostTitles[0]
            ? '<div class="voter-voted-nodes"><span class="muted">Voted on merged nodes:</span> ' + esc(votedTitles) + '</div>'
            : '') +
          '<details class="voter-other-ideas-section">' +
          '<summary>' +
          '<span class="ms">expand_more</span>' +
          '<strong>Other Upvoted Ideas</strong>' +
          '<span class="idea-count">' + otherIdeasCount + '</span>' +
          '</summary>' +
          '<div class="voter-other-links">' +
          otherIdeasHtml +
          '</div>' +
          '</details>' +
          '</article>'
        );
      })
      .join("");
  }

  function renderRoadmap(roadmap) {
    var data = roadmap || state.roadmap || { planned: [], in_progress: [], complete: [] };

    state.roadmapCounts = {
      planned: (data.planned || []).length,
      in_progress: (data.in_progress || []).length,
      complete: (data.complete || []).length,
      total: ((data.planned || []).length + (data.in_progress || []).length + (data.complete || []).length)
    };

    if (el.roadmapCountPlanned) {
      el.roadmapCountPlanned.textContent = String(state.roadmapCounts.planned);
    }

    if (el.roadmapCountProgress) {
      el.roadmapCountProgress.textContent = String(state.roadmapCounts.in_progress);
    }

    if (el.roadmapCountComplete) {
      el.roadmapCountComplete.textContent = String(state.roadmapCounts.complete);
    }

    if (el.roadmapCountTotal) {
      el.roadmapCountTotal.textContent = String(state.roadmapCounts.total);
    }

    if (state.loading.roadmap) {
      var loadingCard = renderStateCard("loading", "Loading roadmap", "Fetching planned, in-progress, and complete items.");
      el.roadmapPlanned.innerHTML = loadingCard;
      el.roadmapProgress.innerHTML = loadingCard;
      el.roadmapComplete.innerHTML = loadingCard;
      return;
    }

    if (state.errors.roadmap) {
      var errorCard = renderStateCard("error", state.errors.roadmap, "Try refreshing or changing the board.");
      el.roadmapPlanned.innerHTML = errorCard;
      el.roadmapProgress.innerHTML = errorCard;
      el.roadmapComplete.innerHTML = errorCard;
      return;
    }

    function mapItem(post) {
      var board = state.boards.find(function (candidate) {
        return candidate.id === post.boardId;
      });

      return (
        '<article class="roadmap-item clickable" data-roadmap-post-id="' + esc(post.id) + '" data-roadmap-board-id="' + esc(post.boardId) + '">' +
        '<strong>' + esc(post.title) + '</strong>' +
        '<p class="muted">' +
        esc(post.voteCount) +
        ' votes • ' +
        esc(currency(post.attachedMrr)) +
        (board ? " • " + esc(board.name) : "") +
        '</p>' +
        '</article>'
      );
    }

    el.roadmapPlanned.innerHTML = data.planned.length
      ? data.planned.map(mapItem).join("")
      : renderStateCard("empty", "No planned items", "Move ideas into Planned to populate this lane.");

    el.roadmapProgress.innerHTML = data.in_progress.length
      ? data.in_progress.map(mapItem).join("")
      : renderStateCard("empty", "No in-progress items", "Active roadmap work appears here.");

    el.roadmapComplete.innerHTML = data.complete.length
      ? data.complete.map(mapItem).join("")
      : renderStateCard("empty", "No complete items", "Completed roadmap posts appear here.");
  }

  function renderAccessRequests(requests) {
    var items = requests || state.accessRequests || [];

    if (state.loading.accessRequests) {
      el.accessRequestList.innerHTML = renderStateCard("loading", "Loading access requests", "Checking incoming access approvals.");
      return;
    }

    if (state.errors.accessRequests) {
      el.accessRequestList.innerHTML = renderStateCard("error", state.errors.accessRequests, "Retry from the access tab.");
      return;
    }

    el.accessRequestList.innerHTML = items.length
      ? items
          .map(function (item) {
            return (
              '<article class="request-item">' +
              '<strong>' + esc(item.email) + '</strong>' +
              '<p class="muted">' + esc(item.reason) + '</p>' +
              '<div class="request-actions">' +
              '<button class="primary" data-request-id="' + esc(item.id) + '" data-status="approved" type="button">Approve</button>' +
              '<button class="ghost" data-request-id="' + esc(item.id) + '" data-status="rejected" type="button">Reject</button>' +
              '</div>' +
              '</article>'
            );
          })
          .join("")
      : renderStateCard("empty", "No pending access requests", "New requests will appear here.");
  }

  function renderBoardSettings() {
    if (!el.boardSettingsList) {
      return;
    }

    if (state.loading.boardSettings) {
      el.boardSettingsList.innerHTML = renderStateCard("loading", "Loading board settings", "Fetching board access configuration.");
      return;
    }

    if (state.errors.boardSettings) {
      el.boardSettingsList.innerHTML = renderStateCard("error", state.errors.boardSettings, "Try refreshing board settings.");
      return;
    }

    el.boardSettingsList.innerHTML = state.boardSettings.length
      ? state.boardSettings
          .map(function (board) {
            return (
              '<article class="request-item">' +
              '<strong>' +
              esc(board.name) +
              '</strong>' +
              '<p class="muted">' +
              esc(board.postCount) +
              " posts • visibility " +
              esc(board.visibility) +
              "</p>" +
              '<div class="request-actions">' +
              '<select data-board-setting-visibility="' +
              esc(board.id) +
              '">' +
              '<option value="public"' +
              (board.visibility === "public" ? " selected" : "") +
              ">Public</option>" +
              '<option value="private"' +
              (board.visibility === "private" ? " selected" : "") +
              ">Private</option>" +
              '<option value="custom"' +
              (board.visibility === "custom" ? " selected" : "") +
              ">Custom</option>" +
              '</select>' +
              '<input data-board-setting-segments="' +
              esc(board.id) +
              '" type="text" placeholder="segment-a, segment-b" value="' +
              esc((board.allowedSegments || []).join(", ")) +
              '">' +
              '<button class="ghost small" data-save-board-setting="' +
              esc(board.id) +
              '" type="button">Save</button>' +
              '</div>' +
              '</article>'
            );
          })
          .join("")
      : renderStateCard("empty", "No boards found", "Create a board to configure access controls.");
  }

  function renderChangelogPreview(entry) {
    if (!el.changelogPreviewPanel) {
      return;
    }

    var empty = el.changelogPreviewPanel.querySelector(".preview-empty");
    var content = el.changelogPreviewPanel.querySelector(".preview-content");

    if (!entry) {
      if (empty) {
        empty.classList.remove("hidden");
      }
      if (content) {
        content.classList.add("hidden");
      }

      if (el.chPreviewTags) {
        el.chPreviewTags.innerHTML = "";
      }
      if (el.chPreviewTitle) {
        el.chPreviewTitle.textContent = "";
      }
      if (el.chPreviewMeta) {
        el.chPreviewMeta.textContent = "";
      }
      if (el.chPreviewBody) {
        el.chPreviewBody.innerHTML = "";
      }
      return;
    }

    if (empty) {
      empty.classList.add("hidden");
    }
    if (content) {
      content.classList.remove("hidden");
    }

    if (el.chPreviewTags) {
      el.chPreviewTags.innerHTML = (entry.tags || [])
        .map(function (tag) {
          return '<span class="tag-pill">' + esc(tag) + "</span>";
        })
        .join("");
    }

    if (el.chPreviewTitle) {
      el.chPreviewTitle.textContent = entry.title || "";
    }

    if (el.chPreviewMeta) {
      var statusLabelText = entry.isPublished ? "Published" : "Draft";
      var board = entry.boardName || "No board";
      var releaseTime = entry.publishedAt ? fullDate(entry.publishedAt) : "Not published";
      el.chPreviewMeta.textContent = statusLabelText + " • " + board + " • " + releaseTime;
    }

    if (el.chPreviewBody) {
      el.chPreviewBody.innerHTML = sanitizeHtml(entry.content || "");
    }
  }

  function renderChangelog(entries) {
    if (state.loading.changelog) {
      el.changelogList.innerHTML = [
        renderStateCard("loading", "Loading changelog", "Syncing drafts and published entries."),
        renderStateCard("loading", "Loading changelog", "")
      ].join("");
      return;
    }

    if (state.errors.changelog) {
      el.changelogList.innerHTML = renderStateCard("error", state.errors.changelog, "Retry with the refresh button.");
      renderChangelogPreview(null);
      return;
    }

    state.changelogEntries = entries || [];

    if (!state.selectedChangelogId && state.changelogEntries.length) {
      state.selectedChangelogId = state.changelogEntries[0].id;
    }

    if (
      state.selectedChangelogId &&
      !state.changelogEntries.some(function (entry) {
        return entry.id === state.selectedChangelogId;
      })
    ) {
      state.selectedChangelogId = state.changelogEntries[0] ? state.changelogEntries[0].id : "";
    }

    el.changelogList.innerHTML = state.changelogEntries.length
      ? state.changelogEntries
          .map(function (entry) {
            var isActive = entry.id === state.selectedChangelogId;
            var previewText = entry.excerpt || "";
            return (
              '<article class="changelog-item ' +
              (isActive ? "is-active" : "") +
              '" data-changelog-id="' +
              esc(entry.id) +
              '">' +
              '<div class="changelog-item-head">' +
              '<strong>' +
              esc(entry.title) +
              "</strong>" +
              '<span class="status-pill status-' +
              esc(entry.isPublished ? "complete" : "under_review") +
              '">' +
              esc(entry.isPublished ? "Published" : "Draft") +
              "</span>" +
              "</div>" +
              '<p class="muted">' +
              esc(entry.boardName || "No board") +
              " • " +
              esc(entry.publishedAt ? fullDate(entry.publishedAt) : "Not published") +
              "</p>" +
              (entry.tags || [])
                .map(function (tag) {
                  return '<span class="tag-pill">' + esc(tag) + "</span>";
                })
                .join("") +
              '<p class="muted">' +
              esc(previewText) +
              "</p>" +
              "</article>"
            );
          })
          .join("")
      : renderStateCard("empty", "No matching changelog entries", "Adjust your filters or publish a new entry.");

    var selectedEntry = state.changelogEntries.find(function (entry) {
      return entry.id === state.selectedChangelogId;
    }) || null;
    renderChangelogPreview(selectedEntry);
  }

  function renderAiInboxViews() {
    if (!el.aiInboxTabs) {
      return;
    }

    Array.prototype.forEach.call(el.aiInboxTabs.querySelectorAll("[data-ai-tab]"), function (button) {
      var tab = button.getAttribute("data-ai-tab");
      button.classList.toggle("is-active", tab === state.aiInboxTab);
    });

    if (el.aiInboxIncoming) {
      el.aiInboxIncoming.classList.toggle("is-active", state.aiInboxTab === "incoming");
    }
    if (el.aiInboxConfiguration) {
      el.aiInboxConfiguration.classList.toggle("is-active", state.aiInboxTab === "configuration");
    }
  }

  function normalizeAiInboxConfig(rawConfig) {
    var map = {};
    (rawConfig || []).forEach(function (entry) {
      if (!entry || !entry.source) {
        return;
      }
      map[entry.source] = {
        source: entry.source,
        routingMode: entry.routingMode === "individual" ? "individual" : "central",
        enabled: entry.enabled !== false,
        updatedAt: entry.updatedAt || ""
      };
    });

    ["freshdesk", "zoom"].forEach(function (source) {
      if (!map[source]) {
        map[source] = {
          source: source,
          routingMode: source === "zoom" ? "individual" : "central",
          enabled: true,
          updatedAt: ""
        };
      }
    });

    return Object.keys(map)
      .sort()
      .map(function (source) {
        return map[source];
      });
  }

  function sourceLabel(source) {
    return source === "zoom" ? "Zoom" : "Freshdesk";
  }

  function triageStatusLabel(status) {
    if (status === "auto_merged") {
      return "Merged";
    }

    return "Needs triage";
  }

  function defaultZoomConnection() {
    return {
      connected: false,
      zoomUserEmail: null,
      zoomUserId: null,
      zoomAccountId: null,
      expiresAt: null,
      connectedAt: null,
      lastSyncedAt: null
    };
  }

  function defaultFreshdeskConnection() {
    return {
      connected: false,
      domain: null,
      hasApiKey: false,
      filterField: null,
      filterValue: null,
      lastFieldSyncAt: null,
      lastTicketSyncAt: null
    };
  }

  function defaultSlackConnection() {
    return {
      connected: false,
      teamId: null,
      teamName: null,
      userId: null,
      userName: null,
      channelCount: 0,
      channelNames: [],
      connectedAt: null,
      lastSyncedAt: null
    };
  }

  function renderIntegrationCards() {
    // Zoom Integration Card
    var zoomCard = document.getElementById("zoom-integration-card");
    var zoomStatusEl = document.getElementById("zoom-connection-status");
    var zoomStatusDetails = document.getElementById("zoom-status-details");
    var zoomActions = document.getElementById("zoom-actions");

    if (zoomCard && zoomStatusEl && zoomStatusDetails && zoomActions) {
      var zoomConnected = state.zoomConnection && state.zoomConnection.connected;
      var zoomBusy = state.loading.zoom ? " disabled" : "";

      // Update connection status
      if (zoomConnected) {
        zoomStatusEl.textContent = "✓ Connected";
        zoomStatusEl.className = "connection-status is-connected";
        zoomCard.classList.add("is-connected");
      } else {
        zoomStatusEl.textContent = "Not connected";
        zoomStatusEl.className = "connection-status";
        zoomCard.classList.remove("is-connected");
      }

      // Status details
      var zoomEmail = zoomConnected ? state.zoomConnection.zoomUserEmail || "Connected account" : "";
      var zoomLastSync = zoomConnected && state.zoomConnection.lastSyncedAt
        ? fullDate(state.zoomConnection.lastSyncedAt)
        : "Never";
      var zoomExpires = zoomConnected && state.zoomConnection.expiresAt
        ? fullDate(state.zoomConnection.expiresAt)
        : "";

      var zoomStatusHtml = "";
      if (state.errors.zoom) {
        zoomStatusHtml = '<div class="integration-status has-error">' + esc(state.errors.zoom) + '</div>';
      } else if (zoomConnected) {
        zoomStatusHtml = '<div class="integration-status">' +
          '<strong>Account:</strong> ' + esc(zoomEmail) +
          ' • <strong>Last sync:</strong> ' + esc(zoomLastSync) +
          (zoomExpires ? ' • <strong>Token expires:</strong> ' + esc(zoomExpires) : '') +
          '</div>';
      } else {
        zoomStatusHtml = '<div class="integration-status">Connect your Zoom account to start importing call transcripts.</div>';
      }
      zoomStatusDetails.innerHTML = zoomStatusHtml;

      // Action buttons
      zoomActions.innerHTML =
        '<button class="ghost" data-zoom-connect type="button"' + zoomBusy + '>' +
        '<span class="ms">link</span> ' + esc(zoomConnected ? "Reconnect" : "Connect Zoom") +
        '</button>' +
        '<button class="primary" data-zoom-import type="button"' +
        (zoomConnected ? "" : " disabled") + zoomBusy + '>' +
        '<span class="ms">download</span> Import Transcripts' +
        '</button>' +
        (zoomConnected
          ? '<button class="ghost" data-zoom-disconnect type="button"' + zoomBusy + '>' +
            '<span class="ms">link_off</span> Disconnect</button>'
          : '');
    }

    // Freshdesk Integration Card
    var freshdeskCard = document.getElementById("freshdesk-integration-card");
    var freshdeskStatusEl = document.getElementById("freshdesk-connection-status");
    var freshdeskConfigForm = document.getElementById("freshdesk-config-form");
    var freshdeskStatusDetails = document.getElementById("freshdesk-status-details");
    var freshdeskActions = document.getElementById("freshdesk-actions");

    if (freshdeskCard && freshdeskStatusEl && freshdeskConfigForm && freshdeskStatusDetails && freshdeskActions) {
      var freshdesk = state.freshdeskConnection || defaultFreshdeskConnection();
      var freshdeskConnected = Boolean(freshdesk.connected);
      var freshdeskBusy = state.loading.freshdesk ? " disabled" : "";
      var freshdeskDomain = freshdesk.domain || "";
      var freshdeskFilterField = freshdesk.filterField || "";
      var freshdeskFilterValue = freshdesk.filterValue || "";

      // Update connection status
      if (freshdeskConnected) {
        freshdeskStatusEl.textContent = "✓ Connected";
        freshdeskStatusEl.className = "connection-status is-connected";
        freshdeskCard.classList.add("is-connected");
      } else if (freshdesk.hasApiKey) {
        freshdeskStatusEl.textContent = "API key saved";
        freshdeskStatusEl.className = "connection-status";
        freshdeskCard.classList.remove("is-connected");
      } else {
        freshdeskStatusEl.textContent = "Not connected";
        freshdeskStatusEl.className = "connection-status";
        freshdeskCard.classList.remove("is-connected");
      }

      // Build filter field options
      var fieldOptions = state.freshdeskParams
        .map(function (field) {
          var key = field && field.key ? String(field.key) : "";
          if (!key) return "";
          var selected = key === freshdeskFilterField ? " selected" : "";
          var label = field.label || key;
          return '<option value="' + esc(key) + '"' + selected + '>' + esc(label) + '</option>';
        })
        .filter(Boolean)
        .join("");

      var hasSelectedField = state.freshdeskParams.some(function (field) {
        return field && field.key === freshdeskFilterField;
      });
      if (freshdeskFilterField && !hasSelectedField) {
        fieldOptions += '<option value="' + esc(freshdeskFilterField) + '" selected>' + esc(freshdeskFilterField) + '</option>';
      }
      fieldOptions = '<option value="">No filter (import all)</option>' + fieldOptions;

      // Config form
      freshdeskConfigForm.innerHTML =
        '<div class="integration-config-row">' +
        '<label>Freshdesk Domain' +
        '<input type="text" data-freshdesk-domain value="' + esc(freshdeskDomain) +
        '" placeholder="yourcompany.freshdesk.com" />' +
        '</label>' +
        '<label>API Key' +
        '<input type="password" data-freshdesk-api-key value="" placeholder="' +
        esc(freshdesk.hasApiKey ? "••••••• (saved)" : "Enter your API key") + '" />' +
        '</label>' +
        '</div>' +
        '<div class="integration-config-row">' +
        '<label>Filter by Field (optional)' +
        '<select data-freshdesk-filter-field>' + fieldOptions + '</select>' +
        '</label>' +
        '<label>Match Value' +
        '<input type="text" data-freshdesk-filter-value value="' + esc(freshdeskFilterValue) +
        '" placeholder="e.g. Enterprise, High, 2" />' +
        '</label>' +
        '</div>';

      // Status details
      var freshdeskLastSync = freshdesk.lastTicketSyncAt ? fullDate(freshdesk.lastTicketSyncAt) : "Never";
      var freshdeskStatusHtml = "";
      if (state.errors.freshdesk) {
        freshdeskStatusHtml = '<div class="integration-status has-error">' + esc(state.errors.freshdesk) + '</div>';
      } else if (freshdeskConnected) {
        freshdeskStatusHtml = '<div class="integration-status">' +
          '<strong>Domain:</strong> ' + esc(freshdeskDomain) +
          ' • <strong>Last sync:</strong> ' + esc(freshdeskLastSync) +
          '</div>';
      } else {
        freshdeskStatusHtml = '<div class="integration-status">Enter your Freshdesk domain and API key to connect.</div>';
      }
      freshdeskStatusDetails.innerHTML = freshdeskStatusHtml;

      // Action buttons
      freshdeskActions.innerHTML =
        '<button class="ghost" data-freshdesk-fetch-params type="button"' + freshdeskBusy + '>' +
        '<span class="ms">sync</span> Fetch Fields' +
        '</button>' +
        '<button class="primary" data-freshdesk-save-config type="button"' + freshdeskBusy + '>' +
        '<span class="ms">save</span> Save Config' +
        '</button>' +
        '<button class="primary" data-freshdesk-import type="button"' +
        (freshdeskConnected ? "" : " disabled") + freshdeskBusy + '>' +
        '<span class="ms">download</span> Import Tickets' +
        '</button>' +
        (freshdeskConnected || freshdesk.hasApiKey || freshdeskDomain
          ? '<button class="ghost" data-freshdesk-disconnect type="button"' + freshdeskBusy + '>' +
            '<span class="ms">link_off</span> Disconnect</button>'
          : '');
    }

    // Slack Integration Card
    var slackCard = document.getElementById("slack-integration-card");
    var slackStatusEl = document.getElementById("slack-connection-status");
    var slackConfigForm = document.getElementById("slack-config-form");
    var slackStatusDetails = document.getElementById("slack-status-details");
    var slackActions = document.getElementById("slack-actions");

    if (slackCard && slackStatusEl && slackConfigForm && slackStatusDetails && slackActions) {
      var slack = state.slackConnection || defaultSlackConnection();
      var slackConnected = Boolean(slack.connected);
      var slackBusy = state.loading.slack ? " disabled" : "";

      // Update connection status
      if (slackConnected) {
        slackStatusEl.textContent = "✓ Connected to " + (slack.teamName || "Slack");
        slackStatusEl.className = "connection-status is-connected";
        slackCard.classList.add("is-connected");
      } else {
        slackStatusEl.textContent = "Not connected";
        slackStatusEl.className = "connection-status";
        slackCard.classList.remove("is-connected");
      }

      // Channel selector (only show when connected)
      if (slackConnected) {
        var channelOptions = state.slackChannels
          .map(function (ch) {
            var isSelected = slack.channelNames.indexOf(ch.name) !== -1;
            return '<label class="channel-checkbox">' +
              '<input type="checkbox" data-slack-channel="' + esc(ch.id) + '" data-channel-name="' + esc(ch.name) + '"' +
              (isSelected ? ' checked' : '') + ' />' +
              '<span>#' + esc(ch.name) + (ch.isPrivate ? ' 🔒' : '') + '</span>' +
              '</label>';
          })
          .join("");

        slackConfigForm.innerHTML =
          '<div class="channel-selector">' +
          '<label class="channel-label">Select channels to monitor:</label>' +
          '<div class="channel-list">' +
          (channelOptions || '<span class="muted">No channels found. Click "Fetch Channels" to load.</span>') +
          '</div>' +
          '</div>';
      } else {
        slackConfigForm.innerHTML = '';
      }

      // Status details
      var slackLastSync = slack.lastSyncedAt ? fullDate(slack.lastSyncedAt) : "Never";
      var eventsWebhookUrl = window.location.origin + "/api/integrations/slack/events";
      var slackStatusHtml = "";
      if (state.errors.slack) {
        slackStatusHtml = '<div class="integration-status has-error">' + esc(state.errors.slack) + '</div>';
      } else if (slackConnected) {
        slackStatusHtml = '<div class="integration-status">' +
          '<strong>Workspace:</strong> ' + esc(slack.teamName || "Connected") +
          ' • <strong>Channels:</strong> ' + (slack.channelCount || 0) + ' selected' +
          ' • <strong>Last sync:</strong> ' + esc(slackLastSync) +
          '</div>' +
          '<div class="integration-setup-hint">' +
          '<strong>🔔 Real-time Events</strong>: For instant feedback capture, set up ' +
          '<a href="https://api.slack.com/apps" target="_blank">Slack Event Subscriptions</a> with this URL:' +
          '<code class="webhook-url" onclick="navigator.clipboard.writeText(\'' + esc(eventsWebhookUrl) + '\'); this.classList.add(\'copied\');">' +
          esc(eventsWebhookUrl) +
          '<span class="copy-hint">(click to copy)</span>' +
          '</code>' +
          '<span class="muted">Subscribe to: message.channels, message.groups, app_mention</span>' +
          '</div>';
      } else {
        slackStatusHtml = '<div class="integration-status">Connect your Slack workspace to monitor channels for feedback.</div>';
      }
      slackStatusDetails.innerHTML = slackStatusHtml;

      // Action buttons
      slackActions.innerHTML =
        '<button class="ghost" data-slack-connect type="button"' + slackBusy + '>' +
        '<span class="ms">link</span> ' + esc(slackConnected ? "Reconnect" : "Connect Slack") +
        '</button>' +
        (slackConnected
          ? '<button class="ghost" data-slack-fetch-channels type="button"' + slackBusy + '>' +
            '<span class="ms">sync</span> Fetch Channels</button>'
          : '') +
        (slackConnected
          ? '<button class="primary" data-slack-save-channels type="button"' + slackBusy + '>' +
            '<span class="ms">save</span> Save Channels</button>'
          : '') +
        '<button class="primary" data-slack-import type="button"' +
        (slackConnected && slack.channelCount > 0 ? "" : " disabled") + slackBusy + '>' +
        '<span class="ms">download</span> Import Messages' +
        '</button>' +
        (slackConnected
          ? '<button class="ghost" data-slack-disconnect type="button"' + slackBusy + '>' +
            '<span class="ms">link_off</span> Disconnect</button>'
          : '');
    }
  }

  function renderTriageConfig() {
    // First render the new integration cards
    renderIntegrationCards();

    if (!el.triageConfigList) {
      return;
    }

    if (state.loading.triage && !state.triageConfig.length) {
      // Don't show loading in the hidden legacy config
      return;
    }

    if (state.errors.triage && !state.triageConfig.length) {
      // Show error in integration cards instead
      return;
    }

    var configs = normalizeAiInboxConfig(state.triageConfig);
    el.triageConfigList.innerHTML = configs
      .map(function (config) {
        var isZoom = config.source === "zoom";
        var isFreshdesk = config.source === "freshdesk";
        var summary = isZoom
          ? "Zoom events route to the matching logged-in user when set to Individual."
          : "Freshdesk events are routed centrally for shared company triage and can be filtered by ticket field.";
        var statusNote = config.enabled ? "Enabled" : "Paused";
        var updatedAt = config.updatedAt ? fullDate(config.updatedAt) : "Never";
        var zoomStatusBlock = "";
        var freshdeskStatusBlock = "";
        if (isZoom) {
          var zoomConnected = state.zoomConnection && state.zoomConnection.connected;
          var zoomEmail = zoomConnected ? state.zoomConnection.zoomUserEmail || "Connected account" : "Not connected";
          var zoomExpires = zoomConnected && state.zoomConnection.expiresAt ? fullDate(state.zoomConnection.expiresAt) : "N/A";
          var zoomLastSync =
            zoomConnected && state.zoomConnection.lastSyncedAt ? fullDate(state.zoomConnection.lastSyncedAt) : "Never";
          var zoomBusy = state.loading.zoom ? " disabled" : "";
          var zoomErrorLine = state.errors.zoom
            ? '<p class="muted">' + esc(state.errors.zoom) + "</p>"
            : "";
          zoomStatusBlock =
            '<section class="zoom-config-block">' +
            '<p class="muted"><strong>Connection:</strong> ' +
            esc(zoomEmail) +
            " • Expires " +
            esc(zoomExpires) +
            " • Last sync " +
            esc(zoomLastSync) +
            "</p>" +
            zoomErrorLine +
            '<div class="triage-config-controls">' +
            '<button class="ghost small" data-zoom-connect type="button"' +
            zoomBusy +
            ">" +
            esc(zoomConnected ? "Reconnect Zoom" : "Connect Zoom") +
            "</button>" +
            '<button class="primary small" data-zoom-import type="button"' +
            (zoomConnected ? "" : " disabled") +
            zoomBusy +
            ">Import Transcripts</button>" +
            '<button class="ghost small" data-zoom-disconnect type="button"' +
            (zoomConnected ? "" : " disabled") +
            zoomBusy +
            ">Disconnect</button>" +
            "</div>" +
            "</section>";
        }
        if (isFreshdesk) {
          var freshdesk = state.freshdeskConnection || defaultFreshdeskConnection();
          var freshdeskConnected = Boolean(freshdesk.connected);
          var freshdeskDomain = freshdesk.domain || "";
          var freshdeskFilterField = freshdesk.filterField || "";
          var freshdeskFilterValue = freshdesk.filterValue || "";
          var freshdeskLastFieldSync = freshdesk.lastFieldSyncAt ? fullDate(freshdesk.lastFieldSyncAt) : "Never";
          var freshdeskLastTicketSync = freshdesk.lastTicketSyncAt ? fullDate(freshdesk.lastTicketSyncAt) : "Never";
          var freshdeskBusy = state.loading.freshdesk ? " disabled" : "";
          var freshdeskErrorLine = state.errors.freshdesk
            ? '<p class="muted">' + esc(state.errors.freshdesk) + "</p>"
            : "";
          var fieldOptions = state.freshdeskParams
            .map(function (field) {
              var key = field && field.key ? String(field.key) : "";
              if (!key) {
                return "";
              }
              var selected = key === freshdeskFilterField ? " selected" : "";
              var label = field.label || key;
              return '<option value="' + esc(key) + '"' + selected + ">" + esc(label) + "</option>";
            })
            .filter(Boolean)
            .join("");
          var hasSelectedField = state.freshdeskParams.some(function (field) {
            return field && field.key === freshdeskFilterField;
          });
          if (freshdeskFilterField && !hasSelectedField) {
            fieldOptions +=
              '<option value="' +
              esc(freshdeskFilterField) +
              '" selected>' +
              esc(freshdeskFilterField) +
              "</option>";
          }
          fieldOptions = '<option value="">No filter field</option>' + fieldOptions;

          freshdeskStatusBlock =
            '<section class="freshdesk-config-block">' +
            '<p class="muted"><strong>Connection:</strong> ' +
            esc(freshdeskConnected ? freshdeskDomain || "Connected" : "Not connected") +
            " • API key " +
            esc(freshdesk.hasApiKey ? "saved" : "missing") +
            " • Fields sync " +
            esc(freshdeskLastFieldSync) +
            " • Ticket sync " +
            esc(freshdeskLastTicketSync) +
            "</p>" +
            freshdeskErrorLine +
            '<div class="triage-config-grid">' +
            '<label>Freshdesk domain' +
            '<input type="text" data-freshdesk-domain value="' +
            esc(freshdeskDomain) +
            '" placeholder="company.freshdesk.com" />' +
            "</label>" +
            '<label>Freshdesk API key' +
            '<input type="password" data-freshdesk-api-key value="" placeholder="' +
            esc(freshdesk.hasApiKey ? "Saved (enter new key to rotate)" : "Enter API key") +
            '" />' +
            "</label>" +
            '<label>Ticket field' +
            '<select data-freshdesk-filter-field>' +
            fieldOptions +
            "</select>" +
            "</label>" +
            '<label>Match value = X' +
            '<input type="text" data-freshdesk-filter-value value="' +
            esc(freshdeskFilterValue) +
            '" placeholder="e.g. Enterprise or 2" />' +
            "</label>" +
            "</div>" +
            '<div class="triage-config-controls">' +
            '<button class="ghost small" data-freshdesk-fetch-params type="button"' +
            freshdeskBusy +
            ">Fetch Params</button>" +
            '<button class="primary small" data-freshdesk-save-config type="button"' +
            freshdeskBusy +
            ">Save Freshdesk Config</button>" +
            '<button class="primary small" data-freshdesk-import type="button"' +
            (freshdeskConnected ? "" : " disabled") +
            freshdeskBusy +
            ">Import Tickets</button>" +
            '<button class="ghost small" data-freshdesk-disconnect type="button"' +
            (freshdeskConnected || freshdesk.hasApiKey || freshdeskDomain ? "" : " disabled") +
            freshdeskBusy +
            ">Disconnect</button>" +
            "</div>" +
            "</section>";
        }

        return (
          '<article class="triage-config-item" data-triage-config="' +
          esc(config.source) +
          '">' +
          '<div class="triage-config-head">' +
          "<strong>" +
          esc(sourceLabel(config.source)) +
          "</strong>" +
          '<span class="status-pill status-' +
          esc(config.enabled ? "planned" : "under_review") +
          '">' +
          esc(statusNote) +
          "</span>" +
          "</div>" +
          '<p class="muted">' +
          esc(summary) +
          "</p>" +
          '<div class="triage-config-controls">' +
          '<label>Routing' +
          '<select data-config-routing="' +
          esc(config.source) +
          '">' +
          '<option value="central"' +
          (config.routingMode === "central" ? " selected" : "") +
          ">Central inbox</option>" +
          '<option value="individual"' +
          (config.routingMode === "individual" ? " selected" : "") +
          ">Individual inbox</option>" +
          "</select>" +
          "</label>" +
          '<label class="pill-toggle">' +
          '<input type="checkbox" data-config-enabled="' +
          esc(config.source) +
          '"' +
          (config.enabled ? " checked" : "") +
          " />" +
          "<span>Enabled</span>" +
          "</label>" +
          '<button class="primary small" data-config-save="' +
          esc(config.source) +
          '" type="button">Save</button>' +
          "</div>" +
          freshdeskStatusBlock +
          zoomStatusBlock +
          '<p class="muted triage-config-foot">Last update: ' +
          esc(updatedAt) +
          "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderTriage(events) {
    if (state.loading.triage) {
      el.triageList.innerHTML = renderStateCard("loading", "Loading AI inbox", "Collecting support signals and merge suggestions.");
      renderTriageConfig();
      return;
    }

    if (state.errors.triage) {
      el.triageList.innerHTML = renderStateCard("error", state.errors.triage, "Retry to pull the latest AI events.");
      renderTriageConfig();
      return;
    }

    var triageEvents = events || state.triageEvents || [];
    if (el.triageSummaryNeeds) {
      el.triageSummaryNeeds.textContent = String(state.triageSummary.needsTriage || 0);
    }
    if (el.triageSummaryMerged) {
      el.triageSummaryMerged.textContent = String(state.triageSummary.merged || 0);
    }
    if (el.triageSummaryTotal) {
      el.triageSummaryTotal.textContent = String(state.triageSummary.total || 0);
    }

    el.triageList.innerHTML = triageEvents.length
      ? triageEvents
          .map(function (event) {
            var mergeOptions = (event.recommendedMergeCandidates || [])
              .map(function (candidate) {
                var selected = candidate.postId === event.suggestedPostId ? " selected" : "";
                var optionLabel = [
                  candidate.postTitle || "Untitled post",
                  candidate.boardName || "Unknown board",
                  candidate.status ? String(candidate.status).replace(/_/g, " ") : ""
                ]
                  .filter(Boolean)
                  .join(" • ");
                return '<option value="' + esc(candidate.postId) + '"' + selected + ">" + esc(optionLabel) + "</option>";
              })
              .join("");

            if (!mergeOptions && event.suggestedPostId && event.suggestedPostTitle) {
              mergeOptions =
                '<option value="' +
                esc(event.suggestedPostId) +
                '" selected>' +
                esc(event.suggestedPostTitle) +
                "</option>";
            }

            if (!mergeOptions) {
              var postPool = state.reportingPosts.length ? state.reportingPosts : state.posts;
              mergeOptions = postPool
                .map(function (post) {
                  var selected = post.id === event.suggestedPostId ? " selected" : "";
                  return '<option value="' + esc(post.id) + '"' + selected + ">" + esc(post.title) + "</option>";
                })
                .join("");
            }

            var recommendedBoardId = event.recommendedCreate && event.recommendedCreate.boardId ? event.recommendedCreate.boardId : "";
            var boardOptions = state.boards
              .map(function (board) {
                var selected = board.id === recommendedBoardId ? " selected" : "";
                return '<option value="' + esc(board.id) + '"' + selected + ">" + esc(board.name) + "</option>";
              })
              .join("");
            var prefillTitle = (event.recommendedCreate && event.recommendedCreate.title) || event.title || "";
            var prefillDescription =
              (event.recommendedCreate && event.recommendedCreate.description) || event.description || event.rawText || "";
            var confidenceText =
              event.confidenceScore == null
                ? "No confidence score"
                : "Confidence " + Math.round(Number(event.confidenceScore) * 100) + "%";
            var mergedBadge = event.status === "auto_merged" && event.suggestedPostTitle ? "Merged to " + event.suggestedPostTitle : "";

            return (
              '<article class="triage-item" data-triage-event-id="' +
              esc(event.id) +
              '">' +
              '<div class="triage-item-head">' +
              "<div>" +
              '<h3 class="triage-title">' +
              esc(event.title || "Untitled request") +
              "</h3>" +
              '<p class="muted">' +
              esc(sourceLabel(event.source)) +
              " • " +
              esc(triageStatusLabel(event.status)) +
              " • " +
              esc(confidenceText) +
              " • " +
              esc(fullDate(event.createdAt)) +
              "</p>" +
              "</div>" +
              '<span class="status-pill status-' +
              esc(event.status === "auto_merged" ? "complete" : "under_review") +
              '">' +
              esc(triageStatusLabel(event.status)) +
              "</span>" +
              "</div>" +
              '<p class="triage-copy">' +
              esc(event.description || event.rawText || "") +
              "</p>" +
              '<p class="muted triage-company">' +
              esc(event.requesterCompany) +
              " • " +
              esc(event.requesterEmail) +
              " • " +
              esc(currency(event.companyMrr)) +
              (mergedBadge ? " • " + esc(mergedBadge) : "") +
              "</p>" +
              '<div class="triage-actions-grid">' +
              '<section class="triage-action-card">' +
              "<h4>Recommended Action: Merge</h4>" +
              '<p class="muted">Merge this signal to an existing request in its board.</p>' +
              '<div class="triage-actions">' +
              '<select data-triage-select="' + esc(event.id) + '">' + mergeOptions + "</select>" +
              '<button class="primary" data-merge-id="' +
              esc(event.id) +
              '" type="button"' +
              (event.status === "auto_merged" ? " disabled" : "") +
              ">Merge to Post</button>" +
              "</div>" +
              "</section>" +
              '<section class="triage-action-card">' +
              "<h4>Recommended Action: Create Idea</h4>" +
              '<p class="muted">Create a new idea and place it in the recommended board.</p>' +
              '<div class="triage-create-grid">' +
              '<select data-create-board="' +
              esc(event.id) +
              '">' +
              boardOptions +
              "</select>" +
              '<input data-create-title="' +
              esc(event.id) +
              '" type="text" value="' +
              esc(prefillTitle) +
              '" placeholder="Idea title" />' +
              '<textarea data-create-description="' +
              esc(event.id) +
              '" rows="3" placeholder="Idea details">' +
              esc(prefillDescription) +
              "</textarea>" +
              '<button class="ghost" data-create-idea-id="' +
              esc(event.id) +
              '" type="button"' +
              (event.status === "auto_merged" ? " disabled" : "") +
              ">Create New Idea</button>" +
              "</div>" +
              "</section>" +
              "</div>" +
              "</article>"
            );
          })
          .join("")
      : renderStateCard("empty", "AI inbox is clear", "No events need manual triage right now.");

    renderTriageConfig();
  }

  function renderMetrics() {
    var activeReportingError = reportingError();

    if (state.loading.reporting) {
      el.metrics.innerHTML = [
        renderStateCard("loading", "Loading reporting", "Computing KPIs and MRR impact."),
        renderStateCard("loading", "Loading reporting", ""),
        renderStateCard("loading", "Loading reporting", ""),
        renderStateCard("loading", "Loading reporting", "")
      ].join("");
      el.reportingTopPosts.innerHTML = renderStateCard("loading", "Loading top requests", "");
      el.opportunitiesList.innerHTML = renderStateCard("loading", "Loading opportunities", "");
      return;
    }

    if (activeReportingError) {
      el.metrics.innerHTML = renderStateCard("error", activeReportingError, "Try refreshing the reporting tab.");
      el.reportingTopPosts.innerHTML = renderStateCard("error", activeReportingError, "");
      el.opportunitiesList.innerHTML = renderStateCard("error", activeReportingError, "");
      return;
    }

    el.metrics.innerHTML = [
      ["Boards", state.summary.boardCount],
      ["Posts", state.summary.postCount],
      ["AI Inbox", state.summary.triageCount],
      ["Attached MRR", currency(state.summary.totalAttachedMrr)]
    ]
      .map(function (item) {
        return (
          '<article class="metric-card">' +
          '<h3>' + esc(item[0]) + '</h3>' +
          '<strong>' + esc(item[1]) + '</strong>' +
          '</article>'
        );
      })
      .join("");

    el.reportingTopPosts.innerHTML = state.reportingPosts.length
      ? state.reportingPosts
          .slice(0, 8)
          .map(function (post) {
            return (
              '<article class="top-post">' +
              '<strong>' + esc(post.title) + '</strong>' +
              '<p>' + esc(currency(post.attachedMrr)) + ' • ' + esc(post.voteCount) + ' votes</p>' +
              '</article>'
            );
          })
          .join("")
      : renderStateCard("empty", "No reporting data yet", "Feedback activity will populate this list.");

    el.opportunitiesList.innerHTML = state.opportunities.length
      ? state.opportunities
          .slice(0, 8)
          .map(function (item) {
            return (
              '<article class="top-post">' +
              '<strong>' + esc(item.title) + '</strong>' +
              '<p>Score ' + esc(item.opportunityScore) + " • " + esc(item.voteCount) + " votes • " + esc(currency(item.attachedMrr)) + "</p>" +
              "</article>"
            );
          })
          .join("")
      : renderStateCard("empty", "No opportunities found", "Opportunity scoring will appear as data grows.");
  }

  function renderCustomerView() {
    if (!el.customerViewList || !el.customerViewSummary) {
      return;
    }

    if (state.loading.customers) {
      el.customerViewSummary.textContent = "";
      el.customerViewList.innerHTML = renderStateCard(
        "loading",
        "Loading customer relationships",
        "Building customer -> ideas and idea -> customer links."
      );
      return;
    }

    if (state.errors.customers) {
      el.customerViewSummary.textContent = "";
      el.customerViewList.innerHTML = renderStateCard("error", state.errors.customers, "Try refreshing customer view.");
      return;
    }

    var summary = state.customerRelationshipSummary || {
      totalCustomers: 0,
      totalLinkedIdeas: 0,
      totalCustomerMrr: 0
    };
    el.customerViewSummary.textContent =
      summary.totalCustomers +
      " customers • " +
      summary.totalLinkedIdeas +
      " linked ideas • " +
      currency(summary.totalCustomerMrr) +
      " total customer MRR";

    if (!state.customerRelationships.length) {
      el.customerViewList.innerHTML = renderStateCard(
        "empty",
        "No customer relationships",
        "Customer-post links will appear after votes are captured."
      );
      return;
    }

    el.customerViewList.innerHTML = state.customerRelationships
      .map(function (customer) {
        var links = customer.linkedIdeas || [];
        var voters = customer.voters || [];
        var linksHtml = links.length
          ? links
              .map(function (idea) {
                var voteLabel = idea.voteType === "explicit" ? "Explicit" : "Support";
                return (
                  '<button class="ghost small" data-open-post-id="' +
                  esc(idea.postId) +
                  '" data-open-board-id="' +
                  esc(idea.boardId) +
                  '" type="button">' +
                  esc(idea.title) +
                  " • " +
                  esc(idea.boardName) +
                  " • " +
                  esc(voteLabel) +
                  "</button>"
                );
              })
              .join("")
          : '<p class="muted">No linked ideas</p>';
        var votersHtml = voters.length
          ? voters
              .map(function (voter) {
                return (
                  '<span class="status-pill" title="' +
                  esc(voter.userEmail) +
                  '">' +
                  esc(voter.userName) +
                  " • " +
                  esc(voter.linkedIdeaCount) +
                  "</span>"
                );
              })
              .join("")
          : '<span class="muted">No voter details</span>';

        return (
          '<article class="request-item customer-view-item">' +
          '<div class="customer-view-head">' +
          "<strong>" +
          esc(customer.companyName) +
          "</strong>" +
          '<span class="status-pill">' +
          esc(currency(customer.companyMrr)) +
          " MRR</span>" +
          "</div>" +
          '<p class="muted">' +
          esc(customer.uniqueVoterCount) +
          " voters • " +
          esc(customer.totalLinkedIdeas) +
          " linked ideas • " +
          esc(customer.explicitIdeaCount) +
          " explicit • " +
          esc(customer.implicitIdeaCount) +
          " support-captured</p>" +
          '<div class="customer-voters">' +
          votersHtml +
          "</div>" +
          '<div class="customer-view-links">' +
          linksHtml +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function loadSummary() {
    setLoading("reporting", true);
    state.errors.reportingSummary = "";
    renderMetrics();

    return request("/api/company/summary")
      .then(function (result) {
        state.summary = result.metrics || state.summary;
        state.errors.reportingSummary = "";
        renderDeckMetrics();
      })
      .catch(function (error) {
        state.errors.reportingSummary = error.message || "Failed to load summary metrics.";
        pushToast("error", state.errors.reportingSummary);
      })
      .finally(function () {
        setLoading("reporting", false);
        renderMetrics();
      });
  }

  function loadMembers() {
    setLoading("members", true);
    state.errors.members = "";
    renderMemberDirectory();

    return request("/api/company/members")
      .then(function (result) {
        state.members = result.members || [];
        renderOwnerFilter();
      })
      .catch(function (error) {
        state.members = [];
        state.errors.members = error.message || "Failed to load teammates.";
        pushToast("error", state.errors.members);
      })
      .finally(function () {
        setLoading("members", false);
        renderMemberDirectory();
      });
  }

  function loadBoards() {
    return request("/api/company/boards")
      .then(function (result) {
        state.boards = result.boards || [];
        if (!state.boardId && state.boards.length) {
          state.boardId = state.boards[0].id;
        }
        if (!state.roadmapBoardId && state.boardId) {
          state.roadmapBoardId = state.boardId;
        }
        renderBoards();
      })
      .catch(function (error) {
        state.boards = [];
        renderBoards();
        pushToast("error", error.message || "Failed to load boards.");
      });
  }

  function loadSavedFilters() {
    return request("/api/company/saved-filters").then(function (result) {
      state.customSavedFilters = result.filters || [];
      renderCustomSavedFilters();
    });
  }

  function loadFeedback() {
    if (!state.boardId) {
      state.posts = [];
      state.selectedPostId = "";
      state.errors.feedback = "";
      state.errors.voterInsights = "";
      renderFeedbackList();
      renderDetail();
      return Promise.resolve();
    }

    setLoading("feedback", true);
    state.errors.feedback = "";
    renderFeedbackList();
    renderDetail();

    var query = new URLSearchParams({
      boardId: state.boardId,
      sort: state.sort,
      q: state.query,
      filter: state.filter
    });

    return request("/api/company/feedback?" + query.toString())
      .then(function (result) {
        state.posts = result.posts || [];

        if (state.selectedPostId && !state.posts.some(function (post) { return post.id === state.selectedPostId; })) {
          state.selectedPostId = "";
          state.mergedSources = [];
          state.commentReplyTarget = null;
          state.errors.voterInsights = "";
        }

        if (!state.selectedPostId && state.posts.length) {
          state.selectedPostId = state.posts[0].id;
        }

        if (!state.selectedPostId) {
          return Promise.resolve();
        }

        return Promise.all([loadMergedSources(), loadVoterInsights(state.selectedPostId)]);
      })
      .catch(function (error) {
        state.posts = [];
        state.selectedPostId = "";
        state.mergedSources = [];
        state.commentReplyTarget = null;
        state.errors.voterInsights = "";
        state.errors.feedback = error.message || "Failed to load feedback.";
        pushToast("error", state.errors.feedback);
      })
      .finally(function () {
        setLoading("feedback", false);
        renderFeedbackList();
        renderDetail();
      });
  }

  function loadRoadmap() {
    setLoading("roadmap", true);
    state.errors.roadmap = "";
    state.roadmap = { planned: [], in_progress: [], complete: [] };
    renderRoadmap({ planned: [], in_progress: [], complete: [] });

    var params = new URLSearchParams();
    var activeBoardId = state.roadmapBoardId || state.boardId || "";
    if (activeBoardId && activeBoardId !== "all") {
      params.set("boardId", activeBoardId);
    }
    if (state.roadmapQuery) {
      params.set("q", state.roadmapQuery);
    }

    return request("/api/company/roadmap?" + params.toString())
      .then(function (result) {
        state.errors.roadmap = "";
        state.roadmap = result.roadmap || { planned: [], in_progress: [], complete: [] };
      })
      .catch(function (error) {
        state.errors.roadmap = error.message || "Failed to load roadmap.";
        state.roadmap = { planned: [], in_progress: [], complete: [] };
        pushToast("error", state.errors.roadmap);
      })
      .finally(function () {
        setLoading("roadmap", false);
        renderRoadmap(state.roadmap);
      });
  }

  function loadAccessRequests() {
    setLoading("accessRequests", true);
    state.errors.accessRequests = "";
    renderAccessRequests([]);

    return request("/api/company/access-requests")
      .then(function (result) {
        state.accessRequests = result.requests || [];
      })
      .catch(function (error) {
        state.errors.accessRequests = error.message || "Failed to load access requests.";
        state.accessRequests = [];
        pushToast("error", state.errors.accessRequests);
      })
      .finally(function () {
        setLoading("accessRequests", false);
        renderAccessRequests(state.accessRequests);
      });
  }

  function loadBoardSettings() {
    setLoading("boardSettings", true);
    state.errors.boardSettings = "";
    renderBoardSettings();

    return request("/api/company/board-settings")
      .then(function (result) {
        state.boardSettings = result.boards || [];
      })
      .catch(function (error) {
        state.boardSettings = [];
        state.errors.boardSettings = error.message || "Failed to load board settings.";
        pushToast("error", state.errors.boardSettings);
      })
      .finally(function () {
        setLoading("boardSettings", false);
        renderBoardSettings();
      });
  }

  function loadChangelog() {
    setLoading("changelog", true);
    state.errors.changelog = "";
    renderChangelog([]);

    var params = new URLSearchParams();
    if (state.changelogQuery) {
      params.set("q", state.changelogQuery);
    }
    if (state.changelogBoardId && state.changelogBoardId !== "all") {
      params.set("boardId", state.changelogBoardId);
    }
    if (state.changelogStatus && state.changelogStatus !== "all") {
      params.set("status", state.changelogStatus);
    }
    if (state.changelogTag) {
      params.set("tag", state.changelogTag);
    }
    params.set("page", "1");
    params.set("pageSize", "40");

    return request("/api/company/changelog?" + params.toString())
      .then(function (result) {
        state.changelogEntries = result.entries || [];
      })
      .catch(function (error) {
        state.errors.changelog = error.message || "Failed to load changelog.";
        state.changelogEntries = [];
        pushToast("error", state.errors.changelog);
      })
      .finally(function () {
        setLoading("changelog", false);
        renderChangelog(state.changelogEntries);
      });
  }

  function loadMergedSources() {
    var post = getSelectedPost();
    if (!post) {
      state.mergedSources = [];
      renderDetail();
      return Promise.resolve();
    }

    return request("/api/company/posts/" + encodeURIComponent(post.id) + "/merged-sources").then(function (result) {
      state.mergedSources = result.sources || [];
      renderDetail();
    });
  }

  function loadVoterInsights(postId) {
    if (!postId) {
      state.errors.voterInsights = "";
      renderDetail();
      return Promise.resolve();
    }

    setLoading("voterInsights", true);
    state.errors.voterInsights = "";
    renderVoterInsights(postId);

    return request("/api/company/posts/" + encodeURIComponent(postId) + "/voter-insights")
      .then(function (result) {
        if (!result || !result.insights) {
          throw new Error("No voter insights returned.");
        }
        state.voterInsightsByPostId[postId] = result.insights;
      })
      .catch(function (error) {
        state.errors.voterInsights = error.message || "Failed to load voter insights.";
        pushToast("error", state.errors.voterInsights);
      })
      .finally(function () {
        setLoading("voterInsights", false);
        renderVoterInsights(postId);
      });
  }

  function openLinkedIdea(boardId, postId) {
    if (!boardId || !postId) {
      return Promise.resolve();
    }

    state.tab = "feedback";
    renderTabs();

    state.boardId = boardId;
    if (state.roadmapBoardId !== "all") {
      state.roadmapBoardId = boardId;
    }
    state.filter = "all";
    state.sort = "trending";
    state.query = "";
    state.selectedPostId = postId;

    if (el.feedbackFilter) {
      el.feedbackFilter.value = state.filter;
    }
    if (el.feedbackSort) {
      el.feedbackSort.value = state.sort;
    }
    if (el.feedbackSearch) {
      el.feedbackSearch.value = state.query;
    }

    renderBoards();

    return Promise.all([loadFeedback(), loadRoadmap(), loadOpportunities()]).then(function () {
      if (state.posts.some(function (post) { return post.id === postId; })) {
        state.selectedPostId = postId;
        renderFeedbackList();
        renderDetail();
        return Promise.all([loadMergedSources(), loadVoterInsights(postId)]).then(function () {
          return undefined;
        });
      }

      pushToast("info", "Linked idea could not be opened in current view.");
      return undefined;
    });
  }

  function loadZoomConnectionStatus() {
    setLoading("zoom", true);
    state.errors.zoom = "";
    renderTriageConfig();

    return request("/api/integrations/zoom/status")
      .then(function (result) {
        state.zoomConnection = result.connection || defaultZoomConnection();
      })
      .catch(function (error) {
        state.zoomConnection = defaultZoomConnection();
        state.errors.zoom = error.message || "Failed to load Zoom connection status.";
        if (state.tab === "autopilot") {
          pushToast("error", state.errors.zoom);
        }
      })
      .finally(function () {
        setLoading("zoom", false);
        renderTriageConfig();
      });
  }

  function loadFreshdeskStatus() {
    setLoading("freshdesk", true);
    state.errors.freshdesk = "";
    renderTriageConfig();

    return request("/api/integrations/freshdesk/status")
      .then(function (result) {
        state.freshdeskConnection = result.connection || defaultFreshdeskConnection();
        state.freshdeskParams = Array.isArray(result.params) ? result.params : state.freshdeskParams;
      })
      .catch(function (error) {
        state.freshdeskConnection = defaultFreshdeskConnection();
        state.freshdeskParams = [];
        state.errors.freshdesk = error.message || "Failed to load Freshdesk configuration.";
        if (state.tab === "autopilot") {
          pushToast("error", state.errors.freshdesk);
        }
      })
      .finally(function () {
        setLoading("freshdesk", false);
        renderTriageConfig();
      });
  }

  function loadSlackConnectionStatus() {
    setLoading("slack", true);
    state.errors.slack = "";
    renderTriageConfig();

    return request("/api/integrations/slack/status")
      .then(function (result) {
        state.slackConnection = result.connection || defaultSlackConnection();
      })
      .catch(function (error) {
        state.slackConnection = defaultSlackConnection();
        state.errors.slack = error.message || "Failed to load Slack connection status.";
        if (state.tab === "autopilot") {
          pushToast("error", state.errors.slack);
        }
      })
      .finally(function () {
        setLoading("slack", false);
        renderTriageConfig();
      });
  }

  function loadSlackChannels() {
    setLoading("slack", true);
    renderTriageConfig();

    return request("/api/integrations/slack/channels")
      .then(function (result) {
        state.slackChannels = Array.isArray(result.channels) ? result.channels : [];
      })
      .catch(function (error) {
        state.slackChannels = [];
        pushToast("error", error.message || "Failed to fetch Slack channels.");
      })
      .finally(function () {
        setLoading("slack", false);
        renderTriageConfig();
      });
  }

  function loadTriage() {
    setLoading("triage", true);
    state.errors.triage = "";
    renderTriage([]);

    var params = new URLSearchParams();
    params.set("status", state.triageStatus || "needs_triage");
    params.set("source", state.triageSource || "all");
    if (state.triageQuery) {
      params.set("q", state.triageQuery);
    }
    if (state.triageMinMrr > 0) {
      params.set("minMrr", String(state.triageMinMrr));
    }

    return request("/api/company/triage?" + params.toString())
      .then(function (result) {
        state.triageSummary = result.summary || state.triageSummary;
        state.triageEvents = result.painEvents || [];
        state.triageConfig = normalizeAiInboxConfig(result.config && result.config.sources ? result.config.sources : state.triageConfig);
      })
      .catch(function (error) {
        state.errors.triage = error.message || "Failed to load AI inbox.";
        state.triageEvents = [];
        pushToast("error", state.errors.triage);
      })
      .finally(function () {
        setLoading("triage", false);
        renderTriage(state.triageEvents);
      });
  }

  function loadReportingPosts() {
    setLoading("reporting", true);
    state.errors.reportingPosts = "";
    renderMetrics();

    if (!state.boards.length) {
      state.reportingPosts = [];
      renderMetrics();
      setLoading("reporting", false);
      return Promise.resolve();
    }

    return Promise.all(
      state.boards.map(function (board) {
        var query = new URLSearchParams({
          boardId: board.id,
          sort: "trending",
          filter: "all",
          q: ""
        });
        return request("/api/company/feedback?" + query.toString());
      })
    ).then(function (responses) {
      var unique = {};

      responses.forEach(function (response) {
        (response.posts || []).forEach(function (post) {
          unique[post.id] = post;
        });
      });

      state.reportingPosts = Object.keys(unique)
        .map(function (key) { return unique[key]; })
        .sort(function (a, b) {
          return b.attachedMrr - a.attachedMrr;
        });

      state.errors.reportingPosts = "";

      renderMetrics();
    })
      .catch(function (error) {
        state.reportingPosts = [];
        state.errors.reportingPosts = error.message || "Failed to load reporting posts.";
        pushToast("error", state.errors.reportingPosts);
        renderMetrics();
      })
      .finally(function () {
        setLoading("reporting", false);
        renderMetrics();
      });
  }

  function loadOpportunities() {
    setLoading("reporting", true);
    state.errors.reportingOpportunities = "";
    renderMetrics();

    var query = new URLSearchParams({
      boardId: state.boardId
    });

    return request("/api/company/opportunities?" + query.toString())
      .then(function (result) {
        state.opportunities = result.opportunities || [];
        state.errors.reportingOpportunities = "";
        renderMetrics();
      })
      .catch(function (error) {
        state.opportunities = [];
        state.errors.reportingOpportunities = error.message || "Failed to load opportunities.";
        pushToast("error", state.errors.reportingOpportunities);
      })
      .finally(function () {
        setLoading("reporting", false);
        renderMetrics();
      });
  }

  function loadCustomerView() {
    if (!el.customerViewList) {
      return Promise.resolve();
    }

    setLoading("customers", true);
    state.errors.customers = "";
    renderCustomerView();

    var params = new URLSearchParams();
    if (state.customerViewQuery) {
      params.set("q", state.customerViewQuery);
    }
    if (state.customerViewBoardId && state.customerViewBoardId !== "all") {
      params.set("boardId", state.customerViewBoardId);
    }
    if (state.customerViewMinMrr > 0) {
      params.set("minMrr", String(state.customerViewMinMrr));
    }

    return request("/api/company/customers?" + params.toString())
      .then(function (result) {
        state.customerRelationships = result.customers || [];
        state.customerRelationshipSummary = result.summary || {
          totalCustomers: 0,
          totalLinkedIdeas: 0,
          totalCustomerMrr: 0
        };
      })
      .catch(function (error) {
        state.customerRelationships = [];
        state.customerRelationshipSummary = {
          totalCustomers: 0,
          totalLinkedIdeas: 0,
          totalCustomerMrr: 0
        };
        state.errors.customers = error.message || "Failed to load customer relationships.";
        pushToast("error", state.errors.customers);
      })
      .finally(function () {
        setLoading("customers", false);
        renderCustomerView();
      });
  }

  function openTab(tab) {
    state.tab = tab;
    renderTabs();

    if (tab === "roadmap") {
      void loadRoadmap();
    }

    if (tab === "access") {
      void Promise.all([loadAccessRequests(), loadBoardSettings()]);
    }

    if (tab === "changelog") {
      void loadChangelog();
    }

    if (tab === "autopilot") {
      renderAiInboxViews();
      void Promise.all([loadTriage(), loadZoomConnectionStatus(), loadFreshdeskStatus(), loadSlackConnectionStatus()]);
    }

    if (tab === "reporting") {
      state.errors.reportingSummary = "";
      state.errors.reportingPosts = "";
      state.errors.reportingOpportunities = "";
      state.errors.customers = "";
      void Promise.all([loadSummary(), loadReportingPosts(), loadOpportunities(), loadCustomerView()]);
    }
  }

  function bindEvents() {
    el.nav.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      var navItem = target.closest(".nav-item");
      if (!navItem) {
        return;
      }
      var tab = navItem.getAttribute("data-tab") || "feedback";
      openTab(tab);
    });

    el.openComposer.addEventListener("click", function () {
      openTab("feedback");
      el.composer.classList.toggle("hidden");
      if (!el.composer.classList.contains("hidden")) {
        el.newTitle.focus();
      }
    });

    el.savedViews.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(".saved-view")) {
        return;
      }

      state.view = target.getAttribute("data-view") || "all";
      renderSavedViews();
      renderFeedbackList();
      renderDetail();
    });

    el.customSavedFilters.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var applyBtn = target.closest("[data-saved-filter-id]");
      if (applyBtn) {
        var filterId = applyBtn.getAttribute("data-saved-filter-id");
        var saved = state.customSavedFilters.find(function (item) {
          return item.id === filterId;
        });
        if (!saved) {
          return;
        }

        state.view = "all";
        state.boardId = saved.criteria.boardId;
        state.roadmapBoardId = state.boardId;
        state.sort = saved.criteria.sort;
        state.filter = saved.criteria.filter;
        state.query = saved.criteria.query;
        state.filterSupportOnly = saved.criteria.supportOnly;
        state.filterCommentsOnly = saved.criteria.commentsOnly;
        state.filterMinMrr = saved.criteria.minMrr;
        state.filterOwner = saved.criteria.ownerName;
        state.selectedPostIds = [];
        state.selectedPostId = "";

        renderSavedViews();
        renderBoards();
        el.feedbackSort.value = state.sort;
        el.feedbackFilter.value = state.filter;
        el.feedbackSearch.value = state.query;
        el.filterSupportOnly.checked = state.filterSupportOnly;
        el.filterCommentsOnly.checked = state.filterCommentsOnly;
        el.filterMinMrr.value = state.filterMinMrr ? String(state.filterMinMrr) : "";
        el.filterOwner.value = state.filterOwner;

        void Promise.all([loadFeedback(), loadRoadmap(), loadOpportunities()]);
        return;
      }

      var deleteBtn = target.closest("[data-delete-saved-filter-id]");
      if (!deleteBtn) {
        return;
      }

      var deleteId = deleteBtn.getAttribute("data-delete-saved-filter-id");
      if (!deleteId) {
        return;
      }

      request("/api/company/saved-filters/" + encodeURIComponent(deleteId), {
        method: "DELETE"
      })
        .then(function () {
          return loadSavedFilters();
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to delete saved filter.");
        });
    });

    if (el.toggleCreateBoard) {
      el.toggleCreateBoard.addEventListener("click", function () {
        var isHidden = !el.createBoardForm || el.createBoardForm.classList.contains("hidden");
        setCreateBoardFormOpen(isHidden);
      });
    }

    if (el.newBoardVisibility) {
      el.newBoardVisibility.addEventListener("change", function () {
        renderCreateBoardSegments();
      });
    }

    if (el.createBoardCancel) {
      el.createBoardCancel.addEventListener("click", function () {
        resetCreateBoardForm();
      });
    }

    if (el.createBoardForm) {
      el.createBoardForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!el.newBoardName || !el.newBoardVisibility) {
          return;
        }

        var boardName = el.newBoardName.value.trim();
        if (!boardName) {
          pushToast("info", "Enter a board name.");
          el.newBoardName.focus();
          return;
        }

        var visibility = el.newBoardVisibility.value || "public";
        var allowedSegments =
          visibility === "custom" && el.newBoardSegments
            ? csvToList(el.newBoardSegments.value)
            : [];

        if (visibility === "custom" && !allowedSegments.length) {
          pushToast("info", "Add at least one segment for a custom board.");
          if (el.newBoardSegments) {
            el.newBoardSegments.focus();
          }
          return;
        }

        setButtonBusy(el.createBoardSubmit, true, "Creating...");
        request("/api/company/boards", {
          method: "POST",
          body: {
            name: boardName,
            visibility: visibility,
            allowedSegments: allowedSegments
          }
        })
          .then(function (result) {
            var newBoard = result && result.board ? result.board : null;
            resetCreateBoardForm();
            if (newBoard && newBoard.id) {
              state.boardId = newBoard.id;
              state.roadmapBoardId = newBoard.id;
              state.selectedPostId = "";
              state.selectedPostIds = [];
              state.mergedSources = [];
              state.commentReplyTarget = null;
              state.errors.voterInsights = "";
            }

            return Promise.all([
              loadBoards(),
              loadBoardSettings(),
              loadSummary(),
              loadFeedback(),
              loadRoadmap(),
              loadReportingPosts(),
              loadOpportunities(),
              loadCustomerView()
            ]);
          })
          .then(function () {
            pushToast("success", "Board created.");
          })
          .catch(function (error) {
            pushToast("error", error.message || "Failed to create board.");
          })
          .finally(function () {
            setButtonBusy(el.createBoardSubmit, false);
          });
      });
    }

    el.boardList.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var boardButton = target.closest(".board-item");
      if (!boardButton) {
        return;
      }

      state.boardId = boardButton.getAttribute("data-board-id") || state.boardId;
      state.roadmapBoardId = state.boardId;
      state.selectedPostId = "";
      state.selectedPostIds = [];
      state.mergedSources = [];
      if (state.boardId) {
        el.chBoard.value = state.boardId;
      }
      renderBoards();
      void Promise.all([loadFeedback(), loadRoadmap(), loadOpportunities()]);
    });

    if (el.roadmapBoardFilter) {
      el.roadmapBoardFilter.addEventListener("change", function () {
        var nextBoard = el.roadmapBoardFilter.value || "all";
        state.roadmapBoardId = nextBoard;
        renderRoadmapContext();
        if (nextBoard !== "all") {
          state.boardId = nextBoard;
          state.selectedPostId = "";
          state.selectedPostIds = [];
          state.mergedSources = [];
          renderBoards();
          void Promise.all([loadFeedback(), loadRoadmap(), loadOpportunities()]);
          return;
        }

        void loadRoadmap();
      });
    }

    if (el.roadmapSearch) {
      el.roadmapSearch.addEventListener("input", function () {
        state.roadmapQuery = el.roadmapSearch.value.trim();
        void loadRoadmap();
      });
    }

    // Roadmap item click handlers
    function handleRoadmapItemClick(event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var item = target.closest("[data-roadmap-post-id]");
      if (!item) {
        return;
      }

      var postId = item.getAttribute("data-roadmap-post-id");
      var boardId = item.getAttribute("data-roadmap-board-id");
      if (!postId || !boardId) {
        return;
      }

      // Navigate to feedback tab and select this post
      state.boardId = boardId;
      state.selectedPostId = postId;
      state.selectedPostIds = [postId];
      
      // Reset filters to ensure the post is visible
      state.filter = "all";
      state.query = "";
      if (el.feedbackFilter) {
        el.feedbackFilter.value = "all";
      }
      if (el.feedbackSearch) {
        el.feedbackSearch.value = "";
      }
      
      renderBoards();
      openTab("feedback");
      
      void loadFeedback().then(function () {
        // Re-select the post after loading (in case it wasn't in the list)
        state.selectedPostId = postId;
        state.selectedPostIds = [postId];
        renderFeedbackList();
        renderDetail();
        loadVoterInsights(postId);
        
        // Scroll to the post in the list
        setTimeout(function () {
          var postEl = document.querySelector('[data-post-id="' + postId + '"]');
          if (postEl) {
            postEl.scrollIntoView({ behavior: "smooth", block: "center" });
            postEl.classList.add("highlight-flash");
            setTimeout(function () {
              postEl.classList.remove("highlight-flash");
            }, 1500);
          }
        }, 100);
      });
    }

    if (el.roadmapPlanned) {
      el.roadmapPlanned.addEventListener("click", handleRoadmapItemClick);
    }
    if (el.roadmapProgress) {
      el.roadmapProgress.addEventListener("click", handleRoadmapItemClick);
    }
    if (el.roadmapComplete) {
      el.roadmapComplete.addEventListener("click", handleRoadmapItemClick);
    }

    el.feedbackSearch.addEventListener("input", function () {
      state.query = el.feedbackSearch.value;
      void loadFeedback();
    });

    el.feedbackFilter.addEventListener("change", function () {
      state.filter = el.feedbackFilter.value;
      void loadFeedback();
    });

    el.feedbackSort.addEventListener("change", function () {
      state.sort = el.feedbackSort.value;
      void loadFeedback();
    });

    el.filterSupportOnly.addEventListener("change", function () {
      state.filterSupportOnly = el.filterSupportOnly.checked;
      renderFeedbackList();
      renderDetail();
    });

    el.filterCommentsOnly.addEventListener("change", function () {
      state.filterCommentsOnly = el.filterCommentsOnly.checked;
      renderFeedbackList();
      renderDetail();
    });

    el.filterMinMrr.addEventListener("input", function () {
      state.filterMinMrr = Number(el.filterMinMrr.value || 0);
      renderFeedbackList();
      renderDetail();
    });

    el.filterOwner.addEventListener("change", function () {
      state.filterOwner = el.filterOwner.value;
      renderFeedbackList();
      renderDetail();
    });

    el.clearFilters.addEventListener("click", function () {
      state.filterSupportOnly = false;
      state.filterCommentsOnly = false;
      state.filterMinMrr = 0;
      state.filterOwner = "";
      state.filter = "all";
      state.sort = "trending";
      state.query = "";

      el.filterSupportOnly.checked = false;
      el.filterCommentsOnly.checked = false;
      el.filterMinMrr.value = "";
      el.filterOwner.value = "";
      el.feedbackFilter.value = "all";
      el.feedbackSort.value = "trending";
      el.feedbackSearch.value = "";

      void loadFeedback();
    });

    el.saveCurrentFilter.addEventListener("click", function () {
      if (!state.boardId) {
        return;
      }

      var name = window.prompt("Name this saved filter");
      if (!name) {
        return;
      }

      request("/api/company/saved-filters", {
        method: "POST",
        body: {
          name: name,
          criteria: {
            boardId: state.boardId,
            sort: state.sort,
            filter: state.filter,
            query: state.query,
            supportOnly: state.filterSupportOnly,
            commentsOnly: state.filterCommentsOnly,
            minMrr: Number(state.filterMinMrr || 0),
            ownerName: state.filterOwner || ""
          }
        }
      })
        .then(function () {
          return loadSavedFilters();
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to save filter.");
        });
    });

    el.feedbackList.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var checkbox = target.closest(".post-select");
      if (checkbox instanceof HTMLInputElement) {
        var checkedPostId = checkbox.getAttribute("data-select-post-id");
        if (!checkedPostId) {
          return;
        }

        if (checkbox.checked) {
          if (state.selectedPostIds.indexOf(checkedPostId) === -1) {
            state.selectedPostIds.push(checkedPostId);
          }
        } else {
          state.selectedPostIds = state.selectedPostIds.filter(function (id) {
            return id !== checkedPostId;
          });
        }

        renderBulkActions();
        return;
      }

      var card = target.closest(".feedback-card");
      if (!card) {
        return;
      }

      var postId = card.getAttribute("data-post-id") || "";
      if (!postId) {
        return;
      }

      state.selectedPostId = postId;
      renderFeedbackList();
      renderDetail();
      void Promise.all([loadMergedSources(), loadVoterInsights(postId)]);
    });

    el.saveStatus.addEventListener("click", function () {
      var post = getSelectedPost();
      if (!post) {
        return;
      }

      var tags = el.detailTags.value
        .split(",")
        .map(function (value) {
          return value.trim();
        })
        .filter(Boolean);

      setButtonBusy(el.saveStatus, true, "Saving...");
      request("/api/company/posts/" + encodeURIComponent(post.id), {
        method: "PATCH",
        body: {
          status: el.detailStatus.value,
          ownerName: el.detailOwner.value,
          eta: el.detailEta.value || null,
          tags: tags
        }
      })
        .then(function () {
          return Promise.all([loadFeedback(), loadRoadmap(), loadSummary(), loadReportingPosts(), loadOpportunities()]);
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to save updates.");
        })
        .finally(function () {
          setButtonBusy(el.saveStatus, false);
        });
    });

    el.bulkApply.addEventListener("click", function () {
      if (!state.selectedPostIds.length) {
        return;
      }

      setButtonBusy(el.bulkApply, true, "Applying...");
      request("/api/company/posts/bulk-update", {
        method: "POST",
        body: {
          postIds: state.selectedPostIds,
          status: el.bulkStatus.value || undefined,
          ownerName: el.bulkOwner.value || undefined,
          addTags: csvToList(el.bulkAddTags.value),
          removeTags: csvToList(el.bulkRemoveTags.value)
        }
      })
        .then(function () {
          state.selectedPostIds = [];
          el.bulkStatus.value = "";
          el.bulkOwner.value = "";
          el.bulkAddTags.value = "";
          el.bulkRemoveTags.value = "";
          return Promise.all([loadFeedback(), loadRoadmap(), loadSummary(), loadReportingPosts(), loadOpportunities()]);
        })
        .catch(function (error) {
          pushToast("error", error.message || "Bulk update failed.");
        })
        .finally(function () {
          setButtonBusy(el.bulkApply, false);
        });
    });

    el.bulkClear.addEventListener("click", function () {
      state.selectedPostIds = [];
      renderFeedbackList();
      renderDetail();
    });

    el.mergePost.addEventListener("click", function () {
      var source = getSelectedPost();
      var targetPostId = el.mergeTargetPost.value;
      if (!source || !targetPostId) {
        return;
      }

      setButtonBusy(el.mergePost, true, "Merging...");
      request("/api/company/posts/merge", {
        method: "POST",
        body: {
          sourcePostId: source.id,
          targetPostId: targetPostId
        }
      })
        .then(function () {
          state.selectedPostId = targetPostId;
          return Promise.all([
            loadFeedback(),
            loadRoadmap(),
            loadSummary(),
            loadReportingPosts(),
            loadOpportunities(),
            loadCustomerView()
          ]);
        })
        .catch(function (error) {
          pushToast("error", error.message || "Merge failed.");
        })
        .finally(function () {
          setButtonBusy(el.mergePost, false);
        });
    });

    el.mergedSources.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var unmergeBtn = target.closest("[data-unmerge-source-id]");
      if (!unmergeBtn) {
        return;
      }

      var sourcePostId = unmergeBtn.getAttribute("data-unmerge-source-id");
      if (!sourcePostId) {
        return;
      }

      request("/api/company/posts/unmerge", {
        method: "POST",
        body: {
          sourcePostId: sourcePostId
        }
      })
        .then(function () {
          return Promise.all([
            loadFeedback(),
            loadRoadmap(),
            loadSummary(),
            loadReportingPosts(),
            loadOpportunities(),
            loadCustomerView()
          ]);
        })
        .catch(function (error) {
          pushToast("error", error.message || "Unmerge failed.");
        });
    });

    if (el.detailVoterList) {
      el.detailVoterList.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var linkButton = target.closest("[data-open-post-id]");
        if (!linkButton) {
          return;
        }

        var postId = linkButton.getAttribute("data-open-post-id");
        var boardId = linkButton.getAttribute("data-open-board-id");
        if (!postId || !boardId) {
          return;
        }

        void openLinkedIdea(boardId, postId);
      });
    }

    if (el.detailVoterSummary) {
      el.detailVoterSummary.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var exportBtn = target.closest("[data-export-voters]");
        if (exportBtn && state.selectedPostId) {
          exportVotersToCsv(state.selectedPostId);
        }
      });
    }

    el.addComment.addEventListener("click", function () {
      var post = getSelectedPost();
      if (!post) {
        return;
      }

      var body = el.newComment.value.trim();
      if (!body) {
        return;
      }

      setButtonBusy(el.addComment, true, "Posting...");
      request("/api/company/comments", {
        method: "POST",
        body: {
          postId: post.id,
          body: body,
          replyToCommentId: state.commentReplyTarget ? state.commentReplyTarget.commentId : undefined
        }
      })
        .then(function () {
          el.newComment.value = "";
          state.commentReplyTarget = null;
          return loadFeedback();
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to add comment.");
        })
        .finally(function () {
          setButtonBusy(el.addComment, false);
        });
    });

    el.detailComments.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var replyBtn = target.closest(".reply-btn");

      if (!replyBtn) {
        return;
      }

      var author = replyBtn.getAttribute("data-reply-author");
      var commentId = replyBtn.getAttribute("data-reply-comment-id");
      if (!author || !commentId) {
        return;
      }

      state.commentReplyTarget = {
        commentId: commentId,
        authorName: author
      };
      renderCommentReplyContext();
      el.newComment.focus();
    });

    el.commentReplyContext.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var clearReply = target.closest("[data-clear-comment-reply]");
      if (!clearReply) {
        return;
      }

      state.commentReplyTarget = null;
      renderCommentReplyContext();
      el.newComment.focus();
    });

    el.createPost.addEventListener("click", function () {
      var payload = {
        boardId: state.boardId,
        title: el.newTitle.value.trim(),
        details: el.newDetails.value.trim()
      };

      if (!payload.boardId || !payload.title || !payload.details) {
        return;
      }

      setButtonBusy(el.createPost, true, "Creating...");
      request("/api/company/posts", {
        method: "POST",
        body: payload
      })
        .then(function () {
          el.newTitle.value = "";
          el.newDetails.value = "";
          el.composer.classList.add("hidden");
          return Promise.all([
            loadBoards(),
            loadFeedback(),
            loadRoadmap(),
            loadSummary(),
            loadReportingPosts(),
            loadOpportunities()
          ]);
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to create post.");
        })
        .finally(function () {
          setButtonBusy(el.createPost, false);
        });
    });

    el.clearPost.addEventListener("click", function () {
      el.newTitle.value = "";
      el.newDetails.value = "";
      el.composer.classList.add("hidden");
    });

    el.accessRequestList.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var requestButton = target.closest("[data-request-id]");
      if (!(requestButton instanceof HTMLButtonElement)) {
        return;
      }

      var requestId = requestButton.getAttribute("data-request-id");
      var status = requestButton.getAttribute("data-status");
      if (!requestId || !status) {
        return;
      }

      setButtonBusy(requestButton, true, status === "approved" ? "Approving..." : "Rejecting...");
      request("/api/company/access-requests/" + encodeURIComponent(requestId), {
        method: "PATCH",
        body: {
          status: status
        }
      })
        .then(function () {
          return loadAccessRequests();
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to update request.");
        })
        .finally(function () {
          setButtonBusy(requestButton, false);
        });
    });

    if (el.boardSettingsList) {
      el.boardSettingsList.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var saveBtn = target.closest("[data-save-board-setting]");
        if (!saveBtn) {
          return;
        }

        var boardId = saveBtn.getAttribute("data-save-board-setting");
        if (!boardId) {
          return;
        }

        var visibilitySelect = el.boardSettingsList.querySelector(
          'select[data-board-setting-visibility=\"' + boardId + '\"]'
        );
        var segmentInput = el.boardSettingsList.querySelector(
          'input[data-board-setting-segments=\"' + boardId + '\"]'
        );

        if (!(visibilitySelect instanceof HTMLSelectElement) || !(segmentInput instanceof HTMLInputElement)) {
          return;
        }

        var segments = segmentInput.value
          .split(",")
          .map(function (segment) {
            return segment.trim();
          })
          .filter(Boolean);

        setButtonBusy(saveBtn, true, "Saving...");
        request("/api/company/board-settings/" + encodeURIComponent(boardId), {
          method: "PATCH",
          body: {
            visibility: visibilitySelect.value,
            allowedSegments: segments
          }
        })
          .then(function () {
            return Promise.all([loadBoards(), loadBoardSettings()]);
          })
          .catch(function (error) {
            pushToast("error", error.message || "Failed to save board settings.");
          })
          .finally(function () {
            setButtonBusy(saveBtn, false);
          });
      });
    }

    el.rteToolbar.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      var button = target.closest("button[data-cmd]");
      if (!button) {
        return;
      }

      var cmd = button.getAttribute("data-cmd");
      if (!cmd) {
        return;
      }

      if (cmd === "togglePreview") {
        setChangelogPreviewState(!state.changelogPreview);
        return;
      }

      el.chContentEditor.focus();

      if (cmd === "createLink") {
        var url = window.prompt("Enter link URL", "https://");
        if (!url) {
          return;
        }

        if (!isHttpUrl(url)) {
          pushToast("error", "Please enter a valid http(s) URL.");
          return;
        }

        document.execCommand("createLink", false, url);
        return;
      }

      if (cmd === "insertImageUrl") {
        var imageUrl = window.prompt("Paste an image URL", "https://");
        if (!imageUrl) {
          return;
        }

        if (!isHttpUrl(imageUrl)) {
          pushToast("error", "Please enter a valid image URL.");
          return;
        }

        insertImageByUrl(imageUrl);
        return;
      }

      if (cmd === "insertVideoUrl") {
        var videoUrl = window.prompt("Paste a video URL", "https://");
        if (!videoUrl) {
          return;
        }

        if (!isHttpUrl(videoUrl)) {
          pushToast("error", "Please enter a valid video URL.");
          return;
        }

        insertVideoByUrl(videoUrl);
        return;
      }

      if (cmd === "uploadImage") {
        if (el.chImageUpload) {
          el.chImageUpload.click();
        }
        return;
      }

      if (cmd === "uploadVideo") {
        if (el.chVideoUpload) {
          el.chVideoUpload.click();
        }
        return;
      }

      if (cmd === "formatH3") {
        document.execCommand("formatBlock", false, "h3");
        return;
      }

      if (cmd === "formatH2") {
        document.execCommand("formatBlock", false, "h2");
        return;
      }

      if (cmd === "blockquote") {
        document.execCommand("formatBlock", false, "blockquote");
        return;
      }

      if (cmd === "insertCodeBlock") {
        var selection = window.getSelection();
        var selectedText = selection ? selection.toString() : "";
        document.execCommand("insertHTML", false, "<pre><code>" + esc(selectedText || "code") + "</code></pre>");
        return;
      }

      document.execCommand(cmd, false, null);
    });

    el.chContentEditor.addEventListener("input", function () {
      if (!state.changelogPreview) {
        return;
      }

      el.rtePreview.innerHTML = sanitizeHtml(el.chContentEditor.innerHTML);
    });

    if (el.chImageUpload) {
      el.chImageUpload.addEventListener("change", function () {
        var file = el.chImageUpload.files && el.chImageUpload.files[0];
        if (!file) {
          return;
        }

        uploadMediaFile(file, "image")
          .then(function (result) {
            if (!result.url) {
              throw new Error("Upload failed.");
            }
            insertImageByUrl(result.url);
          })
          .catch(function (error) {
            pushToast("error", error.message || "Failed to upload image.");
          })
          .finally(function () {
            el.chImageUpload.value = "";
          });
      });
    }

    if (el.chVideoUpload) {
      el.chVideoUpload.addEventListener("change", function () {
        var file = el.chVideoUpload.files && el.chVideoUpload.files[0];
        if (!file) {
          return;
        }

        uploadMediaFile(file, "video")
          .then(function (result) {
            if (!result.url) {
              throw new Error("Upload failed.");
            }
            insertVideoByUrl(result.url);
          })
          .catch(function (error) {
            pushToast("error", error.message || "Failed to upload video.");
          })
          .finally(function () {
            el.chVideoUpload.value = "";
          });
      });
    }

    el.chCreate.addEventListener("click", function () {
      var content = getEditorHtml().trim();
      var plainText = el.chContentEditor.textContent ? el.chContentEditor.textContent.trim() : "";
      var tags = el.chTags.value
        .split(",")
        .map(function (value) {
          return value.trim();
        })
        .filter(Boolean);
      var payload = {
        entryId: el.chEditingId ? el.chEditingId.value || undefined : undefined,
        boardId: el.chBoard.value,
        title: el.chTitle.value.trim(),
        content: content,
        tags: tags,
        isPublished: true
      };

      if (!payload.boardId || !payload.title || !plainText) {
        return;
      }

      setButtonBusy(el.chCreate, true, "Publishing...");
      request("/api/company/changelog", {
        method: "POST",
        body: payload
      })
        .then(function () {
          resetChangelogComposer();
          return loadChangelog();
        })
        .catch(function (error) {
          pushToast("error", error.message || "Failed to publish changelog.");
        })
        .finally(function () {
          setButtonBusy(el.chCreate, false);
        });
    });

    if (el.chSaveDraft) {
      el.chSaveDraft.addEventListener("click", function () {
        var content = getEditorHtml().trim();
        var plainText = el.chContentEditor.textContent ? el.chContentEditor.textContent.trim() : "";
        var tags = el.chTags.value
          .split(",")
          .map(function (value) {
            return value.trim();
          })
          .filter(Boolean);
        var payload = {
          entryId: el.chEditingId ? el.chEditingId.value || undefined : undefined,
          boardId: el.chBoard.value,
          title: el.chTitle.value.trim(),
          content: content,
          tags: tags,
          isPublished: false
        };

        if (!payload.boardId || !payload.title || !plainText) {
          return;
        }

        setButtonBusy(el.chSaveDraft, true, "Saving...");
        request("/api/company/changelog", {
          method: "POST",
          body: payload
        })
          .then(function () {
            resetChangelogComposer();
            state.changelogStatus = "draft";
            if (el.changelogStatusFilter) {
              el.changelogStatusFilter.value = "draft";
            }
            return loadChangelog();
          })
          .catch(function (error) {
            pushToast("error", error.message || "Failed to save draft.");
          })
          .finally(function () {
            setButtonBusy(el.chSaveDraft, false);
          });
      });
    }

    if (el.chClear) {
      el.chClear.addEventListener("click", function () {
        resetChangelogComposer();
      });
    }

    if (el.changelogQuery) {
      el.changelogQuery.addEventListener("input", function () {
        state.changelogQuery = el.changelogQuery.value.trim();
        void loadChangelog();
      });
    }

    if (el.changelogBoardFilter) {
      el.changelogBoardFilter.addEventListener("change", function () {
        state.changelogBoardId = el.changelogBoardFilter.value || "all";
        void loadChangelog();
      });
    }

    if (el.changelogStatusFilter) {
      el.changelogStatusFilter.addEventListener("change", function () {
        state.changelogStatus = el.changelogStatusFilter.value || "all";
        void loadChangelog();
      });
    }

    if (el.changelogTagFilter) {
      el.changelogTagFilter.addEventListener("input", function () {
        state.changelogTag = el.changelogTagFilter.value.trim();
        void loadChangelog();
      });
    }

    if (el.changelogRefresh) {
      el.changelogRefresh.addEventListener("click", function () {
        void loadChangelog();
      });
    }

    if (el.changelogList) {
      el.changelogList.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var item = target.closest("[data-changelog-id]");
        if (!item) {
          return;
        }

        var id = item.getAttribute("data-changelog-id");
        if (!id) {
          return;
        }

        state.selectedChangelogId = id;
        renderChangelog(state.changelogEntries);
      });
    }

    if (el.chEditEntry) {
      el.chEditEntry.addEventListener("click", function () {
        var selected = state.changelogEntries.find(function (entry) {
          return entry.id === state.selectedChangelogId;
        });
        if (!selected) {
          return;
        }
        applyChangelogEntryToComposer(selected);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    if (el.aiInboxTabs) {
      el.aiInboxTabs.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var tabButton = target.closest("[data-ai-tab]");
        if (!tabButton) {
          return;
        }

        state.aiInboxTab = tabButton.getAttribute("data-ai-tab") || "incoming";
        renderAiInboxViews();
      });
    }

    if (el.triageList) {
      el.triageList.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var createButton = target.closest("[data-create-idea-id]");
        var createId = createButton ? createButton.getAttribute("data-create-idea-id") : null;
        if (createId) {
          var boardSelect = el.triageList.querySelector('select[data-create-board="' + createId + '"]');
          var titleInput = el.triageList.querySelector('input[data-create-title="' + createId + '"]');
          var detailsInput = el.triageList.querySelector('textarea[data-create-description="' + createId + '"]');
          if (!boardSelect || !titleInput || !detailsInput) {
            pushToast("error", "Unable to read create-idea fields.");
            return;
          }

          var boardId = boardSelect.value || "";
          var title = titleInput.value.trim();
          var details = detailsInput.value.trim();
          if (!boardId || !title || !details) {
            pushToast("info", "Provide board, title, and details before creating the idea.");
            return;
          }

          if (createButton instanceof HTMLButtonElement) {
            setButtonBusy(createButton, true, "Creating...");
          }

          request("/api/company/triage/" + encodeURIComponent(createId) + "/create-idea", {
            method: "POST",
            body: {
              boardId: boardId,
              title: title,
              details: details
            }
          })
            .then(function () {
              return Promise.all([
                loadFeedback(),
                loadRoadmap(),
                loadTriage(),
                loadSummary(),
                loadReportingPosts(),
                loadOpportunities(),
                loadCustomerView()
              ]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to create idea from AI inbox event.");
            })
            .finally(function () {
              if (createButton instanceof HTMLButtonElement) {
                setButtonBusy(createButton, false);
              }
            });
          return;
        }

        var mergeButton = target.closest("[data-merge-id]");
        var mergeId = mergeButton ? mergeButton.getAttribute("data-merge-id") : null;
        if (!mergeId) {
          return;
        }

        var select = el.triageList.querySelector('select[data-triage-select="' + mergeId + '"]');
        if (!select) {
          return;
        }

        if (!select.value) {
          pushToast("info", "Pick a roadmap post to merge this event.");
          return;
        }

        if (mergeButton instanceof HTMLButtonElement) {
          setButtonBusy(mergeButton, true, "Merging...");
        }
        request("/api/company/triage/" + encodeURIComponent(mergeId) + "/merge", {
          method: "POST",
          body: {
            postId: select.value
          }
        })
          .then(function () {
            return Promise.all([
              loadFeedback(),
              loadRoadmap(),
              loadTriage(),
              loadSummary(),
              loadReportingPosts(),
              loadOpportunities(),
              loadCustomerView()
            ]);
          })
          .catch(function (error) {
            pushToast("error", error.message || "Failed to merge triage event.");
          })
          .finally(function () {
            if (mergeButton instanceof HTMLButtonElement) {
              setButtonBusy(mergeButton, false);
            }
          });
      });
    }

    if (el.triageConfigList) {
      el.triageConfigList.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var zoomConnectButton = target.closest("[data-zoom-connect]");
        if (zoomConnectButton) {
          setLoading("zoom", true);
          renderTriageConfig();
          request("/api/integrations/zoom/connect-url")
            .then(function (result) {
              if (!result || !result.url) {
                throw new Error("Unable to generate Zoom connect URL.");
              }

              var popup = window.open(result.url, "_blank", "noopener,noreferrer");
              if (!popup) {
                window.location.assign(result.url);
                return;
              }

              window.setTimeout(function () {
                void loadZoomConnectionStatus();
              }, 1500);
              window.setTimeout(function () {
                void loadZoomConnectionStatus();
              }, 4500);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to open Zoom connect flow.");
            })
            .finally(function () {
              setLoading("zoom", false);
              renderTriageConfig();
            });
          return;
        }

        var zoomImportButton = target.closest("[data-zoom-import]");
        if (zoomImportButton) {
          if (zoomImportButton instanceof HTMLButtonElement) {
            setButtonBusy(zoomImportButton, true, "Importing...");
          }

          request("/api/integrations/zoom/import-transcripts", {
            method: "POST",
            body: {
              daysBack: 30,
              maxMeetings: 40
            }
          })
            .then(function (result) {
              var imported = Number(result.imported || 0);
              var queued = Number(result.queued || 0);
              pushToast("success", "Imported " + imported + " transcript(s), queued " + queued + " for AI.");
              return Promise.all([
                loadZoomConnectionStatus(),
                loadTriage(),
                loadSummary(),
                loadReportingPosts(),
                loadOpportunities()
              ]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to import Zoom transcripts.");
            })
            .finally(function () {
              if (zoomImportButton instanceof HTMLButtonElement) {
                setButtonBusy(zoomImportButton, false);
              }
            });
          return;
        }

        var zoomDisconnectButton = target.closest("[data-zoom-disconnect]");
        if (zoomDisconnectButton) {
          if (zoomDisconnectButton instanceof HTMLButtonElement) {
            setButtonBusy(zoomDisconnectButton, true, "Disconnecting...");
          }

          request("/api/integrations/zoom/disconnect", {
            method: "POST"
          })
            .then(function () {
              state.zoomConnection = defaultZoomConnection();
              pushToast("success", "Zoom disconnected.");
              return Promise.all([loadZoomConnectionStatus(), loadTriage()]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to disconnect Zoom.");
            })
            .finally(function () {
              if (zoomDisconnectButton instanceof HTMLButtonElement) {
                setButtonBusy(zoomDisconnectButton, false);
              }
            });
          return;
        }

        var freshdeskFetchParamsButton = target.closest("[data-freshdesk-fetch-params]");
        if (freshdeskFetchParamsButton) {
          setLoading("freshdesk", true);
          renderTriageConfig();
          request("/api/integrations/freshdesk/params")
            .then(function (result) {
              state.freshdeskConnection = result.connection || defaultFreshdeskConnection();
              state.freshdeskParams = Array.isArray(result.params) ? result.params : [];
              state.errors.freshdesk = "";
              pushToast("success", "Freshdesk params synced.");
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to fetch Freshdesk params.");
            })
            .finally(function () {
              setLoading("freshdesk", false);
              renderTriageConfig();
            });
          return;
        }

        var freshdeskSaveConfigButton = target.closest("[data-freshdesk-save-config]");
        if (freshdeskSaveConfigButton) {
          var domainInput = el.triageConfigList.querySelector("input[data-freshdesk-domain]");
          var apiKeyInput = el.triageConfigList.querySelector("input[data-freshdesk-api-key]");
          var filterFieldSelect = el.triageConfigList.querySelector("select[data-freshdesk-filter-field]");
          var filterValueInput = el.triageConfigList.querySelector("input[data-freshdesk-filter-value]");

          if (!domainInput || !apiKeyInput || !filterFieldSelect || !filterValueInput) {
            pushToast("error", "Unable to read Freshdesk config form.");
            return;
          }

          if (freshdeskSaveConfigButton instanceof HTMLButtonElement) {
            setButtonBusy(freshdeskSaveConfigButton, true, "Saving...");
          }

          var domain = domainInput.value.trim();
          var apiKey = apiKeyInput.value.trim();
          var filterField = filterFieldSelect.value.trim();
          var filterValue = filterValueInput.value.trim();

          request("/api/integrations/freshdesk/configure", {
            method: "POST",
            body: {
              domain: domain || undefined,
              apiKey: apiKey || undefined,
              filterField: filterField || "",
              filterValue: filterValue || ""
            }
          })
            .then(function (result) {
              state.freshdeskConnection = result.connection || defaultFreshdeskConnection();
              state.freshdeskParams = Array.isArray(result.params) ? result.params : state.freshdeskParams;
              state.errors.freshdesk = "";
              pushToast("success", "Freshdesk configuration saved.");
              return loadFreshdeskStatus();
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to save Freshdesk config.");
            })
            .finally(function () {
              if (freshdeskSaveConfigButton instanceof HTMLButtonElement) {
                setButtonBusy(freshdeskSaveConfigButton, false);
              }
            });
          return;
        }

        var freshdeskImportButton = target.closest("[data-freshdesk-import]");
        if (freshdeskImportButton) {
          if (freshdeskImportButton instanceof HTMLButtonElement) {
            setButtonBusy(freshdeskImportButton, true, "Importing...");
          }

          request("/api/integrations/freshdesk/import-tickets", {
            method: "POST",
            body: {
              daysBack: 30,
              maxTickets: 120,
              processInline: true
            }
          })
            .then(function (result) {
              state.freshdeskConnection = result.connection || state.freshdeskConnection;
              state.errors.freshdesk = "";
              var scanned = Number(result.scanned || 0);
              var matched = Number(result.matched || 0);
              var imported = Number(result.imported || 0);
              pushToast(
                "success",
                "Freshdesk import complete: scanned " +
                  scanned +
                  ", matched " +
                  matched +
                  ", ingested " +
                  imported +
                  "."
              );
              return Promise.all([
                loadFreshdeskStatus(),
                loadTriage(),
                loadSummary(),
                loadFeedback(),
                loadRoadmap(),
                loadReportingPosts(),
                loadOpportunities()
              ]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to import Freshdesk tickets.");
            })
            .finally(function () {
              if (freshdeskImportButton instanceof HTMLButtonElement) {
                setButtonBusy(freshdeskImportButton, false);
              }
            });
          return;
        }

        var freshdeskDisconnectButton = target.closest("[data-freshdesk-disconnect]");
        if (freshdeskDisconnectButton) {
          if (freshdeskDisconnectButton instanceof HTMLButtonElement) {
            setButtonBusy(freshdeskDisconnectButton, true, "Disconnecting...");
          }

          request("/api/integrations/freshdesk/disconnect", {
            method: "POST"
          })
            .then(function (result) {
              state.freshdeskConnection = result.connection || defaultFreshdeskConnection();
              state.freshdeskParams = Array.isArray(result.params) ? result.params : [];
              state.errors.freshdesk = "";
              pushToast("success", "Freshdesk disconnected.");
              return Promise.all([loadFreshdeskStatus(), loadTriage()]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to disconnect Freshdesk.");
            })
            .finally(function () {
              if (freshdeskDisconnectButton instanceof HTMLButtonElement) {
                setButtonBusy(freshdeskDisconnectButton, false);
              }
            });
          return;
        }

        var saveButton = target.closest("[data-config-save]");
        if (!saveButton) {
          return;
        }

        var source = saveButton.getAttribute("data-config-save");
        if (!source) {
          return;
        }

        var routingSelect = el.triageConfigList.querySelector('select[data-config-routing="' + source + '"]');
        var enabledInput = el.triageConfigList.querySelector('input[data-config-enabled="' + source + '"]');
        if (!routingSelect || !enabledInput) {
          pushToast("error", "Unable to read AI source settings.");
          return;
        }

        if (saveButton instanceof HTMLButtonElement) {
          setButtonBusy(saveButton, true, "Saving...");
        }

        request("/api/company/triage/config", {
          method: "PATCH",
          body: {
            source: source,
            routingMode: routingSelect.value === "individual" ? "individual" : "central",
            enabled: Boolean(enabledInput.checked)
          }
        })
          .then(function (result) {
            var updated = result.source || null;
            if (updated && updated.source) {
              state.triageConfig = normalizeAiInboxConfig(
                state.triageConfig
                  .filter(function (item) {
                    return item.source !== updated.source;
                  })
                  .concat([updated])
              );
              renderTriageConfig();
              pushToast("success", sourceLabel(updated.source) + " routing saved.");
            }

            return loadTriage();
          })
          .catch(function (error) {
            pushToast("error", error.message || "Failed to update AI source routing.");
          })
          .finally(function () {
            if (saveButton instanceof HTMLButtonElement) {
              setButtonBusy(saveButton, false);
            }
          });
      });
    }

    // Event listeners for new integration cards (Zoom & Freshdesk)
    var zoomIntegrationCard = document.getElementById("zoom-integration-card");
    if (zoomIntegrationCard) {
      zoomIntegrationCard.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var zoomConnectButton = target.closest("[data-zoom-connect]");
        if (zoomConnectButton) {
          setLoading("zoom", true);
          renderTriageConfig();
          request("/api/integrations/zoom/connect-url")
            .then(function (result) {
              if (!result || !result.url) {
                throw new Error("Unable to generate Zoom connect URL.");
              }
              var popup = window.open(result.url, "_blank", "noopener,noreferrer");
              if (!popup) {
                window.location.assign(result.url);
                return;
              }
              window.setTimeout(function () {
                void loadZoomConnectionStatus();
              }, 1500);
              window.setTimeout(function () {
                void loadZoomConnectionStatus();
              }, 4500);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to open Zoom connect flow.");
            })
            .finally(function () {
              setLoading("zoom", false);
              renderTriageConfig();
            });
          return;
        }

        var zoomImportButton = target.closest("[data-zoom-import]");
        if (zoomImportButton) {
          if (zoomImportButton instanceof HTMLButtonElement) {
            setButtonBusy(zoomImportButton, true, "Importing...");
          }
          request("/api/integrations/zoom/import-transcripts", {
            method: "POST",
            body: { daysBack: 30, maxMeetings: 40 }
          })
            .then(function (result) {
              var imported = Number(result.imported || 0);
              var queued = Number(result.queued || 0);
              pushToast("success", "Imported " + imported + " transcript(s), queued " + queued + " for AI processing.");
              return Promise.all([
                loadZoomConnectionStatus(),
                loadTriage(),
                loadSummary(),
                loadReportingPosts(),
                loadOpportunities()
              ]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to import Zoom transcripts.");
            })
            .finally(function () {
              if (zoomImportButton instanceof HTMLButtonElement) {
                setButtonBusy(zoomImportButton, false);
              }
            });
          return;
        }

        var zoomDisconnectButton = target.closest("[data-zoom-disconnect]");
        if (zoomDisconnectButton) {
          if (zoomDisconnectButton instanceof HTMLButtonElement) {
            setButtonBusy(zoomDisconnectButton, true, "Disconnecting...");
          }
          request("/api/integrations/zoom/disconnect", { method: "POST" })
            .then(function () {
              state.zoomConnection = defaultZoomConnection();
              pushToast("success", "Zoom disconnected.");
              return Promise.all([loadZoomConnectionStatus(), loadTriage()]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to disconnect Zoom.");
            })
            .finally(function () {
              if (zoomDisconnectButton instanceof HTMLButtonElement) {
                setButtonBusy(zoomDisconnectButton, false);
              }
            });
          return;
        }
      });
    }

    var freshdeskIntegrationCard = document.getElementById("freshdesk-integration-card");
    if (freshdeskIntegrationCard) {
      freshdeskIntegrationCard.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var fetchParamsButton = target.closest("[data-freshdesk-fetch-params]");
        if (fetchParamsButton) {
          setLoading("freshdesk", true);
          renderTriageConfig();
          request("/api/integrations/freshdesk/params")
            .then(function (result) {
              state.freshdeskConnection = result.connection || defaultFreshdeskConnection();
              state.freshdeskParams = Array.isArray(result.params) ? result.params : [];
              state.errors.freshdesk = "";
              pushToast("success", "Freshdesk fields synced.");
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to fetch Freshdesk fields.");
            })
            .finally(function () {
              setLoading("freshdesk", false);
              renderTriageConfig();
            });
          return;
        }

        var saveConfigButton = target.closest("[data-freshdesk-save-config]");
        if (saveConfigButton) {
          var domainInput = freshdeskIntegrationCard.querySelector("input[data-freshdesk-domain]");
          var apiKeyInput = freshdeskIntegrationCard.querySelector("input[data-freshdesk-api-key]");
          var filterFieldSelect = freshdeskIntegrationCard.querySelector("select[data-freshdesk-filter-field]");
          var filterValueInput = freshdeskIntegrationCard.querySelector("input[data-freshdesk-filter-value]");

          if (!domainInput || !apiKeyInput || !filterFieldSelect || !filterValueInput) {
            pushToast("error", "Unable to read Freshdesk config form.");
            return;
          }

          if (saveConfigButton instanceof HTMLButtonElement) {
            setButtonBusy(saveConfigButton, true, "Saving...");
          }

          var domain = domainInput.value.trim();
          var apiKey = apiKeyInput.value.trim();
          var filterField = filterFieldSelect.value.trim();
          var filterValue = filterValueInput.value.trim();

          request("/api/integrations/freshdesk/configure", {
            method: "POST",
            body: {
              domain: domain || undefined,
              apiKey: apiKey || undefined,
              filterField: filterField || "",
              filterValue: filterValue || ""
            }
          })
            .then(function (result) {
              state.freshdeskConnection = result.connection || defaultFreshdeskConnection();
              state.freshdeskParams = Array.isArray(result.params) ? result.params : state.freshdeskParams;
              state.errors.freshdesk = "";
              pushToast("success", "Freshdesk configuration saved.");
              return loadFreshdeskStatus();
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to save Freshdesk config.");
            })
            .finally(function () {
              if (saveConfigButton instanceof HTMLButtonElement) {
                setButtonBusy(saveConfigButton, false);
              }
            });
          return;
        }

        var importButton = target.closest("[data-freshdesk-import]");
        if (importButton) {
          if (importButton instanceof HTMLButtonElement) {
            setButtonBusy(importButton, true, "Importing...");
          }
          request("/api/integrations/freshdesk/import-tickets", {
            method: "POST",
            body: { daysBack: 30, maxTickets: 120, processInline: true }
          })
            .then(function (result) {
              state.freshdeskConnection = result.connection || state.freshdeskConnection;
              state.errors.freshdesk = "";
              var scanned = Number(result.scanned || 0);
              var matched = Number(result.matched || 0);
              var imported = Number(result.imported || 0);
              pushToast(
                "success",
                "Freshdesk: scanned " + scanned + ", matched " + matched + ", imported " + imported + " tickets."
              );
              return Promise.all([
                loadFreshdeskStatus(),
                loadTriage(),
                loadSummary(),
                loadFeedback(),
                loadRoadmap(),
                loadReportingPosts(),
                loadOpportunities()
              ]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to import Freshdesk tickets.");
            })
            .finally(function () {
              if (importButton instanceof HTMLButtonElement) {
                setButtonBusy(importButton, false);
              }
            });
          return;
        }

        var disconnectButton = target.closest("[data-freshdesk-disconnect]");
        if (disconnectButton) {
          if (disconnectButton instanceof HTMLButtonElement) {
            setButtonBusy(disconnectButton, true, "Disconnecting...");
          }
          request("/api/integrations/freshdesk/disconnect", { method: "POST" })
            .then(function (result) {
              state.freshdeskConnection = result.connection || defaultFreshdeskConnection();
              state.freshdeskParams = Array.isArray(result.params) ? result.params : [];
              state.errors.freshdesk = "";
              pushToast("success", "Freshdesk disconnected.");
              return Promise.all([loadFreshdeskStatus(), loadTriage()]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to disconnect Freshdesk.");
            })
            .finally(function () {
              if (disconnectButton instanceof HTMLButtonElement) {
                setButtonBusy(disconnectButton, false);
              }
            });
          return;
        }
      });
    }

    // Slack integration card event listeners
    var slackIntegrationCard = document.getElementById("slack-integration-card");
    if (slackIntegrationCard) {
      slackIntegrationCard.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var slackConnectButton = target.closest("[data-slack-connect]");
        if (slackConnectButton) {
          setLoading("slack", true);
          renderTriageConfig();
          request("/api/integrations/slack/connect-url")
            .then(function (result) {
              if (!result || !result.url) {
                throw new Error("Unable to generate Slack connect URL. Make sure SLACK_CLIENT_ID is configured.");
              }
              var popup = window.open(result.url, "_blank", "noopener,noreferrer");
              if (!popup) {
                window.location.assign(result.url);
                return;
              }
              window.setTimeout(function () {
                void loadSlackConnectionStatus();
              }, 1500);
              window.setTimeout(function () {
                void loadSlackConnectionStatus();
                void loadSlackChannels();
              }, 4500);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to open Slack connect flow.");
            })
            .finally(function () {
              setLoading("slack", false);
              renderTriageConfig();
            });
          return;
        }

        var slackFetchChannelsButton = target.closest("[data-slack-fetch-channels]");
        if (slackFetchChannelsButton) {
          if (slackFetchChannelsButton instanceof HTMLButtonElement) {
            setButtonBusy(slackFetchChannelsButton, true, "Fetching...");
          }
          loadSlackChannels()
            .finally(function () {
              if (slackFetchChannelsButton instanceof HTMLButtonElement) {
                setButtonBusy(slackFetchChannelsButton, false);
              }
            });
          return;
        }

        var slackSaveChannelsButton = target.closest("[data-slack-save-channels]");
        if (slackSaveChannelsButton) {
          var checkboxes = slackIntegrationCard.querySelectorAll("input[data-slack-channel]:checked");
          var channelIds = [];
          var channelNames = [];
          checkboxes.forEach(function (cb) {
            channelIds.push(cb.getAttribute("data-slack-channel"));
            channelNames.push(cb.getAttribute("data-channel-name"));
          });

          if (slackSaveChannelsButton instanceof HTMLButtonElement) {
            setButtonBusy(slackSaveChannelsButton, true, "Saving...");
          }

          request("/api/integrations/slack/configure-channels", {
            method: "POST",
            body: { channelIds: channelIds, channelNames: channelNames }
          })
            .then(function (result) {
              state.slackConnection = result.connection || state.slackConnection;
              pushToast("success", "Slack channels saved. " + channelIds.length + " channel(s) selected.");
              return loadSlackConnectionStatus();
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to save Slack channels.");
            })
            .finally(function () {
              if (slackSaveChannelsButton instanceof HTMLButtonElement) {
                setButtonBusy(slackSaveChannelsButton, false);
              }
            });
          return;
        }

        var slackImportButton = target.closest("[data-slack-import]");
        if (slackImportButton) {
          if (slackImportButton instanceof HTMLButtonElement) {
            setButtonBusy(slackImportButton, true, "Importing...");
          }
          request("/api/integrations/slack/import-messages", {
            method: "POST",
            body: { daysBack: 7, maxMessages: 100 }
          })
            .then(function (result) {
              var imported = Number(result.imported || 0);
              var processed = Number(result.processed || 0);
              var channelsScanned = Number(result.channelsScanned || 0);
              pushToast(
                "success",
                "Slack: imported " + imported + " messages from " + channelsScanned + " channel(s), processed " + processed + "."
              );
              return Promise.all([
                loadSlackConnectionStatus(),
                loadTriage(),
                loadSummary(),
                loadFeedback(),
                loadRoadmap(),
                loadReportingPosts(),
                loadOpportunities()
              ]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to import Slack messages.");
            })
            .finally(function () {
              if (slackImportButton instanceof HTMLButtonElement) {
                setButtonBusy(slackImportButton, false);
              }
            });
          return;
        }

        var slackDisconnectButton = target.closest("[data-slack-disconnect]");
        if (slackDisconnectButton) {
          if (slackDisconnectButton instanceof HTMLButtonElement) {
            setButtonBusy(slackDisconnectButton, true, "Disconnecting...");
          }
          request("/api/integrations/slack/disconnect", { method: "POST" })
            .then(function () {
              state.slackConnection = defaultSlackConnection();
              state.slackChannels = [];
              pushToast("success", "Slack disconnected.");
              return Promise.all([loadSlackConnectionStatus(), loadTriage()]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to disconnect Slack.");
            })
            .finally(function () {
              if (slackDisconnectButton instanceof HTMLButtonElement) {
                setButtonBusy(slackDisconnectButton, false);
              }
            });
          return;
        }
      });
    }

    if (el.triageStatusFilter) {
      el.triageStatusFilter.addEventListener("change", function () {
        state.triageStatus = el.triageStatusFilter.value || "needs_triage";
        void loadTriage();
      });
    }

    if (el.triageSourceFilter) {
      el.triageSourceFilter.addEventListener("change", function () {
        state.triageSource = el.triageSourceFilter.value || "all";
        void loadTriage();
      });
    }

    if (el.triageSearch) {
      el.triageSearch.addEventListener("input", function () {
        state.triageQuery = el.triageSearch.value.trim();
        void loadTriage();
      });
    }

    if (el.triageMinMrr) {
      el.triageMinMrr.addEventListener("input", function () {
        state.triageMinMrr = Number(el.triageMinMrr.value || 0);
        void loadTriage();
      });
    }

    if (el.triageRefresh) {
      el.triageRefresh.addEventListener("click", function () {
        void loadTriage();
      });
    }

    if (el.customerViewQuery) {
      el.customerViewQuery.addEventListener("input", function () {
        state.customerViewQuery = el.customerViewQuery.value.trim();
        void loadCustomerView();
      });
    }

    if (el.customerViewBoard) {
      el.customerViewBoard.addEventListener("change", function () {
        state.customerViewBoardId = el.customerViewBoard.value || "all";
        void loadCustomerView();
      });
    }

    if (el.customerViewMinMrr) {
      el.customerViewMinMrr.addEventListener("input", function () {
        state.customerViewMinMrr = Number(el.customerViewMinMrr.value || 0);
        void loadCustomerView();
      });
    }

    if (el.customerViewRefresh) {
      el.customerViewRefresh.addEventListener("click", function () {
        void loadCustomerView();
      });
    }

    if (el.customerViewList) {
      el.customerViewList.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        var openButton = target.closest("[data-open-post-id]");
        if (!openButton) {
          return;
        }

        var postId = openButton.getAttribute("data-open-post-id");
        var boardId = openButton.getAttribute("data-open-board-id");
        if (!postId || !boardId) {
          return;
        }

        void openLinkedIdea(boardId, postId);
      });
    }

    el.exportPostsCsv.addEventListener("click", function () {
      window.open("/api/company/export/posts.csv", "_blank");
    });

    el.exportCommentsCsv.addEventListener("click", function () {
      window.open("/api/company/export/comments.csv", "_blank");
    });
  }

  function bootstrap() {
    renderTabs();
    renderSavedViews();
    renderAiInboxViews();
    renderCreateBoardSegments();
    setChangelogPreviewState(false);
    renderCommentReplyContext();
    renderChangelogPreview(null);
    renderCustomerView();

    if (el.changelogStatusFilter) {
      el.changelogStatusFilter.value = state.changelogStatus;
    }
    if (el.triageStatusFilter) {
      el.triageStatusFilter.value = state.triageStatus;
    }
    if (el.triageSourceFilter) {
      el.triageSourceFilter.value = state.triageSource;
    }

    state.errors.reportingSummary = "";
    state.errors.reportingPosts = "";
    state.errors.reportingOpportunities = "";

    Promise.all([loadSummary(), loadMembers(), loadBoards(), loadSavedFilters()])
      .then(function () {
        return Promise.all([
          loadFeedback(),
          loadRoadmap(),
          loadAccessRequests(),
          loadBoardSettings(),
          loadChangelog(),
          loadTriage(),
          loadZoomConnectionStatus(),
          loadFreshdeskStatus(),
          loadReportingPosts(),
          loadOpportunities(),
          loadCustomerView()
        ]);
      })
      .catch(function (error) {
        console.error("Company bootstrap failed", error);
      });
  }

  bindEvents();
  bootstrap();
})(window, document);
