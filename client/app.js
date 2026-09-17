// Minimal consumer client for the Flight Booking API.
//
// This client consumes the API ONLY over HTTP as an external caller. It never
// imports API internals, never touches the database, and has no knowledge of
// the server's implementation (consumer-client.md).
//
// Scope (consumer-client.md, PRD §5 item 7):
//   - exactly one success path: create a Booking referencing an existing
//     Customer and Flight,
//   - exactly one failure path: attempt a Booking with invalid input and
//     display the resulting API error,
//   - baseline read capability: display flight data.
// Nothing beyond this.

// ── API endpoint (single swap point) ───────────────────────────────────
// The client must always target the deployed public API URL. This constant is
// the ONLY place the endpoint changes. It must never be localhost or any
// non-public address (consumer-client.md "Integration boundary").
//
// For local development the same client is verified against a local instance
// by passing the local base URL explicitly (see API_BASE_URL override below);
// that override never replaces the committed public URL.
const PRODUCTION_API_BASE_URL = 'https://REPLACE_WITH_DEPLOYED_PUBLIC_API_URL/v1';

// Development-only override. When the page is opened with
//   ?apiBaseUrl=http://127.0.0.1:3000/v1
// the client targets that local instance for dev verification. When the
// parameter is absent (the committed default), the deployed public URL above
// is used.
const params = new URLSearchParams(window.location.search);
const API_BASE_URL = params.get('apiBaseUrl') || PRODUCTION_API_BASE_URL;

// ── DOM references ─────────────────────────────────────────────────────
const flightListEl = document.getElementById('flight-list');
const bookingFormEl = document.getElementById('booking-form');
const customerSelectEl = document.getElementById('customer-select');
const flightSelectEl = document.getElementById('flight-select');
const seatsEl = document.getElementById('seats');
const resultEl = document.getElementById('result');

// ── Envelope helpers (matches identity-and-contract.md) ────────────────
function readData(body) {
  // Success envelope: { "data": ..., "meta": ... }
  return body.data;
}

function readError(body, fallback) {
  // Error envelope: { "error": { "code": "...", "message": "..." } }
  if (body && body.error && body.error.message) {
    return `${body.error.code}: ${body.error.message}`;
  }
  return fallback;
}

// ── Flights — baseline read (PRD §5 item 7) ────────────────────────────
async function loadFlights() {
  const res = await fetch(`${API_BASE_URL}/flights?limit=20`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    flightListEl.textContent = `Could not load flights: ${readError(body, `HTTP ${res.status}`)}`;
    return;
  }
  const body = await res.json();
  const flights = readData(body) || [];

  flightListEl.innerHTML = '';

  if (flights.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No flights found.';
    flightListEl.appendChild(li);
    return;
  }

  for (const flight of flights) {
    const li = document.createElement('li');
    li.textContent =
      `${flight.id} — ${flight.flightNumber} ` +
      `${flight.origin} → ${flight.destination} ` +
      `${flight.price} (capacity ${flight.seatCapacity})`;
    flightListEl.appendChild(li);

    const opt = document.createElement('option');
    opt.value = flight.id;
    opt.textContent =
      `${flight.flightNumber} ${flight.origin} → ${flight.destination}`;
    flightSelectEl.appendChild(opt);
  }
}

// ── Customers — needed so the success path can reference an existing one ─
async function loadCustomers() {
  const res = await fetch(`${API_BASE_URL}/customers?limit=20`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    customerSelectEl.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = `Could not load customers: ${readError(body, `HTTP ${res.status}`)}`;
    customerSelectEl.appendChild(opt);
    return;
  }
  const body = await res.json();
  const customers = readData(body) || [];

  for (const customer of customers) {
    const opt = document.createElement('option');
    opt.value = customer.id;
    opt.textContent = `${customer.fullName} (${customer.email})`;
    customerSelectEl.appendChild(opt);
  }
}

// ── Booking creation — the one success path ────────────────────────────
async function createBooking(e) {
  e.preventDefault();
  resultEl.textContent = '';

  const payload = {
    customerId: customerSelectEl.value,
    flightId: flightSelectEl.value,
    bookingTimestamp: new Date().toISOString(),
    seatsBooked: Number(seatsEl.value),
  };

  let res;
  try {
    res = await fetch(`${API_BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    resultEl.textContent = `Network error: ${err.message}`;
    return;
  }

  const body = await res.json().catch(() => null);

  if (res.ok) {
    // Success path: the API created the Booking.
    const booking = readData(body);
    resultEl.textContent =
      `Booking created: ${booking.id} — ` +
      `customer ${booking.customerId}, flight ${booking.flightId}, ` +
      `${booking.seatsBooked} seat(s).`;
    bookingFormEl.reset();
  } else {
    // Failure path: invalid input produced an API error — display it.
    resultEl.textContent = `Booking failed: ${readError(body, `HTTP ${res.status}`)}`;
  }
}

// ── Init ───────────────────────────────────────────────────────────────
flightListEl.textContent = 'Loading flights…';
loadFlights();
loadCustomers();
bookingFormEl.addEventListener('submit', createBooking);
