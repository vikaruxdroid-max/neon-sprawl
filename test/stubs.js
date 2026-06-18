// ---- headless DOM/canvas stubs ----
function mkCtx(){const t={};return new Proxy(t,{
  get(o,p){if(p==="createRadialGradient"||p==="createLinearGradient")return ()=>({addColorStop(){}});
    if(p in o)return o[p];return ()=>{}},
  set(o,p,v){o[p]=v;return true}})}
function mkEl(){return{style:{},dataset:{},children:[],className:"",innerHTML:"",textContent:"",title:"",
  width:0,height:0,
  classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},
    toggle(c,v){if(v===undefined){this._s.has(c)?this._s.delete(c):this._s.add(c)}else{v?this._s.add(c):this._s.delete(c)}},
    contains(c){return this._s.has(c)}},
  addEventListener(){},appendChild(c){this.children.push(c)},prepend(c){this.children.unshift(c)},
  remove(){},setAttribute(){},dataset:{},style:this.style||{},
  removeChild(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1)},
  get lastChild(){return this.children[this.children.length-1]},
  getContext(){return mkCtx()}}}
const _els={};
globalThis.document={getElementById(id){return _els[id]||(_els[id]=mkEl())},
  addEventListener(){},body:mkEl(),
  createElement(tag){return tag==="canvas"?{width:0,height:0,style:{},getContext:()=>mkCtx()}:mkEl()}};
globalThis.window={addEventListener(){},devicePixelRatio:1,innerWidth:1280,innerHeight:800};
globalThis.requestAnimationFrame=()=>0;

// in-memory localStorage shim for save/load tests
global.localStorage={_d:Object.create(null),
  getItem(k){return k in this._d?this._d[k]:null},
  setItem(k,v){this._d[k]=String(v)},
  removeItem(k){delete this._d[k]}};
