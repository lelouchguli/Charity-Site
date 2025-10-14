// netlify/functions/create-checkout.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // version récente
});

export const handler = async (event) => {
  // CORS basique
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { amount, frequency, name, email } = JSON.parse(event.body || '{}');

    // validations simples
    const intAmount = parseInt(amount, 10);
    if (!intAmount || intAmount < 1) {
      return resp(400, { error: 'Montant invalide' });
    }
    const isMonthly = frequency === 'monthly';

    // pages de retour (adapte si ton site est sur un sous-domaine)
    const origin = event.headers.origin || `https://${event.headers.host}`;
    const successUrl = `${origin}/success.html`;
    const cancelUrl  = `${origin}/cancel.html`;

    // Contruction line_items dynamique
    const lineItem = {
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: intAmount * 100, // en centimes
        product_data: {
          name: isMonthly ? `Don mensuel Gulcare` : `Don ponctuel Gulcare`,
          description: name ? `Donateur: ${name}` : undefined,
        },
        ...(isMonthly
          ? { recurring: { interval: 'month' } }
          : {}),
      },
    };

    // mode selon fréquence
    const mode = isMonthly ? 'subscription' : 'payment';

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [lineItem],
      success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl,
      customer_email: email || undefined,
      // facultatif : texte sur le reçu
      payment_intent_data: !isMonthly ? { description: 'Don Gulcare' } : undefined,
      metadata: {
        project: 'gulcare-donation',
        donor_name: name || '',
        donor_email: email || '',
        frequency: isMonthly ? 'monthly' : 'one-time',
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      submit_type: 'donate', // texte du bouton chez Stripe
    });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error(err);
    return resp(500, { error: 'Erreur serveur Stripe' });
  }
};

function resp(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}
