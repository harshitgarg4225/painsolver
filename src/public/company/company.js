(function companyApp(window, document) {
  var state = {
    // Auth state
    authUser: null, // { id, email, name, role, companyId, companySlug, companyName }
    isAuthenticated: false,
    companyId: null,  // Multi-tenancy: current company context
    companySlug: null,
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
    customDomains: [],
    activeDomainId: null,
    portalSettings: {
      portalName: "PainSolver",
      primaryColor: "#004549",
      accentColor: "#00eef9"
    },
    summary: {
      boardCount: 0,
      postCount: 0,
      triageCount: 0,
      totalAttachedMrr: 0
    },
    reportingPosts: [],
    commentReplyTarget: null,
    changelogPreview: false,
    knowledgeHubLoaded: false,
    knowledgeHubData: null,
    clickUpConnection: null,
    trendsData: null,
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
    exportCommentsCsv: document.getElementById("export-comments-csv"),
    aiThresholdSlider: document.getElementById("ai-threshold-slider"),
    aiThresholdValue: document.getElementById("ai-threshold-value"),
    aiTriageModeToggle: document.getElementById("ai-triage-mode-toggle"),
    aiTriageModeLabel: document.getElementById("ai-triage-mode-label"),
    aiSpamDetectionToggle: document.getElementById("ai-spam-detection-toggle"),
    aiSpamDetectionLabel: document.getElementById("ai-spam-detection-label"),
    aiInboxKnowledgeHub: document.getElementById("ai-inbox-knowledge-hub"),
    knowledgeHubContent: document.getElementById("knowledge-hub-content"),
    clickUpIntegrationCard: document.getElementById("clickup-integration-card"),
    clickUpConnectionStatus: document.getElementById("clickup-connection-status"),
    clickUpConfigForm: document.getElementById("clickup-config-form"),
    clickUpStatusDetails: document.getElementById("clickup-status-details"),
    clickUpActions: document.getElementById("clickup-actions"),
    trendsGrid: document.getElementById("trends-grid")
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

  // Freshdesk Activity Modal
  function showFreshdeskActivityModal(data) {
    // Remove existing modal if any
    var existingModal = document.getElementById("freshdesk-activity-modal");
    if (existingModal) {
      existingModal.remove();
    }

    var events = data.events || [];
    var summary = data.summary || {};

    var eventsHtml = events.length === 0
      ? '<p class="empty-state">No Freshdesk activity yet. Import tickets or set up a webhook to get started.</p>'
      : events.map(function (e) {
          var statusClass = e.status === "auto_merged" ? "status-merged" :
                            e.status === "needs_triage" ? "status-triage" :
                            e.status === "pending_ai" ? "status-pending" : "status-skipped";
          var statusLabel = e.status === "auto_merged" ? "Auto-merged" :
                            e.status === "needs_triage" ? "Needs Review" :
                            e.status === "pending_ai" ? "Processing..." : "Skipped";
          var matchedHtml = e.matchedPost
            ? '<div class="activity-matched"><span class="ms">link</span> Matched: ' + esc(e.matchedPost.title) + '</div>'
            : '';
          var aiHtml = e.aiAction
            ? '<div class="activity-ai">' +
                (e.aiAction.category ? '<span class="ai-tag">' + esc(e.aiAction.category) + '</span>' : '') +
                (e.aiAction.sentiment ? '<span class="ai-tag sentiment-' + esc(e.aiAction.sentiment) + '">' + esc(e.aiAction.sentiment) + '</span>' : '') +
                (e.aiAction.confidence ? '<span class="ai-confidence">' + Math.round(e.aiAction.confidence * 100) + '% confidence</span>' : '') +
              '</div>'
            : '';

          return '<div class="activity-item ' + statusClass + '">' +
            '<div class="activity-header">' +
              '<span class="activity-ticket">#' + esc(e.ticketId) + '</span>' +
              '<span class="activity-status ' + statusClass + '">' + statusLabel + '</span>' +
              '<span class="activity-time">' + formatRelativeTime(e.createdAt) + '</span>' +
            '</div>' +
            '<div class="activity-user">' +
              '<strong>' + esc(e.user.name || "Unknown") + '</strong> (' + esc(e.user.email) + ')' +
              (e.user.company ? ' • ' + esc(e.user.company) : '') +
              (e.user.mrr ? ' • $' + Number(e.user.mrr).toLocaleString() + ' MRR' : '') +
            '</div>' +
            '<div class="activity-preview">' + esc(e.preview) + '</div>' +
            matchedHtml +
            aiHtml +
          '</div>';
        }).join("");

    var summaryHtml =
      '<div class="activity-summary">' +
        '<div class="summary-stat"><span class="stat-value">' + (summary.total || 0) + '</span><span class="stat-label">Total</span></div>' +
        '<div class="summary-stat merged"><span class="stat-value">' + (summary.autoMerged || 0) + '</span><span class="stat-label">Auto-merged</span></div>' +
        '<div class="summary-stat triage"><span class="stat-value">' + (summary.needsTriage || 0) + '</span><span class="stat-label">Needs Review</span></div>' +
        '<div class="summary-stat pending"><span class="stat-value">' + (summary.pending || 0) + '</span><span class="stat-label">Processing</span></div>' +
        '<div class="summary-stat skipped"><span class="stat-value">' + (summary.skipped || 0) + '</span><span class="stat-label">Skipped</span></div>' +
      '</div>';

    var modalHtml =
      '<div class="modal-overlay" id="freshdesk-activity-modal">' +
        '<div class="modal-content activity-modal">' +
          '<div class="modal-header">' +
            '<h3><span class="ms">history</span> Freshdesk Activity</h3>' +
            '<button class="modal-close" data-close-modal><span class="ms">close</span></button>' +
          '</div>' +
          summaryHtml +
          '<div class="activity-list">' + eventsHtml + '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    var modal = document.getElementById("freshdesk-activity-modal");
    if (modal) {
      modal.addEventListener("click", function (e) {
        var target = e.target;
        if (target instanceof HTMLElement) {
          if (target.classList.contains("modal-overlay") || target.closest("[data-close-modal]")) {
            modal.remove();
          }
        }
      });
    }
  }

  function formatRelativeTime(isoString) {
    var date = new Date(isoString);
    var now = new Date();
    var diffMs = now.getTime() - date.getTime();
    var diffMins = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMins / 60);
    var diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return diffMins + "m ago";
    if (diffHours < 24) return diffHours + "h ago";
    if (diffDays < 7) return diffDays + "d ago";
    return date.toLocaleDateString();
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
    var h = {
      "Content-Type": "application/json"
    };
    // If authenticated, session cookie is sent automatically.
    // If NOT authenticated (demo mode), send fallback actor headers.
    if (!state.isAuthenticated) {
      h["x-painsolver-role"] = "admin";
      h["x-painsolver-auth"] = "true";
      h["x-painsolver-email"] = "demo@painsolver.io";
      h["x-painsolver-name"] = "Demo User";
      h["x-painsolver-segments"] = "internal";
    }
    // Multi-tenancy: include company context in all requests
    if (state.companyId) {
      h["X-Company-ID"] = state.companyId;
    }
    if (state.companySlug) {
      h["X-Company-Slug"] = state.companySlug;
    }
    return h;
  }

  function request(path, options) {
    return fetch(path, {
      method: (options && options.method) || "GET",
      headers: headers(),
      credentials: "same-origin", // Send session cookies
      body: options && options.body ? JSON.stringify(options.body) : undefined
    }).then(function (response) {
      // If 401/403 and authenticated, redirect to login (session expired)
      if ((response.status === 401 || response.status === 403) && state.isAuthenticated) {
        window.location.href = "/auth";
        return Promise.reject(new Error("Authentication required"));
      }
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
      ["MRR", currency(state.summary.totalAttachedMrr)]
    ]
      .map(function (item) {
        return (
          '<article class="deck-metric">' +
          '<strong>' + esc(item[1]) + '</strong>' +
          '<span>' + esc(item[0]) + '</span>' +
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
        var ownerInitial = (post.ownerName || "?").charAt(0).toUpperCase();
        var descPreview = (post.details || "").length > 140 ? post.details.substring(0, 140) + "…" : (post.details || "");

        return (
          '<article class="feedback-card ' + (isActive ? "is-active" : "") + '" data-post-id="' + esc(post.id) + '">' +
          '<div class="feedback-vote-col">' +
          '<button class="vote-arrow" type="button" title="Upvote"><span class="ms">arrow_drop_up</span></button>' +
          '<span class="vote-count">' + esc(post.voteCount) + '</span>' +
          '</div>' +
          '<div class="feedback-card-body">' +
          '<div class="feedback-card-head">' +
          '<label class="select-post" onclick="event.stopPropagation()">' +
          '<input class="post-select" data-select-post-id="' + esc(post.id) + '" type="checkbox" ' + (isSelected ? "checked" : "") + ' />' +
          '</label>' +
          '<h4>' + esc(post.title) + '</h4>' +
          '<span class="status-pill status-' + esc(post.status) + '">' + esc(statusLabel(post.status)) + '</span>' +
          '</div>' +
          (descPreview ? '<p class="feedback-card-desc">' + esc(descPreview) + '</p>' : '') +
          '<div class="feedback-card-footer">' +
          '<span class="meta-pill"><span class="ms">chat_bubble_outline</span> ' + esc(post.commentCount) + '</span>' +
          '<span class="meta-dot">·</span>' +
          '<span class="meta-pill"><span class="ms">attach_money</span> ' + esc(currency(post.attachedMrr)) + '</span>' +
          (post.ownerName && post.ownerName !== "Unassigned"
            ? '<span class="meta-dot">·</span><span class="owner-pill"><span class="owner-avatar">' + esc(ownerInitial) + '</span> ' + esc(post.ownerName) + '</span>'
            : '') +
          (post.eta ? '<span class="meta-dot">·</span><span class="meta-pill"><span class="ms">event</span> ' + esc(shortDate(post.eta)) + '</span>' : '') +
          (post.capturedViaSupport ? '<span class="meta-dot">·</span><span class="meta-pill"><span class="ms">support_agent</span> Support</span>' : '') +
          (mergedCount ? '<span class="meta-dot">·</span><span class="tag-pill">⊕ ' + esc(mergedCount) + ' merged</span>' : '') +
          tags.map(function (tag) {
            return '<span class="tag-pill">' + esc(tag) + '</span>';
          }).join("") +
          '</div>' +
          '</div>' +
          '</article>'
        );
      })
      .join("");
  }

  function showEditPostModal(post) {
    var modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML =
      '<div class="modal-content edit-post-modal">' +
      '<div class="modal-header"><h3><span class="ms">edit</span> Edit Post</h3>' +
      '<button class="ghost small modal-close" type="button">&times;</button></div>' +
      '<div class="edit-post-form">' +
      '<label>Title<input id="edit-post-title" type="text" value="' + esc(post.title) + '" /></label>' +
      '<label>Description<textarea id="edit-post-description" rows="5">' + esc(post.details || "") + '</textarea></label>' +
      '<label>Tags<input id="edit-post-tags" type="text" value="' + esc((post.tags || []).join(", ")) + '" /></label>' +
      '<div class="edit-post-actions">' +
      '<button class="ghost" id="edit-post-cancel" type="button">Cancel</button>' +
      '<button class="primary" id="edit-post-save" type="button">Save Changes</button>' +
      '</div>' +
      '</div></div>';
    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) {
      if (e.target.closest(".modal-close") || e.target.closest("#edit-post-cancel") || e.target === modal) {
        modal.remove();
      }
      if (e.target.closest("#edit-post-save")) {
        var newTitle = document.getElementById("edit-post-title").value.trim();
        var newDesc = document.getElementById("edit-post-description").value.trim();
        var newTags = document.getElementById("edit-post-tags").value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
        if (!newTitle) { pushToast("error", "Title is required."); return; }
        var saveBtn = document.getElementById("edit-post-save");
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        request("/api/company/posts/" + post.id, {
          method: "PATCH",
          body: { title: newTitle, description: newDesc, tags: newTags }
        })
          .then(function () {
            pushToast("success", "Post updated!");
            modal.remove();
            return loadFeedback();
          })
          .catch(function (err) {
            pushToast("error", err.message || "Failed to update post.");
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Changes";
          });
      }
    });
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

    el.detailTitle.innerHTML = esc(post.title) +
      '<button class="ghost tiny edit-post-btn" data-edit-post-id="' + esc(post.id) + '" type="button" title="Edit post"><span class="ms">edit</span></button>';
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

    // AI action buttons + ClickUp push
    var clickUpBtn = (state.clickUpConnection && state.clickUpConnection.connected)
      ? '<button class="ghost small clickup-push-btn" data-push-post-id="' + esc(post.id) + '" type="button"><span class="ms">add_task</span> Push to ClickUp</button>'
      : '';
    var aiButtonsHtml =
      '<div class="detail-ai-actions">' +
      '<button class="ghost small ai-smart-reply-btn" data-post-id="' + esc(post.id) + '" type="button">' +
      '<span class="ms">auto_awesome</span> Smart Reply' +
      '</button>' +
      '<button class="ghost small ai-summary-btn" data-post-id="' + esc(post.id) + '" type="button">' +
      '<span class="ms">summarize</span> Summarize' +
      '</button>' +
      clickUpBtn +
      '</div>';

    // Comment summary cache display
    var commentSummaryHtml = '';
    if (post._commentSummary) {
      var cs = post._commentSummary;
      commentSummaryHtml =
        '<div class="comment-summary-card">' +
        '<div class="comment-summary-header"><span class="ms">summarize</span> <strong>AI Summary</strong>' +
        (post._commentSummaryAt ? '<span class="muted"> • ' + fullDate(post._commentSummaryAt) + '</span>' : '') +
        '</div>' +
        (cs.tldr ? '<p class="comment-summary-tldr">' + esc(cs.tldr) + '</p>' : '') +
        (cs.keyPoints && cs.keyPoints.length ? '<div class="comment-summary-points"><strong>Key Points:</strong><ul>' +
          cs.keyPoints.map(function(p) { return '<li>' + esc(p) + '</li>'; }).join("") + '</ul></div>' : '') +
        (cs.sentiment ? '<span class="tag-pill sentiment-' + esc(cs.sentiment) + '">' + esc(cs.sentiment) + '</span>' : '') +
        '</div>';
    }

    el.detailComments.innerHTML = aiButtonsHtml + commentSummaryHtml + (post.comments.length
      ? post.comments
          .map(function (comment) {
            var replyToHtml = comment.replyToAuthorName
              ? '<p class="reply-to">Replying to ' + esc(comment.replyToAuthorName) + '</p>'
              : "";

            // P1: Images
            var imagesHtml = (comment.images && comment.images.length)
              ? '<div class="comment-images">' + comment.images.map(function (url) {
                  return '<img src="' + esc(url) + '" alt="attachment" loading="lazy" class="comment-img-thumb" />';
                }).join("") + '</div>'
              : "";

            // P1: Reactions
            var reactions = comment.reactions || {};
            var reactKeys = Object.keys(reactions);
            var reactionsHtml = reactKeys.length
              ? '<div class="comment-reactions">' + reactKeys.map(function (emoji) {
                  var users = reactions[emoji] || [];
                  var myId = state.authUser ? state.authUser.id : "";
                  var isReacted = users.indexOf(myId) !== -1;
                  return '<button class="reaction-pill' + (isReacted ? ' is-reacted' : '') + '" data-react-comment="' + esc(comment.id) + '" data-react-emoji="' + esc(emoji) + '" type="button">' + esc(emoji) + ' ' + esc(users.length) + '</button>';
                }).join("") + '</div>'
              : "";

            // P1: Pinned badge
            var pinnedHtml = comment.isPinned
              ? '<span class="tag-pill pinned-tag"><span class="ms">push_pin</span> Pinned</span>'
              : "";

            // P1: Edited badge
            var editedHtml = comment.editedAt
              ? '<span class="muted edited-tag">(edited ' + esc(timeAgo(comment.editedAt)) + ')</span>'
              : "";

            // P1: Like button
            var myId = state.authUser ? state.authUser.id : "";
            var isLiked = (comment.likedByUserIds || []).indexOf(myId) !== -1;
            var likeCount = comment.likeCount || 0;

            return (
              '<article class="comment' + (comment.isPrivate ? ' is-private' : '') + (comment.isPinned ? ' is-pinned' : '') + '">' +
              '<div class="comment-head">' +
              '<strong>' + esc(comment.authorName) + '</strong>' +
              pinnedHtml + editedHtml +
              '<span>' + esc(fullDate(comment.createdAt)) + '</span>' +
              '</div>' +
              replyToHtml +
              '<p>' + esc(comment.body) + '</p>' +
              imagesHtml +
              reactionsHtml +
              '<div class="comment-actions-bar">' +
              '<button class="ghost tiny reply-btn" data-reply-comment-id="' + esc(comment.id) + '" data-reply-author="' + esc(comment.authorName) + '" type="button"><span class="ms">reply</span> Reply</button>' +
              '<button class="ghost tiny like-btn' + (isLiked ? ' is-liked' : '') + '" data-like-comment="' + esc(comment.id) + '" type="button"><span class="ms">' + (isLiked ? 'favorite' : 'favorite_border') + '</span> ' + esc(likeCount) + '</button>' +
              '<button class="ghost tiny react-btn" data-add-react-comment="' + esc(comment.id) + '" type="button"><span class="ms">add_reaction</span></button>' +
              '<button class="ghost tiny pin-btn" data-pin-comment="' + esc(comment.id) + '" type="button"><span class="ms">' + (comment.isPinned ? 'push_pin' : 'push_pin') + '</span> ' + (comment.isPinned ? 'Unpin' : 'Pin') + '</button>' +
              '<button class="ghost tiny edit-btn" data-edit-comment="' + esc(comment.id) + '" data-edit-body="' + esc(comment.body) + '" type="button"><span class="ms">edit</span> Edit</button>' +
              '</div>' +
              '</article>'
            );
          })
          .join("")
      : renderStateCard("empty", "No conversation yet", "Add a comment to start collaboration."));

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
        var voterPriority = voter.priority || "none";
        var voterLink = voter.link || "";
        var voteId = voter.voteId || "";
        
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

        var priorityOptions = ["none", "low", "medium", "high", "critical"];
        var prioritySelect = '<select class="voter-priority-select" data-vote-id="' + esc(voteId) + '">' +
          priorityOptions.map(function (opt) {
            return '<option value="' + opt + '"' + (opt === voterPriority ? ' selected' : '') + '>' +
              opt.charAt(0).toUpperCase() + opt.slice(1) + '</option>';
          }).join("") +
          '</select>';
        
        return (
          '<article class="voter-card voter-card-expanded">' +
          '<div class="voter-card-header">' +
          '<div class="voter-avatar">' + esc(safeUserName.charAt(0).toUpperCase()) + '</div>' +
          '<div class="voter-info">' +
          '<strong class="voter-name">' + esc(safeUserName) + '</strong>' +
          '<span class="voter-email">' + esc(safeUserEmail) + '</span>' +
          '</div>' +
          '<div class="voter-priority-badge priority-' + esc(voterPriority) + '">' +
          prioritySelect +
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
          '<span class="ms">link</span>' +
          '<div><strong>Link</strong>' +
          (voterLink
            ? '<a href="' + esc(voterLink) + '" target="_blank" class="voter-external-link">' + esc(voterLink.replace(/^https?:\/\//, "").substring(0, 30)) + '</a>'
            : '<button class="ghost tiny voter-add-link-btn" data-vote-id="' + esc(voteId) + '" type="button">+ Add link</button>') +
          '</div>' +
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
      .join("") +
      // Total MRR footer
      '<div class="voter-mrr-footer">' +
      '<span class="ms">payments</span>' +
      '<strong>Total Attached MRR:</strong> ' +
      '<span class="mrr-footer-value">' + esc(currency(summary.totalCompanyMrr || 0)) + '</span>' +
      '<span class="muted"> across ' + esc(String(summary.uniqueCompanies || 0)) + ' companies</span>' +
      '</div>';
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
      var entryTypeForPreview = entry.type || "update";
      var typePreviewIcons = { "new": "new_releases", "improved": "upgrade", "fixed": "build", "update": "update" };
      var typePreviewColors = { "new": "#00eef9", "improved": "#7c3aed", "fixed": "#f97316", "update": "#6b7280" };
      el.chPreviewTags.innerHTML =
        '<span class="changelog-type-badge" style="background:' + (typePreviewColors[entryTypeForPreview] || "#6b7280") + '">' +
        '<span class="ms" style="font-size:14px">' + (typePreviewIcons[entryTypeForPreview] || "update") + '</span> ' +
        esc(entryTypeForPreview.charAt(0).toUpperCase() + entryTypeForPreview.slice(1)) +
        '</span>' +
        (entry.tags || [])
          .map(function (tag) {
            return '<span class="tag-pill">' + esc(tag) + "</span>";
          })
          .join("") +
        (entry.labels || [])
          .map(function (label) {
            return '<span class="changelog-label">' + esc(label) + '</span>';
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

    var typeIcons = { "new": "new_releases", "improved": "upgrade", "fixed": "build", "update": "update" };
    var typeColors = { "new": "#00eef9", "improved": "#7c3aed", "fixed": "#f97316", "update": "#6b7280" };

    el.changelogList.innerHTML = state.changelogEntries.length
      ? state.changelogEntries
          .map(function (entry) {
            var isActive = entry.id === state.selectedChangelogId;
            var previewText = entry.excerpt || "";
            var entryType = entry.type || "update";
            var typeIcon = typeIcons[entryType] || "update";
            var typeColor = typeColors[entryType] || "#6b7280";
            var labelsHtml = (entry.labels || []).map(function (label) {
              return '<span class="changelog-label">' + esc(label) + '</span>';
            }).join("");
            return (
              '<article class="changelog-item ' +
              (isActive ? "is-active" : "") +
              '" data-changelog-id="' +
              esc(entry.id) +
              '">' +
              '<div class="changelog-item-head">' +
              '<span class="changelog-type-badge" style="background:' + typeColor + '">' +
              '<span class="ms" style="font-size:14px">' + typeIcon + '</span> ' +
              esc(entryType.charAt(0).toUpperCase() + entryType.slice(1)) +
              '</span>' +
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
              '<div class="changelog-tags-row">' +
              (entry.tags || [])
                .map(function (tag) {
                  return '<span class="tag-pill">' + esc(tag) + "</span>";
                })
                .join("") +
              labelsHtml +
              '</div>' +
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
    if (el.aiInboxKnowledgeHub) {
      el.aiInboxKnowledgeHub.classList.toggle("is-active", state.aiInboxTab === "knowledge-hub");
      if (state.aiInboxTab === "knowledge-hub" && !state.knowledgeHubLoaded) {
        loadKnowledgeHub();
      }
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
    if (status === "dismissed") {
      return "Dismissed";
    }
    if (status === "skipped") {
      return "Skipped";
    }
    if (status === "spam") {
      return "Spam";
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
      var zoomWebhookUrl = window.location.origin + "/api/integrations/zoom/webhook";
      if (state.errors.zoom) {
        zoomStatusHtml = '<div class="integration-status has-error">' + esc(state.errors.zoom) + '</div>';
      } else if (zoomConnected) {
        zoomStatusHtml = '<div class="integration-status">' +
          '<strong>Account:</strong> ' + esc(zoomEmail) +
          ' • <strong>Last sync:</strong> ' + esc(zoomLastSync) +
          (zoomExpires ? ' • <strong>Token expires:</strong> ' + esc(zoomExpires) : '') +
          '</div>' +
          '<div class="integration-setup-hint">' +
          '<strong>🔔 Automatic Transcripts</strong>: For auto-import after every call, add an event subscription in your ' +
          '<a href="https://marketplace.zoom.us/" target="_blank">Zoom App</a>:' +
          '<code class="webhook-url" onclick="navigator.clipboard.writeText(\'' + esc(zoomWebhookUrl) + '\'); this.classList.add(\'copied\');">' +
          esc(zoomWebhookUrl) +
          '<span class="copy-hint">(click to copy)</span>' +
          '</code>' +
          '<span class="muted">Subscribe to: recording.completed, recording.transcript_completed</span>' +
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
      var freshdeskWebhookUrl = window.location.origin + "/api/integrations/freshdesk/webhook";
      var freshdeskStatusHtml = "";
      if (state.errors.freshdesk) {
        freshdeskStatusHtml = '<div class="integration-status has-error">' + esc(state.errors.freshdesk) + '</div>';
      } else if (freshdeskConnected) {
        freshdeskStatusHtml = '<div class="integration-status">' +
          '<strong>Domain:</strong> ' + esc(freshdeskDomain) +
          ' • <strong>Last sync:</strong> ' + esc(freshdeskLastSync) +
          '</div>' +
          '<div class="integration-setup-hint">' +
          '<strong>🔔 Real-time Webhooks</strong>: For instant ticket capture, set up a webhook in ' +
          '<a href="' + esc(freshdeskDomain) + '/admin/automations/ticket_update" target="_blank">Freshdesk Automations</a>:' +
          '<code class="webhook-url" onclick="navigator.clipboard.writeText(\'' + esc(freshdeskWebhookUrl) + '\'); this.classList.add(\'copied\');">' +
          esc(freshdeskWebhookUrl) +
          '<span class="copy-hint">(click to copy)</span>' +
          '</code>' +
          '<span class="muted">Trigger on: Ticket Created. Action: POST webhook with ticket fields.</span>' +
          '</div>';
      } else {
        freshdeskStatusHtml = '<div class="integration-status">Enter your Freshdesk domain and API key to connect.</div>';
      }
      freshdeskStatusDetails.innerHTML = freshdeskStatusHtml;

      // Action buttons
      freshdeskActions.innerHTML =
        '<button class="ghost" data-freshdesk-test type="button"' + freshdeskBusy + '>' +
        '<span class="ms">cable</span> Test Connection' +
        '</button>' +
        '<button class="ghost" data-freshdesk-fetch-params type="button"' + freshdeskBusy + '>' +
        '<span class="ms">sync</span> Fetch Fields' +
        '</button>' +
        '<button class="primary" data-freshdesk-save-config type="button"' + freshdeskBusy + '>' +
        '<span class="ms">save</span> Save Config' +
        '</button>' +
        '<button class="primary" data-freshdesk-sync-now type="button"' +
        (freshdeskConnected ? "" : " disabled") + freshdeskBusy + '>' +
        '<span class="ms">cloud_sync</span> Sync Now' +
        '</button>' +
        '<button class="ghost" data-freshdesk-activity type="button"' +
        (freshdeskConnected ? "" : " disabled") + freshdeskBusy + '>' +
        '<span class="ms">history</span> View Activity' +
        '</button>' +
        (freshdeskConnected || freshdesk.hasApiKey || freshdeskDomain
          ? '<button class="ghost" data-freshdesk-disconnect type="button"' + freshdeskBusy + '>' +
            '<span class="ms">link_off</span> Disconnect</button>'
          : '');

      // Test result display
      var testResultEl = document.getElementById("freshdesk-test-result");
      if (!testResultEl) {
        testResultEl = document.createElement("div");
        testResultEl.id = "freshdesk-test-result";
        testResultEl.className = "test-result-banner hidden";
        freshdeskActions.insertAdjacentElement("afterend", testResultEl);
      }
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
            // Use AI suggested title/description if available
            var aiMeta2 = (event.aiActionLog && event.aiActionLog.metadata) || {};
            var prefillTitle = (event.recommendedCreate && event.recommendedCreate.title) || 
              aiMeta2.suggestedTitle || event.title || "";
            var prefillDescription =
              (event.recommendedCreate && event.recommendedCreate.description) || 
              aiMeta2.suggestedDescription || event.description || event.rawText || "";
            var confidenceText =
              event.confidenceScore == null
                ? "No confidence score"
                : "Confidence " + Math.round(Number(event.confidenceScore) * 100) + "%";
            var mergedBadge = event.status === "auto_merged" && event.suggestedPostTitle ? "Merged to " + event.suggestedPostTitle : "";

            // P1: Spam badge
            var spamBadge = event.isSpam
              ? '<span class="tag-pill spam-tag"><span class="ms">block</span> SPAM (' + esc(Math.round((event.spamConfidence || 0) * 100)) + '%)</span>'
              : '';
            var spamActions = event.status === "spam"
              ? '<button class="ghost small" data-unspam-id="' + esc(event.id) + '" type="button">Not Spam</button>'
              : (event.status !== "auto_merged" && event.status !== "dismissed"
                ? '<button class="ghost small spam-mark-btn" data-spam-id="' + esc(event.id) + '" type="button"><span class="ms">block</span> Mark Spam</button>'
                : '');

            // Enhanced AI metadata from aiActionLog
            var aiMeta = (event.aiActionLog && event.aiActionLog.metadata) || {};
            var sentimentIcon = {
              "frustrated": "😤",
              "neutral": "😐", 
              "positive": "😊"
            }[aiMeta.sentiment] || "";
            var urgencyIcon = {
              "critical": "🔴",
              "high": "🟠",
              "medium": "🟡",
              "low": "🟢"
            }[aiMeta.urgency] || "";
            var categoryBadge = aiMeta.category ? '<span class="ai-badge">' + esc(aiMeta.category) + '</span>' : "";
            var keywordsHtml = (aiMeta.keywords || []).slice(0, 3).map(function(kw) {
              return '<span class="ai-keyword">' + esc(kw) + '</span>';
            }).join("");

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
              (sentimentIcon ? " • " + sentimentIcon : "") +
              (urgencyIcon ? " " + urgencyIcon : "") +
              " • " +
              esc(fullDate(event.createdAt)) +
              "</p>" +
              '</div>' +
              '<div class="triage-badges">' +
              categoryBadge +
              '<span class="status-pill status-' +
              esc(event.status === "auto_merged" ? "complete" : event.status === "dismissed" ? "dismissed" : "under_review") +
              '">' +
              esc(triageStatusLabel(event.status)) +
              "</span>" +
              spamBadge +
              (event.status !== "auto_merged" && event.status !== "dismissed" && event.status !== "spam"
                ? '<button class="ghost small dismiss-btn" data-dismiss-id="' + esc(event.id) + '" type="button" title="Dismiss this item"><span class="ms">close</span></button>'
                : "") +
              "</div>" +
              "</div>" +
              (keywordsHtml ? '<div class="ai-keywords-row">' + keywordsHtml + '</div>' : '') +
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
              '<div class="triage-spam-action">' + spamActions + '</div>' +
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

    // Load trends when reporting tab is shown
    loadTrends();
  }

  // ═══════════════════════════════════════════════
  // P1: AI Knowledge Hub
  // ═══════════════════════════════════════════════
  function loadKnowledgeHub() {
    if (!el.knowledgeHubContent) return;
    el.knowledgeHubContent.innerHTML = renderStateCard("loading", "Loading Knowledge Hub", "Analyzing your AI pipeline data...");
    request("/api/company/ai/knowledge-hub")
      .then(function (data) {
        state.knowledgeHubLoaded = true;
        state.knowledgeHubData = data;
        renderKnowledgeHub();
      })
      .catch(function (err) {
        el.knowledgeHubContent.innerHTML = renderStateCard("error", err.message || "Failed to load Knowledge Hub", "Try again later.");
      });
  }

  function renderKnowledgeHub() {
    if (!el.knowledgeHubContent || !state.knowledgeHubData) return;
    var d = state.knowledgeHubData;

    var summaryCards =
      '<div class="kh-summary-grid">' +
      '<article class="metric-card"><h3>Total Events</h3><strong>' + esc(d.totalEvents || 0) + '</strong></article>' +
      '<article class="metric-card"><h3>Avg Confidence</h3><strong>' + esc(Math.round((d.avgConfidence || 0) * 100)) + '%</strong></article>' +
      '</div>';

    // Status breakdown
    var statusBreakdown = d.statusBreakdown || {};
    var statusHtml = '<div class="kh-section"><h4>Status Breakdown</h4><div class="kh-bar-chart">' +
      Object.keys(statusBreakdown).map(function (key) {
        var val = statusBreakdown[key] || 0;
        var pct = d.totalEvents ? Math.round((val / d.totalEvents) * 100) : 0;
        return '<div class="kh-bar-row">' +
          '<span class="kh-bar-label">' + esc(key.replace(/_/g, " ")) + '</span>' +
          '<div class="kh-bar-track"><div class="kh-bar-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="kh-bar-value">' + esc(val) + '</span></div>';
      }).join("") + '</div></div>';

    // Source breakdown
    var sourceBreakdown = d.sourceBreakdown || {};
    var sourceHtml = '<div class="kh-section"><h4>Source Distribution</h4><div class="kh-bar-chart">' +
      Object.keys(sourceBreakdown).map(function (key) {
        var val = sourceBreakdown[key] || 0;
        var pct = d.totalEvents ? Math.round((val / d.totalEvents) * 100) : 0;
        return '<div class="kh-bar-row">' +
          '<span class="kh-bar-label">' + esc(key) + '</span>' +
          '<div class="kh-bar-track"><div class="kh-bar-fill kh-bar-source" style="width:' + pct + '%"></div></div>' +
          '<span class="kh-bar-value">' + esc(val) + '</span></div>';
      }).join("") + '</div></div>';

    // Category distribution
    var catDist = d.categoryDistribution || {};
    var catKeys = Object.keys(catDist).sort(function (a, b) { return catDist[b] - catDist[a]; });
    var catHtml = catKeys.length
      ? '<div class="kh-section"><h4>Top Categories</h4><div class="kh-tags">' +
        catKeys.slice(0, 10).map(function (k) {
          return '<span class="kh-tag">' + esc(k) + ' <strong>' + esc(catDist[k]) + '</strong></span>';
        }).join("") + '</div></div>'
      : '';

    // Sentiment distribution
    var sentDist = d.sentimentDistribution || {};
    var sentIcons = { frustrated: "😤", neutral: "😐", positive: "😊" };
    var sentHtml = Object.keys(sentDist).length
      ? '<div class="kh-section"><h4>Sentiment</h4><div class="kh-tags">' +
        Object.keys(sentDist).map(function (k) {
          return '<span class="kh-tag">' + (sentIcons[k] || '') + ' ' + esc(k) + ' <strong>' + esc(sentDist[k]) + '</strong></span>';
        }).join("") + '</div></div>'
      : '';

    // Weekly trend
    var weeklyTrend = d.weeklyTrend || [];
    var weeklyHtml = weeklyTrend.length
      ? '<div class="kh-section"><h4>Weekly Trend (last 12 weeks)</h4><div class="kh-trend-table"><table>' +
        '<thead><tr><th>Week</th><th>Total</th><th>Auto-merged</th><th>Needs Triage</th><th>Spam</th></tr></thead><tbody>' +
        weeklyTrend.map(function (w) {
          return '<tr><td>' + esc(w.week) + '</td><td>' + esc(w.total) + '</td><td>' + esc(w.auto_merged) + '</td><td>' + esc(w.needs_triage) + '</td><td>' + esc(w.spam || 0) + '</td></tr>';
        }).join("") +
        '</tbody></table></div></div>'
      : '';

    // Recent AI actions
    var recentActions = d.recentActions || [];
    var recentHtml = recentActions.length
      ? '<div class="kh-section"><h4>Recent AI Actions</h4><div class="kh-recent-list">' +
        recentActions.slice(0, 15).map(function (a) {
          var meta = a.metadata || {};
          return '<article class="kh-action-item">' +
            '<div class="kh-action-head">' +
            '<span class="tag-pill">' + esc(a.action) + '</span>' +
            '<span class="muted">' + esc(Math.round((a.confidence || 0) * 100)) + '% confidence</span>' +
            '<span class="muted">' + esc(timeAgo(a.createdAt)) + '</span>' +
            '</div>' +
            (a.painEvent ? '<p class="kh-action-text">' + esc((a.painEvent.rawText || "").slice(0, 150)) + '</p>' : '') +
            (a.painEvent && a.painEvent.matchedPostTitle ? '<p class="muted">→ ' + esc(a.painEvent.matchedPostTitle) + '</p>' : '') +
            (meta.category ? '<span class="ai-badge">' + esc(meta.category) + '</span>' : '') +
            (meta.sentiment ? '<span class="ai-badge">' + esc(meta.sentiment) + '</span>' : '') +
            '</article>';
        }).join("") +
        '</div></div>'
      : '';

    el.knowledgeHubContent.innerHTML = summaryCards + statusHtml + sourceHtml + catHtml + sentHtml + weeklyHtml + recentHtml;
  }

  // ═══════════════════════════════════════════════
  // P1: ClickUp Integration UI
  // ═══════════════════════════════════════════════
  function loadClickUpStatus() {
    request("/api/company/integrations/clickup/status")
      .then(function (data) {
        state.clickUpConnection = data;
        renderClickUpCard();
      })
      .catch(function () {
        state.clickUpConnection = { connected: false };
        renderClickUpCard();
      });
  }

  function renderClickUpCard() {
    if (!el.clickUpConnectionStatus || !el.clickUpActions) return;
    var conn = state.clickUpConnection || { connected: false };

    if (conn.connected) {
      el.clickUpConnectionStatus.textContent = "Connected";
      el.clickUpConnectionStatus.classList.add("is-connected");
      var spacesInfo = (conn.spaceNames || []).join(", ") || "No spaces";
      el.clickUpStatusDetails.innerHTML =
        '<p class="muted">' +
        '<strong>Team:</strong> ' + esc(conn.teamName || "Unknown") +
        ' • <strong>Spaces:</strong> ' + esc(spacesInfo) +
        (conn.defaultListName ? ' • <strong>Default list:</strong> ' + esc(conn.defaultListName) : '') +
        (conn.lastSyncedAt ? ' • Last synced: ' + esc(timeAgo(conn.lastSyncedAt)) : '') +
        '</p>';

      el.clickUpConfigForm.innerHTML =
        '<div class="triage-config-grid">' +
        '<label>Default List ID<input type="text" id="clickup-default-list-id" value="' + esc(conn.defaultListId || '') + '" placeholder="e.g., 901234567" /></label>' +
        '<label>List Name<input type="text" id="clickup-default-list-name" value="' + esc(conn.defaultListName || '') + '" placeholder="e.g., Feature Requests" /></label>' +
        '</div>';

      el.clickUpActions.innerHTML =
        '<button class="primary small" id="clickup-save-list" type="button">Save Default List</button>' +
        '<button class="ghost small" id="clickup-disconnect" type="button">Disconnect</button>';
    } else {
      el.clickUpConnectionStatus.textContent = "Not connected";
      el.clickUpConnectionStatus.classList.remove("is-connected");
      el.clickUpStatusDetails.innerHTML = '';
      el.clickUpConfigForm.innerHTML =
        '<div class="triage-config-grid">' +
        '<label>ClickUp API Token<input type="password" id="clickup-access-token" placeholder="pk_..." /></label>' +
        '</div>';
      el.clickUpActions.innerHTML =
        '<button class="primary small" id="clickup-connect-btn" type="button">Connect ClickUp</button>';
    }
  }

  // ═══════════════════════════════════════════════
  // P1: Reporting Trends
  // ═══════════════════════════════════════════════
  function loadTrends() {
    if (!el.trendsGrid || state.trendsData) return;
    el.trendsGrid.innerHTML = renderStateCard("loading", "Loading trend data", "Analyzing recent activity...");
    request("/api/company/reporting/trends")
      .then(function (data) {
        state.trendsData = data;
        renderTrends();
      })
      .catch(function (err) {
        el.trendsGrid.innerHTML = renderStateCard("error", err.message || "Failed to load trends", "Try refreshing.");
      });
  }

  function renderTrends() {
    if (!el.trendsGrid || !state.trendsData) return;
    var d = state.trendsData;

    // Daily posts sparkline
    var dailyPosts = d.dailyPosts || [];
    var dailyPostsHtml = dailyPosts.length
      ? '<div class="trend-card"><h4>Daily New Posts (30d)</h4><div class="trend-mini-chart">' +
        renderMiniBarChart(dailyPosts.map(function (dp) { return { label: dp.date.slice(5), value: dp.count }; })) +
        '</div></div>'
      : '';

    // Daily votes
    var dailyVotes = d.dailyVotes || [];
    var dailyVotesHtml = dailyVotes.length
      ? '<div class="trend-card"><h4>Daily Votes (30d)</h4><div class="trend-mini-chart">' +
        renderMiniBarChart(dailyVotes.map(function (dv) { return { label: dv.date.slice(5), value: dv.explicit + dv.implicit }; })) +
        '</div></div>'
      : '';

    // Weekly MRR
    var weeklyMrr = d.weeklyMrr || [];
    var weeklyMrrHtml = weeklyMrr.length
      ? '<div class="trend-card"><h4>Weekly MRR Attached (90d)</h4><div class="trend-mini-chart">' +
        renderMiniBarChart(weeklyMrr.map(function (wm) { return { label: wm.week.slice(5), value: wm.mrr }; }), true) +
        '</div></div>'
      : '';

    // Top categories
    var topCategories = d.topCategories || [];
    var catHtml = topCategories.length
      ? '<div class="trend-card"><h4>Top Categories</h4><div class="kh-bar-chart">' +
        topCategories.map(function (c) {
          var maxCount = topCategories[0].count || 1;
          var pct = Math.round((c.count / maxCount) * 100);
          return '<div class="kh-bar-row"><span class="kh-bar-label">' + esc(c.name) + '</span>' +
            '<div class="kh-bar-track"><div class="kh-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<span class="kh-bar-value">' + esc(c.count) + '</span></div>';
        }).join("") + '</div></div>'
      : '';

    // Velocity
    var velocityHtml = '<div class="trend-card"><h4>Completion Velocity</h4>' +
      '<div class="velocity-stat">' +
      '<strong>' + esc(d.avgVelocityDays || 0) + '</strong><span> avg days to complete</span>' +
      '</div>' +
      '<p class="muted">' + esc(d.completedCount || 0) + ' posts completed recently</p>' +
      '</div>';

    el.trendsGrid.innerHTML = dailyPostsHtml + dailyVotesHtml + weeklyMrrHtml + catHtml + velocityHtml;
  }

  function renderMiniBarChart(dataPoints, isCurrency) {
    if (!dataPoints || !dataPoints.length) return '<p class="muted">No data</p>';
    var maxVal = Math.max.apply(null, dataPoints.map(function (dp) { return dp.value; })) || 1;
    return '<div class="mini-bar-chart">' +
      dataPoints.map(function (dp) {
        var height = Math.max(2, Math.round((dp.value / maxVal) * 60));
        var display = isCurrency ? currency(dp.value) : String(dp.value);
        return '<div class="mini-bar-col" title="' + esc(dp.label) + ': ' + esc(display) + '">' +
          '<div class="mini-bar" style="height:' + height + 'px"></div>' +
          '<span class="mini-bar-label">' + esc(dp.label) + '</span>' +
          '</div>';
      }).join("") + '</div>';
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

  // ===========================
  // Custom Domains
  // ===========================
  function loadCustomDomains() {
    var statusEl = document.getElementById("custom-domain-status");
    if (statusEl) {
      statusEl.innerHTML = '<div class="domain-loading"><span class="ms">refresh</span> Loading domain configuration...</div>';
    }

    return request("/api/custom-domains")
      .then(function (result) {
        state.customDomains = result.domains || [];
        state.activeDomainId = result.activeDomainId;
        renderCustomDomains();
      })
      .catch(function (error) {
        state.customDomains = [];
        if (statusEl) {
          statusEl.innerHTML = '<div class="domain-error">' + esc(error.message || "Failed to load domains") + '</div>';
        }
      });
  }

  function renderCustomDomains() {
    var statusEl = document.getElementById("custom-domain-status");
    var listEl = document.getElementById("domains-list");
    var instructionsEl = document.getElementById("domain-instructions");

    if (!statusEl || !listEl) return;

    var domains = state.customDomains;
    var activeDomain = domains.find(function (d) { return d.id === state.activeDomainId; });

    if (activeDomain && activeDomain.status === "active") {
      statusEl.innerHTML =
        '<div class="domain-active">' +
        '<span class="ms" style="color: var(--aqua-600);">check_circle</span> ' +
        '<strong>Your portal is live at:</strong> ' +
        '<a href="https://' + esc(activeDomain.domain) + '" target="_blank">https://' + esc(activeDomain.domain) + '</a>' +
        '</div>';
    } else if (domains.length === 0) {
      statusEl.innerHTML =
        '<div class="domain-empty">' +
        '<span class="ms">info</span> ' +
        'No custom domain configured. Your portal is accessible at the default URL.' +
        '</div>';
    } else {
      statusEl.innerHTML =
        '<div class="domain-pending">' +
        '<span class="ms">pending</span> ' +
        'You have ' + domains.length + ' domain(s) pending setup.' +
        '</div>';
    }

    // Show/hide instructions based on pending domains
    var hasPending = domains.some(function (d) { return d.status === "pending_verification"; });
    if (instructionsEl) {
      instructionsEl.classList.toggle("hidden", !hasPending);
    }

    // Render domain cards
    listEl.innerHTML = domains.map(function (domain) {
      var statusClass = domain.status === "active" ? "active" :
                        domain.status === "verified" ? "verified" :
                        domain.status === "failed" ? "failed" : "pending";
      var statusLabel = domain.status === "active" ? "Active" :
                        domain.status === "verified" ? "Verified" :
                        domain.status === "failed" ? "Failed" : "Pending Verification";

      var verificationHtml = "";
      if (domain.status === "pending_verification") {
        verificationHtml =
          '<div class="domain-verification">' +
          '<div class="verification-record">' +
          '<span class="record-type">TXT Record</span>' +
          '<div class="record-value">' +
          '<span>_painsolver-verify.' + esc(domain.domain) + '</span>' +
          '</div>' +
          '<div class="record-value">' +
          '<span>' + esc(domain.verificationToken) + '</span>' +
          '<button class="copy-btn ghost small" data-copy="' + esc(domain.verificationToken) + '">Copy</button>' +
          '</div>' +
          '</div>' +
          '</div>';
      } else if (domain.status === "verified") {
        verificationHtml =
          '<div class="domain-verification">' +
          '<p class="muted">Add a CNAME record pointing <strong>' + esc(domain.domain) + '</strong> to <code>cname.vercel-dns.com</code></p>' +
          '</div>';
      }

      var actionsHtml =
        '<div class="domain-card-actions">' +
        (domain.status === "pending_verification"
          ? '<button class="primary small" data-verify-domain="' + esc(domain.id) + '"><span class="ms">verified</span> Verify</button>'
          : '') +
        (domain.status === "verified"
          ? '<button class="primary small" data-activate-domain="' + esc(domain.id) + '"><span class="ms">rocket_launch</span> Activate</button>' +
            '<button class="ghost small" data-check-cname="' + esc(domain.id) + '"><span class="ms">dns</span> Check CNAME</button>'
          : '') +
        '<button class="ghost small danger" data-delete-domain="' + esc(domain.id) + '"><span class="ms">delete</span> Remove</button>' +
        '</div>';

      return (
        '<div class="domain-card' + (domain.status === "active" ? " is-active" : "") + '" data-domain-id="' + esc(domain.id) + '">' +
        '<div class="domain-card-header">' +
        '<span class="domain-name"><span class="ms">language</span> ' + esc(domain.domain) + '</span>' +
        '<span class="domain-status-badge ' + statusClass + '">' + statusLabel + '</span>' +
        '</div>' +
        verificationHtml +
        (domain.errorMessage ? '<p class="domain-error-msg">' + esc(domain.errorMessage) + '</p>' : '') +
        actionsHtml +
        '</div>'
      );
    }).join("");
  }

  function addCustomDomain(domain) {
    var btn = document.getElementById("add-domain-btn");
    if (btn) setButtonBusy(btn, true, "Adding...");

    return request("/api/custom-domains/add", {
      method: "POST",
      body: { domain: domain }
    })
      .then(function (result) {
        state.customDomains.push(result.domain);
        renderCustomDomains();
        pushToast("success", "Domain added! Follow the instructions to verify ownership.");
        var input = document.getElementById("new-domain-input");
        if (input) input.value = "";
      })
      .catch(function (error) {
        pushToast("error", error.message || "Failed to add domain");
      })
      .finally(function () {
        if (btn) setButtonBusy(btn, false);
      });
  }

  function verifyDomain(domainId) {
    var btn = document.querySelector('[data-verify-domain="' + domainId + '"]');
    if (btn) setButtonBusy(btn, true, "Verifying...");

    return request("/api/custom-domains/verify/" + domainId, { method: "POST" })
      .then(function (result) {
        if (result.verified) {
          pushToast("success", "Domain verified! " + (result.nextStep || ""));
          return loadCustomDomains();
        } else {
          pushToast("warning", result.error || "Verification failed. " + (result.hint || ""));
        }
      })
      .catch(function (error) {
        pushToast("error", error.message || "Verification failed");
      })
      .finally(function () {
        if (btn) setButtonBusy(btn, false);
      });
  }

  function activateDomain(domainId) {
    var btn = document.querySelector('[data-activate-domain="' + domainId + '"]');
    if (btn) setButtonBusy(btn, true, "Activating...");

    return request("/api/custom-domains/activate/" + domainId, { method: "POST" })
      .then(function (result) {
        if (result.activated) {
          pushToast("success", "Domain activated! " + (result.note || ""));
          return loadCustomDomains();
        }
      })
      .catch(function (error) {
        pushToast("error", error.message || "Activation failed");
      })
      .finally(function () {
        if (btn) setButtonBusy(btn, false);
      });
  }

  function deleteDomain(domainId) {
    if (!confirm("Are you sure you want to remove this domain?")) return;

    return request("/api/custom-domains/" + domainId, { method: "DELETE" })
      .then(function () {
        state.customDomains = state.customDomains.filter(function (d) { return d.id !== domainId; });
        renderCustomDomains();
        pushToast("success", "Domain removed");
      })
      .catch(function (error) {
        pushToast("error", error.message || "Failed to remove domain");
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

    if (tab === "settings") {
      void loadCustomDomains();
      void loadPortalBranding();
      void loadApiKeys();
      renderPortalUrl();
    }

    if (tab === "changelog") {
      void loadChangelog();
    }

    if (tab === "autopilot") {
      renderAiInboxViews();
      void Promise.all([loadTriage(), loadZoomConnectionStatus(), loadFreshdeskStatus(), loadSlackConnectionStatus(), loadClickUpStatus()]);
      // Sync toggle state from config
      var freshConfig = (state.triageConfig || []).find(function (c) { return c && c.source === "freshdesk"; });
      if (freshConfig && el.aiTriageModeToggle) {
        el.aiTriageModeToggle.checked = freshConfig.triageMode === "auto";
        if (el.aiTriageModeLabel) el.aiTriageModeLabel.textContent = freshConfig.triageMode === "auto" ? "Auto" : "Manual";
      }
      if (freshConfig && el.aiSpamDetectionToggle) {
        el.aiSpamDetectionToggle.checked = freshConfig.spamDetectionEnabled !== false;
        if (el.aiSpamDetectionLabel) el.aiSpamDetectionLabel.textContent = freshConfig.spamDetectionEnabled !== false ? "Enabled" : "Disabled";
      }
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
    // ── User menu dropdown ──
    var avatarBtn = document.getElementById("user-avatar-btn");
    var userDropdown = document.getElementById("user-dropdown");
    if (avatarBtn && userDropdown) {
      avatarBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = userDropdown.style.display !== "none";
        userDropdown.style.display = isOpen ? "none" : "block";
      });
      document.addEventListener("click", function (e) {
        if (!e.target.closest("#user-menu-wrapper")) {
          userDropdown.style.display = "none";
        }
      });
    }
    var btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", handleLogout);
    }
    var btnViewPortal = document.getElementById("btn-view-portal");
    if (btnViewPortal) {
      btnViewPortal.addEventListener("click", function () {
        var portalUrl = state.companySlug ? "/portal/" + encodeURIComponent(state.companySlug) : "/portal";
        window.open(portalUrl, "_blank");
      });
    }
    var btnViewDocs = document.getElementById("btn-view-docs");
    if (btnViewDocs) {
      btnViewDocs.addEventListener("click", function () { window.open("/docs", "_blank"); });
    }

    // ── Navigation ──
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

        // Add link button
        var addLinkBtn = target.closest(".voter-add-link-btn");
        if (addLinkBtn) {
          var voteIdForLink = addLinkBtn.getAttribute("data-vote-id");
          if (voteIdForLink) {
            var newLink = prompt("Enter external link (CRM profile, etc.):");
            if (newLink !== null && newLink.trim()) {
              request("/api/company/votes/" + voteIdForLink + "/link", {
                method: "PATCH",
                body: { link: newLink.trim() }
              }).then(function () {
                pushToast("success", "Link added");
                if (state.selectedPostId) loadVoterInsights(state.selectedPostId);
              });
            }
          }
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

      // Priority dropdown change
      el.detailVoterList.addEventListener("change", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) return;
        var prioritySelect = target.closest(".voter-priority-select");
        if (prioritySelect) {
          var voteId = prioritySelect.getAttribute("data-vote-id");
          var newPriority = prioritySelect.value;
          if (voteId && newPriority) {
            request("/api/company/votes/" + voteId + "/priority", {
              method: "PATCH",
              body: { priority: newPriority }
            }).then(function () {
              pushToast("success", "Priority updated to " + newPriority);
            });
          }
        }
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

    // ── Detail comments area: Edit, Smart Reply, Summary ──
    if (el.detailComments) {
      el.detailComments.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) return;

        // Smart Reply
        var smartReplyBtn = target.closest(".ai-smart-reply-btn");
        if (smartReplyBtn) {
          var pId = smartReplyBtn.getAttribute("data-post-id");
          if (!pId) return;
          smartReplyBtn.disabled = true;
          smartReplyBtn.innerHTML = '<span class="ms">hourglass_empty</span> Generating...';
          request("/api/company/posts/" + pId + "/smart-reply", { method: "POST" })
            .then(function (data) {
              var replies = data.replies || [];
              if (!replies.length) { pushToast("info", "No smart replies generated."); return; }
              var modal = document.createElement("div");
              modal.className = "modal-overlay";
              modal.innerHTML =
                '<div class="modal-content smart-reply-modal">' +
                '<div class="modal-header"><h3><span class="ms">auto_awesome</span> Smart Replies</h3>' +
                '<button class="ghost small modal-close" type="button">&times;</button></div>' +
                '<div class="smart-reply-list">' +
                replies.map(function (r) {
                  return '<article class="smart-reply-card">' +
                    '<span class="tag-pill">' + esc(r.tone || "reply") + '</span>' +
                    '<p>' + esc(r.text) + '</p>' +
                    '<button class="ghost small use-reply-btn" type="button">Use this reply</button>' +
                    '</article>';
                }).join("") +
                '</div></div>';
              document.body.appendChild(modal);
              modal.addEventListener("click", function (e) {
                if (e.target.closest(".modal-close") || e.target === modal) {
                  modal.remove();
                }
                var useBtn = e.target.closest(".use-reply-btn");
                if (useBtn) {
                  var text = useBtn.closest(".smart-reply-card").querySelector("p").textContent;
                  el.newComment.value = text;
                  modal.remove();
                }
              });
            })
            .catch(function (err) { pushToast("error", err.message || "Failed to generate smart replies."); })
            .finally(function () {
              smartReplyBtn.disabled = false;
              smartReplyBtn.innerHTML = '<span class="ms">auto_awesome</span> Smart Reply';
            });
          return;
        }

        // Comment Summary
        var summaryBtn = target.closest(".ai-summary-btn");
        if (summaryBtn) {
          var sPostId = summaryBtn.getAttribute("data-post-id");
          if (!sPostId) return;
          summaryBtn.disabled = true;
          summaryBtn.innerHTML = '<span class="ms">hourglass_empty</span> Summarizing...';
          request("/api/company/posts/" + sPostId + "/comment-summary", { method: "POST" })
            .then(function (data) {
              var s = data.summary || {};
              var post = getSelectedPost();
              if (post) {
                post._commentSummary = s;
                post._commentSummaryAt = new Date().toISOString();
                renderDetail();
              }
              pushToast("success", "Summary generated!");
            })
            .catch(function (err) { pushToast("error", err.message || "Failed to generate summary."); })
            .finally(function () {
              summaryBtn.disabled = false;
              summaryBtn.innerHTML = '<span class="ms">summarize</span> Summarize';
            });
          return;
        }

        // P1: Push to ClickUp
        var pushClickUpBtn = target.closest(".clickup-push-btn");
        if (pushClickUpBtn) {
          var cuPostId = pushClickUpBtn.getAttribute("data-push-post-id");
          if (!cuPostId) return;
          pushClickUpBtn.disabled = true;
          pushClickUpBtn.innerHTML = '<span class="ms">hourglass_empty</span> Pushing...';
          request("/api/company/posts/" + cuPostId + "/clickup/push", { method: "POST" })
            .then(function (data) {
              if (data.alreadyLinked) {
                pushToast("info", "Already linked to ClickUp task.");
              } else {
                pushToast("success", "Task created in ClickUp!");
              }
              if (data.url) window.open(data.url, "_blank");
            })
            .catch(function (err) { pushToast("error", err.message || "Failed to push to ClickUp."); })
            .finally(function () {
              pushClickUpBtn.disabled = false;
              pushClickUpBtn.innerHTML = '<span class="ms">add_task</span> Push to ClickUp';
            });
          return;
        }
      });
    }

    // ── Edit post button ──
    if (el.detailTitle) {
      el.detailTitle.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) return;
        var editBtn = target.closest(".edit-post-btn");
        if (!editBtn) return;
        var post = getSelectedPost();
        if (!post) return;
        showEditPostModal(post);
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
      if (replyBtn) {
        var author = replyBtn.getAttribute("data-reply-author");
        var commentId = replyBtn.getAttribute("data-reply-comment-id");
        if (author && commentId) {
          state.commentReplyTarget = {
            commentId: commentId,
            authorName: author
          };
          renderCommentReplyContext();
          el.newComment.focus();
        }
        return;
      }

      // P1: Like comment
      var likeBtn = target.closest("[data-like-comment]");
      if (likeBtn) {
        var cId = likeBtn.getAttribute("data-like-comment");
        request("/api/company/comments/" + cId + "/like", { method: "POST" })
          .then(function () { if (state.selectedPostId) loadDetail(state.selectedPostId); })
          .catch(function (err) { pushToast("error", err.message || "Failed to toggle like."); });
        return;
      }

      // P1: Toggle reaction
      var reactPill = target.closest("[data-react-comment][data-react-emoji]");
      if (reactPill) {
        var cId = reactPill.getAttribute("data-react-comment");
        var emoji = reactPill.getAttribute("data-react-emoji");
        request("/api/company/comments/" + cId + "/react", { method: "POST", body: { emoji: emoji } })
          .then(function () { if (state.selectedPostId) loadDetail(state.selectedPostId); })
          .catch(function (err) { pushToast("error", err.message || "Failed to toggle reaction."); });
        return;
      }

      // P1: Add new reaction
      var addReactBtn = target.closest("[data-add-react-comment]");
      if (addReactBtn) {
        var cId = addReactBtn.getAttribute("data-add-react-comment");
        var emoji = prompt("Enter emoji (e.g., 👍, ❤️, 🎉, 🚀):");
        if (emoji && emoji.trim()) {
          request("/api/company/comments/" + cId + "/react", { method: "POST", body: { emoji: emoji.trim() } })
            .then(function () { if (state.selectedPostId) loadDetail(state.selectedPostId); })
            .catch(function (err) { pushToast("error", err.message || "Failed to add reaction."); });
        }
        return;
      }

      // P1: Pin comment
      var pinBtn = target.closest("[data-pin-comment]");
      if (pinBtn) {
        var cId = pinBtn.getAttribute("data-pin-comment");
        request("/api/company/comments/" + cId + "/pin", { method: "POST" })
          .then(function (data) {
            pushToast("success", data.isPinned ? "Comment pinned." : "Comment unpinned.");
            if (state.selectedPostId) loadDetail(state.selectedPostId);
          })
          .catch(function (err) { pushToast("error", err.message || "Failed to toggle pin."); });
        return;
      }

      // P1: Edit comment
      var editBtn = target.closest("[data-edit-comment]");
      if (editBtn) {
        var cId = editBtn.getAttribute("data-edit-comment");
        var oldBody = editBtn.getAttribute("data-edit-body") || "";
        var newBody = prompt("Edit comment:", oldBody);
        if (newBody !== null && newBody.trim() && newBody.trim() !== oldBody) {
          request("/api/company/comments/" + cId, { method: "PATCH", body: { value: newBody.trim() } })
            .then(function () {
              pushToast("success", "Comment updated.");
              if (state.selectedPostId) loadDetail(state.selectedPostId);
            })
            .catch(function (err) { pushToast("error", err.message || "Failed to edit comment."); });
        }
        return;
      }
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
      var chTypeEl = document.getElementById("ch-type");
      var chLabelsEl = document.getElementById("ch-labels");
      var labels = chLabelsEl ? chLabelsEl.value.split(",").map(function (v) { return v.trim(); }).filter(Boolean) : [];
      var payload = {
        entryId: el.chEditingId ? el.chEditingId.value || undefined : undefined,
        boardId: el.chBoard.value,
        title: el.chTitle.value.trim(),
        content: content,
        tags: tags,
        type: chTypeEl ? chTypeEl.value : "update",
        labels: labels,
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
        var chTypeElDraft = document.getElementById("ch-type");
        var chLabelsElDraft = document.getElementById("ch-labels");
        var labelsDraft = chLabelsElDraft ? chLabelsElDraft.value.split(",").map(function (v) { return v.trim(); }).filter(Boolean) : [];
        var payload = {
          entryId: el.chEditingId ? el.chEditingId.value || undefined : undefined,
          boardId: el.chBoard.value,
          title: el.chTitle.value.trim(),
          content: content,
          tags: tags,
          type: chTypeElDraft ? chTypeElDraft.value : "update",
          labels: labelsDraft,
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

        // Dismiss button handler
        var dismissButton = target.closest("[data-dismiss-id]");
        var dismissId = dismissButton ? dismissButton.getAttribute("data-dismiss-id") : null;
        if (dismissId) {
          if (dismissButton instanceof HTMLButtonElement) {
            setButtonBusy(dismissButton, true, "...");
          }
          request("/api/company/triage/" + encodeURIComponent(dismissId) + "/dismiss", {
            method: "POST"
          })
            .then(function () {
              pushToast("success", "Item dismissed.");
              return loadTriage();
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to dismiss triage item.");
            })
            .finally(function () {
              if (dismissButton instanceof HTMLButtonElement) {
                setButtonBusy(dismissButton, false);
              }
            });
          return;
        }

        // P1: Mark as spam
        var spamButton = target.closest("[data-spam-id]");
        var spamId = spamButton ? spamButton.getAttribute("data-spam-id") : null;
        if (spamId) {
          if (spamButton instanceof HTMLButtonElement) setButtonBusy(spamButton, true, "...");
          request("/api/company/triage/" + encodeURIComponent(spamId) + "/spam", { method: "POST" })
            .then(function () {
              pushToast("success", "Marked as spam.");
              return loadTriage();
            })
            .catch(function (err) { pushToast("error", err.message || "Failed to mark spam."); })
            .finally(function () { if (spamButton instanceof HTMLButtonElement) setButtonBusy(spamButton, false); });
          return;
        }

        // P1: Unmark spam
        var unspamButton = target.closest("[data-unspam-id]");
        var unspamId = unspamButton ? unspamButton.getAttribute("data-unspam-id") : null;
        if (unspamId) {
          if (unspamButton instanceof HTMLButtonElement) setButtonBusy(unspamButton, true, "...");
          request("/api/company/triage/" + encodeURIComponent(unspamId) + "/unspam", { method: "POST" })
            .then(function () {
              pushToast("success", "Removed spam flag.");
              return loadTriage();
            })
            .catch(function (err) { pushToast("error", err.message || "Failed to remove spam flag."); })
            .finally(function () { if (unspamButton instanceof HTMLButtonElement) setButtonBusy(unspamButton, false); });
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

        // Test Connection button
        var testButton = target.closest("[data-freshdesk-test]");
        if (testButton) {
          if (testButton instanceof HTMLButtonElement) {
            setButtonBusy(testButton, true, "Testing...");
          }
          var domainInput = document.getElementById("freshdesk-domain");
          var apiKeyInput = document.getElementById("freshdesk-api-key");
          var domain = domainInput ? domainInput.value : "";
          var apiKey = apiKeyInput ? apiKeyInput.value : "";

          request("/api/integrations/freshdesk/test-connection", {
            method: "POST",
            body: { domain: domain || undefined, apiKey: apiKey || undefined }
          })
            .then(function (result) {
              var resultEl = document.getElementById("freshdesk-test-result");
              if (resultEl) {
                resultEl.classList.remove("hidden");
                if (result.success) {
                  resultEl.className = "test-result-banner success";
                  resultEl.innerHTML = '<span class="ms">check_circle</span> ' + esc(result.message) +
                    (result.details && result.details.sampleFields
                      ? ' <small>(Fields: ' + esc(result.details.sampleFields.join(", ")) + ')</small>'
                      : '');
                } else {
                  resultEl.className = "test-result-banner error";
                  resultEl.innerHTML = '<span class="ms">error</span> ' + esc(result.error);
                }
                setTimeout(function () { resultEl.classList.add("hidden"); }, 8000);
              }
            })
            .catch(function (error) {
              var resultEl = document.getElementById("freshdesk-test-result");
              if (resultEl) {
                resultEl.classList.remove("hidden");
                resultEl.className = "test-result-banner error";
                resultEl.innerHTML = '<span class="ms">error</span> ' + esc(error.message || "Connection test failed");
                setTimeout(function () { resultEl.classList.add("hidden"); }, 8000);
              }
            })
            .finally(function () {
              if (testButton instanceof HTMLButtonElement) {
                setButtonBusy(testButton, false);
              }
            });
          return;
        }

        // Sync Now button
        var syncNowButton = target.closest("[data-freshdesk-sync-now]");
        if (syncNowButton) {
          if (syncNowButton instanceof HTMLButtonElement) {
            setButtonBusy(syncNowButton, true, "Syncing...");
          }
          request("/api/integrations/freshdesk/sync-now", {
            method: "POST",
            body: { daysBack: 7, maxTickets: 50 }
          })
            .then(function (result) {
              state.freshdeskConnection = result.connection || state.freshdeskConnection;
              state.errors.freshdesk = "";
              var msg = "Freshdesk sync complete: " +
                result.scanned + " scanned, " +
                result.matched + " matched filter, " +
                result.imported + " imported";
              if (result.errors > 0) {
                msg += ", " + result.errors + " errors";
              }
              pushToast(result.success ? "success" : "warning", msg);
              return Promise.all([
                loadFreshdeskStatus(),
                loadTriage(),
                loadSummary(),
                loadFeedback()
              ]);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Sync failed.");
            })
            .finally(function () {
              if (syncNowButton instanceof HTMLButtonElement) {
                setButtonBusy(syncNowButton, false);
              }
            });
          return;
        }

        // View Activity button
        var activityButton = target.closest("[data-freshdesk-activity]");
        if (activityButton) {
          if (activityButton instanceof HTMLButtonElement) {
            setButtonBusy(activityButton, true, "Loading...");
          }
          request("/api/integrations/freshdesk/activity")
            .then(function (result) {
              showFreshdeskActivityModal(result);
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to load activity.");
            })
            .finally(function () {
              if (activityButton instanceof HTMLButtonElement) {
                setButtonBusy(activityButton, false);
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

    // AI Threshold Slider
    var thresholdSaveTimeout = null;
    if (el.aiThresholdSlider && el.aiThresholdValue) {
      // Load saved preference from localStorage as initial value
      var savedThreshold = localStorage.getItem("painsolver_ai_threshold");
      if (savedThreshold) {
        el.aiThresholdSlider.value = savedThreshold;
        el.aiThresholdValue.textContent = savedThreshold + "%";
      }

      el.aiThresholdSlider.addEventListener("input", function () {
        var value = el.aiThresholdSlider.value;
        el.aiThresholdValue.textContent = value + "%";
        localStorage.setItem("painsolver_ai_threshold", value);

        // Debounced save to server
        if (thresholdSaveTimeout) {
          clearTimeout(thresholdSaveTimeout);
        }
        thresholdSaveTimeout = setTimeout(function () {
          var thresholdValue = Number(value) / 100; // Convert percentage to decimal (e.g., 75 -> 0.75)
          request("/api/company/triage/config", {
            method: "PATCH",
            body: {
              source: "freshdesk",
              routingMode: "central",
              enabled: true,
              similarityThreshold: thresholdValue
            }
          })
            .then(function () {
              pushToast("success", "AI threshold updated to " + value + "%");
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to save threshold.");
            });
        }, 500);
      });
    }

    // ===========================
    // P1: AI Triage Mode Toggle
    // ===========================
    if (el.aiTriageModeToggle) {
      el.aiTriageModeToggle.addEventListener("change", function () {
        var newMode = el.aiTriageModeToggle.checked ? "auto" : "manual";
        el.aiTriageModeLabel.textContent = newMode === "auto" ? "Auto" : "Manual";
        // Save to all sources
        var sources = ["freshdesk", "zoom", "slack"];
        sources.forEach(function (src) {
          var config = (state.triageConfig || []).find(function (c) { return c && c.source === src; }) || {};
          request("/api/company/triage/config", {
            method: "PATCH",
            body: {
              source: src,
              routingMode: config.routingMode || "central",
              enabled: config.enabled !== false,
              triageMode: newMode,
              spamDetectionEnabled: config.spamDetectionEnabled !== false
            }
          }).catch(function () {});
        });
        pushToast("success", "AI triage mode set to " + newMode + ".");
      });
    }

    // P1: Spam Detection Toggle
    if (el.aiSpamDetectionToggle) {
      el.aiSpamDetectionToggle.addEventListener("change", function () {
        var enabled = el.aiSpamDetectionToggle.checked;
        el.aiSpamDetectionLabel.textContent = enabled ? "Enabled" : "Disabled";
        var sources = ["freshdesk", "zoom", "slack"];
        sources.forEach(function (src) {
          var config = (state.triageConfig || []).find(function (c) { return c && c.source === src; }) || {};
          request("/api/company/triage/config", {
            method: "PATCH",
            body: {
              source: src,
              routingMode: config.routingMode || "central",
              enabled: config.enabled !== false,
              spamDetectionEnabled: enabled
            }
          }).catch(function () {});
        });
        pushToast("success", "Spam detection " + (enabled ? "enabled" : "disabled") + ".");
      });
    }

    // ===========================
    // P1: ClickUp Integration Handlers
    // ===========================
    if (el.clickUpIntegrationCard) {
      el.clickUpIntegrationCard.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) return;

        // Connect ClickUp
        var connectBtn = target.closest("#clickup-connect-btn");
        if (connectBtn) {
          var tokenInput = document.getElementById("clickup-access-token");
          if (!tokenInput || !tokenInput.value.trim()) {
            pushToast("warning", "Enter your ClickUp API token first.");
            return;
          }
          if (connectBtn instanceof HTMLButtonElement) setButtonBusy(connectBtn, true, "Connecting...");
          request("/api/company/integrations/clickup/connect", {
            method: "POST",
            body: { accessToken: tokenInput.value.trim() }
          })
            .then(function (data) {
              state.clickUpConnection = data;
              pushToast("success", "ClickUp connected to " + (data.teamName || "workspace") + "!");
              renderClickUpCard();
            })
            .catch(function (err) { pushToast("error", err.message || "Failed to connect ClickUp."); })
            .finally(function () { if (connectBtn instanceof HTMLButtonElement) setButtonBusy(connectBtn, false); });
          return;
        }

        // Save default list
        var saveListBtn = target.closest("#clickup-save-list");
        if (saveListBtn) {
          var listIdInput = document.getElementById("clickup-default-list-id");
          var listNameInput = document.getElementById("clickup-default-list-name");
          if (!listIdInput || !listIdInput.value.trim()) {
            pushToast("warning", "Enter a ClickUp list ID.");
            return;
          }
          if (saveListBtn instanceof HTMLButtonElement) setButtonBusy(saveListBtn, true, "Saving...");
          request("/api/company/integrations/clickup/default-list", {
            method: "PATCH",
            body: { listId: listIdInput.value.trim(), listName: (listNameInput && listNameInput.value.trim()) || undefined }
          })
            .then(function (data) {
              state.clickUpConnection = Object.assign(state.clickUpConnection || {}, data);
              pushToast("success", "Default ClickUp list saved.");
              renderClickUpCard();
            })
            .catch(function (err) { pushToast("error", err.message || "Failed to save default list."); })
            .finally(function () { if (saveListBtn instanceof HTMLButtonElement) setButtonBusy(saveListBtn, false); });
          return;
        }

        // Disconnect
        var disconnectBtn = target.closest("#clickup-disconnect");
        if (disconnectBtn) {
          if (!confirm("Disconnect ClickUp?")) return;
          if (disconnectBtn instanceof HTMLButtonElement) setButtonBusy(disconnectBtn, true, "Disconnecting...");
          request("/api/company/integrations/clickup/disconnect", { method: "DELETE" })
            .then(function () {
              state.clickUpConnection = { connected: false };
              pushToast("success", "ClickUp disconnected.");
              renderClickUpCard();
            })
            .catch(function (err) { pushToast("error", err.message || "Failed to disconnect ClickUp."); })
            .finally(function () { if (disconnectBtn instanceof HTMLButtonElement) setButtonBusy(disconnectBtn, false); });
          return;
        }
      });
    }

    // ===========================
    // Settings Page Event Listeners
    // ===========================
    var settingsSection = document.getElementById("company-settings");
    if (settingsSection) {
      // Add Domain Button
      var addDomainBtn = document.getElementById("add-domain-btn");
      var newDomainInput = document.getElementById("new-domain-input");
      
      if (addDomainBtn && newDomainInput) {
        addDomainBtn.addEventListener("click", function () {
          var domain = newDomainInput.value.trim().toLowerCase();
          if (!domain) {
            pushToast("warning", "Please enter a domain name.");
            return;
          }
          addCustomDomain(domain);
        });

        newDomainInput.addEventListener("keypress", function (e) {
          if (e.key === "Enter") {
            addDomainBtn.click();
          }
        });
      }

      // Domain List Actions (delegated)
      var domainsList = document.getElementById("domains-list");
      if (domainsList) {
        domainsList.addEventListener("click", function (event) {
          var target = event.target;
          if (!(target instanceof HTMLElement)) return;

          // Copy button
          var copyBtn = target.closest("[data-copy]");
          if (copyBtn) {
            var textToCopy = copyBtn.getAttribute("data-copy");
            navigator.clipboard.writeText(textToCopy).then(function () {
              pushToast("success", "Copied to clipboard!");
            });
            return;
          }

          // Verify domain
          var verifyBtn = target.closest("[data-verify-domain]");
          if (verifyBtn) {
            var domainId = verifyBtn.getAttribute("data-verify-domain");
            verifyDomain(domainId);
            return;
          }

          // Activate domain
          var activateBtn = target.closest("[data-activate-domain]");
          if (activateBtn) {
            var domainId = activateBtn.getAttribute("data-activate-domain");
            activateDomain(domainId);
            return;
          }

          // Check CNAME
          var checkCnameBtn = target.closest("[data-check-cname]");
          if (checkCnameBtn) {
            var domainId = checkCnameBtn.getAttribute("data-check-cname");
            if (checkCnameBtn instanceof HTMLButtonElement) {
              setButtonBusy(checkCnameBtn, true, "Checking...");
            }
            request("/api/custom-domains/check-cname/" + domainId, { method: "POST" })
              .then(function (result) {
                if (result.configured) {
                  pushToast("success", "CNAME configured correctly! SSL is active.");
                  loadCustomDomains();
                } else {
                  pushToast("warning", result.error || "CNAME not configured. " + (result.hint || ""));
                }
              })
              .catch(function (error) {
                pushToast("error", error.message || "CNAME check failed");
              })
              .finally(function () {
                if (checkCnameBtn instanceof HTMLButtonElement) {
                  setButtonBusy(checkCnameBtn, false);
                }
              });
            return;
          }

          // Delete domain
          var deleteBtn = target.closest("[data-delete-domain]");
          if (deleteBtn) {
            var domainId = deleteBtn.getAttribute("data-delete-domain");
            deleteDomain(domainId);
            return;
          }
        });
      }

      // Color picker sync
      var primaryColor = document.getElementById("primary-color");
      var primaryColorHex = document.getElementById("primary-color-hex");
      var accentColor = document.getElementById("accent-color");
      var accentColorHex = document.getElementById("accent-color-hex");

      if (primaryColor && primaryColorHex) {
        primaryColor.addEventListener("input", function () {
          primaryColorHex.value = primaryColor.value.toUpperCase();
        });
        primaryColorHex.addEventListener("input", function () {
          if (/^#[0-9A-Fa-f]{6}$/.test(primaryColorHex.value)) {
            primaryColor.value = primaryColorHex.value;
          }
        });
      }

      if (accentColor && accentColorHex) {
        accentColor.addEventListener("input", function () {
          accentColorHex.value = accentColor.value.toUpperCase();
        });
        accentColorHex.addEventListener("input", function () {
          if (/^#[0-9A-Fa-f]{6}$/.test(accentColorHex.value)) {
            accentColor.value = accentColorHex.value;
          }
        });
      }

      // Save branding
      var saveBrandingBtn = document.getElementById("save-branding-btn");
      if (saveBrandingBtn) {
        saveBrandingBtn.addEventListener("click", function () {
          var portalNameEl = document.getElementById("portal-name");
          var settings = {
            portalName: portalNameEl ? portalNameEl.value : "Feedback Portal",
            primaryColor: primaryColor ? primaryColor.value : "#004549",
            accentColor: accentColor ? accentColor.value : "#00eef9"
          };
          
          setButtonBusy(saveBrandingBtn, true, "Saving...");
          
          request("/api/portal/settings", {
            method: "PATCH",
            body: settings
          })
            .then(function (result) {
              if (result.settings) {
                state.portalSettings = result.settings;
                pushToast("success", "Branding settings saved!");
              }
            })
            .catch(function (error) {
              pushToast("error", error.message || "Failed to save branding");
            })
            .finally(function () {
              setButtonBusy(saveBrandingBtn, false);
            });
        });
      }

      // ── API Key events ──
      var createApiKeyBtn = document.getElementById("create-api-key-btn");
      if (createApiKeyBtn) {
        createApiKeyBtn.addEventListener("click", createApiKey);
      }

      var copyNewApiKeyBtn = document.getElementById("copy-new-api-key");
      if (copyNewApiKeyBtn) {
        copyNewApiKeyBtn.addEventListener("click", function () {
          var val = document.getElementById("new-api-key-value");
          if (val && val.textContent) {
            navigator.clipboard.writeText(val.textContent).then(function () {
              pushToast("success", "API key copied to clipboard");
            });
          }
        });
      }

      var copyPortalUrlBtn = document.getElementById("copy-portal-url");
      if (copyPortalUrlBtn) {
        copyPortalUrlBtn.addEventListener("click", function () {
          var displayEl = document.getElementById("portal-url-display");
          if (displayEl && displayEl.textContent) {
            navigator.clipboard.writeText(displayEl.textContent).then(function () {
              pushToast("success", "Portal URL copied to clipboard");
            });
          }
        });
      }

      // Delegate revoke clicks
      var apiKeysList = document.getElementById("api-keys-list");
      if (apiKeysList) {
        apiKeysList.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-revoke-key-id]");
          if (btn) {
            var keyId = btn.getAttribute("data-revoke-key-id");
            if (keyId) revokeApiKey(keyId);
          }
        });
      }
    }
  }

  function loadPortalBranding() {
    return request("/api/portal/settings")
      .then(function (result) {
        if (result.settings) {
          state.portalSettings = result.settings;
          renderPortalBranding();
        }
      })
      .catch(function (error) {
        console.warn("Failed to load portal settings:", error);
      });
  }

  function renderPortalBranding() {
    var settings = state.portalSettings;
    if (!settings) return;

    var portalNameEl = document.getElementById("portal-name");
    var primaryColorEl = document.getElementById("primary-color");
    var primaryColorHexEl = document.getElementById("primary-color-hex");
    var accentColorEl = document.getElementById("accent-color");
    var accentColorHexEl = document.getElementById("accent-color-hex");

    if (portalNameEl && settings.portalName) {
      portalNameEl.value = settings.portalName;
    }
    if (primaryColorEl && settings.primaryColor) {
      primaryColorEl.value = settings.primaryColor;
    }
    if (primaryColorHexEl && settings.primaryColor) {
      primaryColorHexEl.value = settings.primaryColor;
    }
    if (accentColorEl && settings.accentColor) {
      accentColorEl.value = settings.accentColor;
    }
    if (accentColorHexEl && settings.accentColor) {
      accentColorHexEl.value = settings.accentColor;
    }
  }

  /**
   * Check authentication and load user/company context.
   * Redirects to /auth if not authenticated (production multi-tenant mode).
   */
  function checkAuthAndLoadContext() {
    return fetch("/api/auth/session", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.authenticated && data.user) {
          // Authenticated — use real user context
          state.authUser = data.user;
          state.isAuthenticated = true;
          state.companyId = data.user.companyId;
          state.companySlug = data.user.companySlug;
          updateUserMenu(data.user);
          return data;
        } else {
          // Not authenticated — redirect to login
          console.log("[PainSolver] No active session — redirecting to login.");
          window.location.href = "/auth";
          // Throw to prevent further bootstrap from running
          throw new Error("Not authenticated");
        }
      })
      .catch(function (err) {
        if (err && err.message === "Not authenticated") {
          throw err; // Re-throw to stop bootstrap
        }
        // Session check failed (network error etc.) — redirect to login
        console.warn("[PainSolver] Auth check failed, redirecting to login:", err.message);
        window.location.href = "/auth";
        throw new Error("Not authenticated");
      });
  }

  function updateUserMenu(user) {
    // Update avatar with user initial
    var avatarBtn = document.getElementById("user-avatar-btn");
    if (avatarBtn) {
      avatarBtn.textContent = (user.name || user.email || "?").charAt(0).toUpperCase();
    }
    // Update dropdown
    var nameEl = document.getElementById("user-dropdown-name");
    var emailEl = document.getElementById("user-dropdown-email");
    if (nameEl) nameEl.textContent = user.name || "User";
    if (emailEl) emailEl.textContent = user.email || "";
  }

  function handleLogout() {
    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
      .then(function () {
        window.location.href = "/auth";
      })
      .catch(function () {
        window.location.href = "/auth";
      });
  }

  // ── API Key Self-Service ──
  function loadApiKeys() {
    var listEl = document.getElementById("api-keys-list");
    if (!listEl) return Promise.resolve();

    listEl.innerHTML = '<p class="muted">Loading keys...</p>';

    return fetch("/api/company/api-keys", {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" }
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var creds = data.credentials || [];
        if (!creds.length) {
          listEl.innerHTML = '<p class="muted">No API keys yet. Generate one above.</p>';
          return;
        }
        listEl.innerHTML = creds.map(function (c) {
          var scopeStr = (c.scopes || ["*"]).join(", ");
          var statusClass = c.isActive ? "api-key-active" : "api-key-revoked";
          var statusLabel = c.isActive ? "Active" : "Revoked";
          var revokeBtn = c.isActive
            ? '<button class="ghost small" data-revoke-key-id="' + esc(c.id) + '" type="button" style="color:var(--error);"><span class="ms" style="font-size:15px;">block</span> Revoke</button>'
            : '';
          return (
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);">' +
            '<div>' +
            '<strong>' + esc(c.name) + '</strong>' +
            '<span class="' + statusClass + '" style="margin-left:8px;font-size:12px;padding:2px 8px;border-radius:4px;' +
            (c.isActive ? 'background:rgba(16,185,129,0.1);color:#10b981;' : 'background:rgba(239,68,68,0.1);color:#ef4444;') +
            '">' + statusLabel + '</span>' +
            '<div class="muted" style="font-size:12px;margin-top:2px;">Scopes: ' + esc(scopeStr) + ' · Created: ' + new Date(c.createdAt).toLocaleDateString() + '</div>' +
            '</div>' +
            '<div>' + revokeBtn + '</div>' +
            '</div>'
          );
        }).join("");
      })
      .catch(function (err) {
        listEl.innerHTML = '<p class="muted" style="color:var(--error);">Failed to load API keys.</p>';
        console.error("[api-keys] load error:", err);
      });
  }

  function createApiKey() {
    var nameInput = document.getElementById("new-api-key-name");
    var name = (nameInput && nameInput.value || "").trim() || "API Key";
    var banner = document.getElementById("new-api-key-banner");
    var valueEl = document.getElementById("new-api-key-value");

    return fetch("/api/company/api-keys", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.apiKey) {
          if (valueEl) valueEl.textContent = data.apiKey;
          if (banner) banner.style.display = "block";
          if (nameInput) nameInput.value = "";
          loadApiKeys();
        } else {
          alert(data.error || "Failed to create API key");
        }
      })
      .catch(function (err) {
        alert("Failed to create API key: " + err.message);
      });
  }

  function revokeApiKey(keyId) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;

    return fetch("/api/company/api-keys/" + keyId + "/revoke", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" }
    })
      .then(function (res) { return res.json(); })
      .then(function () {
        loadApiKeys();
      })
      .catch(function (err) {
        alert("Failed to revoke key: " + err.message);
      });
  }

  function renderPortalUrl() {
    var displayEl = document.getElementById("portal-url-display");
    if (!displayEl) return;

    var baseUrl = window.location.origin;
    var slug = state.companySlug;
    var url = slug ? baseUrl + "/portal/" + encodeURIComponent(slug) : baseUrl + "/portal";
    displayEl.textContent = url;
  }

  function bootstrap() {
    // ── Step 1: Check authentication before anything else ──
    checkAuthAndLoadContext()
      .then(function () {
        // ── Step 2: Render UI ──
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

        // Remove loading overlay
        var overlay = document.getElementById("auth-loading-overlay");
        if (overlay) {
          overlay.classList.add("fade-out");
          setTimeout(function () { overlay.remove(); }, 300);
        }

        // ── Step 3: Load data ──
        return Promise.all([loadSummary(), loadMembers(), loadBoards(), loadSavedFilters()]);
      })
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
        if (error && error.message === "Not authenticated") {
          return; // Redirect is already happening
        }
        console.error("Company bootstrap failed", error);
      });
  }

  bindEvents();
  bootstrap();
})(window, document);
