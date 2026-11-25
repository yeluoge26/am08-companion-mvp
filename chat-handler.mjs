import {modelConfig,generateReply,updateMemory} from './openai.mjs';

export function createChatHandler({db,metrics,relationships,operations,transaction,audit,fail,now,id,text,json,limit,publicCharacter,visibleCharacter,pendingReplies}){
 const inFlight=new Set();
 const one=(q,...a)=>db.prepare(q).get(...a),all=(q,...a)=>db.prepare(q).all(...a),run=(q,...a)=>db.prepare(q).run(...a);
 return async function handleChat(req,res,body,conversation,user){
  const config=operations.config();
  if(!config.chatEnabled)fail(503,'Companion chat is disabled by the operator.');
  const content=text(body.content,4000),requestKey=text(req.headers['idempotency-key']||id(),100);
  const replay=one('SELECT * FROM chat_runs WHERE user_id=? AND request_key=?',user.id,requestKey);
  if(replay){
   if(replay.content!==content||replay.conversation_id!==conversation.id)fail(409,'Idempotency conflict');
   if(replay.status==='pending')fail(409,'AI reply is still pending');
   return json(res,200,{message:one('SELECT * FROM messages WHERE id=?',replay.message_id),assistantMessage:one('SELECT * FROM messages WHERE id=?',replay.assistant_id)||null,replyError:replay.error,access:operations.access(user.id),duplicate:true,relationship:relationships.state(user.id,conversation.character_id),modelEnabled:modelConfig().enabled});
  }
  limit(`messages:${user.id}`,60,60000);
  let mid=id(),runId=id();
  transaction(()=>{
   if(inFlight.has(user.id)||one("SELECT id FROM chat_runs WHERE user_id=? AND status='pending'",user.id))fail(409,'AI reply is still pending');
   const access=operations.access(user.id);
   if(modelConfig().enabled&&!access.allowed)fail(402,'Free message limit reached. Subscribe to continue.');
   if(body.retryMessageId){
    const failed=one("SELECT * FROM chat_runs WHERE user_id=? AND message_id=? AND status='failed' ORDER BY rowid DESC LIMIT 1",user.id,text(body.retryMessageId,64));
    if(!failed||failed.content!==content||failed.conversation_id!==conversation.id||one("SELECT id FROM chat_runs WHERE message_id=? AND status='completed'",failed.message_id))fail(409,'This message cannot be retried');
    mid=failed.message_id;
   }else{run('INSERT INTO messages VALUES(?,?,?,?,?)',mid,conversation.id,'user',content,now())}
   run('UPDATE conversations SET updated=? WHERE id=?',now(),conversation.id);
   if(modelConfig().enabled)run('INSERT INTO chat_runs(id,user_id,conversation_id,request_key,content,message_id,status,trial,model,created) VALUES(?,?,?,?,?,?,?, ?,?,?)',runId,user.id,conversation.id,requestKey,content,mid,'pending',Number(config.quotaEnabled&&!access.subscribed),config.model,now());
  });
  const message=one('SELECT * FROM messages WHERE id=?',mid);
  if(!modelConfig().enabled)return json(res,201,{message,modelEnabled:false,notice:'Message saved. AI responses are not connected.'});
  pendingReplies.add(conversation.id);
  inFlight.add(user.id);
  const stream=(req.headers.accept||'').includes('text/event-stream'),abort=new AbortController();
  const disconnected=()=>{if(!res.writableEnded)abort.abort()};res.on('close',disconnected);
  let heartbeat,assistantMessage=null,replyError=null,memoryWarning=null;
  const emit=(event,value)=>{if(!res.destroyed)res.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`)};
  if(stream){res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});res.flushHeaders();emit('message',{message,access:operations.access(user.id)});heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': heartbeat\n\n')},15000)}
  try{
   const rawCharacter=visibleCharacter(conversation.character_id,user);const character=publicCharacter(rawCharacter);character.settings.prompt=JSON.parse(rawCharacter.settings||'{}').prompt||'';
   const history=all('SELECT role,content FROM (SELECT rowid,role,content FROM messages WHERE conversation_id=? ORDER BY rowid DESC LIMIT ?) ORDER BY rowid',conversation.id,config.contextMessages);
   const accountMemory=operations.memory(user.id),memory=operations.characterMemory(user.id,conversation.character_id),useMemory=config.memoryEnabled&&accountMemory.enabled&&memory.enabled;
   const result=await generateReply(character,history,{config,memory:useMemory?memory.summary:'',onDelta:stream?delta=>emit('delta',{delta}):undefined,signal:abort.signal});
   const aid=id();
   transaction(()=>{run('INSERT INTO messages VALUES(?,?,?,?,?)',aid,conversation.id,'assistant',result.content,now());run('UPDATE conversations SET updated=? WHERE id=?',now(),conversation.id);run("UPDATE chat_runs SET status='completed',assistant_id=?,usage=?,completed=? WHERE id=?",aid,JSON.stringify(result.usage),now(),runId);relationships.award(user.id,conversation.character_id,runId);audit(user.id,'ai.reply',conversation.id,{model:result.model,usage:result.usage,stream})});
   assistantMessage=one('SELECT * FROM messages WHERE id=?',aid);
   if(stream)emit('reply',{assistantMessage,relationship:relationships.state(user.id,conversation.character_id),access:operations.access(user.id)});
   if(useMemory){try{const summary=await updateMemory(memory.summary,content,{config,signal:abort.signal,onUsage:usage=>metrics.recordMemory(user.id,runId,config.model,usage)});operations.rememberCharacter(user.id,conversation.character_id,summary,memory.revision,accountMemory.revision,config.version)}catch{memoryWarning='Reply saved, but memory could not be updated.'}}
  }catch(e){
   replyError=e.message.startsWith('AI ')?e.message:'AI service is temporarily unavailable. Your message was saved.';
   run("UPDATE chat_runs SET status='failed',error=?,completed=? WHERE id=? AND status='pending'",replyError,now(),runId);
   audit(user.id,'ai.reply.failed',conversation.id,{model:config.model});
  }finally{clearInterval(heartbeat);pendingReplies.delete(conversation.id);inFlight.delete(user.id);res.off('close',disconnected)}
  const result={message,assistantMessage,replyError,memoryWarning,relationshipMemory:operations.memoryState(user.id,conversation.character_id),relationship:relationships.state(user.id,conversation.character_id),access:operations.access(user.id),modelEnabled:true};
  if(!res.destroyed){if(stream){emit(replyError?'error':'done',result);res.end()}else json(res,201,result)}
 };
}
