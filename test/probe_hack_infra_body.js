"use strict";
let pass=0,fail=0;
function ok(label,cond){if(cond){console.log("PASS",label);pass++;}else{console.log("FAIL",label);fail++;}}

// ── DEF entries ───────────────────────────────────────────────────────────────
ok("DEF.gridtap exists",          !!DEF.gridtap);
ok("gridtap pillar=hack",         DEF.gridtap&&DEF.gridtap.pillar==="hack");
ok("gridtap espionage=true",      DEF.gridtap&&DEF.gridtap.espionage===true);
ok("gridtap infraRadius=5",       DEF.gridtap&&DEF.gridtap.infraRadius===5);
ok("gridtap cost.income=120",     DEF.gridtap&&DEF.gridtap.cost&&DEF.gridtap.cost.income===120);
ok("DEF.relay exists",            !!DEF.relay);
ok("relay pillar=hack",           DEF.relay&&DEF.relay.pillar==="hack");
ok("relay espionage=true",        DEF.relay&&DEF.relay.espionage===true);
ok("relay infraRadius=6",         DEF.relay&&DEF.relay.infraRadius===6);

// ── BUILD_CATS Cyberwar category ──────────────────────────────────────────────
const cw=BUILD_CATS.find(c=>c.name==="Cyberwar");
ok("Cyberwar cat exists",         !!cw);
ok("Cyberwar has gridtap",        cw&&cw.items.includes("gridtap"));
ok("Cyberwar has relay",          cw&&cw.items.includes("relay"));
ok("Cyberwar gate fn exists",     cw&&typeof cw.gate==="function");

// ── gate: hidden without serverroom, visible with it ─────────────────────────
newGame();
ok("Cyberwar hidden without HQ",  cw&&!cw.gate());
if(!ST.hq)ST.hq={claimed:false,stations:{}};
ST.hq.claimed=true;
ST.hq.stations.serverroom=true;
ok("Cyberwar visible with serverroom", cw&&cw.gate());

// ── placeBp guard: blocked without serverroom ─────────────────────────────────
ST.hq.stations.serverroom=false;
let px=-1,py=-1;
outer:for(let x=60;x<80;x++)for(let y=60;y<80;y++){if(!structAt(x,y)&&colCost(x,y)>=0){px=x;py=y;break outer;}}
const before=ST.structs.size;
const placed=placeBp("gridtap",px,py);
ok("placeBp blocked without serverroom", !placed && ST.structs.size===before);

// ── placeBp succeeds with serverroom ─────────────────────────────────────────
ST.hq.stations.serverroom=true;
ST.income=9999;
const placed2=placeBp("gridtap",px,py);
ok("placeBp succeeds with serverroom", placed2);
const bp=ST.structs.get(K(px,py));
ok("struct added as blueprint",   bp&&bp.bp===true);
finishBuild(bp);
const fin=ST.structs.get(K(px,py));
ok("finishBuild sets espionage",  fin&&fin.espionage===true);
ok("finishBuild sets pillar=hack",fin&&fin.pillar==="hack");

// ── infraTick drip: 1 tap → 0.05 ────────────────────────────────────────────
newGame();
ST.hq={claimed:true,stations:{serverroom:true}};
ST.income=9999;
const m1=M();
const i0=m1.intel||0;
let tx=-1,ty=-1;
outer2:for(let x=50;x<70;x++)for(let y=50;y<70;y++){if(!structAt(x,y)&&colCost(x,y)>=0){tx=x;ty=y;break outer2;}}
placeBp("gridtap",tx,ty);
const ts=ST.structs.get(K(tx,ty));
finishBuild(ts);
ST.tick=200;
infraTick();
const i1=m1.intel||0;
ok("1 tap drips intel",           i1>i0);
ok("1 tap drip ~0.05",            Math.abs((i1-i0)-0.05)<0.001);

// ── infraTick cap: 4 taps → 0.20 ─────────────────────────────────────────────
newGame();
ST.hq={claimed:true,stations:{serverroom:true}};
ST.income=9999;
const m2=M();
const i2=m2.intel||0;
let used=new Set();
let placed4=0;
for(let x=55;x<80&&placed4<4;x++)for(let y=55;y<80&&placed4<4;y++){
  if(!structAt(x,y)&&colCost(x,y)>=0&&!used.has(K(x,y))){
    used.add(K(x,y));
    placeBp("gridtap",x,y);
    const s4=ST.structs.get(K(x,y));
    if(s4){finishBuild(s4);placed4++;}
  }
}
ST.tick=200;
infraTick();
const i3=m2.intel||0;
ok("4 taps capped at 0.20",       Math.abs((i3-i2)-0.20)<0.001);

// ── hasHackReach ──────────────────────────────────────────────────────────────
newGame();
ST.hq={claimed:true,stations:{serverroom:true}};
ST.income=9999;
let hx=-1,hy=-1;
outer3:for(let x=68;x<85;x++)for(let y=68;y<85;y++){if(!structAt(x,y)&&colCost(x,y)>=0){hx=x;hy=y;break outer3;}}
placeBp("gridtap",hx,hy);
const ht=ST.structs.get(K(hx,hy));
finishBuild(ht);
ok("reach: target 3 tiles away",  hasHackReach({x:hx+3,y:hy}));
ok("no reach: target 7 tiles away",!hasHackReach({x:hx+7,y:hy}));
ok("no reach: null target",        !hasHackReach(null));

// no taps at all
newGame();
ok("no reach: no taps placed",    !hasHackReach({x:50,y:50}));

// broken tap → false
newGame();
ST.hq={claimed:true,stations:{serverroom:true}};
ST.income=9999;
let bx=-1,by=-1;
outer4:for(let x=60;x<75;x++)for(let y=60;y<75;y++){if(!structAt(x,y)&&colCost(x,y)>=0){bx=x;by=y;break outer4;}}
placeBp("gridtap",bx,by);
const bt=ST.structs.get(K(bx,by));
finishBuild(bt);
bt.isBroken=true;
ok("no reach: broken tap ignored", !hasHackReach({x:bx+2,y:by}));

console.log(`\n${pass} PASS  ${fail} FAIL`);
if(fail>0)process.exit(1);
