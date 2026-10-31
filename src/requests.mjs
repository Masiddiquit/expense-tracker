export class RequestTimeoutError extends Error{
 constructor(message){super(message);this.name='RequestTimeoutError';this.code='REQUEST_TIMEOUT';}
}

// The deadline also covers SDK session/lock waits before fetch begins.
export async function requestWithDeadline(run,{timeoutMs=15000,message='This request took too long. Check your connection and try again.'}={}){
 const controller=new AbortController();let timer;
 try{return await Promise.race([
  Promise.resolve().then(()=>run(controller.signal)),
  new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new RequestTimeoutError(message));controller.abort();},timeoutMs);})
 ]);}finally{clearTimeout(timer);}
}
