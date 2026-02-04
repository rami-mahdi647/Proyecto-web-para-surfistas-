# Surf Santa Cruz (Tenerife) – Satélite + Tiempo + Suscripción (Stripe)

## Qué hace
- Mapa Leaflet centrado en Santa Cruz de Tenerife
- Capa satélite NASA GIBS
- Pronóstico surf básico con Open-Meteo
- Suscripción 1€/mes con Stripe Checkout (subscription)
- Webhook Stripe actualiza estado en Netlify Blobs

## Variables de entorno (Netlify)
- STRIPE_SECRET_KEY=sk_...
- STRIPE_WEBHOOK_SECRET=whsec_...
- STRIPE_PRICE_ID=price_... (1.00 EUR mensual)
- APP_BASE_URL=https://TU-SITIO.netlify.app

## Stripe
1. Crea un Product + Price recurrente 1.00 EUR / month
2. Copia el price_id en STRIPE_PRICE_ID
3. Crea Webhook endpoint:
   https://TU-SITIO.netlify.app/.netlify/functions/stripe-webhook
   Eventos recomendados:
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted

## Deploy
1. Sube este repo a GitHub
2. En Netlify: New site from Git → GitHub → elige repo
3. Build settings:
   - Build command: (vacío)
   - Publish directory: public
4. Añade variables de entorno
5. Deploy

## Mejoras típicas
- Login (Netlify Identity/Supabase) para no depender del email en localStorage
- Portal de cliente (Stripe Customer Portal)
- Alertas de swell, mareas y dirección ideal por spot
