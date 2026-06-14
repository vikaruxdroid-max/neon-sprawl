
// ---- NEON SPRAWL headless test suite ----
// Runs against the real game script with DOM/canvas stubbed.
// Exit code 0 = all pass. Any FAIL string = investigate before commit.
let fails=0;ST.procgen=false;
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
  const cx=MW/2|0,cy=MH/2|0;

  // F1: industrious agent (Static) picks build when blueprint queued + comfortable needs
  newGame();ST.nextEv=1e9;
  const sta=ST.pawns.find(p=>p.name==="Static");
  sta.needs.food=80;sta.needs.rest=80;
  ST.res.scrap+=200;ST.res.comp+=40;
  // place blueprint adjacent to Static and reveal fog in radius so explore won't win
  const sbx=(sta.px|0)+2,sby=(sta.py|0);
  for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const X=(sta.px|0)+dx,Y=(sta.py|0)+dy;if(INB(X,Y))ST.fog[X+Y*MW]=0}
  placeBp("wall",sbx,sby);
  sta.job=null;
  const j1=chooseJob(sta);
  const f1=j1&&j1.t==="build";
  if(!f1)fails++;
  console.log("F1 industrious picks build:",f1?"PASS":"FAIL","got:"+(j1&&j1.t));
  // clean up reservation for next sub-test
  if(j1&&j1.s&&j1.s.res===sta.id)j1.s.res=0;

  // F2: curious agent (Vex) picks explore when no urgent jobs + fog cells in range
  newGame();ST.nextEv=1e9;
  const vex=ST.pawns.find(p=>p.name==="Vex");
  vex.needs.food=80;vex.needs.rest=80;
  // no blueprints, no designations, meal full so cook won't trigger, no zone for haul
  for(const s of ST.structs.values()){s.bp=false;s.decon=false;s.desig=false;s.res=0}
  ST.res.meal=10;ST.res.raw=0;
  vex.job=null;
  const j2=chooseJob(vex);
  const f2=j2&&j2.t==="explore";
  if(!f2)fails++;
  console.log("F2 curious picks explore:",f2?"PASS":"FAIL","got:"+(j2&&j2.t));

  // F3: hard gate fires eat at food=15 regardless of personality
  newGame();ST.nextEv=1e9;ST.res.meal=5;
  const p3=ST.pawns[0];
  p3.pers={ind:100,cau:0,soc:50,cur:50};
  p3.needs.food=15;p3.needs.rest=80;
  p3.job=null;
  const j3=chooseJob(p3);
  const f3=j3&&j3.t==="eat";
  if(!f3)fails++;
  console.log("F3 hard gate eat at food=15:",f3?"PASS":"FAIL","got:"+(j3&&j3.t));
}
try{T_combat();T_economy();T_path();T_fullrun();
  if(fails>0){console.error(fails+" TEST(S) FAILED");process.exit(1)}
  console.log("ALL TESTS PASS")}
catch(err){console.error("HARNESS ERROR:",err);process.exit(1)}
