import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clientIP} from '../client-ip.mjs';
test('client identity only trusts an explicit loopback proxy and a single valid IP',()=>{
 const req=(peer,headers={})=>({socket:{remoteAddress:peer},headers});
 assert.equal(clientIP(req('127.0.0.1',{'x-real-ip':'203.0.113.5'}),true),'203.0.113.5');
 assert.equal(clientIP(req('127.0.0.1',{'x-real-ip':'203.0.113.6'}),true),'203.0.113.6');
 assert.equal(clientIP(req('127.0.0.1',{'x-real-ip':'203.0.113.5'}),false),'127.0.0.1');
 assert.equal(clientIP(req('198.51.100.2',{'x-real-ip':'203.0.113.5'}),true),'198.51.100.2');
 assert.equal(clientIP(req('127.0.0.1',{'x-real-ip':'a, b','x-forwarded-for':'203.0.113.5'}),true),'127.0.0.1');
 assert.equal(clientIP(req('::ffff:127.0.0.1',{'x-real-ip':'2001:db8::1'}),true),'2001:db8::1');
});
