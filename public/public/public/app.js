// Santa Cruz de Tenerife (zona costa)
const SPOT = {
  name: "Santa Cruz de Tenerife",
  lat: 28.4636,
  lon: -16.2518
};

// Helpers
const $ = (id) => document.getElementById(id);

let map, satLayer;

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function getQueryParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function setStatus(text, kind = "") {
  const el = $("statusBox");
  el.textContent = text;
  el.className = "status " + kind;
}

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([SPOT.lat, SPOT.lon], 12);

  // Base map (OSM)
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  // NASA GIBS satélite (MODIS Terra corrected reflectance)
  // https://wiki.earthdata.nasa.gov/display/GIBS/GIBS+API+for+Developers
  satLayer = L.tileLayer(
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/" +
      "MODIS_Terra_CorrectedReflectance_TrueColor/default/" +
      "{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    {
      maxZoom: 9,
      attribution: "NASA GIBS",
      time: new Date().toISOString().slice(0, 10) // YYYY-MM-DD hoy
    }
  );

  satLayer.addTo(map);

  L.marker([SPOT.lat, SPOT.lon]).addTo(map).bindPopup(`📍 ${SPOT.name}`).openPopup();

  $("satToggle").addEventListener("change", (e) => {
    if (e.target.checked) satLayer.addTo(map);
    else map.removeLayer(satLayer);
  });
}

async function loadWeather() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${SPOT.lat}&longitude=${SPOT.lon}` +
    "&hourly=wave_height,wind_speed_10m,wind_direction_10m" +
    "&daily=weathercode,temperature_2m_max,temperature_2m_min" +
    "&timezone=Europe%2FMadrid";

  const data = await fetchJSON(url);

  // Simplificación: coger 6 horas próximas
  const now = new Date();
  const hours = data.hourly.time.map((t) => new Date(t));
  let idx = hours.findIndex((d) => d >= now);
  if (idx < 0) idx = 0;

  const items = [];
  for (let i = idx; i < Math.min(idx + 6, hours.length); i++) {
    items.push({
      time: hours[i].toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
      wave: data.hourly.wave_height?.[i],
      wind: data.hourly.wind_speed_10m?.[i],
      dir: data.hourly.wind_direction_10m?.[i]
    });
  }

  const daily = {
    tmax: data.daily.temperature_2m_max?.[0],
    tmin: data.daily.temperature_2m_min?.[0]
  };

  const html = `
    <div class="status" style="margin-bottom:10px">
      <div><b>Hoy</b>: ${fmt(daily.tmin)}°C – ${fmt(daily.tmax)}°C</div>
      <div style="color:var(--muted);font-size:13px;margin-top:6px">
        Nota: “wave_height” depende del modelo disponible en tu zona.
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Hora</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Ola (m)</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Viento (km/h)</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Dirección</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(row => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid var(--border)">${row.time}</td>
            <td style="padding:8px;border-bottom:1px solid var(--border)">${fmt(row.wave)}</td>
            <td style="padding:8px;border-bottom:1px solid var(--border)">${fmt(row.wind)}</td>
            <td style="padding:8px;border-bottom:1px solid var(--border)">${fmt(row.dir)}°</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  $("weather").innerHTML = html;
}

function fmt(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return typeof v === "number" ? v.toFixed(1) : String(v);
}

/**
 * Suscripción:
 * 1) Click -> create-checkout-session (Stripe)
 * 2) Stripe redirect -> success_url con session_id
 * 3) verify-session -> guarda email "activo" en Netlify Blob (via webhook) y aquí verificamos estado
 */
async function startCheckout() {
  $("subscribeBtn").disabled = true;
  try {
    const body = await fetchJSON("/.netlify/functions/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Para tu caso: precio fijo de 1€ definido en server (Stripe)
        // aquí no hace falta pasar nada
      })
    });

    window.location.href = body.url;
  } catch (e) {
    alert("Error iniciando Checkout: " + e.message);
  } finally {
    $("subscribeBtn").disabled = false;
  }
}

async function verifyIfReturnedFromCheckout() {
  const sessionId = getQueryParam("session_id");
  if (!sessionId) return;

  try {
    setStatus("Verificando pago…");
    const out = await fetchJSON(`/.netlify/functions/verify-session?session_id=${encodeURIComponent(sessionId)}`);
    if (out.active) {
      setStatus(`✅ Suscripción activa para ${out.email}`, "ok");
    } else {
      setStatus("❌ No se ha detectado suscripción activa todavía.", "bad");
    }
  } catch (e) {
    setStatus("❌ Error verificando el pago.", "bad");
  } finally {
    // Limpia URL
    const u = new URL(window.location.href);
    u.searchParams.delete("session_id");
    window.history.replaceState({}, "", u.toString());
  }
}

async function loadStatus() {
  try {
    // Si el usuario ya pagó antes, no sabremos su email sin login.
    // Pero permitimos que el usuario pegue su email para comprobar (simple MVP).
    const savedEmail = localStorage.getItem("subscriber_email");
    if (!savedEmail) {
      setStatus("No hay email guardado. Suscríbete para activar el acceso.", "bad");
      return;
    }
    const out = await fetchJSON(`/.netlify/functions/get-status?email=${encodeURIComponent(savedEmail)}`);
    if (out.active) setStatus(`✅ Suscripción activa para ${savedEmail}`, "ok");
    else setStatus(`❌ Suscripción no activa para ${savedEmail}`, "bad");
  } catch {
    setStatus("No se pudo comprobar el estado.", "bad");
  }
}

function attachEmailPromptIfNeeded() {
  // Pequeño UX: si no hay email local, pedimos uno para comprobar estado.
  const savedEmail = localStorage.getItem("subscriber_email");
  if (savedEmail) return;

  const box = $("statusBox");
  const div = document.createElement("div");
  div.style.marginTop = "10px";
  div.innerHTML = `
    <label style="display:block;color:var(--muted);font-size:13px;margin-bottom:6px">
      Si ya pagaste antes, escribe tu email para comprobar:
    </label>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input id="emailInput" placeholder="tu@email.com" style="flex:1;min-width:220px;padding:10px;border-radius:12px;border:1px solid var(--border);background:rgba(0,0,0,.2);color:var(--text)" />
      <button id="saveEmailBtn" class="btn">Guardar</button>
    </div>
  `;
  box.appendChild(div);

  setTimeout(() => {
    const btn = $("saveEmailBtn");
    const input = $("emailInput");
    btn?.addEventListener("click", async () => {
      const email = (input.value || "").trim().toLowerCase();
      if (!email.includes("@")) return alert("Email inválido");
      localStorage.setItem("subscriber_email", email);
      await loadStatus();
    });
  }, 0);
}

async function main() {
  initMap();

  $("subscribeBtn").addEventListener("click", startCheckout);
  $("refreshBtn").addEventListener("click", async () => {
    await loadWeather();
    await loadStatus();
  });

  await loadWeather();
  await verifyIfReturnedFromCheckout();
  attachEmailPromptIfNeeded();
  await loadStatus();
}

main().catch(() => {
  setStatus("Error cargando la app.", "bad");
});
