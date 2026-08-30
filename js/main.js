/* ==========================================================================
   Deepika Gupta Realty — landing page behaviour
   --------------------------------------------------------------------------
   Contents
     1.  Config + small helpers
     2.  Analytics (dataLayer + Meta Pixel bridge)
     3.  URL parameters (utm_*, interest, city, area)
     4.  WhatsApp link wiring
     5.  Click tracking (WhatsApp / Call)
     6.  Lead forms: validation, submit, localStorage, success, sync
     7.  Inventory + city shortcuts
     8.  Mobile navigation (focus trap, ESC, scroll lock)
     9.  FAQ accordion
     10. Chrome: header height, sticky bar, smooth scroll
     11. Boot
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. CONFIG + HELPERS
     ------------------------------------------------------------------------ */
  var WA_NUMBER = '919648410410';                    // wa.me format: country code, no +
  var WA_BASE = 'https://wa.me/' + WA_NUMBER;
  var STORE_KEY = 'dgr_leads_v1';
  var MIN_FILL_MS = 2000;                            // faster than this = almost certainly a bot

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var prefersReducedMotion = function () {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  function scrollToEl(el) {
    if (!el) return;
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  /* Bilingual, short field errors — Hindi first, English after the dot. */
  var MSG = {
    nameEmpty:    'Naam likhiye · Please enter your name',
    nameShort:    'Poora naam likhiye · Use at least 2 characters',
    nameLong:     'Naam 80 characters se kam rakhiye · Keep the name under 80 characters',
    nameChars:    'Sirf naam likhiye · Letters, spaces and dots only',
    phoneEmpty:   'Mobile number likhiye · Please enter your mobile number',
    phoneInvalid: '10 digit mobile daaliye, 6-9 se shuru · Enter a valid 10-digit Indian mobile',
    cityEmpty:    'Apna sheher chuniye · Please select your city',
    interestEmpty:'Kya chahiye — chuniye · Please select a property type',
    budgetEmpty:  'Budget range chuniye · Please select a budget range',
    messageLong:  '500 characters se kam likhiye · Please keep this under 500 characters',
    consentEmpty: 'Contact karne ki permission dijiye · Please tick this to continue'
  };

  /* ------------------------------------------------------------------------
     2. ANALYTICS
     ------------------------------------------------------------------------
     Cookie-less: everything is pushed to window.dataLayer. Wire GTM, Plausible,
     Umami or anything else on top of these six event names:
       page_view · click_whatsapp · click_call · form_start · form_error · lead_submitted
     ------------------------------------------------------------------------ */
  window.dataLayer = window.dataLayer || [];

  function track(eventName, payload) {
    var data = { event: eventName };
    if (payload) {
      Object.keys(payload).forEach(function (k) { data[k] = payload[k]; });
    }
    try { window.dataLayer.push(data); } catch (err) { /* never break the page */ }
  }

  /* Meta Pixel bridge — no-ops until the pixel snippet in <head> is uncommented. */
  function pixel(eventName, payload) {
    if (typeof window.fbq === 'function') {
      try { window.fbq('track', eventName, payload || {}); } catch (err) {}
    }
  }

  /* ------------------------------------------------------------------------
     3. URL PARAMETERS
     ------------------------------------------------------------------------ */
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var params = new URLSearchParams(window.location.search);
  var utm = {};
  var deepLink = { interest: '', city: '', area: '' };

  /* ?interest=plot|villa|row-house|farmhouse|not-sure  ->  exact <option> values */
  var INTEREST_ALIASES = {
    'plot': 'Plot',
    'plots': 'Plot',
    'land': 'Plot',
    'villa': 'Villa / Row house',
    'villas': 'Villa / Row house',
    'rowhouse': 'Villa / Row house',
    'row-house': 'Villa / Row house',
    'row house': 'Villa / Row house',
    'villa / row house': 'Villa / Row house',
    'farmhouse': 'Farmhouse',
    'farm-house': 'Farmhouse',
    'farm': 'Farmhouse',
    'notsure': 'Not sure yet',
    'not-sure': 'Not sure yet',
    'not sure yet': 'Not sure yet'
  };

  var CITY_ALIASES = {
    'lucknow': 'Lucknow', 'lko': 'Lucknow',
    'kanpur': 'Kanpur',
    'sitapur': 'Sitapur',
    'lakhimpur': 'Lakhimpur', 'lakhimpur-kheri': 'Lakhimpur', 'kheri': 'Lakhimpur',
    'ayodhya': 'Ayodhya', 'faizabad': 'Ayodhya',
    'unnao': 'Unnao',
    'other': 'Other'
  };

  function readParams() {
    UTM_KEYS.forEach(function (k) {
      var v = params.get(k);
      if (v) utm[k] = v.slice(0, 120);
    });

    var rawInterest = (params.get('interest') || '').trim().toLowerCase();
    if (rawInterest && INTEREST_ALIASES[rawInterest]) deepLink.interest = INTEREST_ALIASES[rawInterest];

    var rawCity = (params.get('city') || '').trim().toLowerCase();
    if (rawCity && CITY_ALIASES[rawCity]) deepLink.city = CITY_ALIASES[rawCity];

    var rawArea = (params.get('area') || '').trim();
    if (rawArea) deepLink.area = rawArea.slice(0, 80);
  }

  function utmRef() {
    var bits = [];
    if (utm.utm_source) bits.push(utm.utm_source);
    if (utm.utm_campaign) bits.push(utm.utm_campaign);
    if (!bits.length && utm.utm_medium) bits.push(utm.utm_medium);
    return bits.length ? bits.join(' / ') : '';
  }

  /* ------------------------------------------------------------------------
     4. WHATSAPP LINK WIRING
     ------------------------------------------------------------------------
     Every WhatsApp anchor ships with a working href (bare wa.me link) so the
     page still converts with JavaScript disabled. Here we upgrade each one
     with its prefilled message plus the campaign reference.
     ------------------------------------------------------------------------ */
  function waUrl(text) {
    if (!text) return WA_BASE;
    return WA_BASE + '?text=' + encodeURIComponent(text);
  }

  function withRef(text) {
    var ref = utmRef();
    return ref ? text + '\n\n(Ref: ' + ref + ')' : text;
  }

  function wireWhatsAppLinks() {
    $$('a[data-wa]').forEach(function (a) {
      var msg = a.getAttribute('data-wa-msg');
      if (!msg) return;
      var area = deepLink.area ? ' Area: ' + deepLink.area + '.' : '';
      a.href = waUrl(withRef(msg + area));
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
  }

  /* ------------------------------------------------------------------------
     5. CLICK TRACKING
     ------------------------------------------------------------------------ */
  function wireClickTracking() {
    document.addEventListener('click', function (e) {
      var target = e.target;
      if (!target || !target.closest) return;

      var wa = target.closest('a[href^="https://wa.me"], a[data-wa], a[data-success-wa]');
      if (wa) {
        track('click_whatsapp', {
          location: describeLocation(wa),
          label: (wa.textContent || '').trim().slice(0, 60)
        });
        pixel('Contact', { method: 'whatsapp' });
        return;
      }

      var call = target.closest('a[href^="tel:"]');
      if (call) {
        track('click_call', {
          location: describeLocation(call),
          label: (call.textContent || '').trim().slice(0, 60)
        });
        pixel('Contact', { method: 'phone' });
      }
    }, false);
  }

  function describeLocation(el) {
    var section = el.closest('section, header, footer, .sticky-cta, .announce, .float-card, .contact-card');
    if (!section) return 'page';
    return section.id || (section.className || '').split(' ')[0] || section.tagName.toLowerCase();
  }

  /* ------------------------------------------------------------------------
     6. LEAD FORMS
     ------------------------------------------------------------------------ */
  var FIELD_NAMES = ['fullName', 'phone', 'city', 'interest', 'budget', 'message', 'consent'];
  var forms = [];
  var formStartFired = false;

  function normalizePhone(raw) {
    var d = String(raw || '').replace(/[^\d]/g, '');
    if (d.length === 13 && d.indexOf('091') === 0) d = d.slice(3);
    else if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    else if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return d;
  }

  function isValidIndianMobile(digits) {
    return /^[6-9]\d{9}$/.test(digits);
  }

  function fieldWrap(input) {
    return input.closest('.field');
  }

  function setError(form, name, message) {
    var input = form.elements[name];
    if (!input) return;
    var wrap = fieldWrap(input);
    var errEl = form.querySelector('[data-error-for="' + name + '"]');
    if (wrap) wrap.classList.add('is-invalid');
    if (input.setAttribute) input.setAttribute('aria-invalid', 'true');
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
    }
  }

  function clearError(form, name) {
    var input = form.elements[name];
    if (!input) return;
    var wrap = fieldWrap(input);
    var errEl = form.querySelector('[data-error-for="' + name + '"]');
    if (wrap) wrap.classList.remove('is-invalid');
    if (input.removeAttribute) input.removeAttribute('aria-invalid');
    if (errEl) {
      errEl.textContent = '';
      errEl.hidden = true;
    }
  }

  function clearAllErrors(form) {
    FIELD_NAMES.forEach(function (n) { clearError(form, n); });
  }

  /* Returns { ok, values, errors:[{name,message}] } */
  function validate(form) {
    var errors = [];
    var el = form.elements;

    var name = (el.fullName.value || '').trim().replace(/\s+/g, ' ');
    if (!name) errors.push({ name: 'fullName', message: MSG.nameEmpty });
    else if (name.length < 2) errors.push({ name: 'fullName', message: MSG.nameShort });
    else if (name.length > 80) errors.push({ name: 'fullName', message: MSG.nameLong });
    else if (/[0-9@#$%^*_=+<>{}[\]\\/|~`]/.test(name)) errors.push({ name: 'fullName', message: MSG.nameChars });

    var rawPhone = (el.phone.value || '').trim();
    var phone = normalizePhone(rawPhone);
    if (!rawPhone) errors.push({ name: 'phone', message: MSG.phoneEmpty });
    else if (!isValidIndianMobile(phone)) errors.push({ name: 'phone', message: MSG.phoneInvalid });

    var city = el.city.value || '';
    if (!city) errors.push({ name: 'city', message: MSG.cityEmpty });

    var interest = el.interest.value || '';
    if (!interest) errors.push({ name: 'interest', message: MSG.interestEmpty });

    var budget = el.budget.value || '';
    if (!budget) errors.push({ name: 'budget', message: MSG.budgetEmpty });

    var message = (el.message.value || '').trim();
    if (message.length > 500) errors.push({ name: 'message', message: MSG.messageLong });

    if (!el.consent.checked) errors.push({ name: 'consent', message: MSG.consentEmpty });

    return {
      ok: errors.length === 0,
      errors: errors,
      values: {
        fullName: name,
        phone: phone,
        phoneE164: phone ? '+91' + phone : '',
        city: city,
        interest: interest,
        budget: budget,
        message: message,
        consent: !!el.consent.checked
      }
    };
  }

  /* WhatsApp text exactly per the brief, with optional note + campaign ref. */
  function buildLeadMessage(v) {
    var lines = [];
    lines.push('Namaste Deepika ji, main ' + v.fullName + ' hoon, ' + v.city + ' se.');
    lines.push('');
    lines.push('Interest: ' + v.interest);
    lines.push('Budget: ' + v.budget);
    lines.push('');
    lines.push('Main Jankipuram Extension / Sitapur Road / Kursi Road ke options dekhna chahta/chahti hoon. Site visit ke liye guide kijiye.');
    if (v.message) {
      lines.push('');
      lines.push('Note: ' + v.message);
    }
    if (deepLink.area) {
      lines.push('');
      lines.push('Area of interest: ' + deepLink.area);
    }
    return withRef(lines.join('\n'));
  }

  function storeLead(lead) {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      list.push(lead);
      if (list.length > 200) list = list.slice(-200);
      window.localStorage.setItem(STORE_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      return false; // private browsing / storage full — the lead still reaches WhatsApp
    }
  }

  function makeLeadId() {
    return 'dgr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function toast(kind, title, body) {
    var wrap = $('#toastWrap');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' toast--error' : '');
    var icon = kind === 'error' ? '#i-alert' : '#i-check';
    el.innerHTML =
      '<svg class="ico" aria-hidden="true"><use href="' + icon + '"></use></svg>' +
      '<p><strong></strong><span></span></p>';
    el.querySelector('strong').textContent = title;
    el.querySelector('span').textContent = body || '';
    wrap.appendChild(el);

    window.setTimeout(function () {
      el.classList.add('is-leaving');
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 260);
    }, kind === 'error' ? 5200 : 4200);
  }

  function otherForms(current) {
    return forms.filter(function (f) { return f !== current; });
  }

  /* Keep city + interest identical across both DOM forms. */
  function syncField(sourceForm, name) {
    var value = sourceForm.elements[name] ? sourceForm.elements[name].value : '';
    otherForms(sourceForm).forEach(function (f) {
      var target = f.elements[name];
      if (target && target.value !== value) {
        target.value = value;
        clearError(f, name);
      }
    });
  }

  function setFieldOnAllForms(name, value) {
    forms.forEach(function (f) {
      var el = f.elements[name];
      if (!el) return;
      el.value = value;
      clearError(f, name);
    });
  }

  function updateCounter(form) {
    var ta = form.elements.message;
    var out = form.querySelector('[data-counter-for="message"]');
    if (ta && out) out.textContent = String((ta.value || '').length);
  }

  function showSuccess(form, values, waHref) {
    var id = form.getAttribute('data-form-id');
    var panel = document.getElementById(id + '-success');
    if (!panel) return;

    var nameSlot = panel.querySelector('[data-success-name]');
    if (nameSlot) nameSlot.textContent = values.fullName.split(' ')[0] + ' ji';

    var waBtn = panel.querySelector('[data-success-wa]');
    if (waBtn) waBtn.href = waHref;

    form.hidden = true;
    panel.hidden = false;
    panel.setAttribute('tabindex', '-1');
    panel.focus({ preventScroll: true });
    scrollToEl(panel.closest('.form-card') || panel);
  }

  function resetForm(form) {
    var id = form.getAttribute('data-form-id');
    var panel = document.getElementById(id + '-success');
    clearAllErrors(form);
    form.reset();
    form.elements.renderedAt.value = String(Date.now());
    applyPrefill(form);
    updateCounter(form);
    if (panel) panel.hidden = true;
    form.hidden = false;
    var first = form.elements.fullName;
    if (first) first.focus();
  }

  function setSubmitting(form, isSubmitting) {
    var btn = form.querySelector('[data-submit]');
    if (!btn) return;
    var label = btn.querySelector('[data-submit-label]');
    btn.disabled = isSubmitting;
    btn.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');
    if (label) {
      if (isSubmitting) {
        if (!btn.getAttribute('data-label-default')) {
          btn.setAttribute('data-label-default', label.textContent);
        }
        label.textContent = 'Bhej rahe hain…';
      } else {
        label.textContent = btn.getAttribute('data-label-default') || 'Get matching options';
      }
    }
  }

  function handleSubmit(e) {
    var form = e.currentTarget;
    e.preventDefault();

    if (form.dataset.busy === '1') return;

    /* honeypot: a real person never fills this, it sits off-screen and is
       hidden from assistive tech. Fail quietly so bots learn nothing. */
    var hp = form.elements.companyWebsite;
    if (hp && hp.value.trim() !== '') {
      track('form_spam_blocked', { form: form.getAttribute('data-form-id'), reason: 'honeypot' });
      showSuccess(form, { fullName: 'ji' }, WA_BASE);
      return;
    }

    var result = validate(form);
    clearAllErrors(form);

    if (!result.ok) {
      result.errors.forEach(function (err) { setError(form, err.name, err.message); });
      track('form_error', {
        form: form.getAttribute('data-form-id'),
        error_count: result.errors.length,
        fields: result.errors.map(function (x) { return x.name; }).join(',')
      });
      var firstBad = form.elements[result.errors[0].name];
      if (firstBad) {
        if (firstBad.type === 'checkbox') {
          var wrap = fieldWrap(firstBad);
          if (wrap) scrollToEl(wrap);
        }
        firstBad.focus({ preventScroll: firstBad.type === 'checkbox' });
      }
      toast('error', 'Kuch fields adhoore hain', 'Please fix the highlighted fields and submit again.');
      return;
    }

    form.dataset.busy = '1';
    setSubmitting(form, true);

    var renderedAt = parseInt(form.elements.renderedAt.value, 10) || 0;
    var elapsed = renderedAt ? Date.now() - renderedAt : null;

    var lead = {
      id: makeLeadId(),
      submittedAt: new Date().toISOString(),
      formLocation: form.elements.formLocation ? form.elements.formLocation.value : 'unknown',
      fullName: result.values.fullName,
      phone: result.values.phoneE164,
      city: result.values.city,
      interest: result.values.interest,
      budget: result.values.budget,
      message: result.values.message,
      consent: result.values.consent,
      area: deepLink.area || '',
      utm: {
        utm_source: utm.utm_source || '',
        utm_medium: utm.utm_medium || '',
        utm_campaign: utm.utm_campaign || '',
        utm_content: utm.utm_content || '',
        utm_term: utm.utm_term || ''
      },
      pageUrl: window.location.href,
      referrer: document.referrer || '',
      fillMs: elapsed,
      suspectedBot: elapsed !== null && elapsed < MIN_FILL_MS
    };

    var stored = storeLead(lead);
    var waHref = waUrl(buildLeadMessage(result.values));

    /* Custom DOM event — hook Meta Pixel, a CRM webhook or anything else here.
       document.addEventListener('lead_submitted', e => console.log(e.detail)); */
    var evt;
    try {
      evt = new CustomEvent('lead_submitted', { detail: lead, bubbles: true });
    } catch (err) {
      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('lead_submitted', true, false, lead);
    }
    document.dispatchEvent(evt);

    track('lead_submitted', {
      form: form.getAttribute('data-form-id'),
      lead_id: lead.id,
      city: lead.city,
      interest: lead.interest,
      budget: lead.budget,
      stored: stored,
      utm_source: lead.utm.utm_source,
      utm_campaign: lead.utm.utm_campaign
    });
    pixel('Lead', {
      content_category: lead.interest,
      content_name: 'site-visit-lead',
      city: lead.city
    });

    showSuccess(form, result.values, waHref);

    /* Opened inside the submit gesture so mobile browsers allow it. */
    var win = window.open(waHref, '_blank', 'noopener');
    if (!win) {
      toast('error', 'WhatsApp block ho gaya', 'Tap "Open WhatsApp again" to send your message.');
    } else {
      toast('ok', 'Request bhej di gayi', 'WhatsApp par bas Send dabaiye.');
    }

    setSubmitting(form, false);
    form.dataset.busy = '0';
  }

  function applyPrefill(form) {
    if (deepLink.interest && form.elements.interest) form.elements.interest.value = deepLink.interest;
    if (deepLink.city && form.elements.city) form.elements.city.value = deepLink.city;
    if (form.elements.area) form.elements.area.value = deepLink.area || '';
    UTM_KEYS.forEach(function (k) {
      if (form.elements[k]) form.elements[k].value = utm[k] || '';
    });
  }

  function initForm(form) {
    /* Native constraints stay in the markup so the no-JS path still validates.
       With JS on we take over so the messages can be bilingual. */
    form.noValidate = true;
    form.elements.renderedAt.value = String(Date.now());
    applyPrefill(form);
    updateCounter(form);

    form.addEventListener('submit', handleSubmit);

    form.addEventListener('input', function (e) {
      var t = e.target;
      if (!t.name) return;
      if (t.name === 'message') updateCounter(form);
      if (FIELD_NAMES.indexOf(t.name) !== -1) clearError(form, t.name);
      if (!formStartFired) {
        formStartFired = true;
        track('form_start', { form: form.getAttribute('data-form-id') });
      }
    });

    form.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.name) return;
      if (FIELD_NAMES.indexOf(t.name) !== -1) clearError(form, t.name);
      if (t.name === 'city' || t.name === 'interest') syncField(form, t.name);
      if (!formStartFired) {
        formStartFired = true;
        track('form_start', { form: form.getAttribute('data-form-id') });
      }
    });

    /* Validate a field the moment the user leaves it. */
    form.addEventListener('focusout', function (e) {
      var t = e.target;
      if (!t.name || FIELD_NAMES.indexOf(t.name) === -1) return;
      if (t.name === 'message' || t.name === 'consent') return;
      if (t.name === 'fullName' && !t.value.trim()) return;
      if (t.name === 'phone' && !t.value.trim()) return;
      var res = validate(form);
      var mine = res.errors.filter(function (x) { return x.name === t.name; })[0];
      if (mine) setError(form, t.name, mine.message);
    });

    var resetBtn = document.querySelector('#' + form.getAttribute('data-form-id') + '-success [data-form-reset]');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () { resetForm(form); });
    }
  }

  function initForms() {
    forms = $$('form.lead-form');
    forms.forEach(initForm);
  }

  /* ------------------------------------------------------------------------
     7. INVENTORY + CITY SHORTCUTS
     ------------------------------------------------------------------------ */
  function initShortcuts() {
    $$('[data-set-interest]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-set-interest');
        deepLink.interest = value;
        setFieldOnAllForms('interest', value);
        wireWhatsAppLinks();

        var target = $('#visit');
        scrollToEl(target);
        toast('ok', value + ' add ho gaya', 'Now add your name, city and budget to finish.');

        var visitForm = $('#lead-form-visit');
        if (visitForm && !visitForm.hidden) {
          window.setTimeout(function () {
            var next = visitForm.elements.fullName.value.trim()
              ? visitForm.elements.budget
              : visitForm.elements.fullName;
            if (next) next.focus({ preventScroll: true });
          }, prefersReducedMotion() ? 60 : 620);
        }
        track('shortcut_interest', { value: value });
      });
    });

    $$('[data-set-city]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-set-city');
        deepLink.city = value;
        setFieldOnAllForms('city', value);
        wireWhatsAppLinks();

        scrollToEl($('#visit'));
        toast('ok', value + ' set ho gaya', 'Deepika will plan the visit around your travel.');

        var visitForm = $('#lead-form-visit');
        if (visitForm && !visitForm.hidden) {
          window.setTimeout(function () {
            var next = visitForm.elements.fullName.value.trim()
              ? visitForm.elements.interest
              : visitForm.elements.fullName;
            if (next) next.focus({ preventScroll: true });
          }, prefersReducedMotion() ? 60 : 620);
        }
        track('shortcut_city', { value: value });
      });
    });
  }

  /* ------------------------------------------------------------------------
     8. MOBILE NAVIGATION
     ------------------------------------------------------------------------ */
  var nav = {
    toggle: null, panel: null, scrim: null, lastFocus: null, open: false
  };

  function navIsMobile() {
    return window.matchMedia('(max-width: 1023px)').matches;
  }

  function navFocusable() {
    return $$('a[href], button:not([disabled]), input, select, textarea', nav.panel)
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }

  function openNav() {
    if (nav.open || !navIsMobile()) return;
    nav.open = true;
    nav.lastFocus = document.activeElement;
    document.documentElement.classList.add('nav-open');
    nav.toggle.setAttribute('aria-expanded', 'true');
    nav.toggle.setAttribute('aria-label', 'Close navigation menu');
    if (nav.scrim) nav.scrim.hidden = false;
    var first = navFocusable()[0];
    if (first) first.focus();
    document.addEventListener('keydown', onNavKeydown, true);
  }

  function closeNav(returnFocus) {
    if (!nav.open) return;
    nav.open = false;
    document.documentElement.classList.remove('nav-open');
    nav.toggle.setAttribute('aria-expanded', 'false');
    nav.toggle.setAttribute('aria-label', 'Open navigation menu');
    if (nav.scrim) nav.scrim.hidden = true;
    document.removeEventListener('keydown', onNavKeydown, true);
    if (returnFocus !== false) {
      (nav.lastFocus && nav.lastFocus.focus ? nav.lastFocus : nav.toggle).focus();
    }
  }

  function onNavKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      closeNav(true);
      return;
    }
    if (e.key !== 'Tab') return;

    var items = navFocusable();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];

    /* keep the toggle button inside the loop so it is always reachable */
    if (e.shiftKey && (document.activeElement === first || document.activeElement === nav.toggle)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      nav.toggle.focus();
    }
  }

  function initNav() {
    nav.toggle = $('#navToggle');
    nav.panel = $('#siteMenu');
    nav.scrim = $('#navScrim');
    if (!nav.toggle || !nav.panel) return;

    nav.toggle.addEventListener('click', function () {
      if (nav.open) closeNav(true); else openNav();
    });

    if (nav.scrim) {
      nav.scrim.addEventListener('click', function () { closeNav(true); });
    }

    /* tapping any nav link closes the panel and lets the anchor scroll happen */
    $$('a', nav.panel).forEach(function (a) {
      a.addEventListener('click', function () {
        if (nav.open) closeNav(false);
      });
    });

    window.addEventListener('resize', function () {
      if (nav.open && !navIsMobile()) closeNav(false);
    });
  }

  /* ------------------------------------------------------------------------
     9. FAQ ACCORDION
     ------------------------------------------------------------------------ */
  function initFaq() {
    var buttons = $$('.faq__btn');
    if (!buttons.length) return;

    function setExpanded(btn, expanded) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (panel) panel.hidden = !expanded;
    }

    buttons.forEach(function (btn, index) {
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        setExpanded(btn, !expanded);
        if (!expanded) {
          track('faq_open', { question: (btn.textContent || '').trim().slice(0, 80) });
        }
      });

      btn.addEventListener('keydown', function (e) {
        var move = null;
        if (e.key === 'ArrowDown') move = buttons[(index + 1) % buttons.length];
        else if (e.key === 'ArrowUp') move = buttons[(index - 1 + buttons.length) % buttons.length];
        else if (e.key === 'Home') move = buttons[0];
        else if (e.key === 'End') move = buttons[buttons.length - 1];
        if (move) {
          e.preventDefault();
          move.focus();
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     10. CHROME
     ------------------------------------------------------------------------ */
  function measureHeader() {
    var header = $('#siteHeader');
    if (!header) return;
    var h = Math.round(header.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--header-h', h + 'px');
  }

  function measureStickyBar() {
    var bar = $('#stickyCta');
    if (!bar) return;
    var h = Math.round(bar.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--sticky-h', h + 'px');
  }

  function initChrome() {
    var header = $('#siteHeader');

    measureHeader();
    measureStickyBar();

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        measureHeader();
        measureStickyBar();
      }, 150);
    });

    if (header) {
      var onScroll = function () {
        header.classList.toggle('is-stuck', window.scrollY > 8);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* Give the form room: fold the sticky bar away while the user types. */
    var blurTimer = null;
    document.addEventListener('focusin', function (e) {
      if (e.target.closest && e.target.closest('.lead-form')) {
        window.clearTimeout(blurTimer);
        document.documentElement.classList.add('form-focus');
      }
    });
    document.addEventListener('focusout', function (e) {
      if (!e.target.closest || !e.target.closest('.lead-form')) return;
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(function () {
        var active = document.activeElement;
        if (!active || !active.closest || !active.closest('.lead-form')) {
          document.documentElement.classList.remove('form-focus');
        }
      }, 160);
    });

    /* Anchor scrolling is CSS-driven (scroll-behavior + scroll-margin-top).
       This only covers the "#top" shortcut and keeps focus sensible. */
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        if (!id) return;
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        scrollToEl(target);
        if (history.replaceState) history.replaceState(null, '', '#' + id);
      });
    });
  }

  /* ------------------------------------------------------------------------
     11. BOOT
     ------------------------------------------------------------------------ */
  function boot() {
    readParams();
    wireWhatsAppLinks();
    wireClickTracking();
    initForms();
    initShortcuts();
    initNav();
    initFaq();
    initChrome();

    track('page_view', {
      page_path: window.location.pathname,
      page_title: document.title,
      utm_source: utm.utm_source || '',
      utm_medium: utm.utm_medium || '',
      utm_campaign: utm.utm_campaign || '',
      utm_content: utm.utm_content || '',
      utm_term: utm.utm_term || '',
      deep_interest: deepLink.interest || '',
      deep_city: deepLink.city || '',
      deep_area: deepLink.area || ''
    });

    /* Small demo hook: `window.dgrLeads()` prints the stored leads. */
    window.dgrLeads = function () {
      try { return JSON.parse(window.localStorage.getItem(STORE_KEY) || '[]'); }
      catch (err) { return []; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
