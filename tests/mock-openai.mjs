// Test-process-only transport. Production never imports this module.
const realFetch=globalThis.fetch,attempts=new Map();
globalThis.fetch=async(url,options)=>{
 if(String(url)!=='https://api.openai.com/v1/responses')return realFetch(url,options);
 const payload=JSON.parse(options.body);
 if(payload.text?.format?.name==='user_memory'){
  const input=JSON.parse(payload.input);
  const summary=input.userMessage.includes('测试名字')?input.userMessage:input.previousMemory;
  return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({summary})}]}]});
 }
 const content=payload.input.at(-1).content;
 const attempt=(attempts.get(content)||0)+1;attempts.set(content,attempt);
 if(content==='FAIL_ONCE'&&attempt===1)return Response.json({error:'secret provider detail'},{status:429});
 const answer=content==='RECALL'?(payload.instructions.includes('测试名字小林')?'记得你叫小林':'没有记忆'):'你好，流式测试完成。';
 const completed={type:'response.completed',response:{output:[{type:'message',content:[{type:'output_text',text:answer}]}],usage:{input_tokens:20,output_tokens:10}}};
 if(!payload.stream)return Response.json(completed.response);
 const encoder=new TextEncoder();
 return new Response(new ReadableStream({async start(controller){
  const emit=x=>{const bytes=encoder.encode('data: '+JSON.stringify(x)+'\r\n\r\n');for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7))};
  emit({type:'response.output_text.delta',delta:answer.slice(0,2)});
  await new Promise(r=>setTimeout(r,120));
  if(!options.signal.aborted&&content!=='INTERRUPTED'){emit({type:'response.output_text.delta',delta:answer.slice(2)});emit(completed)}
  controller.close();
 }}),{headers:{'Content-Type':'text/event-stream'}});
};
