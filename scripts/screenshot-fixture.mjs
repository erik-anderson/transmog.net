// Fictional, fixed data. Executed inside the app's existing browser fixture.
// No network traffic, local certificates, user traces, or host proxy changes.
export function seedMarketingFixture() {
  const state = globalThis.__workspaceFixture;
  const caller = {kind:'local-process',processName:'msedge.exe',processId:4820};
  const base = Date.parse('2026-10-01T12:00:00Z');
  const rows = [
    ['GET','shop.example.test','/',200,'text/html',0,142,6384],
    ['GET','shop.example.test','/assets/app.css',200,'text/css',145,34,12340],
    ['GET','shop.example.test','/assets/app.js',200,'application/javascript',148,91,58412],
    ['GET','api.example.test','/v1/products?category=desk',200,'application/json',249,186,4208],
    ['GET','cdn.example.test','/images/desk-lamp.webp',200,'image/webp',275,72,18104],
    ['GET','cdn.example.test','/images/notebook.webp',304,'image/webp',280,28,0],
    ['OPTIONS','api.example.test','/v1/cart',204,'text/plain',442,22,0],
    ['POST','api.example.test','/v1/cart',201,'application/json',470,124,192],
    ['GET','api.example.test','/v1/shipping?country=US',200,'application/json',605,318,864],
    ['GET','api.example.test','/v1/recommendations',503,'application/json',612,480,96],
    ['GET','api.example.test','/v1/recommendations',200,'application/json',1130,156,1820],
    ['POST','api.example.test','/v1/checkout/preview',200,'application/json',1320,205,356]
  ];
  state.sessions = rows.map(([method,host,path,status,contentType,start,durationMs,responseBytes],index)=>({
    id:'demo-'+(index+1),requestNumber:String(index+1),caller,method,host,path,
    url:'https://'+host+path,startedAt:base+start,contentType,topLevelNavigation:index===0,
    fetchDestination:index===0?'document':contentType.startsWith('image/')?'image':'empty',
    protocol:'HTTP/2',status,durationMs,requestBytes:method==='POST'?68:0,responseBytes,
    responseOffset:Math.round(durationMs*0.78)*1000,terminal:'completed',loss:false,capturing:false,autoResponse:null
  }));
  state.workspace={...state.workspace,layout:'stacked',listSplit:48};
  state.lifecycle='stopped';
  state.update={phase:'idle',channel:'Canary',currentVersion:'0.1.4',version:null,automaticChecksEnabled:false};
  state.fullHeaders=[
    ['Accept','application/json'],['Accept-Language','en-US'],['Origin','https://shop.example.test'],
    ['User-Agent','Mozilla/5.0 Edg/154.0.0.0'],['X-Request-ID','demo-request-0004']
  ].map(([name,value])=>({name,value,valueBytes:value.length,fieldBytes:name.length+value.length+4,sensitive:false,binary:false}));
  const product={products:[{id:'desk-lamp',name:'Desk lamp',price:48,currency:'USD',inStock:true},{id:'notebook',name:'Everyday notebook',price:12,currency:'USD',inStock:true}],total:2};
  const body=JSON.stringify(product,null,2);
  const nativeInvoke=window.__TAURI_INTERNALS__.invoke;
  window.__TAURI_INTERNALS__.invoke=async(command,args)=>{
    const result=await nativeInvoke(command,args);
    if(command==='session_detail') {
      result.caller=caller;
      result.requests[0].protocol='HTTP/2';result.responses[0].protocol='HTTP/2';
      result.responses[0].headers=[['Content-Type','application/json; charset=utf-8'],['Cache-Control','public, max-age=60'],['X-Request-ID','demo-request-0004']].map(([name,value])=>({name,value,sensitive:false,binary:false}));
    }
    if(command==='inspect_body'&&args.request.sessionId.startsWith('demo-')) {
      result.display=body;result.displayBytes=new TextEncoder().encode(body).length;result.truncated=false;
    }
    if(command==='execute_composer') {
      const text=JSON.stringify({...product,category:'desk',inStockOnly:true},null,2);
      state.composerBytes=Array.from(new TextEncoder().encode(text));
      const detail=result.detail;detail.requests[0].protocol='HTTP/2';detail.responses[0].protocol='HTTP/2';
      detail.responses[0].status=200;detail.responses[0].headers=[{name:'Content-Type',value:'application/json',sensitive:false,binary:false}];
      Object.assign(detail.storedBodies[0],{mediaType:'application/json',observedBytes:state.composerBytes.length,retainedBytes:state.composerBytes.length});
      state.composerResponseDetail=structuredClone(detail);
      return {...result,status:200,body:text,headers:detail.responses[0].headers};
    }
    if(command==='inspect_body'&&args.request.sessionId.startsWith('composer-response-')) result.display=new TextDecoder().decode(Uint8Array.from(state.composerBytes));
    return result;
  };
}
