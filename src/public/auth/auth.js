(function() {
  var tabs = document.querySelectorAll(".auth-tab");
  var loginForm = document.getElementById("login-form");
  var signupForm = document.getElementById("signup-form");
  var forgotForm = document.getElementById("forgot-form");
  var errorMessage = document.getElementById("error-message");
  var successMessage = document.getElementById("success-message");

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.add("show");
    successMessage.classList.remove("show");
  }

  function showSuccess(msg) {
    successMessage.textContent = msg;
    successMessage.classList.add("show");
    errorMessage.classList.remove("show");
  }

  function clearMessages() {
    errorMessage.classList.remove("show");
    successMessage.classList.remove("show");
  }

  function setButtonLoading(btn, loading) {
    var text = btn.querySelector(".btn-text");
    if (loading) {
      btn.disabled = true;
      text.innerHTML = '<div class="spinner"></div>';
    } else {
      btn.disabled = false;
      text.textContent = btn.getAttribute("data-original-text") || text.textContent;
    }
  }

  // Tab switching
  tabs.forEach(function(tab) {
    tab.addEventListener("click", function() {
      var tabName = tab.getAttribute("data-tab");
      tabs.forEach(function(t) { t.classList.remove("active"); });
      tab.classList.add("active");
      
      clearMessages();
      loginForm.classList.remove("active");
      signupForm.classList.remove("active");
      forgotForm.classList.remove("active");

      if (tabName === "login") {
        loginForm.classList.add("active");
      } else if (tabName === "signup") {
        signupForm.classList.add("active");
      }
    });
  });

  // Forgot password link
  document.getElementById("forgot-password-link").addEventListener("click", function(e) {
    e.preventDefault();
    clearMessages();
    loginForm.classList.remove("active");
    forgotForm.classList.add("active");
    tabs.forEach(function(t) { t.classList.remove("active"); });
  });

  document.getElementById("back-to-login").addEventListener("click", function(e) {
    e.preventDefault();
    clearMessages();
    forgotForm.classList.remove("active");
    loginForm.classList.add("active");
    tabs[0].classList.add("active");
  });

  // Login form
  loginForm.addEventListener("submit", function(e) {
    e.preventDefault();
    clearMessages();
    
    var btn = document.getElementById("login-btn");
    btn.setAttribute("data-original-text", "Sign In");
    setButtonLoading(btn, true);

    var email = document.getElementById("login-email").value;
    var password = document.getElementById("login-password").value;

    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        window.location.href = "/company";
      } else {
        showError(data.error || "Login failed");
        setButtonLoading(btn, false);
      }
    })
    .catch(function(err) {
      showError("Network error. Please try again.");
      setButtonLoading(btn, false);
    });
  });

  // Signup form
  signupForm.addEventListener("submit", function(e) {
    e.preventDefault();
    clearMessages();
    
    var btn = document.getElementById("signup-btn");
    btn.setAttribute("data-original-text", "Create Account");
    setButtonLoading(btn, true);

    var name = document.getElementById("signup-name").value;
    var email = document.getElementById("signup-email").value;
    var companyName = document.getElementById("signup-company").value.trim();
    var password = document.getElementById("signup-password").value;

    var payload = { name: name, email: email, password: password };
    if (companyName) { payload.companyName = companyName; }

    fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        if (data.requiresVerification) {
          showSuccess("Account created! Please check your email to verify your account.");
          setTimeout(function() {
            window.location.href = "/company";
          }, 2000);
        } else {
          window.location.href = "/company";
        }
      } else {
        showError(data.error || "Signup failed");
        setButtonLoading(btn, false);
      }
    })
    .catch(function(err) {
      showError("Network error. Please try again.");
      setButtonLoading(btn, false);
    });
  });

  // Forgot password form
  forgotForm.addEventListener("submit", function(e) {
    e.preventDefault();
    clearMessages();
    
    var btn = document.getElementById("forgot-btn");
    btn.setAttribute("data-original-text", "Send Reset Link");
    setButtonLoading(btn, true);

    var email = document.getElementById("forgot-email").value;

    fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      showSuccess(data.message || "If an account exists, you will receive a reset email.");
      setButtonLoading(btn, false);
    })
    .catch(function(err) {
      showError("Network error. Please try again.");
      setButtonLoading(btn, false);
    });
  });

  // Check if already logged in
  fetch("/api/auth/session")
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.authenticated) {
        window.location.href = "/company";
      }
    });
})();

