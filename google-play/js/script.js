/* ============================================================
   IndoProperty — Google Play Support Pages
   Shared JavaScript — vanilla JS, no framework
   ============================================================ */

/* ── Configuration ─────────────────────────────────────────────────────────
   EDGE FUNCTION ENDPOINT
   This is the Supabase delete-account Edge Function deployed in your project.
   It accepts: POST with Authorization: Bearer <user_jwt>
   It returns:  { success: true } or { error: "..." }

   To connect to a different endpoint, change EDGE_FUNCTION_URL below.
   The anon key is safe to include here — it is the public key and is already
   embedded in the built React app. The service_role key is NEVER used here.
   ─────────────────────────────────────────────────────────────────────────── */
const CONFIG = {
  SUPABASE_URL:      'https://mcahrqukjathkymymsve.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_VhnhIc84pTU7M2nNGLlomQ_IONTP7Q-',
  // Edge Function URL — built from SUPABASE_URL + function name
  get EDGE_FUNCTION_URL() {
    return this.SUPABASE_URL + '/functions/v1/delete-account';
  },
  SUPPORT_EMAIL: 'support@indoproperty.in',
};

/* ── Utility helpers ──────────────────────────────────────── */

/** Mark current nav link as active based on current page filename */
function markActiveNav() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(function(link) {
    const href = link.getAttribute('href') || '';
    if (href === current || (current === 'index.html' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/** Simple email validation */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Show / hide an element */
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

/* ── FAQ accordion ────────────────────────────────────────── */
function initFaq() {
  document.querySelectorAll('.faq-q').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const answer = btn.nextElementSibling;
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      // Collapse all others
      document.querySelectorAll('.faq-q').forEach(function(b) {
        b.setAttribute('aria-expanded', 'false');
        if (b.nextElementSibling) b.nextElementSibling.classList.remove('open');
      });
      // Toggle this one
      if (!expanded) {
        btn.setAttribute('aria-expanded', 'true');
        if (answer) answer.classList.add('open');
      }
    });
  });
}

/* ── Delete Account page ──────────────────────────────────── */
function initDeleteAccountPage() {
  const form        = document.getElementById('delete-form');
  if (!form) return; // not on delete-account page

  const emailInput  = document.getElementById('del-email');
  const reasonInput = document.getElementById('del-reason');
  const submitBtn   = document.getElementById('del-submit');
  const btnText     = document.getElementById('del-btn-text');
  const btnSpinner  = document.getElementById('del-spinner');
  const errorBox    = document.getElementById('del-error');
  const successBox  = document.getElementById('del-success');
  const confirmedEmail = document.getElementById('confirmed-email');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email  = (emailInput ? emailInput.value : '').trim();
    const reason = (reasonInput ? reasonInput.value : '').trim();

    // Client-side validation
    if (!isValidEmail(email)) {
      showError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    clearError();

    try {
      /*
       * STEP 1 — Sign in with email to get a valid session JWT.
       * The Edge Function requires an authenticated user JWT to identify
       * which account to delete. We call Supabase Auth REST directly.
       *
       * NOTE: This page cannot delete accounts for users who are not able
       * to sign in. In that case, the user must email support directly.
       * The password field is shown conditionally (see HTML).
       */
      const passwordInput = document.getElementById('del-password');
      const password = passwordInput ? passwordInput.value : '';

      if (!password) {
        showError('Please enter your account password so we can verify your identity before deleting your account.');
        setLoading(false);
        return;
      }

      // Authenticate user via Supabase REST API (anon key is safe here)
      const signInResp = await fetch(
        CONFIG.SUPABASE_URL + '/auth/v1/token?grant_type=password',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': CONFIG.SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email: email, password: password }),
        }
      );

      const signInData = await signInResp.json();

      if (!signInResp.ok || !signInData.access_token) {
        const msg = signInData.error_description || signInData.msg || 'Sign-in failed. Please check your email and password.';
        showError(msg);
        setLoading(false);
        return;
      }

      const accessToken = signInData.access_token;

      // STEP 2 — Call the Edge Function with the user's JWT
      const deleteResp = await fetch(CONFIG.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason }),
      });

      const deleteData = await deleteResp.json();

      if (!deleteResp.ok || !deleteData.success) {
        const msg = deleteData.error || ('Account deletion failed (HTTP ' + deleteResp.status + '). Please try again or contact ' + CONFIG.SUPPORT_EMAIL);
        showError(msg);
        setLoading(false);
        return;
      }

      // Success
      if (confirmedEmail) confirmedEmail.textContent = email;
      hide(form);
      show(successBox);

    } catch (err) {
      showError(
        'Network error — could not reach the server. ' +
        'Please check your internet connection and try again, or email ' +
        CONFIG.SUPPORT_EMAIL + ' directly.'
      );
      setLoading(false);
    }
  });

  function setLoading(loading) {
    if (submitBtn)  submitBtn.disabled = loading;
    if (btnText)    btnText.textContent = loading ? 'Processing…' : 'Delete My Account';
    if (btnSpinner) { loading ? show(btnSpinner) : hide(btnSpinner); }
  }

  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    show(errorBox);
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearError() {
    if (errorBox) { errorBox.textContent = ''; hide(errorBox); }
  }
}

/* ── Contact page ─────────────────────────────────────────── */
function initContactPage() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const submitBtn    = document.getElementById('contact-submit');
  const btnText      = document.getElementById('contact-btn-text');
  const btnSpinner   = document.getElementById('contact-spinner');
  const successBox   = document.getElementById('contact-success');
  const errorBox     = document.getElementById('contact-error');

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    const name    = (document.getElementById('c-name')    || {}).value || '';
    const email   = (document.getElementById('c-email')   || {}).value || '';
    const subject = (document.getElementById('c-subject') || {}).value || '';
    const message = (document.getElementById('c-message') || {}).value || '';

    if (!isValidEmail(email)) {
      if (errorBox) { errorBox.textContent = 'Please enter a valid email address.'; show(errorBox); }
      return;
    }
    if (!message.trim()) {
      if (errorBox) { errorBox.textContent = 'Please enter your message.'; show(errorBox); }
      return;
    }

    if (errorBox) hide(errorBox);

    // Open mailto: with pre-filled content
    const mailSubject = encodeURIComponent('[IndoProperty Support] ' + (subject || 'General Enquiry'));
    const mailBody = encodeURIComponent(
      'Name: ' + name + '\n' +
      'Email: ' + email + '\n' +
      'Subject: ' + subject + '\n\n' +
      'Message:\n' + message
    );

    if (submitBtn) submitBtn.disabled = true;
    if (btnText)   btnText.textContent = 'Opening email…';
    if (btnSpinner) show(btnSpinner);

    window.location.href = 'mailto:' + CONFIG.SUPPORT_EMAIL +
      '?subject=' + mailSubject + '&body=' + mailBody;

    // Show success after short delay
    setTimeout(function() {
      hide(form);
      show(successBox);
    }, 900);
  });
}

/* ── Initialise ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  markActiveNav();
  initFaq();
  initDeleteAccountPage();
  initContactPage();
});
