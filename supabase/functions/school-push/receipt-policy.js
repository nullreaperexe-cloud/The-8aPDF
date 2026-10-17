// Signed, delivery-scoped acknowledgements work without a page or login token.
const encoder = new TextEncoder();
const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
const key = secret => crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);

export async function signReceipt(device, delivery, secret, now = Date.now()) {
  const payload = encode(encoder.encode(JSON.stringify({device, delivery, expires: now + 172800000})));
  return payload + '.' + encode(new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload))));
}

export async function verifyReceipt(token, secret, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 1200) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !await crypto.subtle.verify('HMAC', await key(secret), decode(parts[1]), encoder.encode(parts[0]))) return null;
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (!/^[a-f0-9]{64}$/.test(claims.device) || !/^[a-f0-9-]{36}$/.test(claims.delivery) || !Number.isFinite(claims.expires) || claims.expires <= now || claims.expires > now + 172800000) return null;
    return claims;
  } catch { return null; }
}
