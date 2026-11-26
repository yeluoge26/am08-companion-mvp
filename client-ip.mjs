import {isIP} from 'node:net';

// Nginx must OVERWRITE X-Real-IP after validating its own upstream proxies.
// Never trust arbitrary X-Forwarded-For or Cloudflare headers in the app.
export function clientIP(req,trustLoopback=process.env.TRUST_PROXY_LOOPBACK==='true'){
 const peer=req.socket.remoteAddress||'unknown';
 const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer);
 const forwarded=req.headers['x-real-ip'];
 const value=trustLoopback&&local&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:peer;
 return value.startsWith('::ffff:')&&isIP(value.slice(7))===4?value.slice(7):value;
}
