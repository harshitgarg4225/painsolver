(function () {
  "use strict";

  var state = {
    currentStep: 1,
    companyName: "",
    boardName: "Feature Requests",
    mrrRange: "0-10k",
    tools: [],
    currentProcess: "nothing",
    boardToken: "",
    apiKey: "",
    clientSecret: ""
  };

  var el = {
    progressFill: document.getElementById("progress-fill"),
    steps: document.querySelectorAll(".wizard-step"),
    progressSteps: document.querySelectorAll(".progress-step"),
    companyForm: document.getElementById("company-form"),
    toolsForm: document.getElementById("tools-form"),
    processForm: document.getElementById("process-form"),
    companyNameInput: document.getElementById("company-name"),
    boardNameInput: document.getElementById("board-name"),
    statBoardName: document.getElementById("stat-board-name"),
    statToolsCount: document.getElementById("stat-tools-count"),
    boardTokenPlaceholder: document.getElementById("board-token-placeholder"),
    apiKeyDisplay: document.getElementById("api-key-display"),
    clientSecretDisplay: document.getElementById("client-secret-display"),
    integrationList: document.getElementById("integration-list")
  };

  function updateProgress() {
    var percent = (state.currentStep / 4) * 100;
    el.progressFill.style.width = percent + "%";

    el.progressSteps.forEach(function (step, index) {
      var stepNum = index + 1;
      step.classList.remove("active", "complete");
      if (stepNum < state.currentStep) {
        step.classList.add("complete");
      } else if (stepNum === state.currentStep) {
        step.classList.add("active");
      }
    });
  }

  function showStep(stepNum) {
    el.steps.forEach(function (step) {
      step.classList.remove("active");
    });
    var targetStep = document.getElementById("step-" + stepNum);
    if (targetStep) {
      targetStep.classList.add("active");
    }
    state.currentStep = stepNum;
    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.goToStep = function (stepNum) {
    if (stepNum < state.currentStep) {
      showStep(stepNum);
    }
  };

  function getSelectedTools() {
    var checkboxes = document.querySelectorAll('input[name="tools"]:checked');
    return Array.prototype.map.call(checkboxes, function (cb) {
      return cb.value;
    });
  }

  function generateRandomString(length) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var result = "";
    for (var i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function generateCredentials() {
    // In a real implementation, these would come from the backend
    // For now, generate demo credentials
    state.boardToken = "brd_" + generateRandomString(24);
    state.apiKey = "ps_live_" + generateRandomString(32);
    state.clientSecret = "psc_" + generateRandomString(40);
  }

  function renderInstallStep() {
    el.statBoardName.textContent = state.boardName || "Feature Requests";
    el.statToolsCount.textContent = state.tools.length;
    el.boardTokenPlaceholder.textContent = state.boardToken;
    el.apiKeyDisplay.textContent = state.apiKey;
    el.clientSecretDisplay.textContent = state.clientSecret;

    // Render integration list
    var integrations = [];
    
    if (state.tools.includes("freshdesk")) {
      integrations.push({ name: "Freshdesk", icon: "freshdesk", connected: false, url: "/company#ai-inbox" });
    }
    if (state.tools.includes("slack")) {
      integrations.push({ name: "Slack", icon: "slack", connected: false, url: "/company#ai-inbox" });
    }
    if (state.tools.includes("zoom")) {
      integrations.push({ name: "Zoom", icon: "zoom", connected: false, url: "/company#ai-inbox" });
    }
    if (state.tools.includes("stripe")) {
      integrations.push({ name: "Stripe", icon: "stripe", connected: false, url: "/docs#stripe-integration" });
    }
    if (state.tools.includes("zendesk")) {
      integrations.push({ name: "Zendesk", icon: "zendesk", connected: false, url: "#", disabled: true });
    }
    if (state.tools.includes("intercom")) {
      integrations.push({ name: "Intercom", icon: "intercom", connected: false, url: "#", disabled: true });
    }

    if (integrations.length === 0) {
      el.integrationList.innerHTML = '<p class="muted" style="margin: 0; color: #64748b;">No integrations selected. You can add them later from the dashboard.</p>';
      return;
    }

    el.integrationList.innerHTML = integrations
      .map(function (int) {
        var btnClass = int.connected ? "btn small connected" : "btn small ghost";
        var btnText = int.connected ? "Connected" : (int.disabled ? "Coming Soon" : "Connect");
        var btnDisabled = int.disabled ? "disabled" : "";
        
        return (
          '<div class="integration-item">' +
          '<div class="integration-item-info">' +
          '<span class="tool-icon ' + int.icon + '"></span>' +
          '<strong>' + int.name + '</strong>' +
          '</div>' +
          '<a href="' + int.url + '" class="' + btnClass + '" ' + btnDisabled + '>' + btnText + '</a>' +
          '</div>'
        );
      })
      .join("");
  }

  function submitSetup() {
    // In a real implementation, this would:
    // 1. POST to /api/v1/onboarding/setup with company/board/tools info
    // 2. Backend creates board, API credentials, returns tokens
    // 3. Display the real credentials
    
    // For now, generate demo credentials
    generateCredentials();
    renderInstallStep();
    showStep(4);
  }

  // Event Listeners
  if (el.companyForm) {
    el.companyForm.addEventListener("submit", function (e) {
      e.preventDefault();
      state.companyName = el.companyNameInput.value.trim();
      state.boardName = el.boardNameInput.value.trim() || "Feature Requests";
      
      var mrrRadio = document.querySelector('input[name="mrr-range"]:checked');
      state.mrrRange = mrrRadio ? mrrRadio.value : "0-10k";
      
      showStep(2);
    });
  }

  if (el.toolsForm) {
    el.toolsForm.addEventListener("submit", function (e) {
      e.preventDefault();
      state.tools = getSelectedTools();
      showStep(3);
    });
  }

  if (el.processForm) {
    el.processForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var processRadio = document.querySelector('input[name="current-process"]:checked');
      state.currentProcess = processRadio ? processRadio.value : "nothing";
      submitSetup();
    });
  }

  // Progress step click handlers
  el.progressSteps.forEach(function (step) {
    step.addEventListener("click", function () {
      var stepNum = parseInt(step.getAttribute("data-step"), 10);
      if (stepNum < state.currentStep) {
        showStep(stepNum);
      }
    });
  });

  // Copy functions
  window.copyCode = function (elementId) {
    var codeEl = document.getElementById(elementId);
    if (!codeEl) return;
    
    var text = codeEl.textContent;
    navigator.clipboard.writeText(text).then(function () {
      var btn = codeEl.parentElement.querySelector(".copy-btn");
      if (btn) {
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(function () {
          btn.textContent = "Copy";
          btn.classList.remove("copied");
        }, 2000);
      }
    });
  };

  window.copyText = function (elementId) {
    var el = document.getElementById(elementId);
    if (!el) return;
    
    var text = el.textContent;
    navigator.clipboard.writeText(text).then(function () {
      var btn = el.parentElement.querySelector(".icon-btn");
      if (btn) {
        var icon = btn.querySelector(".material-symbols-outlined");
        if (icon) {
          icon.textContent = "check";
          setTimeout(function () {
            icon.textContent = "content_copy";
          }, 2000);
        }
      }
    });
  };

  // Initialize
  updateProgress();
})();

