
// ---- NEON SPRAWL headless test suite ----
// Runs against the real game script with DOM/canvas stubbed.
// Exit code 0 = all pass. Any FAIL string = investigate before commit.
let fails=0;ST.procgen=false;
function T_economy(){
  // C — city economy: citizens stay fed (home/vendor) and earn credits over 2 days
  newGame();ST.nextEv=1e9;
  for(let i=0;i<TPD*2;i++)tick();
  const alive=ST.pawns.length;
  const avgFood=alive?ST.pawns.reduce((s,p)=>s+p.needs.food,0)/alive:0;
  const earners=ST.pawns.filter(p=>(p.credits||0)>0).length;
  const cOk=alive>=5&&avgFood>30&&earners>=3;
  if(!cOk)fails++;
  console.log("C city economy (food+credits):",cOk?"PASS":"FAIL","alive="+alive,"avgFood="+Math.round(avgFood),"earners="+earners);
}
function T_path(){
  newGame();
  const pth=astar(2,2,MW-3,MH-3,{});
  const ok=!!pth&&pth.length>40;
  if(!ok)fails++;
  console.log("E A* corner-to-corner:",ok?"PASS ("+pth.length+" steps)":"FAIL");
}
function T_fullrun(){
  const cx=MW/2|0,cy=MH/2|0;

  // F1: industrious agent (Static) picks build when blueprint queued + comfortable needs
  newGame();ST.nextEv=1e9;
  const sta=ST.pawns.find(p=>p.name==="Static");
  sta.needs.food=80;sta.needs.rest=80;sta.needs.hyg=90;sta.needs.fun=90;sta.needs.socN=90;sta.credits=100;sta.stress=0;
  // place blueprint in open space south of map center; procgen=false so layout is fixed
  let bpPlaced=false;
  for(let dx=-6;dx<=6&&!bpPlaced;dx++)for(let dy=1;dy<=6&&!bpPlaced;dy++){
    const bx=(sta.px|0)+dx,by=(sta.py|0)+dy;
    if(canPlace("wall",bx,by)){bpPlaced=placeBp("wall",bx,by)}};
  sta.job=null;
  const j1=chooseJob(sta);
  const f1=j1&&j1.t==="build";
  if(!f1)fails++;
  console.log("F1 industrious picks build:",f1?"PASS":"FAIL","got:"+(j1&&j1.t));
  // clean up reservation for next sub-test
  if(j1&&j1.s&&j1.s.res===sta.id)j1.s.res=0;

  // F2: curious agent (Vex) picks recreate when fun is low and all other needs comfortable
  newGame();ST.nextEv=1e9;
  const vex=ST.pawns.find(p=>p.name==="Vex");
  vex.needs.food=80;vex.needs.rest=80;vex.needs.hyg=90;vex.needs.socN=90;vex.needs.fun=10;vex.credits=100;
  // no blueprints, no designations, no zone for haul
  for(const s of ST.structs.values()){s.bp=false;s.decon=false;s.desig=false;s.res=0}
  vex.job=null;
  const j2=chooseJob(vex);
  const f2=j2&&j2.t==="recreate";
  if(!f2)fails++;
  console.log("F2 curious picks recreate:",f2?"PASS":"FAIL","got:"+(j2&&j2.t));

  // F3: hard gate fires eat at food=15 regardless of personality
  newGame();ST.nextEv=1e9;
  const p3=ST.pawns[0];
  p3.pers={ind:100,cau:0,soc:50,cur:50};
  p3.needs.food=15;p3.needs.rest=80;p3.credits=100;
  p3.job=null;
  const j3=chooseJob(p3);
  const f3=j3&&j3.t==="eat";
  if(!f3)fails++;
  console.log("F3 hard gate eat at food=15:",f3?"PASS":"FAIL","got:"+(j3&&j3.t));
}
// G: save/load round-trip — Map/Set/Uint8Array rebuild, transient ref stripping, reservation clearing, AI re-derives
function T_saveload(){
  newGame();ST.nextEv=1e9;
  ST.tick=TPD*2+150;
  const p=ST.pawns[0];
  p.stress=33;p.needs.food=18;p.credits=88;
  p.job={t:"work",phase:0};
  p.unre.set("9:9",999);
  const s0=[...ST.structs.values()][0];s0.res=p.id;
  ST.goods.data=17;
  const want={credits:88,goods_data:17,tick:TPD*2+150,structs:ST.structs.size,pawns:ST.pawns.length,
    terLen:ST.ter.length,name:p.name,stress:33,food:18,rooms:ST.rooms.length};
  if(ST.pawns[1])relAdj(p.id,ST.pawns[1].id,40);
  want.rel=ST.pawns[1]?relGet(p.id,ST.pawns[1].id):0;
  const saved=saveGame();
  ST.pawns.length=0;ST.structs.clear();
  const loaded=loadGame();
  const checks=[
    ["G1 save+load return true",saved===true&&loaded===true],
    ["G2 structs Map+size",ST.structs instanceof Map&&ST.structs.size===want.structs],
    ["G3 ter Uint8Array",ST.ter instanceof Uint8Array&&ST.ter.length===want.terLen],
    ["G4 goods restored",ST.goods.data===want.goods_data],
    ["G5 pawn credits restored",ST.pawns[0].credits===want.credits],
    ["G6 tick restored",ST.tick===want.tick],
    ["G7 pawn count+identity",ST.pawns.length===want.pawns&&ST.pawns[0].name===want.name&&ST.pawns[0].stress===want.stress&&ST.pawns[0].needs.food===want.food],
    ["G8 job stripped",ST.pawns[0].job===null],
    ["G9 carry stripped",!ST.pawns[0].carry],
    ["G10 unre fresh Map",ST.pawns[0].unre instanceof Map&&ST.pawns[0].unre.size===0],
    ["G11 struct reservations cleared",[...ST.structs.values()].every(s=>s.res===0)],
    ["G12 rooms preserved",ST.rooms.length===want.rooms],
    ["G13 structAt works post-load",structAt(s0.x,s0.y)!==null],
    ["G14 AI re-derives job (no wedge)",(function(){ST.pawns[0].job=null;const j=chooseJob(ST.pawns[0]);return !!j})()],
    ["G15 relationships restored",ST.pawns[1]?relGet(ST.pawns[0].id,ST.pawns[1].id)===want.rel:true]
  ];
  for(const[n,ok] of checks){if(!ok)fails++;console.log(n+":",ok?"PASS":"FAIL")}
}
try{T_economy();T_path();T_fullrun();T_saveload();
  if(fails>0){console.error(fails+" TEST(S) FAILED");process.exit(1)}
  console.log("ALL TESTS PASS")}
catch(err){console.error("HARNESS ERROR:",err);process.exit(1)}
