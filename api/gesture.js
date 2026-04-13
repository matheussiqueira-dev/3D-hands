/**
 * Gesture Event Logger — Serverless API Endpoint
 * Input validation, rate limiting, strict CORS.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev/>
 * @version 2.0.0
 */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://3d-hands.vercel.app')
  .split(',').map(o => o.trim()).filter(Boolean);

const VALID_GESTURES = new Set([
  'open_palm','pinch','two_fingers','fist','v_sign','three_fingers','dual_hands','thumb_up','thumb_down','unknown'
]);

const LIMITS = Object.freeze({
  MAX_BODY_BYTES:4096, MAX_SESSION_ID_LENGTH:64,
  MAX_METADATA_KEYS:10, MAX_METADATA_VALUE:256,
  RATE_WINDOW_MS:60000, RATE_MAX_REQUESTS:100,
});

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const rateLimitStore = new Map();

function getClientIp(req) {
  const fw = req.headers['x-forwarded-for'];
  return (fw ? fw.split(',')[0] : req.socket?.remoteAddress || 'unknown').trim();
}

function isRateLimited(ip) {
  const now = Date.now();
  const e = rateLimitStore.get(ip);
  if (!e || now - e.windowStart > LIMITS.RATE_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now }); return false;
  }
  if (e.count >= LIMITS.RATE_MAX_REQUESTS) return true;
  e.count++; return false;
}

function validatePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return { valid: false, errors: ['Request body must be a JSON object'] };
  if (!body.gesture) errors.push('gesture is required');
  else if (typeof body.gesture !== 'string') errors.push('gesture must be a string');
  else if (!VALID_GESTURES.has(body.gesture))
    errors.push('gesture must be one of: ' + [...VALID_GESTURES].join(', '));
  if (body.sessionId !== undefined) {
    if (typeof body.sessionId !== 'string') errors.push('sessionId must be a string');
    else if (body.sessionId.length > LIMITS.MAX_SESSION_ID_LENGTH)
      errors.push('sessionId too long');
    else if (!SESSION_ID_PATTERN.test(body.sessionId))
      errors.push('sessionId contains invalid characters');
  }
  if (body.metadata !== undefined) {
    if (typeof body.metadata !== 'object' || Array.isArray(body.metadata))
      errors.push('metadata must be a plain object');
    else {
      const keys = Object.keys(body.metadata);
      if (keys.length > LIMITS.MAX_METADATA_KEYS) errors.push('metadata has too many keys');
      for (const k of keys) {
        if (body.metadata[k] !== null && typeof body.metadata[k] === 'object')
          errors.push('metadata.' + k + ' must be primitive');
        if (typeof body.metadata[k] === 'string' && body.metadata[k].length > LIMITS.MAX_METADATA_VALUE)
          errors.push('metadata.' + k + ' is too long');
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

function buildCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export default async function handler(req, res) {
  const corsHeaders = buildCorsHeaders(req.headers.origin || '');
  Object.entries(corsHeaders).forEach(([k,v]) => res.setHeader(k,v));
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (isRateLimited(getClientIp(req))) return res.status(429).json({ error: 'Too Many Requests', retryAfter: 60 });
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        if (Buffer.byteLength(body,'utf8') > LIMITS.MAX_BODY_BYTES) return res.status(413).json({ error: 'Body too large' });
        try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
      }
      const { valid, errors } = validatePayload(body);
      if (!valid) return res.status(400).json({ error: 'Validation failed', details: errors });
      const event = { gesture: body.gesture, sessionId: body.sessionId || 'anonymous', timestamp: new Date().toISOString(), metadata: body.metadata || {} };
      console.log('[gesture-api] event:', JSON.stringify(event));
      return res.status(200).json({ success: true, recorded: event });
    } catch (err) {
      console.error('[gesture-api] error:', err?.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  if (req.method === 'GET') {
    return res.status(200).json({ name: '3D Hands Gesture API', version: '2.0.0', author: 'Matheus Siqueira', portfolio: 'https://www.matheussiqueira.dev/', validGestures: [...VALID_GESTURES] });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
