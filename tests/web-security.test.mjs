import test from 'node:test';
import assert from 'node:assert/strict';
import {apiGuard,publicFeedback} from '../web-security.js';
test('rate limiting distinguishes writes, expires, and supplies retry guidance',()=>{
 let clock=0,next=0;const guard=apiGuard({limit:4,writeLimit:1,now:()=>clock});
 const res={headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
 const req={ip:'client',method:'POST'};guard(req,res,()=>next++);guard(req,res,()=>next++);
 assert.equal(next,1);assert.equal(res.code,429);assert.equal(res.headers['Retry-After'],'60');clock=60001;guard(req,res,()=>next++);assert.equal(next,2);
});
test('untrusted free-text feedback and contact details are not persisted',()=>{
 const event=publicFeedback({type:'wrong_match',ident:'SQ12',reason:'email me someone@example.com',route_hint:'private booking'});
 assert.deepEqual(event,{type:'wrong_match',ident:'SQ12',reason:'wrong_match'});
});
