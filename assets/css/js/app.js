// ====== Inject header/footer + nav active ======
async function inject(partial, targetSelector){
  const res = await fetch(partial);
  const html = await res.text();
  document.querySelector(targetSelector).innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
  await inject('partials/header.html', '#app-header');
  await inject('partials/footer.html', '#app-footer');

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  const path = (location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('is-active');
  });

  setupDonateWithStripe();
  setupContact();
});

// ====== DONATE via Stripe Checkout ======
function setupDonateWithStripe(){
  const form = document.getElementById('donation-form');
  if (!form) return;

  const chips = form.querySelectorAll('.chip[data-amount]');
  const custom = form.querySelector('#custom-amount');
  let selectedAmount = null;

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('is-selected'));
      chip.classList.add('is-selected');
      selectedAmount = parseInt(chip.dataset.amount, 10);
      if (custom) custom.value = '';
    });
  });

  if (custom){
    custom.addEventListener('input', () => {
      chips.forEach(c => c.classList.remove('is-selected'));
      selectedAmount = parseInt(custom.value || '0', 10);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('donor-name')?.value.trim();
    const email = document.getElementById('donor-email')?.value.trim();
    const freq = form.querySelector('input[name="frequency"]:checked')?.value || 'one-time';

    if (!selectedAmount || selectedAmount < 1){
      alert('Merci de choisir ou saisir un montant valide.');
      return;
    }
    if (!name || !email){
      alert('Merci de renseigner votre nom et votre email.');
      return;
    }

    // Appel de la fonction Netlify
    try{
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedAmount,
          frequency: freq,
          name, email
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.url){
        console.error(data);
        alert("Une erreur est survenue. Merci de réessayer.");
        return;
      }
      // Redirection vers Stripe Checkout
      window.location.href = data.url;
    }catch(err){
      console.error(err);
      alert("Impossible de contacter le serveur de paiement.");
    }
  });
}

// ====== Contact (EmailJS en option/fallback local) ======
function setupContact(){
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = document.getElementById('contact-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Envoi en cours...';

    const data = Object.fromEntries(new FormData(form).entries());

    // —— Option EmailJS (remplis ces 3 valeurs si tu veux l’activer) ——
    const EMAILJS_PUBLIC_KEY  = 'VOTRE_PUBLIC_KEY';
    const EMAILJS_SERVICE_ID  = 'VOTRE_SERVICE_ID';
    const EMAILJS_TEMPLATE_ID = 'VOTRE_TEMPLATE_ID';

    if (EMAILJS_PUBLIC_KEY !== 'VOTRE_PUBLIC_KEY'){
      try{
        if (!window.emailjs){
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js';
            s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
          });
        }
        window.emailjs.init(EMAILJS_PUBLIC_KEY);
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          from_name: data.name, from_email: data.email, subject: data.subject, message: data.message
        });
        status.textContent = 'Merci ! Votre message a bien été envoyé.';
        form.reset(); return;
      }catch(err){
        console.error(err);
        status.textContent = "Échec d'envoi via EmailJS. Essayez plus tard.";
        return;
      }
    }

    // Fallback local
    await new Promise(r => setTimeout(r, 600));
    status.textContent = 'Merci ! (simulation) Votre message a été pris en compte.';
    form.reset();
  });
}
