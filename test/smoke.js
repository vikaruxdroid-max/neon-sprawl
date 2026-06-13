
// ---- NEON SPRAWL headless test suite ----
// Runs against the real game script with DOM/canvas stubbed.
// Exit code 0 = all pass. Any FAIL string = investigate before commit.
let fails=0;
function T_combat(){
  newGame();ST.nextEv=1e9;
  const p=ST.pawns[0];p.drafted=true;clearJob(p);
  spawnFoeAt("ganger",(p.px|0)+4,(p.py|0),uid());
  let killed=false;
  for(let i=0;i<600;i++){tick();if(ST.foes.length===0){killed=true;break}}
  if(!killed)fails++;
  console.log("A drafted-pawn kill:",killed?"PASS":"FAIL");
  ST.foes.length=0;ST.res.scrap+=200;ST.res.comp+=40;
  const cx=MW/2|0,cy=MH/2|0;
  placeBp("gen",cx+3,cy+3);placeBp("turret",cx+3,cy+4);
  for(const s of ST.structs.values())if(s.bp){s.bp=false;s.hp=s.maxHp}
  powerRecalc();
  spawnFoeAt("gunner",cx+8,cy+4,uid());
  let tkill=false;
  for(let i=0;i<600;i++){tick();if(ST.foes.length===0){tkill=true;break}}
  if(!tkill)fails++;
  console.log("B turret kill:",tkill?"PASS":"FAIL");
}
function T_economy(){
  newGame();ST.nextEv=1e9;
  const cx=MW/2|0,cy=MH/2|0;
  for(let y=cy;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)
    if(colCost(x,y)>=0)ST.zone.add(K(x,y));
  for(const s of ST.structs.values())if(s.type==="scrap")s.desig=true;
  const start=ST.res.scrap;
  for(let i=0;i<TPD;i++)tick();
  const ok=ST.res.scrap>start+30&&ST.stats.salv>3;
  if(!ok)fails++;
  console.log("C salvage->haul chain:",ok?"PASS":"FAIL",
    "scrap="+ST.res.scrap,"salv="+ST.stats.salv,"hauled="+ST.stats.hauled);
  const p=ST.pawns[0];if(!p){console.log("D skipped");return}
  const bx=p.px|0,by=p.py|0;ST.res.scrap+=100;
  for(let k=0;k<8;k++){const X=bx+DIRS[k][0],Y=by+DIRS[k][1];
    if(INB(X,Y)&&!structAt(X,Y))placeBp("wall",X,Y)}
  for(const s of ST.structs.values())if(s.bp&&s.type==="wall"){s.bp=false;s.hp=s.maxHp}
  spawnFoeAt("bruiser",clamp(bx+6,1,MW-2),clamp(by,1,MH-2),uid());
  let breached=false;
  for(let i=0;i<2500;i++){tick();
    if(ST.pawns.indexOf(p)<0||p.hp<100){breached=true;break}}
  if(!breached)fails++;
  console.log("D wall breach AI:",breached?"PASS":"FAIL");
}
function T_path(){
  newGame();
  const pth=astar(2,2,MW-3,MH-3,{});
  const ok=!!pth&&pth.length>40;
  if(!ok)fails++;
  console.log("E A* corner-to-corner:",ok?"PASS ("+pth.length+" steps)":"FAIL");
}
function T_fullrun(){
  // crude auto-player baseline; NOT a difficulty gate — survival to day 4+ acceptable
  newGame();
  const cx=MW/2|0,cy=MH/2|0;
  for(let y=cy-1;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++)
    if(colCost(x,y)>=0)ST.zone.add(K(x,y));
  for(const s of ST.structs.values())if(s.type==="scrap"||s.type==="cache")s.desig=true;
  ST.res.scrap+=120;ST.res.comp+=20;
  placeBp("gen",cx+4,cy);placeBp("vat",cx+4,cy+2);placeBp("synth",cx+4,cy+1);
  placeBp("pod",cx-4,cy);placeBp("pod",cx-4,cy+1);placeBp("turret",cx,cy-4);
  for(let i=0;i<TPD*8&&ST.phase==="run";i++){
    const hostile=ST.foes.length>0;
    for(const p of ST.pawns){
      if(hostile&&!p.drafted){p.drafted=true;clearJob(p)}
      if(hostile){let bf=null,bd=1e9;
        for(const f of ST.foes){const d=DIST(p.px,p.py,f.px,f.py);if(d<bd){bd=d;bf=f}}
        if(bf)p.forced=bf.id}
      if(!hostile&&p.drafted){p.drafted=false;p.forced=0;p.order=null}}
    tick()}
  const ok=dayN()>=4||ST.phase==="run";
  if(!ok)fails++;
  console.log("F 8-day baseline run:",ok?"PASS":"FAIL",
    JSON.stringify({day:dayN(),phase:ST.phase,kills:ST.stats.kills,
    deaths:ST.stats.deaths,raids:ST.stats.raids}));
}
try{T_combat();T_economy();T_path();T_fullrun();
  if(fails>0){console.error(fails+" TEST(S) FAILED");process.exit(1)}
  console.log("ALL TESTS PASS")}
catch(err){console.error("HARNESS ERROR:",err);process.exit(1)}
