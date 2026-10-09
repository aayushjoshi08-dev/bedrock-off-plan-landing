import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./config.js";

const CONFIG = {
  FORM_ENDPOINT: "",
  LEADS_COLLECTION: "bedrock-leads",
  WHATSAPP_NUMBER: "97140000000",
  WHATSAPP_MSG: "Hi Bedrock Prime Realty, I'd like details about your UAE off-plan projects.",
  THANKYOU_URL: "page/thank-you.html"
};

const params = new URLSearchParams(location.search);
const TRACKING_KEYS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'];

function collectQueryParams() {
  const out = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function collectTrackingParams() {
  const out = {};
  params.forEach((value, key) => {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_KEYS.includes(key.toLowerCase())) {
      out[key] = value;
    }
  });
  return out;
}

function setHidden(n, v) {
  document.querySelectorAll('[name="' + n + '"]').forEach(el => el.value = v);
}

['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'].forEach(k => {
  if (params.get(k)) setHidden(k, params.get(k));
});
setHidden('page_path', location.pathname + location.search);

function waHref(p) {
  const m = p ? CONFIG.WHATSAPP_MSG.replace('your UAE off-plan projects', p) : CONFIG.WHATSAPP_MSG;
  return 'https://wa.me/' + CONFIG.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(m);
}

document.querySelectorAll('.js-wa').forEach(a => a.addEventListener('click', () => {
  a.href = waHref(a.dataset.project);
}));

function scrollToForm() {
  document.getElementById('leadform').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.querySelectorAll('.js-scrollform').forEach(b => b.addEventListener('click', scrollToForm));

function setFormError(form, msg) {
  let el = form.querySelector('.form-error');
  if (!el) {
    el = document.createElement('p');
    el.className = 'form-error';
    el.setAttribute('role', 'alert');
    form.appendChild(el);
  }
  el.textContent = msg || '';
  el.classList.toggle('show', Boolean(msg));
}

function validateForm(form) {
  setFormError(form, '');
  form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

  const firstInvalid = [...form.querySelectorAll('input,select,textarea')].find(el => !el.checkValidity());
  if (firstInvalid) {
    firstInvalid.classList.add('is-invalid');
    firstInvalid.reportValidity();
    return false;
  }

  const email = form.querySelector('[name="email"]');
  if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    email.classList.add('is-invalid');
    setFormError(form, 'Please enter a valid email address.');
    email.focus();
    return false;
  }

  const phone = form.querySelector('[name="phone"]');
  if (phone && phone.value && phone.value.replace(/[^\d]/g, '').length < 8) {
    phone.classList.add('is-invalid');
    setFormError(form, 'Please enter a valid phone or WhatsApp number.');
    phone.focus();
    return false;
  }

  return true;
}

function setSubmitting(form, isSubmitting) {
  form.classList.toggle('is-submitting', isSubmitting);
  form.setAttribute('aria-busy', String(isSubmitting));
  form.querySelectorAll('button').forEach(el => el.disabled = isSubmitting);
}

/* gallery thumbs */
document.querySelectorAll('.th').forEach(t => t.addEventListener('click', () => {
  document.getElementById(t.dataset.t).style.backgroundImage = "url('" + t.dataset.img + "')";
}));

/* reusable 4-step qualifier form — shared by hero section and popup modal */
const BUDGET_SCORES = { 'Under AED 1M': 4, 'AED 1M – 2M': 8, 'AED 2M – 3M': 12, 'AED 3M – 5M': 16, 'AED 5M+': 20 };

function initStepForm(form, { totalSteps, source, extra }) {
  let step = 1;

  function showStep(n) {
    form.querySelectorAll('.q-step').forEach(s => s.classList.toggle('active', +s.dataset.step === n));
    form.querySelectorAll('.q-progress .seg').forEach(s => s.classList.toggle('on', +s.dataset.seg <= n));
    step = n;
  }

  form.querySelectorAll('.q-opts').forEach(g => {
    const f = g.dataset.name;
    g.querySelectorAll('.q-opt').forEach(o => {
      o.addEventListener('click', () => {
        g.querySelectorAll('.q-opt').forEach(x => x.classList.remove('sel'));
        o.classList.add('sel');
        const input = form.querySelector('[name="' + f + '"]');
        if (input) input.value = o.dataset.val;
        const nb = o.closest('.q-step').querySelector('.js-next');
        if (nb) nb.disabled = false;
      });
    });
  });

  form.querySelectorAll('.js-next').forEach(b => b.addEventListener('click', () => {
    if (step < totalSteps) showStep(step + 1);
  }));
  form.querySelectorAll('.js-back').forEach(b => b.addEventListener('click', () => {
    if (step > 1) showStep(step - 1);
  }));

  function score() {
    let s = 0;
    form.querySelectorAll('.q-opt.sel').forEach(o => s += parseInt(o.dataset.score || 0, 10));
    const rangeField = form.investment_range;
    if (rangeField) s += BUDGET_SCORES[rangeField.value] || 0;
    return s;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form.company.value) return;
    if (!validateForm(form)) return;

    const scoreField = form.querySelector('[name="lead_score"]');
    if (scoreField) scoreField.value = score();
    const d = Object.fromEntries(new FormData(form).entries());
    if (extra) Object.assign(d, extra());
    setSubmitting(form, true);

    try {
      await sendLead(d, source);
      form.querySelector('.q-formbody').style.display = 'none';
      const successEl = form.querySelector('.q-success');
      successEl.classList.add('show');
      const wa = successEl.querySelector('.js-wa');
      if (wa) wa.href = waHref();
    } catch (err) {
      console.error('Lead submit failed', err);
      setFormError(form, 'We could not save your request. Please try again.');
      setSubmitting(form, false);
    }
  });

  return { reset: () => showStep(1) };
}

/* hero qualifier */
const qform = document.getElementById('qform');
initStepForm(qform, { totalSteps: 4, source: 'hero_qualifier' });

/* modal */
const modal = document.getElementById('modal');
const mform = document.getElementById('mform');
const modalStepper = initStepForm(mform, { totalSteps: 4, source: 'modal', extra: () => ({ lead_source: 'modal_full' }) });

function openModal(p) {
  if (p) document.getElementById('mproject').value = p;
  document.querySelectorAll('.m-utm').forEach(el => el.value = params.get('utm_source') || '');
  document.querySelectorAll('.m-gclid').forEach(el => el.value = params.get('gclid') || '');
  modalStepper.reset();
  modal.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeModal() {
  modal.classList.remove('open');
  document.body.classList.remove('modal-open');
}

document.querySelectorAll('.js-open').forEach(b => b.addEventListener('click', e => {
  e.preventDefault();
  openModal(b.dataset.project);
}));
document.getElementById('modalX').addEventListener('click', closeModal);
modal.addEventListener('click', e => {
  if (e.target === modal) closeModal();
});

function sanitizeLead(d) {
  const out = {};
  Object.entries(d).forEach(([k, v]) => {
    if (k === 'company') return;
    out[k] = typeof v === 'string' ? v.trim() : v;
  });
  return out;
}

async function sendLead(d, src) {
  d = sanitizeLead(d);
  d.source = src;
  d.submitted_at = new Date().toISOString();
  d.page_url = location.href;
  d.referrer = document.referrer || '';
  d.user_agent = navigator.userAgent;
  d.query_params = collectQueryParams();
  d.utm_params = collectTrackingParams();

  [...TRACKING_KEYS, 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => {
    if (params.get(k) && !d[k]) d[k] = params.get(k);
  });

  const docRef = await addDoc(collection(db, CONFIG.LEADS_COLLECTION), {
    ...d,
    created_at: serverTimestamp()
  });
  d.firebase_doc_id = docRef.id;

  if (CONFIG.FORM_ENDPOINT) {
    try {
      await fetch(CONFIG.FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d)
      });
    } catch (err) {
      console.error('Lead post failed', err);
    }
  }

  if (CONFIG.THANKYOU_URL) {
    try {
      sessionStorage.setItem('bedrock_lead', JSON.stringify(d));
    } catch (e) {}
    const keys = ['name', 'email', 'phone', 'profession', 'investment_range', 'intent', 'lead_score', 'gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const qs = new URLSearchParams();
    keys.forEach(k => {
      if (d[k]) qs.set(k, d[k]);
    });
    setTimeout(() => {
      location.href = CONFIG.THANKYOU_URL + '?' + qs.toString();
    }, 900);
  }
}

/* faq */
document.querySelectorAll('.fq').forEach(btn => {
  btn.addEventListener('click', () => {
    const it = btn.parentElement, an = btn.nextElementSibling, op = it.classList.contains('open');
    document.querySelectorAll('.fitem').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.fa').style.maxHeight = null;
    });
    if (!op) {
      it.classList.add('open');
      an.style.maxHeight = an.scrollHeight + 'px';
    }
  });
});
