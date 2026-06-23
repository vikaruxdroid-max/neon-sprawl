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


"use strict";
/* ============================================================
   NEON SPRAWL — Colony Protocol  v0.1
   Single-file cyberpunk colony sim (emergent colony sim vertical slice)
   ============================================================ */

/* ---------- helpers ---------- */
const T=16, MW=140, MH=100, TPD=2400, TPS=10, POP=12;   // tile px, map w/h, ticks/day, ticks/sec, starting agents
// Road arterials (2-tile wide). h:[x0,x1,topY]  v:[leftX,y0,y1]
// Frame the central built-up core (x~38-95, y~28-78) with a loop + cross streets.
const ROADS={
  h:[
    [10,130,22],   // north arterial — reaches farm/woods corners
    [28,112,46],   // mid lane — underclass housing | labor divide
    [28,112,62],   // lower lane — labor | civic divide
    [10,130,82],   // south arterial — reaches mine/civic corners
  ],
  v:[
    [20,14,88],    // far-west — serves farm + mine zones
    [28,22,82],    // core west edge
    [70,22,82],    // THE DIVIDE — underclass (west) | corporate sector (east)
    [112,22,82],   // core east edge
    [120,14,88],   // far-east — serves woods + civic zones
  ]
};
function R(a,b){return a+Math.random()*(b-a)}
function RI(a,b){return Math.floor(R(a,b+1))}
function CH(a){return a[Math.floor(Math.random()*a.length)]}
function clamp(v,a,b){return v<a?a:v>b?b:v}
function K(x,y){return x*MH+y}        // numeric tile key — no string allocation in hot paths
function KX(k){return (k/MH)|0}        // decode key → x
function KY(k){return k%MH}            // decode key → y
function INB(x,y){return x>=0&&y>=0&&x<MW&&y<MH}
function DIST(ax,ay,bx,by){return Math.hypot(bx-ax,by-ay)}
function CHEB(ax,ay,bx,by){return Math.max(Math.abs(bx-ax),Math.abs(by-ay))}
function hash2(x,y){let h=(x*374761393+y*668265263)|0;h=(h^(h>>13))*1274126177;return ((h^(h>>16))>>>0)/4294967295}
let _uid=1; function uid(){return _uid++}
function $(id){return document.getElementById(id)}

/* ---------- audio ---------- */
const SFX=(()=>{let ac=null,mut=false;
  function ctx(){if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}
    if(ac&&ac.state==="suspended")ac.resume();return ac}
  function tone(freq,dur,type,vol,slide,vibHz,vibAmt){
    const a=ctx();if(!a||mut)return;
    const o=a.createOscillator(),g=a.createGain();
    o.type=type||"square";o.frequency.value=freq;
    if(slide)o.frequency.exponentialRampToValueAtTime(slide,a.currentTime+dur);
    if(vibHz){const lfo=a.createOscillator(),lfoG=a.createGain();
      lfo.frequency.value=vibHz;lfoG.gain.value=vibAmt||20;
      lfo.connect(lfoG);lfoG.connect(o.frequency);lfo.start();lfo.stop(a.currentTime+dur)}
    g.gain.setValueAtTime(vol||.04,a.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+dur);
    o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+dur)}
  function noise(dur,vol,hi){
    const a=ctx();if(!a||mut)return;
    const buf=a.createBuffer(1,Math.floor(a.sampleRate*dur),a.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
    const src=a.createBufferSource(),filt=a.createBiquadFilter(),g=a.createGain();
    filt.type=hi?"highpass":"lowpass";filt.frequency.value=hi?2000:400;
    src.buffer=buf;src.connect(filt);filt.connect(g);g.connect(a.destination);
    g.gain.setValueAtTime(vol||.06,a.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+dur);
    src.start();src.stop(a.currentTime+dur)}
  return{
    wake(){ctx()},
    shoot(){noise(.04,.08,true);tone(1200,.06,"square",.02,400)},
    foeshoot(){noise(.05,.06,false);tone(180,.09,"sawtooth",.025,80)},
    hit(){noise(.08,.055,false);tone(120,.07,"triangle",.04)},
    build(){[440,554,659,880].forEach((f,i)=>setTimeout(()=>tone(f,.12,"square",.022,f*1.5),i*55))},
    ui(){tone(1100,.03,"square",.012,800)},
    alert(){[0,1,2].forEach(i=>setTimeout(()=>tone(220,.14,"sawtooth",.04,180),i*160))},
    good(){[523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,.18,"sine",.028),i*18))},
    die(){tone(320,.5,"sawtooth",.05,55,4,30)},
    /* ── AMBIENCE ENGINE: a low city drone + a dynamic music bed that
       gains layers as the district gets busier / more dangerous (0..1 intensity) ── */
    _amb:null,
    ambientStart(){
      const a=ctx();if(!a)return;
      if(this._amb)return;
      // ── MASTER + REVERB BUS ─────────────────────────────────────────────────────────────────────
      // Master gain feeds the speakers. A convolution reverb (long, soft tail) gives the "exploration /
      // wide space" feel. EVERYTHING goes through a per-voice amplitude envelope — there are NO raw
      // continuously-running oscillators, which is what removes the constant electrical "hum".
      const master=a.createGain();master.gain.value=mut?0:0.0;master.connect(a.destination);
      // build an impulse response procedurally (no audio file) — exponential-decay noise = a smooth hall
      const irLen=Math.floor(a.sampleRate*3.2);                 // ~3.2s reverb tail
      const ir=a.createBuffer(2,irLen,a.sampleRate);
      for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);
        for(let i=0;i<irLen;i++){const t=i/irLen;d[i]=(Math.random()*2-1)*Math.pow(1-t,2.6);}}
      const reverb=a.createConvolver();reverb.buffer=ir;
      const revWet=a.createGain();revWet.gain.value=0.55;       // how much reverb in the mix
      const revLp=a.createBiquadFilter();revLp.type="lowpass";revLp.frequency.value=2600; // soften the tail
      reverb.connect(revLp);revLp.connect(revWet);revWet.connect(master);
      // a "send" bus: voices connect here to be heard dry AND sent to reverb
      const dry=a.createGain();dry.gain.value=0.9;dry.connect(master);
      const sendIn=(node,wet)=>{node.connect(dry);const s=a.createGain();s.gain.value=wet==null?1:wet;node.connect(s);s.connect(reverb);};
      // ── VOICE BUILDERS (each creates, envelopes, and AUTO-STOPS its oscillators — nothing lingers) ──
      // soft piano-ish note: sine fundamental + faint bell harmonic, gentle attack, long decay.
      const piano=(freq,vel,when)=>{ if(mut)return; const t0=(when||a.currentTime);
        const o=a.createOscillator();o.type="sine";o.frequency.value=freq;
        const oh=a.createOscillator();oh.type="triangle";oh.frequency.value=freq*2.001; // bell shimmer
        const ohg=a.createGain();ohg.gain.value=0.18;oh.connect(ohg);
        const g=a.createGain();g.gain.setValueAtTime(0.0001,t0);
        g.gain.exponentialRampToValueAtTime(vel,t0+0.04);              // soft attack
        g.gain.exponentialRampToValueAtTime(0.0001,t0+3.2);            // long decay
        o.connect(g);ohg.connect(g);sendIn(g,0.8);
        o.start(t0);oh.start(t0);o.stop(t0+3.3);oh.stop(t0+3.3); };    // AUTO-STOP — no lingering tone
      // bell-like harmonic: a brief, pure, high shimmer (occasional sparkle).
      const bell=(freq,vel,when)=>{ if(mut)return; const t0=(when||a.currentTime);
        const o=a.createOscillator();o.type="sine";o.frequency.value=freq;
        const g=a.createGain();g.gain.setValueAtTime(0.0001,t0);
        g.gain.exponentialRampToValueAtTime(vel,t0+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,t0+2.4);
        o.connect(g);sendIn(g,1.0);
        o.start(t0);o.stop(t0+2.5); };
      // PAD SWELL: a soft chord that FADES IN, holds briefly, and FADES OUT — then it's gone. Because it
      // breathes instead of sustaining, there is no steady electrical tone. Retriggered by the scheduler.
      const padSwell=(freqs,peak,dur,when)=>{ if(mut)return; const t0=(when||a.currentTime);
        const g=a.createGain();g.gain.setValueAtTime(0.0001,t0);
        const lp=a.createBiquadFilter();lp.type="lowpass";lp.frequency.value=900;
        g.connect(lp);sendIn(lp,0.7);
        const oscs=freqs.map((fr,i)=>{const o=a.createOscillator();
          o.type=i===0?"triangle":"sine";o.frequency.value=fr;
          // tiny per-osc detune for warmth WITHOUT the harsh beating that reads as a hum
          o.detune.value=(i-1)*3;
          o.connect(g);return o;});
        const atk=dur*0.4, rel=dur*0.5;
        g.gain.exponentialRampToValueAtTime(peak,t0+atk);             // slow swell in
        g.gain.setValueAtTime(peak,t0+atk+dur*0.1);
        g.gain.exponentialRampToValueAtTime(0.0001,t0+atk+dur*0.1+rel); // fade fully out
        const stopAt=t0+atk+dur*0.1+rel+0.1;
        oscs.forEach(o=>{o.start(t0);o.stop(stopAt);});               // AUTO-STOP
      };
      // sub bass PULSE: a low note that swells and releases under a chord (warmth, not a held drone).
      const bassPulse=(freq,peak,dur,when)=>{ if(mut)return; const t0=(when||a.currentTime);
        const o=a.createOscillator();o.type="sine";o.frequency.value=freq;
        const g=a.createGain();g.gain.setValueAtTime(0.0001,t0);
        const lp=a.createBiquadFilter();lp.type="lowpass";lp.frequency.value=180;
        o.connect(g);g.connect(lp);sendIn(lp,0.25);
        g.gain.exponentialRampToValueAtTime(peak,t0+dur*0.35);
        g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
        o.start(t0);o.stop(t0+dur+0.1); };
      // ── PROCEDURAL COMPOSITION ──────────────────────────────────────────────────────────────────
      // Original, NOT Subwoofer Lullaby. C-Lydian-ish palette (calm, "wonder"): C D E F# G A B.
      // Chords are simple triads built on scale degrees; the scheduler drifts between them slowly so the
      // piece evolves and loops seamlessly (procedural — no fixed sequence to "end").
      const PENT=[261.63,293.66,329.63,392.00,440.00,523.25,587.33,659.25]; // C pentatonic-ish, C4..E5
      const BELLS=[1046.50,1174.66,1318.51,1567.98];                         // high sparkle octave
      // chord pool: each = {bass, pad[3]} in Hz. Warm, consonant, slow-moving.
      const PROG=[
        {bass:65.41, pad:[261.63,329.63,392.00]},   // C
        {bass:55.00, pad:[277.18,329.63,440.00]},   // Am-ish
        {bass:49.00, pad:[293.66,369.99,440.00]},   // G-ish
        {bass:43.65, pad:[261.63,349.23,440.00]},   // F-ish
        {bass:58.27, pad:[293.66,349.23,440.00]},   // Bb-ish (gentle colour)
      ];
      let _bar=0, _pi=4, _on=true, _t1=null,_t2=null,_t3=null;
      const intensity=()=>this._amb?this._amb.intensity:0.2;
      // BAR scheduler: every ~5s lay down a chord (bass pulse + pad swell), drifting through the pool.
      const _bars=()=>{ if(!_on)return; if(!mut){
          const ch=PROG[_bar%PROG.length];
          const lvl=0.5+intensity()*0.5;                  // a touch fuller when the district is busy
          padSwell(ch.pad, 0.040*lvl, 5.4);               // breathing pad — fades fully, no sustain
          bassPulse(ch.bass, 0.060*lvl, 5.0);             // warm low pulse under it
          _bar++;
        }
        _t1=setTimeout(_bars, 5200);                       // ~one chord per 5.2s (slow, ~58 BPM feel)
      };
      // PIANO scheduler: sparse single notes with lots of space, gentle stepwise drift.
      const _melody=()=>{ if(!_on)return; if(!mut){
          const notes=1+(Math.random()<0.35?1:0);          // mostly 1 note, sometimes 2
          for(let n=0;n<notes;n++){
            _pi=Math.max(0,Math.min(PENT.length-1,_pi+(Math.floor(Math.random()*5)-2)));
            piano(PENT[_pi], 0.05+Math.random()*0.03, a.currentTime + n*(0.5+Math.random()*0.4));
          }
        }
        _t2=setTimeout(_melody, 3000+Math.random()*4500);   // 3.0–7.5s of space between notes
      };
      // BELL scheduler: rare high shimmer for "wonder".
      const _bells=()=>{ if(!_on)return;
        if(!mut && Math.random()<0.6) bell(BELLS[Math.floor(Math.random()*BELLS.length)], 0.025, a.currentTime);
        _t3=setTimeout(_bells, 9000+Math.random()*11000);   // every 9–20s, sometimes skipped
      };
      _t1=setTimeout(_bars, 400);
      _t2=setTimeout(_melody, 2600);
      _t3=setTimeout(_bells, 7000);
      const stopMelody=()=>{_on=false;[_t1,_t2,_t3].forEach(t=>t&&clearTimeout(t));};
      this._amb={master,reverb,revWet,intensity:0.2,night:0,stopMelody};
    },
    ambientSet(intensity,nightAmt){
      // intensity 0..1 (district activity+heat); nightAmt 0..1 (darkness). The scheduler reads intensity
      // for fullness; here we just set the overall level and warm the reverb at night. No sustained nodes
      // to fade — the music is entirely event-scheduled, so there is nothing that can drone.
      const A=this._amb;if(!A)return;const a=ac;if(!a)return;
      const t=a.currentTime,glide=2.6;
      A.intensity=intensity;A.night=nightAmt||0;
      const overall=mut?0:0.16;
      A.master.gain.linearRampToValueAtTime(overall,t+glide);
      // a touch more reverb / softer at night for a calmer, wider feel
      A.revWet.gain.linearRampToValueAtTime(0.45+(nightAmt||0)*0.18,t+glide);
    },
    ambientStop(){const A=this._amb;if(A&&A.master)try{A.master.gain.value=0}catch(e){}},
    toggleMute(){mut=!mut;
      if(this._amb){try{this._amb.master.gain.value=mut?0:0.15}catch(e){}}
      if(typeof MUSIC!=="undefined"&&MUSIC.setMuted)MUSIC.setMuted(mut);
      return mut},
    isMuted(){return mut},
    // scale the synth ambience bed's volume (0..1) alongside the mp3 music, so the Volume slider governs
    // BOTH audio systems — not just the mp3 stream (which may be absent). 0.15 is the ambience's full level.
    setAmbVolume(v){const vv=Math.max(0,Math.min(1,v));if(this._amb&&!mut){try{this._amb.master.gain.value=0.15*vv}catch(e){}}}
  }})();
// ═══════════════════════ AMBIENT MUSIC — immersive background bed ═══════════════════════
// Streams looping ambient tracks (mp3s hosted alongside the game), shuffled + crossfaded so the bed
// evolves and never repeats back-to-back. Fades in gently on first interaction. Fully OPTIONAL: if the
// files aren't found (404) or audio is blocked, it silently no-ops — the game runs fine without music.
const MUSIC=(()=>{
  // candidate filenames — the player uses whichever actually load (so exact naming is forgiving).
  // Put your trimmed loop files alongside index.html under any of these names.
  const TRACKS=[
    "slow-ambient-cyberpunk-soundtrack-70_062026.mp3",
    "slow-ambient-cyberpunk-soundtrack-70_062026__1_.mp3",
    "soft-ambient-video-game-soundtrack-steady_062026.mp3",
    "soft-ambient-video-game-soundtrack-very_062026.mp3",
    // generic fallbacks if you rename them simply:
    "ambient1.mp3","ambient2.mp3","ambient3.mp3"
  ];
  let VOL=0.34;            // target music volume (gentle bed, sits under the SFX)
  const FADE_MS=4000;        // fade-in / crossfade duration
  let muted=false, started=false, order=[], idx=0, cur=null, nxt=null, available=null, checking=false;
  // probe which track URLs actually exist (HEAD-style: try to load metadata; keep the ones that succeed)
  function probe(cb){
    if(typeof Audio==="undefined"){cb([]);return;}   // no Audio API (e.g. non-browser) — silent no-op
    if(available){cb(available);return;}
    if(checking)return;checking=true;
    const found=[];let pending=TRACKS.length;
    if(!pending){available=[];cb(available);return;}
    TRACKS.forEach(src=>{
      const a=new Audio();a.preload="metadata";
      let done=false;const finish=ok=>{if(done)return;done=true;if(ok)found.push(src);if(--pending===0){available=found;cb(found);}};
      a.addEventListener("loadedmetadata",()=>finish(true),{once:true});
      a.addEventListener("error",()=>finish(false),{once:true});
      // some browsers need a load() nudge; guard everything
      try{a.src=src;a.load();}catch(e){finish(false);}
      // safety timeout so a hung request doesn't stall startup
      setTimeout(()=>finish(false),6000);
    });
  }
  function shuffle(arr){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function makeAudio(src){
    const a=new Audio(src);a.loop=false;a.preload="auto";a.volume=0;
    return a;
  }
  function fadeTo(audio,target,ms){
    if(!audio)return;
    const steps=24,dt=ms/steps;const start=audio.volume;let i=0;
    const id=setInterval(()=>{i++;const v=start+(target-start)*(i/steps);
      try{audio.volume=clampVol(v);}catch(e){}
      if(i>=steps){clearInterval(id);try{audio.volume=clampVol(target);}catch(e){}
        if(target<=0){try{audio.pause();audio.currentTime=0;}catch(e){}}}
    },dt);
  }
  function clampVol(v){return Math.max(0,Math.min(1,v));}
  function playNext(){
    if(!order.length)return;
    const src=order[idx%order.length];idx++;
    cur=makeAudio(src);
    cur.addEventListener("error",()=>{setTimeout(playNext,500);},{once:true});
    // when the track nears its end, crossfade into the next one for a seamless evolving bed
    cur.addEventListener("timeupdate",function onTU(){
      if(!cur||!cur.duration)return;
      if(cur.duration-cur.currentTime<=FADE_MS/1000+0.4){
        cur.removeEventListener("timeupdate",onTU);
        crossfade();
      }
    });
    const p=cur.play();if(p&&p.catch)p.catch(()=>{});
    fadeTo(cur,muted?0:VOL,FADE_MS);
  }
  function crossfade(){
    const prev=cur;
    const src=order[idx%order.length];idx++;
    nxt=makeAudio(src);
    nxt.addEventListener("error",()=>{setTimeout(playNext,500);},{once:true});
    nxt.addEventListener("timeupdate",function onTU2(){
      if(!nxt||!nxt.duration)return;
      if(nxt.duration-nxt.currentTime<=FADE_MS/1000+0.4){nxt.removeEventListener("timeupdate",onTU2);crossfade();}
    });
    const p=nxt.play();if(p&&p.catch)p.catch(()=>{});
    cur=nxt;
    fadeTo(nxt,muted?0:VOL,FADE_MS);    // new one rises
    fadeTo(prev,0,FADE_MS);             // old one falls + stops
  }
  return {
    // call once on first user interaction (audio can't autoplay before a gesture)
    start(){
      if(started)return;started=true;
      probe(found=>{
        if(!found||!found.length){return;}   // no music files present — silent, no error
        order=shuffle(found);idx=0;
        playNext();
      });
    },
    setMuted(m){muted=m;
      // fade current track to 0 or back up (don't hard-cut)
      if(cur)fadeTo(cur,m?0:VOL,800);
    },
    setVolume(v){VOL=Math.max(0,Math.min(1,v));if(cur&&!muted)fadeTo(cur,VOL,400);},
    getVolume(){return VOL;},
    // skip to the next track (crossfades immediately)
    skip(){if(cur&&order.length){crossfade();}else{this.start();}},
    isMuted(){return muted;},
    isPlaying(){return !!cur;}
  };
})();

/* ---------- data definitions ---------- */
const DEF={
  ruin:  {name:"Derelict Wall", nat:1, blocks:1, hp:140, col:"#332f23"},
  scrap: {name:"Scrap Heap",    nat:1, blocks:1, hp:1, work:140},
  cache: {name:"Supply Cache",  nat:1, blocks:1, hp:1, work:60},
  wall:  {name:"Plasteel Wall", cost:{},          hp:220, blocks:1, work:60,  cat:"b", desc:"Cheap, sturdy barrier."},
  door:  {name:"Blast Door",    cost:{},          hp:170, blocks:2, work:90,  cat:"b", desc:"Citizens pass; controls flow."},
  pod:   {name:"Sleep Pod",     cost:{},          hp:80,  blocks:0, work:120, cat:"b", desc:"A bed — assign a resident.", furn:true},
  lamp:  {name:"Neon Lamp",     cost:{},   hp:40,  blocks:0, work:30,  cat:"b", desc:"Light + small mood aura at night.", furn:true},
  fridge:     {name:"Cooler Unit",  cost:{}, hp:60, blocks:1, work:90,  cat:"b", desc:"Home/vendor food source.", furn:true},
  toilet:     {name:"San Unit",     cost:{}, hp:40, blocks:1, work:80,  cat:"b", desc:"Hygiene fixture.", furn:true},
  shower:     {name:"Mist Shower",  cost:{}, hp:40, blocks:1, work:80,  cat:"b", desc:"Hygiene fixture.", furn:true},
  tv:         {name:"Holoscreen",   cost:{}, hp:30, blocks:0, work:80,  cat:"b", desc:"Entertainment, leisure.", furn:true},
  gym:        {name:"Flex Rig",     cost:{}, hp:60, blocks:1, work:120, cat:"b", desc:"Exercise, stress relief.", furn:true},
  couch:      {name:"Couch",        cost:{income:35}, hp:50, blocks:0, work:90, cat:"b", desc:"Comfort — rest and leisure at home.", furn:true, furnEffect:"comfort"},
  bookshelf:  {name:"Bookshelf",    cost:{income:50}, hp:50, blocks:1, work:100,cat:"b", desc:"Knowledge — speeds skill growth and helps children learn at home.", furn:true, furnEffect:"learn"},
  art:        {name:"Wall Art",     cost:{income:60}, hp:40, blocks:0, work:90, cat:"b", desc:"Status & beauty — a mood lift, more so for the affluent.", furn:true, furnEffect:"art"},
  rug:        {name:"Woven Rug",    cost:{income:25}, hp:40, blocks:0, work:70, cat:"b", desc:"Ambiance — a small steady comfort underfoot.", furn:true, furnEffect:"ambient"},
  workstation:{name:"Workstation",  cost:{}, hp:60, blocks:1, work:140, cat:"b", desc:"Corp terminal — produces Data.", prod:"data", prodRate:180, wage:9},
  counter:    {name:"Shop Counter", cost:{}, hp:80, blocks:1, work:120, cat:"b", desc:"Vendor — sells goods, earns district income.", vendor:true},
  cafeteria:  {name:"Cafeteria", cost:{income:90}, hp:90, blocks:1, work:160, cat:"b", desc:"A communal canteen serving the food the block grows and processes. Anyone can eat here — keeps the hungry and the homeless fed, so people aren't driven to starve or steal.", canteen:true, wage:8},
  bar:        {name:"Bar Counter",  cost:{}, hp:80, blocks:1, work:120, cat:"b", desc:"Drinks, food, socializing, sells Stims.", vendor:true, sells:"stims"},
  medbed:     {name:"Med Bay",      cost:{}, hp:80, blocks:0, work:160, cat:"b", desc:"Treat injury and disease."},
  dealer:     {name:"Dealer Spot",  cost:{}, hp:40, blocks:0, work:100, cat:"b", desc:"Sells Stims off the books, earns district income.", vendor:true, sells:"stims", illegal:true, selfRun:true},
  chemlab:    {name:"Chem Lab",     cost:{income:80}, hp:70, blocks:1, work:150, cat:"b", desc:"Produces Chem raw material.", prod:"chem", prodRate:220, wage:9},
  workshop:   {name:"Workshop",     cost:{income:80}, hp:80, blocks:1, work:150, cat:"b", desc:"Produces Parts raw material.", prod:"parts", prodRate:200, wage:9},
  stimlab:    {name:"Stim Lab",     cost:{income:120},hp:70, blocks:1, work:160, cat:"b", desc:"Refines Chem + Data → Stims. High margin, raises heat.", refine:{in:["chem","data"],out:"stims"}, wage:11},
  gearshop:   {name:"Gear Shop",    cost:{income:100},hp:80, blocks:1, work:160, cat:"b", desc:"Refines Parts + Data → Gear. Steady, clean income.", refine:{in:["parts","data"],out:"gear"}, vendor:true, wage:10},
  // ── RESOURCE PRODUCTION (outer-ring economy) ──
  farmplot:   {name:"Farm Plot",    cost:{income:30}, hp:40, blocks:0, work:110, cat:"b", desc:"Grows Food. Feeds the block cheaply, cuts the credit drain.", prod:"food", prodRate:200, wage:7},
  sporevat:   {name:"Spore Vat",     cost:{income:40}, hp:50, blocks:0, work:120, cat:"b", desc:"Cultivates the glowing mushrooms for Food. Upgrade: Spore Vat \u2192 Algae Bloom \u2192 Bio-Reactor.", prod:"food", prodRate:200, wage:7, tiered:1},
  loggingcamp:{name:"Salvage Yard",  cost:{income:40}, hp:60, blocks:1, work:130, cat:"b", desc:"Strip scrap from the dead sectors — low pay, no questions asked.", prod:"scrap", prodRate:240, wage:8},
  mineshaft:  {name:"Data Den",      cost:{income:60}, hp:80, blocks:1, work:150, cat:"b", desc:"Grey-market terminals — run hacks and sell stolen data. High margin, draws heat.", prod:"data", prodRate:300, wage:9, illicit:true},
  // ── CIVIC BUILDINGS ──
  park:       {name:"Sprawl Park",  cost:{income:50}, hp:50, blocks:0, work:140, cat:"b", desc:"Green space — free recreation + stress relief.", civic:"park"},
  arcade:     {name:"Arcade",       cost:{income:80}, hp:60, blocks:1, work:150, cat:"b", desc:"Premium entertainment — strong fun, small fee earns income.", civic:"arcade", vendor:true},
  hospital:   {name:"Hospital",     cost:{income:120},hp:100,blocks:1, work:180, cat:"b", desc:"Advanced care — faster, cheaper treatment than a Med Bay.", civic:"hospital"},
  school:     {name:"Learning Hub", cost:{income:90}, hp:70, blocks:1, work:160, cat:"b", desc:"Citizens train skills here, raising work output over time.", civic:"school"},
  nursery:    {name:"Nursery",      cost:{income:100},hp:70, blocks:1, work:160, cat:"b", desc:"Cares for the young — children mature faster and weigh less on the block.", civic:"nursery"},
  market:     {name:"Market Hub",   cost:{income:130},hp:80, blocks:1, work:170, cat:"b", desc:"Draws traders — caravans arrive more often and pay better.", civic:"market"},
  hall:       {name:"Community Hall",cost:{income:120},hp:80, blocks:1, work:170, cat:"b", desc:"A gathering place — lifts clique loyalty and warms factions toward you.", civic:"hall"},
  furnstore:  {name:"Furnishings Store",cost:{income:140},hp:80,blocks:1,work:170,cat:"b",desc:"Sells furniture to residents — they furnish their own homes, and the district earns a cut.", civic:"furnstore", vendor:true},
  housing:    {name:"Housing Unit", cost:{income:150},hp:60, blocks:0, work:180, cat:"b", desc:"Adds one home slot — allows the district to support one more citizen."},
  watchpost:  {name:"Watch Post",   cost:{income:110},hp:90, blocks:1, work:0,   cat:"b", desc:"Security outpost — suppresses crime and bleeds off district heat in range.", security:true, secRadius:18},
  powerstation:{name:"Power Station",cost:{income:180},hp:120,blocks:1,work:200, cat:"b", desc:"Generates district power. Without it, buildings run on failing backup — mood and output suffer. Needs a worker to run.", utility:"power", wage:9},
  waterfac:   {name:"Water Facility",cost:{income:160},hp:100,blocks:1,work:190, cat:"b", desc:"Supplies clean water. Without it, hygiene and health decline across the block. Needs a worker to run.", utility:"water", wage:8},
  copstation: {name:"Precinct",     cost:{income:150},hp:110,blocks:1,work:160, cat:"b", desc:"Regime police post — the Enforcer's station. Suppresses crime and projects regime presence.", security:true, secRadius:16, wage:11, roleHome:"enforcer"},
  jail:       {name:"Holding Cells", cost:{income:120},hp:120,blocks:1,work:0,   cat:"b", desc:"The regime's lockup. Wisps caught in serious crimes are held here. Sentences escalate for repeat offenders — and the worst are never seen again.", jail:true},
  // ESPIONAGE INFRASTRUCTURE — placed clandestine assets (espionage:true flags them for infraTick)
  // monitor pillar (gate: survhub) — passive intel generation
  camera:     {name:"Hidden Camera",  cost:{income:80},  hp:40,  blocks:0, work:0, cat:"b", desc:"A concealed surveillance node. Passively drips intel while active. Requires a Surveillance Hub at HQ.", espionage:true, pillar:"monitor", infraRadius:6},
  wiretap:    {name:"Wiretap",        cost:{income:100}, hp:30,  blocks:0, work:0, cat:"b", desc:"A tap placed near regime infrastructure. Drips intel only when adjacent to a regime building — richer yield than a camera, but conditional. Requires a Surveillance Hub at HQ.", espionage:true, pillar:"monitor", infraRadius:4},
  deadDrop:   {name:"Dead Drop",      cost:{income:60},  hp:30,  blocks:0, work:0, cat:"b", desc:"A clandestine node for your cell to pass intel without meeting. Intel yield scales with your recruited network. Requires a Surveillance Hub at HQ.", espionage:true, pillar:"monitor", infraRadius:3},
  // safe pillar (gate: saferoom) — exposure recovery in the field
  safehouse:  {name:"Safehouse",      cost:{income:140}, hp:60,  blocks:0, work:0, cat:"b", desc:"A field refuge away from HQ. When laying low nearby, exposure fades 2× faster — weaker than the Safe Room but deployable anywhere in the district. Requires a Safe Room at HQ.", espionage:true, pillar:"safe", infraRadius:7},
  // hack pillar (gate: serverroom) — remote operation reach
  gridtap:    {name:"Grid Tap",       cost:{income:120}, hp:30,  blocks:0, work:0, cat:"b", desc:"A covert splice placed near power or water infrastructure. Gives your hack ops remote reach to any target within its radius — no physical approach needed. Passively skims a trickle of intel. Requires a Server Room at HQ.", espionage:true, pillar:"hack", infraRadius:5},
  relay:      {name:"Signal Relay",   cost:{income:90},  hp:30,  blocks:0, work:0, cat:"b", desc:"A repeater node that extends the reach of your hack operations across the district. A relay within range of a Grid Tap reduces hack op difficulty. Requires a Server Room at HQ.", espionage:true, pillar:"hack", infraRadius:6},
  streetvendor:{name:"Street Vendor",cost:{income:60}, hp:50, blocks:1,work:120, cat:"b", desc:"A noodle-and-stim cart on the strip — cheap food and goods, street-level commerce.", vendor:true, sells:"food", wage:7},
  mayorhouse: {name:"Admin Villa",  cost:{income:200},hp:120,blocks:1,work:150, cat:"b", desc:"The Mayor's fortified residence and office — the regime's seat in the district.", civic:"mayor", wage:12, roleHome:"mayor"},
  fixercorner:{name:"Fixer Corner", cost:{income:80}, hp:60, blocks:1,work:140, cat:"b", desc:"A back-alley node where the Fixer brokers data, gear, and favors off the books.", vendor:true, illicit:true, wage:10, roleHome:"fixer"},
  // ── DECOR (nat:1 = not buildable, placed by genCity) ──
  bench:      {name:"Bench",       nat:1, hp:40, blocks:0},
  streetlamp: {name:"Street Lamp", nat:1, hp:30, blocks:0},
  crate:      {name:"Crate",       nat:1, hp:30, blocks:0},
  dumpster:   {name:"Dumpster",    nat:1, hp:60, blocks:1},
  vendmachine:{name:"Vending Machine",nat:1,hp:50,blocks:1},
  planter:    {name:"Planter",     nat:1, hp:30, blocks:0}
};
const BUILD_ORDER=["wall","door","lamp","pod","shower","toilet","fridge","tv","gym","couch","bookshelf","art","rug","workstation","chemlab","workshop","stimlab","gearshop","counter","cafeteria","streetvendor","bar","medbed","dealer","farmplot","sporevat","loggingcamp","mineshaft","fixercorner","park","arcade","hospital","school","nursery","market","hall","mayorhouse","furnstore","housing","powerstation","waterfac","watchpost","copstation","jail","camera","wiretap","deadDrop","safehouse","gridtap","relay"];
// Build menu: curated minimal categories (start small, expand later). Each entry: type.
const BUILD_CATS=[
  {name:"Home",     items:["wall","door","pod","lamp","fridge","shower","toilet"]},
  {name:"Comfort",  items:["tv","gym","couch","bookshelf","art","rug"]},
  {name:"Work",     items:["workstation","chemlab","workshop","stimlab","gearshop","farmplot","sporevat","loggingcamp","mineshaft","fixercorner"]},
  {name:"Commerce", items:["counter","cafeteria","streetvendor","bar","market","furnstore","dealer"]},
  {name:"Civic",    items:["medbed","hospital","park","arcade","school","nursery","hall","mayorhouse"]},
  {name:"Order",    items:["watchpost","copstation"]},
  {name:"Utility",  items:["powerstation","waterfac"]},
  {name:"Growth",   items:["housing"]},
  {name:"Espionage",  items:["camera","wiretap","deadDrop"], gate:()=>hqUnlocks("monitor")},
  {name:"Safe Houses",items:["safehouse"],                  gate:()=>hqUnlocks("safe")},
  {name:"Cyberwar",   items:["gridtap","relay"],            gate:()=>hqUnlocks("hack")},
];
// glyph per fixture for the build cards
// Spore Vat upgrade chain — start as mushrooms, upgrade up the bio-tech ladder
const VAT_TIERS=[
  {name:"Spore Vat",   food:1, glow:"#c084fc", core:"#a259ff", up:{income:60, scrap:6}},
  {name:"Algae Bloom", food:2, glow:"#5cffd0", core:"#39ffd0", up:{income:120, data:6}},
  {name:"Bio-Reactor", food:3, glow:"#39d4ff", core:"#7af7ff", up:null},
];
function vatTier(s){return VAT_TIERS[clamp((s.tier||1)-1,0,2)];}
const BUILD_ICON={wall:"▦",door:"⌷",pod:"☖",lamp:"✦",fridge:"❄",shower:"♒",toilet:"⊡",tv:"▭",gym:"⛏",
  workstation:"⌨",chemlab:"⚗",workshop:"⚙",stimlab:"⚕",gearshop:"⛭",counter:"▤",bar:"♨",medbed:"✚",
  dealer:"☠",farmplot:"❀",sporevat:"🍄",loggingcamp:"♻",mineshaft:"⌬",park:"❦",arcade:"►",hospital:"✚",school:"✎",nursery:"⊙",market:"⇄",hall:"⌂",furnstore:"🛋",housing:"⌂",watchpost:"◈",powerstation:"⚡",waterfac:"💧",copstation:"⚖",jail:"⛓",streetvendor:"🍜",mayorhouse:"♔",fixercorner:"⟁",cafeteria:"🍽",couch:"⌗",bookshelf:"▤",art:"◳",rug:"▢",
  camera:"◉", wiretap:"⊕", deadDrop:"◫", safehouse:"⌂",
  gridtap:"⌁", relay:"⇌"};


// weapons removed — city sim mode
// foe types removed — city sim mode
const TRAITS=[
  {id:"chromed",  n:"Chromed Arm",  d:"+15% work speed",           work:1.15},
  {id:"jittery",  n:"Jittery",      d:"+10% move, −8% aim",        move:1.10, acc:-0.08},
  {id:"deadeye",  n:"Deadeye",      d:"+10% aim",                  acc:0.10},
  {id:"stoic",    n:"Stoic",        d:"Breaks only at very low mood",brk:-8},
  {id:"nightowl", n:"Night Owl",    d:"−15% rest drain",           rest:0.85},
  {id:"glutton",  n:"Glutton",      d:"+20% hunger drain",         hung:1.2},
  {id:"lazy",     n:"Burned Out",   d:"−12% work speed",           work:0.88},
  {id:"wired",    n:"Wired",        d:"−25% rest drain, −4 mood",  rest:0.75, mood:-4},
  {id:"sunny",    n:"Optimist",     d:"+6 mood",                   mood:6},
  {id:"streetwise",n:"Streetwise",  d:"−30% crime detection risk", street:0.70},
  {id:"paranoid", n:"Paranoid",     d:"+20% stress from strangers",para:1.20},
  {id:"empathic", n:"Empathic",     d:"Ally aid range +3 tiles",   emprange:3},
  {id:"scarred",  n:"Battle-Scarred",d:"−15% damage taken",        dmgred:0.85},
  {id:"hacker",   n:"Hacker",       d:"+20% data production",      dataprod:1.20},
  {id:"muscle",   n:"Muscle",       d:"+20% fight damage dealt",   fightdmg:1.20},
];
const NF=["Vex","Nyx","Rezz","Mara","Kade","Echo","Juno","Sable","Riko","Dash","Onna","Pike","Zee","Iris","Cole","Yuri","Tash","Bram","Lena","Cass","Dex","Mira","Frost","Sora","Tam","Blix","Nadia","Cruz","Wren","Pax","Lyra","Orin","Faye","Zel","Kira","Rue","Axel","Nova","Cleo","Fen"];
const NH=["Static","Socket","Drift","Ghost","Patch","Vandal","Cinder","Hex","Mute","Bit","Razor","Loop","Null","Flux","Wirez","Crash","Splice","Burn","Codec","Glitch","Sparks","Void","Cache","Proxy","Jolt","Neon","Slag","Rift","Byte","Haze","Smear","Venom","Kink","Clank","Arc","Dusk","Shard","Weld","Punk","Fuse"];
const NL=["Voss","Kane","Reyes","Okafor","Sato","Mercer","Ash","Cole","Vance","Bryce","Doan","Mori","Salk","Renn","Taru","Iyer","Krause","Lund","Petrov","Sorel","Adeyemi","Bauer","Chen","Dlamini","Esposito","Fang","Grim","Holt","Nawaz","Quill"];
const ACC=["#00e5ff","#39ff88","#ffd84a","#ff9ff3","#7aa2ff","#ff9f2d"];

/* ---------- game state ---------- */
const ST={
  phase:"menu", tick:0, speed:1, paused:false,
  ter:new Uint8Array(MW*MH),
  structs:new Map(),
  pawns:[], foes:[], beams:[], floats:[], emotes:[], tombs:[],
  grp:{}, rel:{}, relMeta:{}, cliques:[], contrabandPolicy:"crackdown", nextEv:1e9, lastCrackdown:0,
  sel:[],
  stats:{built:0,deaths:0},
  flags:{},
  goods:{data:0,chem:0,parts:0,stims:0,gear:0,food:0,scrap:0},
  income:0,
  debtDays:0,
  crisis:false,
  gangs:[],
  milestones:[],
  // ── INSURRECTION layer ── you're building an underground movement vs. the oligarch regime.
  mov:{
    support:5,        // 0-100: how much of the district backs your cause (starts as a seed)
    exposure:0,       // 0-100: how much the regime suspects your network (your "cure" pressure)
    intel:0,          // espionage resource — gathered passively + via ops, spent on actions
    cells:0,          // number of clandestine cells established
    stance:"hidden",  // "hidden" (stay invisible) | "open" (overt insurrection) — player choice
    doctrine:null,    // chosen ideological lean (set later)
    foundedTick:0,
  },
  regime:{
    grip:60,          // 0-100: how firmly the oligarchs control this district (your target: reduce it)
    awareness:0,      // regime's active investigation level (rises with exposure)
    lastSweep:0,      // last time the regime ran a crackdown sweep
    informants:[],    // pawn ids the regime has turned against you
  },
  cases:[],           // active investigations (murders, informant-hunts, conspiracies)
  caseSeq:0           // monotonic id for cases
};
function dayN(){return Math.floor(ST.tick/TPD)+1}
function hourN(){return ((ST.tick%TPD)/100+6)%24}   // day starts 06:00

/* ---------- AI soul layer (Phase 1: talk to a wisp) ---------- */
let AI_PROXY="";              // set to your Worker URL, e.g. "https://neon-sprawl-ai.you.workers.dev"
const AI_MODEL_AMBIENT="claude-haiku-4-5";  // cheap/fast for background musings
let AI_CAP_USD=1.00;          // session spend ceiling (0 = no cap); override via localStorage "neonSprawlAICap"
// AGENT REQUESTS temporarily DISABLED — they were too intrusive; will re-enable once tied into the game
// properly (e.g. via the planned weekly council / quest system). Flip to true to restore them.
const REQUESTS_ENABLED=false;
const AI_RATES={"claude-sonnet-4-6":{in:3.0,out:15.0},"claude-haiku-4-5":{in:1.0,out:5.0}};
const AI_COST_IN=3.0, AI_COST_OUT=15.0;  // legacy fallback (Sonnet)
try{const _o=localStorage.getItem("neonSprawlAIProxy");if(_o)AI_PROXY=_o}catch(e){}
try{const _c=localStorage.getItem("neonSprawlAICap");if(_c!=null&&_c!=="")AI_CAP_USD=parseFloat(_c)||0}catch(e){}
const AIUSE={calls:0,inTok:0,outTok:0,byModel:{}};
function aiReady(){return !!AI_PROXY}
function aiCostUSD(){
  // sum per-model costs accurately; fall back to legacy flat rate if no breakdown
  let total=0,counted=0;
  for(const m in AIUSE.byModel){const u=AIUSE.byModel[m],r=AI_RATES[m]||{in:AI_COST_IN,out:AI_COST_OUT};
    total+=(u.inTok*r.in+u.outTok*r.out)/1e6;counted+=u.inTok+u.outTok;}
  if(counted===0)return (AIUSE.inTok*AI_COST_IN+AIUSE.outTok*AI_COST_OUT)/1e6;
  return total;}
function aiMeterUpdate(){const el=$("aimeter");if(!el)return;
  if(!aiReady()||AIUSE.calls===0){el.style.display="none";return}
  const cost=aiCostUSD(),capOn=AI_CAP_USD>0;
  el.style.display="block";
  // compact per-model breakdown
  const son=AIUSE.byModel["claude-sonnet-4-6"],hai=AIUSE.byModel["claude-haiku-4-5"];
  const parts=[];
  if(son)parts.push("S:"+son.calls);
  if(hai)parts.push("H:"+hai.calls);
  const brk=parts.length?" ("+parts.join(" ")+")":"";
  el.textContent="\u25c8 AI"+brk+" \u00b7 "+(AIUSE.inTok+AIUSE.outTok)+" tok \u00b7 ~$"+cost.toFixed(3)+(capOn?" / $"+AI_CAP_USD.toFixed(2):"");
  el.style.color=capOn&&cost>=AI_CAP_USD?"var(--rd)":capOn&&cost>=AI_CAP_USD*0.8?"var(--or)":"var(--dim)";}
async function aiChat(system,messages,model){
  model=model||AI_MODEL_AMBIENT;
  if(AI_CAP_USD>0&&aiCostUSD()>=AI_CAP_USD)throw new Error("session AI budget ($"+AI_CAP_USD.toFixed(2)+") reached — raise it: localStorage.setItem('neonSprawlAICap','5')");
  const r=await fetch(AI_PROXY,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({model,max_tokens:512,system,messages})});
  if(!r.ok)throw new Error("proxy returned "+r.status);
  const d=await r.json();
  if(d&&d.error)throw new Error((d.error&&d.error.message)||String(d.error));
  if(d.usage){AIUSE.calls++;
    const it=d.usage.input_tokens||0,ot=d.usage.output_tokens||0;
    AIUSE.inTok+=it;AIUSE.outTok+=ot;
    const bm=AIUSE.byModel[model]||(AIUSE.byModel[model]={inTok:0,outTok:0,calls:0});
    bm.inTok+=it;bm.outTok+=ot;bm.calls++;
    aiMeterUpdate();}
  return (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
}
function remember(p,txt){if(!p)return;(p.mem||(p.mem=[])).push({d:dayN(),h:hourN()|0,t:txt});
  if(p.mem.length>40)p.mem.shift()}
/* ---------- relationship graph (pairwise affinity, -100..100) ---------- */
function relKey(a,b){return a<b?a+"|"+b:b+"|"+a}
function relGet(a,b){return ST.rel[relKey(a,b)]||0}
function relAdj(a,b,d){if(a===b)return;const k=relKey(a,b);ST.rel[k]=clamp((ST.rel[k]||0)+d,-100,100)}
/* ============================================================
   RELATIONSHIPS — typed bonds, partners, gossip, factions
   ============================================================ */
// derive a relationship TYPE from the scalar + flags stored per-pair
function relType(a,b){
  const v=relGet(a,b);
  const pair=ST.relMeta&&ST.relMeta[relKey(a,b)];
  if(pair&&pair.partner)return v>=0?"partner":"estranged partner";
  if(pair&&pair.mentor)return "mentor";
  if(v>=70)return "close friend";
  if(v>=35)return "friend";
  if(v>=12)return "warm";
  if(v<=-70)return "enemy";
  if(v<=-35)return "rival";
  if(v<=-12)return "cold";
  return "acquaintance";
}
function relMetaFor(a,b){const k=relKey(a,b);if(!ST.relMeta)ST.relMeta={};return ST.relMeta[k]||(ST.relMeta[k]={});}
// gossip: when something notable happens to/by a pawn, nearby pawns "hear" it and adjust
// their opinion of the subject, spreading reputation through the social graph.
function gossip(subjectId,opinion,radius,originX,originY){
  for(const q of ST.pawns){
    if(q.id===subjectId||q.hp<=0||q.sleeping)continue;
    if(originX!==undefined&&DIST(q.px,q.py,originX,originY)>(radius||7))continue;
    // they shift their view of the subject, weighted by how much they trust the messenger context
    relAdj(q.id,subjectId,opinion*0.5);
  }
}
// partnerships form between close, compatible pawns who spend time together
function tryFormPartnership(a,b){
  if(a.id===b.id)return false;
  const meta=relMetaFor(a.id,b.id);
  if(meta.partner)return false;
  // both must already be close, single, and socially inclined
  if(relGet(a.id,b.id)<48)return false;
  if(partnerOf(a)||partnerOf(b))return false;
  if((a.pers.soc||50)<35&&(b.pers.soc||50)<35)return false;
  meta.partner=true;
  addMod(a,"newlove","Found someone",14,TPD*3);addMod(b,"newlove","Found someone",14,TPD*3);
  if(typeof emote==="function"){emote(a,"love");emote(b,"love");}
  log(a.name+" and "+b.name+" became partners.","good");
  chronicle(a.name+" and "+b.name+" became partners.","♥");
  // partners drift to share a home
  if(a.home&&!b.home)claimHome(b,a.home);else if(b.home&&!a.home)claimHome(a,b.home);
  return true;
}
function partnerOf(p){
  if(!ST.relMeta)return null;
  for(const q of ST.pawns){if(q.id===p.id)continue;
    const m=ST.relMeta[relKey(p.id,q.id)];if(m&&m.partner)return q;}
  return null;
}
// when a fight breaks out, nearby friends of each combatant take sides
function defendInFight(a,b){
  for(const q of ST.pawns){
    if(q.id===a.id||q.id===b.id||q.hp<=0||q.sleeping)continue;
    if(DIST(q.px,q.py,a.px,a.py)>6)continue;
    const fa=relGet(q.id,a.id),fb=relGet(q.id,b.id);
    if(fa>30&&fa>fb+25){relAdj(q.id,b.id,-12);tryEmote(q,"anger",90);}      // sides with a, resents b
    else if(fb>30&&fb>fa+25){relAdj(q.id,a.id,-12);tryEmote(q,"anger",90);} // sides with b
  }
}

/* ============================================================
   CLIQUES — emergent social groups (friend-clusters) as a force
   ============================================================ */
const CLIQUE_NAMES=["The Regulars","Neon Circle","Backrow Crew","The Usual Lot","Sprawl Kids",
  "Static Club","The Holdouts","Wire Collective","Dead Block Society","The Inner Ring"];
const CLIQUE_FRIEND=32;   // bond needed to count as a clique-internal friendship
// rebuild cliques from the friendship graph: connected components where members
// mutually like each other above CLIQUE_FRIEND, size >= 3.
function rebuildCliques(){
  if(!ST.cliques)ST.cliques=[];
  const pawns=ST.pawns.filter(p=>p.hp>0);
  const idset=new Set(pawns.map(p=>p.id));
  // adjacency by friendship
  const adj=new Map();for(const p of pawns)adj.set(p.id,[]);
  for(let i=0;i<pawns.length;i++)for(let j=i+1;j<pawns.length;j++){
    const a=pawns[i],b=pawns[j];
    if(relGet(a.id,b.id)>=CLIQUE_FRIEND){adj.get(a.id).push(b.id);adj.get(b.id).push(a.id);}}
  // connected components via BFS
  const seen=new Set(),comps=[];
  for(const p of pawns){if(seen.has(p.id))continue;
    const comp=[],q=[p.id];seen.add(p.id);
    while(q.length){const id=q.shift();comp.push(id);
      for(const n of adj.get(id))if(!seen.has(n)){seen.add(n);q.push(n);}}
    if(comp.length>=3)comps.push(comp);}
  // preserve identity: match new components to existing cliques by membership overlap
  const old=ST.cliques;const next=[];
  for(const comp of comps){
    const cset=new Set(comp);
    let match=null,bestOverlap=0;
    for(const c of old){const ov=c.members.filter(id=>cset.has(id)).length;
      if(ov>bestOverlap){bestOverlap=ov;match=c;}}
    if(match&&bestOverlap>=2){match.members=comp;next.push(match);}
    else{const used=new Set([...old,...next].map(c=>c.name));
      const name=CLIQUE_NAMES.find(n=>!used.has(n))||("Clique "+(next.length+1));
      next.push({id:uid(),name,members:comp,formed:ST.tick,loyalty:50,rival:null});}
  }
  ST.cliques=next;
}
function cliqueOf(p){if(!ST.cliques)return null;return ST.cliques.find(c=>c.members.includes(p.id))||null;}
function sameClique(a,b){const ca=cliqueOf(a);return ca&&ca.members.includes(b.id);}
/* ============================================================
   INSURRECTION — the movement layer. You build an underground cause vs. the oligarch regime
   through intelligence (intel), influence (support), and recruitment (cells). The regime pushes
   back via exposure → awareness → sweeps. Reframes heat/cliques into resistance mechanics.
   ============================================================ */
const M=()=>ST.mov, REG=()=>ST.regime;
// POWER GRID — true while a blackout is in effect (set by sabotage/disaster). Centralizes the check used
// by the cascade: production halts, clinics can't treat, lights drop, and NPCs on edge get angry.
function gridDown(){return !!(ST.blackoutUntil&&ST.tick<ST.blackoutUntil);}
// track the tick a blackout began (for the visual ease-in). Set on the rising edge, cleared when power's back.
function trackBlackoutEdge(){
  if(gridDown()){if(ST._blackoutStart==null)ST._blackoutStart=ST.tick;}
  else if(ST._blackoutStart!=null)ST._blackoutStart=null;
}
// a wisp's openness to the cause: blends their allegiance with discontent (the regime's victims
// radicalize). Broke, evicted, low-mood, ungoverned wisps are the most recruitable.
function radicalPotential(p){
  if(isChild(p))return -999;
  let r=p.allegiance||0;
  if((p.credits||0)<10)r+=15;
  if(p.homeless)r+=18;
  if((p.mood||50)<35)r+=12;
  if((p.pers&&p.pers.intg||50)<40)r+=8;       // the disaffected
  if(p.disillusion)r+=Math.round((p.disillusion||0)*0.25);   // faith eroded by regime failures (sabotage) → recruitable
  if(p.informant)r-=60;                        // turned against you
  return r;
}
// daily: passive intel from recruited wisps (your network's eyes/ears), support drift,
// the regime's surveillance response, and recruitment spread.
// the named regime cast acts as ACTIVE forces against your insurrection (runs daily within insurrectionTick).
function roleForcesTick(){
  const m=M(),reg=REG();
  // MAYOR — sets policy: a living, un-turned Mayor reinforces the regime's grip on the district.
  const mayor=ST.pawns.find(p=>p.role==="mayor"&&p.hp>0);
  if(mayor){
    if((mayor.allegiance||0)<-10){
      // loyal mayor props up grip (scaled by their ambition/competence)
      const eff=0.10+(mayor.pers.amb||50)/100*0.10;
      reg.grip=clamp(reg.grip+eff,0,100);
    }else if((mayor.allegiance||0)>30){
      // a TURNED mayor instead undermines the regime from within — a major coup for you
      reg.grip=clamp(reg.grip-0.30,0,100);
      m.support=clamp((m.support||0)+0.12,0,100);
    }
  }
  // ENFORCER — hunts dissent: a loyal Enforcer raises your exposure and can burn a cell member.
  const enforcer=ST.pawns.find(p=>p.role==="enforcer"&&p.hp>0);
  if(enforcer&&(enforcer.allegiance||0)<-10){
    m.exposure=clamp((m.exposure||0)+0.18,0,100);
    // occasional active bust attempt when exposure is already high
    if(m.exposure>50&&ST.tick%TPD===0&&Math.random()<0.15){
      const cell=ST.pawns.filter(p=>p.recruited&&!isChild(p)&&p!==theAvatar());
      if(cell.length){const victim=CH(cell);
        // your operative's Nerve can foil the bust
        const foil=opsCheck("nerve",13);
        if(!foil.pass){victim.recruited=false;victim.allegiance=clamp((victim.allegiance||0)-20,-100,100);
          m.exposure=clamp(m.exposure+5,0,100);
          log("⚠ The Enforcer burned "+victim.name+" out of your network.","warn");}
        else log("You spotted the Enforcer's move and pulled "+victim.name+" out in time.","good");}
    }
  }else if(enforcer&&(enforcer.allegiance||0)>30){
    // a turned Enforcer shields your network instead — exposure leaks more slowly
    m.exposure=clamp((m.exposure||0)-0.10,0,100);
  }
  // INFORMANT — leaks: an active, un-flipped informant steadily raises regime awareness.
  const informants=ST.pawns.filter(p=>p.informant&&p.hp>0&&!isChild(p));
  if(informants.length){reg.awareness=clamp((reg.awareness||0)+informants.length*0.15,0,100);
    // ANONYMOUS TIP — when your exposure is high, an informant occasionally drops a tip that lands as a
    // VISIBLE event with a story and a real repercussion (a lead on you → heat). The whisper has weight.
    if((m.exposure||0)>35&&ST.tick>(ST.lastTipT||0)+TPD*0.6&&Math.random()<0.04){
      ST.lastTipT=ST.tick;
      const snitch=CH(informants);
      const heatJump=RI(8,16);ST.heat=Math.min(100,(ST.heat||0)+heatJump);
      reg.awareness=clamp((reg.awareness||0)+RI(6,12),0,100);
      tryEmote(snitch,"scheme",150);
      // the tip names something the regime now "knows" — give it narrative texture
      const leaks=["your cell's meeting spot","a face seen at the last action","where the intel's been flowing","one of your contacts"];
      const leak=CH(leaks);
      log("\u260e An anonymous tip reached the regime — they've got a lead on "+leak+". Heat rises.","bad");
      chronicle("An informant tipped the regime about "+leak+".","\u260e");
      banner&&banner("TIPPED OFF","bad");
      // a recruited wisp near the snitch may notice and resent them (story repercussion)
      for(const r of ST.pawns){if(r.recruited&&!isChild(r)&&DIST(r.px,r.py,snitch.px,snitch.py)<8&&Math.random()<0.4){
        relAdj(r.id,snitch.id,-15);emotionalReact(r,"anger",0.4,{toward:snitch.id});}}
    }
  }
}
// ═══════════════════════ THE JAIL SYSTEM — physical lockup with escalating consequence ═══════════════════════
// Caught in a serious crime → an enforcer walks you to the Holding Cells and you're held for a sentence.
// Repeat incarceration ESCALATES: each stint is longer, and severe/repeat offenders face execution. This is
// the real cost behind the risky ops (steal lands you here; a botched assassination can be terminal).
function nearestJail(x,y){
  let best=null,bd=1e9;
  for(const s of ST.structs.values()){if(s.bp||!DEF[s.type]||!DEF[s.type].jail)continue;
    const d=DIST(x,y,s.x,s.y);if(d<bd){bd=d;best=s;}}
  return best;
}
// send a pawn to jail. severity: 1=petty, 2=serious, 3=capital (assassination/killing). returns false if no jail.
function jailPawn(p,severity,crime){
  if(!p||p.hp<=0||p.jailed)return false;
  const jail=nearestJail(p.px,p.py);
  if(!jail){ // no lockup exists — fall back to a heavy fine + heat (can't physically hold them)
    if(p.isAvatar){M().exposure=clamp((M().exposure||0)+15,0,100);log("No holding cells in the district — you slip the patrol, but the heat is on.","warn");}
    return false;
  }
  p.jailCount=(p.jailCount||0)+1;                 // priors — escalates the response
  severity=severity||1;
  // base sentence scales with severity AND priors; capital crimes (or enough priors) → execution
  const priors=p.jailCount;
  const capital=severity>=3||(severity>=2&&priors>=3);
  p.jailed={
    cell:K(jail.x,jail.y), jx:jail.x, jy:jail.y,
    until:capital?1e15:ST.tick+Math.floor(TPD*(severity*0.6+priors*0.4)),  // days, escalating
    severity, crime:crime||"a crime against the regime", capital, arrivedAt:0
  };
  // walk them to the cell (held there by the pawnTick guard); an enforcer escorts if one's near
  p.job={t:"goto",x:jail.x,y:jail.y,adj:1};p._toJail=K(jail.x,jail.y);
  p.activeOp=null;p.cmd=null;
  if(p.isAvatar){
    flashMsg&&flashMsg("CAUGHT — you're being taken to the Holding Cells"+(priors>1?" (prior #"+priors+")":""));
    banner&&banner(capital?"SENTENCED":"ARRESTED",capital?"bad":"warn");
  }
  log((p.isAvatar?"You were":p.name+" was")+" arrested for "+(crime||"a crime")+" — taken to the Holding Cells"+(capital?". The sentence is death.":"."),"bad");
  chronicle&&chronicle((p.isAvatar?"You were":p.name+" was")+" jailed for "+(crime||"a crime")+(capital?" — facing execution.":"."),"\u26d3");
  return true;
}
// per-tick: drive jailed pawns — hold them at the cell, count down, release or execute
function jailTick(){
  for(let i=ST.pawns.length-1;i>=0;i--){const p=ST.pawns[i];const j=p.jailed;if(!j)continue;
    const atCell=DIST(p.px,p.py,j.jx,j.jy)<2.9;
    if(!atCell){ // still being walked to the cell
      if(!p.job||p.job.t!=="goto")p.job={t:"goto",x:j.jx,y:j.jy,adj:1};
      continue;
    }
    if(!j.arrivedAt)j.arrivedAt=ST.tick;
    // EXECUTION — capital sentence: held a short while, then the regime makes them disappear
    if(j.capital){
      if(ST.tick-j.arrivedAt>Math.floor(TPD*0.4)){
        if(p.isAvatar){
          // the player's operative executed = a hard run-ending blow; surface it dramatically
          banner&&banner("EXECUTED","bad");log("The regime executed your operative. The cell falls silent.","bad");
          chronicle&&chronicle("Your operative was executed by the regime.","\u2620");
          killPawn(p,"was executed by the regime");
        } else {
          log(p.name+" was executed by the regime — made an example of.","bad");
          chronicle&&chronicle(p.name+" was executed by the regime.","\u2620");
          // a public execution radicalizes witnesses/neighbors (the regime overreaches)
          for(const q of ST.pawns){if(q===p||isChild(q)||q.hp<=0)continue;
            if(relGet(p.id,q.id)>20||DIST(q.px,q.py,j.jx,j.jy)<20){q.disillusion=clamp((q.disillusion||0)+RI(5,12),0,100);q.allegiance=clamp((q.allegiance||0)+RI(2,6),-100,100);}}
          killPawn(p,"was executed by the regime");
        }
      }
      continue;
    }
    // hold + emotional toll, then RELEASE when the sentence is served
    if(ST.tick%200===0){p.mood=clamp((p.mood||50)-3,0,100);p.stress=clamp((p.stress||0)+3,0,100);
      if(typeof tryEmote==="function"&&Math.random()<0.3)tryEmote(p,"sad",200);}
    if(ST.tick>=j.until){
      p.jailed=null;p._toJail=null;p.job=null;
      addMod&&addMod(p,"exjail","Did time","-6",TPD);
      // jail HARDENS most wisps against the regime (radicalizing) — unless they were a loyal informant
      if(!p.informant){p.disillusion=clamp((p.disillusion||0)+RI(6,14),0,100);p.allegiance=clamp((p.allegiance||0)+RI(3,8),-100,100);}
      if(p.isAvatar){flashMsg&&flashMsg("Released from the Holding Cells");banner&&banner("RELEASED","good");}
      log((p.isAvatar?"You were":p.name+" was")+" released from the Holding Cells.",p.isAvatar?"good":"info");
      if(typeof emotionalReact==="function")emotionalReact(p,"relief",0.5);
    }
  }
}
// EXTORTION — recurring blackmail payments. Each victim with `extorted` pays you on schedule until they
// break free (rare) or snap under the pressure. The reputation drain is ongoing — bleeding neighbors costs you.
function extortionTick(){
  const m=M();
  for(const p of ST.pawns){
    if(!p.extorted||p.hp<=0||p.jailed)continue;
    const ex=p.extorted;
    if(ST.tick<ex.nextPay)continue;
    // payment due — roll for what happens
    const r=Math.random();
    if(r<ex.breakChance){
      // they BREAK FREE — call your bluff, go to the regime, or just refuse. The leverage is spent.
      log("\u2756 "+p.name+" called your bluff — they've stopped paying. Whatever you had on them, it's burned now.","warn");
      // a wisp who breaks free may expose you (raises awareness)
      if((p.pers&&p.pers.intg>55)||Math.random()<0.3){REG().awareness=clamp((REG().awareness||0)+RI(6,12),0,100);
        log(p.name+" went to the regime about being extorted — your exposure rises.","warn");}
      delete p.extorted;
      continue;
    }
    if((p.stress||0)>92&&Math.random()<0.4){
      // they SNAP under the strain — break free in a worse way (despair, or they flee/lash out)
      log("\u2756 "+p.name+" snapped under the extortion — they're done paying, and they're a wreck.","warn");
      p.stress=Math.min(100,(p.stress||0)+10);
      emotionalReact&&emotionalReact(p,"despair",0.8,{});
      delete p.extorted;
      continue;
    }
    // they PAY — a cut of their credits flows to your network (as intel proxy + a small support cost)
    const pay=Math.max(6,Math.floor((p.credits||0)*R(0.2,0.35))+RI(4,10));
    p.credits=Math.max(0,(p.credits||0)-pay);
    m.intel=(m.intel||0)+Math.floor(pay/4);
    p.stress=Math.min(100,(p.stress||0)+RI(4,9));
    adjAvatarRep(-1);   // the ongoing drain on your standing
    ex.nextPay=ST.tick+Math.floor(TPD*R(2,3));   // schedule the next squeeze
    if(Math.random()<0.5)log("\u2756 "+p.name+" made another payment to keep you quiet ("+pay+"c worth).","info");
  }
}
// POWER-OUTAGE CASCADE — runs while the grid is down. Two effects, per the moderate-severity design:
//   (1) NPCs ON EDGE GET ANGRY — already-stressed wisps fray further (mood down, stress up, the odd
//       outburst); calm wisps mostly just wait it out. The whole block is tense, not uniformly furious.
//   (2) THE REGIME RESTORES IT — a government wisp (Mayor, or an enforcer/regime force) walks to the
//       downed power station and repairs it. Production/medical/lights come back when they arrive.
//   Work-stop is already handled (production halts during blackout); medical-stop is handled at the
//   treatment site (no power, no care). This tick adds the human + restoration layer.
function blackoutTick(){
  if(!gridDown())return;
  // ── (1) anger / fray, throttled so it's a slow burn not a per-tick hammer ──
  if(ST.tick%80===0){
    for(const p of ST.pawns){
      if(p.hp<=0||isChild(p)||p.jailed||p.sleeping)continue;
      const onEdge=(p.stress||0)>45||(p.mood||50)<45;   // those already strained take it worst
      if(onEdge){
        p.mood=clamp((p.mood||50)-RI(2,5),0,100);
        p.stress=clamp((p.stress||0)+RI(2,5),0,100);
        if(Math.random()<0.18&&typeof tryEmote==="function")tryEmote(p,Math.random()<0.5?"angry":"sweat",120);
      } else if(Math.random()<0.25){
        p.stress=clamp((p.stress||0)+RI(1,3),0,100);    // even the steady get a little tense
      }
    }
  }
  // ── (2) a regime wisp repairs the grid (if one exists and isn't already on it) ──
  // find a downed/dark power station: either explicitly sabotaged, or just the power station while the
  // blackout is running (a disaster blackout has no sabotaged flag but still needs the regime to act).
  const powerStations=[...ST.structs.values()].filter(s=>DEF[s.type]&&DEF[s.type].utility==="power"&&!s.bp);
  if(!powerStations.length)return;
  // already someone walking to fix one? then let them work (don't dispatch a second)
  const someoneFixing=ST.pawns.some(p=>p._gridFix&&p.hp>0&&!p.jailed);
  if(someoneFixing)return;
  // pick the station to restore (prefer a sabotaged one, else the first)
  const station=powerStations.find(s=>s.sabotaged>ST.tick)||powerStations[0];
  // dispatch a government wisp: Mayor first, else an enforcer/regime force, else (last resort) the power
  // station's assigned worker — the regime keeps its own lights on first.
  let fixer=ST.pawns.find(p=>p.role==="mayor"&&p.hp>0&&!p.jailed&&!isChild(p));
  if(!fixer)fixer=ST.pawns.find(p=>(p.role==="enforcer"||p.regimeForce)&&p.hp>0&&!p.jailed&&!isChild(p));
  if(!fixer)fixer=ST.pawns.find(p=>p.assigned===station.id&&p.hp>0&&!p.jailed);
  if(!fixer)return;   // no one to send — the outage persists until conditions change
  // send them to the station; on arrival, restore power
  fixer._gridFix=station.id;
  fixer.job={t:"goto",x:station.x,y:station.y,adj:1};
  if(!ST._gridFixAnnounced||ST._gridFixAnnounced<ST.tick-TPD){
    ST._gridFixAnnounced=ST.tick;
    log("\u26a1 "+fixer.name+(fixer.role==="mayor"?" (the Mayor)":fixer.regimeForce?" (regime)":"")+" moves to restore power.","info");
  }
}
// called from pawnTick — drive a dispatched grid-fixer to the station and restore power on arrival
function gridFixTick(p){
  if(!p._gridFix)return false;
  const station=ST.structs.get(p._gridFix);
  if(!station||station.bp||!gridDown()){p._gridFix=null;return false;}   // job gone / power already back
  if(DIST(p.px,p.py,station.x,station.y)<2.4){
    // arrived — restore the grid (clear the blackout + any sabotage timer on this station)
    ST.blackoutUntil=ST.tick;
    if(station.sabotaged>ST.tick)station.sabotaged=ST.tick;
    p._gridFix=null;p.job=null;
    float&&float(station.x+.5,station.y+.5,"POWER ON","#5cff9e");
    log("\u26a1 "+p.name+" repaired the "+DEF[station.type].name+" \u2014 power flickers back on across the block.","good");
    chronicle&&chronicle("Power was restored to the district.","\u26a1");
    return true;
  }
  // still walking — keep the goto job asserted (don't let routine AI pull them off the emergency)
  if(!p.job||p.job.t!=="goto"){p.job={t:"goto",x:station.x,y:station.y,adj:1};}
  return true;   // supersedes normal AI while en route
}
// bribe your way out of jail (the avatar) — costs credits scaled by severity + priors
function bribeOutOfJail(){
  const av=theAvatar();if(!av||!av.jailed){flashMsg&&flashMsg("You're not in jail");return false;}
  const j=av.jailed;
  if(j.capital){flashMsg&&flashMsg("No bribe can buy off an execution order");return false;}
  const cost=Math.round(40*j.severity*(1+(av.jailCount||1)*0.3));
  const m=M();
  if((m.intel||0)<8){flashMsg&&flashMsg("Need 8 intel to arrange a bribe");return false;}
  if((ST.income||0)<cost){flashMsg&&flashMsg("Need "+cost+"c to bribe your way out");return false;}
  m.intel-=8;ST.income-=cost;
  av.jailed=null;av._toJail=null;av.job=null;
  m.exposure=clamp((m.exposure||0)+6*resolveMod(),0,100);   // greasing palms leaves a trail (Resolve keeps you composed)
  log("You bribed your way out of the Holding Cells — "+cost+"c and the door opens.","good");
  flashMsg&&flashMsg("Bribed out — you're free");banner&&banner("BRIBED OUT","good");
  return true;
}
// A sabotage isn't a one-shot stat hit; it sets a whole sequence in motion: the city goes dark → wisps
// feel it and lose faith → that disillusionment makes them recruitable → NPCs eventually REPAIR it →
// the regime INVESTIGATES (enforcer walks the scene, questions wisps; a witness who saw enough fingers
// you) → heat and consequence. Every stage is visible.

// record the crime scene the moment a power/water station is hit
function registerSabotage(s,perp,crit){
  if(!s)return;
  const util=DEF[s.type]&&DEF[s.type].utility;
  // who could SEE it happen? snapshot the witnesses by how much they perceived (Phase 2 canSee)
  const witnesses=[];
  if(perp){for(const q of ST.pawns){const w=canSee(q,perp,AVATAR_OPS.sabotage);
    if(w>0)witnesses.push({id:q.id,strength:w});}}
  s.sabState={
    at:ST.tick, util:util||"power", crit:!!crit,
    perpId:perp?perp.id:null,
    witnesses,                              // [{id,strength}] — strength = how damning their view was
    repairProg:0, repairBy:null,            // NPC repair progress
    investigated:false, investStage:0,      // 0 none · 1 enforcer en route · 2 questioning · 3 resolved
    reactedPawns:{}                          // wisps who've already had their blackout reaction (throttle)
  };
  if(!ST.sabotages)ST.sabotages=[];
  ST.sabotages.push(K(s.x,s.y));
  // the district NOTICES immediately — a beat of collective alarm
  onlookersReact&&onlookersReact(s.x,s.y,"shock",10);
}

// per-tick: drive every active sabotage's lifecycle (reaction → repair → investigation)
function sabotageTick(){
  if(!ST.sabotages||!ST.sabotages.length)return;
  const reg=REG(),m=M();
  for(let i=ST.sabotages.length-1;i>=0;i--){
    const key=ST.sabotages[i];const s=ST.structs.get(key);
    if(!s||!s.sabState){ST.sabotages.splice(i,1);continue;}
    const st=s.sabState;const down=s.sabotaged>ST.tick;

    // ── 1. BLACKOUT REACTION — while the utility is down, nearby wisps feel it and lose faith ──
    if(down&&ST.tick%20===0){
      const radius=22;   // the affected blocks
      for(const p of ST.pawns){if(isChild(p)||p.isAvatar||p.sleeping)continue;
        if(DIST(p.px,p.py,s.x,s.y)>radius)continue;
        if(st.reactedPawns[p.id]&&ST.tick-st.reactedPawns[p.id]<400)continue;   // throttle per wisp
        st.reactedPawns[p.id]=ST.tick;
        // frustration/anger at the outage, and an erosion of faith in the regime that failed them
        const r=Math.random();
        tryEmote(p,r<0.45?"anger":r<0.7?"sweat":"gross",90);
        p.mood=clamp((p.mood||50)-RI(2,5),0,100);
        p.stress=clamp((p.stress||0)+RI(2,5),0,100);
        // DISILLUSIONMENT — moderate, builds over time (your call: a nudge, not an instant flip).
        // it leans the wisp toward the insurrection and makes them more recruitable.
        p.disillusion=clamp((p.disillusion||0)+RI(2,4),0,100);
        p.allegiance=clamp((p.allegiance||0)+RI(1,2),-100,100);    // small lean toward the cause
        if(r<0.15)remember(p,st.util==="power"?"the grid went dark again — the regime can't even keep the lights on":"no water again — what good is this government?");
        if(r<0.08&&typeof aiReactLine==="function")aiReactLine(p,st.util==="power"?"the power just went out across the whole block again":"the water's been cut off again");
      }
    }

    // ── 2. NPC REPAIR — an assigned worker (or a brave volunteer) goes to fix it; power restores ──
    if(down&&!st.repairBy){
      // prefer the station's own worker; else a nearby loyal-ish or civic wisp who'll drop what they're
      // doing to deal with the emergency (don't require them to already be idle — power is urgent)
      let fixer=ST.pawns.find(p=>!isChild(p)&&!p.isAvatar&&!p.sleeping&&p.assigned===key&&p.hp>0);
      if(!fixer)fixer=ST.pawns.find(p=>!isChild(p)&&!p.isAvatar&&!p.sleeping&&p.hp>0&&(p.allegiance||0)>-15&&DIST(p.px,p.py,s.x,s.y)<28&&!p.activeOp&&(!p.job||p.job.t!=="sleep"));
      if(fixer){st.repairBy=fixer.id;fixer.job={t:"goto",x:s.x,y:s.y,adj:1};fixer._repairing=key;}
    }
    if(down&&st.repairBy){
      const fixer=ST.pawns.find(p=>p.id===st.repairBy);
      if(!fixer||fixer.hp<=0||fixer.sleeping){st.repairBy=null;}     // lost the fixer; try again next pass
      else if(DIST(fixer.px,fixer.py,s.x,s.y)<2){
        // on site — repair progresses
        fixer._repairing=key;
        st.repairProg+=1;
        if(st.repairProg%30===0)tryEmote(fixer,"sweat",120);else if(st.repairProg%12===0)tryEmote(fixer,"idea",200);
        if(st.repairProg>=90){    // fixed!
          s.sabotaged=0;
          // power restores if no OTHER power station is also down
          const otherDown=[...ST.structs.values()].some(o=>o!==s&&DEF[o.type]&&DEF[o.type].utility==="power"&&o.sabotaged>ST.tick);
          if(st.util==="power"&&!otherDown)ST.blackoutUntil=Math.min(ST.blackoutUntil||ST.tick,ST.tick);
          log("\u26a1 "+fixer.name+" repaired the "+DEF[s.type].name+" — "+(st.util==="power"?"power flickers back on.":"water flows again."),"good");
          tryEmote(fixer,"happy",150);
          fixer._repairing=null;fixer.job=null;
        }
      } else if(!fixer._repairing||(fixer.job&&fixer.job.t!=="goto")){
        // they wandered off task — send them back (the emergency overrides their routine)
        fixer.job={t:"goto",x:s.x,y:s.y,adj:1};fixer._repairing=key;
      }
    }

    // ── 3. INVESTIGATION — once the regime registers the strike, the enforcer works the scene ──
    if(!st.investigated&&ST.tick-st.at>RI(60,140)){
      st.investigated=true;st.investStage=1;
      const enf=ST.pawns.find(p=>p.role==="enforcer"&&p.hp>0&&(p.allegiance||0)<10);
      if(enf){st.enfId=enf.id;enf.job={t:"goto",x:s.x,y:s.y,adj:1};enf._investigating=key;
        log("\u2696 An enforcer is heading to the sabotaged "+DEF[s.type].name+" to investigate.","warn");
      } else { st.investStage=3; }   // no enforcer to investigate
    }
    if(st.investStage===1&&st.enfId){
      const enf=ST.pawns.find(p=>p.id===st.enfId);
      if(!enf||enf.hp<=0){st.investStage=3;}
      else if(DIST(enf.px,enf.py,s.x,s.y)<3){st.investStage=2;st.questionAt=ST.tick;tryEmote(enf,"ques",150);}
    }
    if(st.investStage===2&&st.enfId){
      const enf=ST.pawns.find(p=>p.id===st.enfId);
      if(!enf||enf.hp<=0){st.investStage=3;}
      else if(ST.tick-st.questionAt>RI(40,80)){
        // QUESTIONING — a witness who saw enough fingers the culprit, weighted by how much they saw
        resolveSabotageInvestigation(s,enf);
        st.investStage=3;enf._investigating=null;
      }
    }

    // ── retire the record once the outage is over AND the investigation has run ──
    if(!down&&st.investStage>=3){
      delete s.sabState;ST.sabotages.splice(i,1);
    }
  }
}

// the enforcer questions witnesses; one who saw clearly enough can identify the avatar → heat/marked
function resolveSabotageInvestigation(s,enf){
  const st=s.sabState;if(!st)return;
  // the strongest witness present and willing (loyal-ish, not a sympathizer) talks
  let bestW=null;
  for(const w of st.witnesses){const q=ST.pawns.find(p=>p.id===w.id);
    if(!q||q.hp<=0)continue;
    if((q.allegiance||0)>25)continue;                  // a sympathizer won't snitch
    if(pawnGang(q))continue;                            // gang stays silent
    const willing=w.strength*(1+((q.allegiance||0)<-20?0.6:0));   // loyalists talk more readily
    if(!bestW||willing>bestW.willing)bestW={q,willing,strength:w.strength};
  }
  const av=theAvatar();
  if(bestW&&bestW.strength>0.8&&av){
    // a clear ID — the avatar is fingered
    ST.heat=Math.min(100,(ST.heat||0)+RI(12,20));
    if(reg=REG())reg.awareness=clamp((reg.awareness||0)+RI(10,18),0,100);
    enf.grudgeTarget=av.id;relAdj(enf.id,av.id,-25);
    tryEmote(enf,"excl",150);tryEmote(bestW.q,"chat",120);
    log("\u2696 "+bestW.q.name+" described the saboteur to the enforcer — they're onto you. Heat spikes.","bad");
    chronicle(bestW.q.name+" fingered you for the "+DEF[s.type].name+" sabotage.","\u2696");
  } else if(bestW&&bestW.strength>0.3){
    // a partial description — suspicion rises but no clean ID
    ST.heat=Math.min(100,(ST.heat||0)+RI(5,10));
    if(reg=REG())reg.awareness=clamp((reg.awareness||0)+RI(4,8),0,100);
    tryEmote(bestW.q,"ques",120);
    log("\u2696 A witness gave the enforcer a vague description — suspicion is rising.","warn");
  } else {
    // nobody saw enough — the trail is cold
    log("\u2696 The enforcer questioned the block but no one could identify the saboteur. The trail goes cold.","good");
    chronicle("The "+DEF[s.type].name+" sabotage went unsolved.","\u2715");
  }
}

function insurrectionTick(){
  const m=M(),reg=REG();
  roleForcesTick();   // the named regime cast (Mayor/Enforcer/Informant) act as active forces
  const recruited=ST.pawns.filter(p=>p.recruited&&!isChild(p));
  const adults=ST.pawns.filter(p=>!isChild(p));
  // INTEL sources (layered so the loop can BOOTSTRAP from nothing):
  //  · BASELINE: you're an operative — your own watching/listening yields a steady trickle even
  //    with no network. This is what lets you afford your first recruit.
  //  · SYMPATHIZERS: discontented, sympathetic wisps (not yet recruited) feed you scraps.
  //  · NETWORK: recruited wisps and established cells are the real intel engine.
  //  · staying "hidden" lets you gather more freely; going "open" trades intel for visible action.
  const sympathizers=adults.filter(p=>!p.recruited&&!p.informant&&(p.allegiance||0)>15).length;
  const tradecraft=ops(theAvatar(),"tradecraft");
  const baseline=1.2+(tradecraft-5)*0.12;             // your Tradecraft sharpens your own intel-gathering
  const fromSymp=sympathizers*0.15;                    // ambient scraps from sympathizers
  const fromNet=recruited.length*0.5+m.cells*0.7;      // the network does the heavy lifting
  const stanceMul=m.stance==="open"?0.6:1.0;           // open insurrection diverts effort from intel
  const intelGain=(baseline+fromSymp+fromNet)*stanceMul;
  m.intel=Math.min(999,(m.intel||0)+intelGain);
  // SUPPORT drifts toward the share of the population that leans your way.
  if(adults.length){
    const leanAvg=adults.reduce((s,p)=>s+(p.allegiance||0),0)/adults.length;
    const target=clamp(50+leanAvg*0.5+recruited.length*2,0,100);
    // §9.3 LEGEND — a beloved operative's presence compounds support (people flock); a feared one suppresses
    // it (people keep their heads down). Only amplifies UPWARD drift, so fear doesn't perversely help.
    const drift=Math.sign(target-m.support)*Math.min(1.5,Math.abs(target-m.support));
    const legendDrift=drift>0?drift*legendSupportMod():drift;
    m.support=clamp((m.support||0)+legendDrift,0,100);
  }
  // EXPOSURE feeds regime awareness; staying "hidden" leaks slowly, "open" leaks fast.
  const leakRate=m.stance==="open"?1.4:0.3;
  const tcShield=clamp(1-(tradecraft-5)*0.06,0.5,1.3);   // high Tradecraft keeps the network quieter
  if(recruited.length)m.exposure=clamp((m.exposure||0)+recruited.length*0.04*leakRate*tcShield*doctrineMod("stealth"),0,100);
  // natural cooldown if you lie low
  // lying low reduces exposure — but a hostile Enforcer's surveillance blunts how fast you can fade.
  // Safe Room station: being at HQ accelerates the fade (2.5×) — the shielded space does its job.
  if(ST.tick%50===0&&m.stance==="hidden"){
    const enf=ST.pawns.find(p=>p.role==="enforcer"&&p.hp>0&&(p.allegiance||0)<-10);
    let fade=enf?0.7:1.5;
    if(hasStation("saferoom")){
      const rm=ST.hq&&ST.hq.room;
      const av=theAvatar();
      if(rm&&av&&av.hp>0){
        const cx=rm.x0+rm.w/2, cy=rm.y0+rm.h/2;
        if(DIST(av.px,av.py,cx,cy)<8)fade*=2.5;
      }
    }
    // safehouse structs: a placed field refuge gives 2× fade when the avatar is within its infraRadius
    // (weaker than the hardened HQ Safe Room at 2.5×, but deployable anywhere in the district)
    if(!hasStation("saferoom")||fade<2){   // only apply if safe room didn't already multiply
      const avSH=theAvatar();
      if(avSH&&avSH.hp>0){
        for(const s of ST.structs.values()){
          if(!s.bp&&s.espionage&&s.pillar==="safe"&&!s.isBroken){
            const r=(DEF[s.type]&&DEF[s.type].infraRadius)||7;
            if(DIST(avSH.px,avSH.py,s.x,s.y)<=r){fade*=2;break;}
          }
        }
      }
    }
    m.exposure=Math.max(0,m.exposure-fade);
  }
  // REGIME awareness tracks exposure; high awareness → investigative sweeps.
  reg.awareness=clamp(reg.awareness*0.96+m.exposure*0.05,0,100);
  // STANCE-AWARE RESPONSE (§9.1) — the regime treats a HIDDEN insurgency and an OPEN one completely
  // differently. Hidden: it INVESTIGATES — patient, intel-driven, can't crack down on a ghost, so it needs
  // higher awareness before it sweeps. Open: it MILITARIZES — overt force, sweeps far sooner and harder.
  const open=m.stance==="open";
  const sweepThreshold=open?35:55;            // open insurrection provokes sweeps at much lower awareness
  const sweepCooldown=open?TPD*1.2:TPD*2;     // and the regime moves on you faster when you're overt
  if(reg.awareness>sweepThreshold&&ST.tick-reg.lastSweep>sweepCooldown){regimeSweep(open);reg.lastSweep=ST.tick;}
  // when open, the regime also steadily militarizes — grip hardens as it asserts control by force
  if(open&&ST.tick%TPD===0)reg.grip=clamp(reg.grip+0.4,0,100);
  // GRIP erodes as your support climbs and cells spread — the long game.
  // GRIP erosion: the regime's hold weakens as your support and cell network grow. Tuned so a
  // well-run movement (high support, several cells) can crack the regime in ~40-80 days, while a
  // weak one barely dents it. Below 40% support the regime actually consolidates (grip rises).
  const supPressure=(m.support-40)*0.03;     // +support above 40% erodes; below, regime regains
  const cellPressure=m.cells*0.06;           // each established cell chips steadily
  reg.grip=clamp(reg.grip-supPressure-cellPressure,0,100);
  // RECRUITMENT spread: recruited wisps slowly radicalize discontented neighbors.
  if(ST.tick%30===0&&recruited.length){
    for(const r of recruited){
      const near=ST.pawns.find(q=>!q.recruited&&!isChild(q)&&q.id!==r.id&&!q.informant&&
        DIST(r.px,r.py,q.px,q.py)<6&&relGet(r.id,q.id)>20&&radicalPotential(q)>30);
      if(near&&Math.random()<0.3){near.allegiance=clamp((near.allegiance||0)+8,-100,100);}
    }
  }
}
// Regime counterplay: during each awareness-triggered sweep, discover + destroy placed espionage infra.
// Chance is spatial — assets inside underSecurity patrol coverage are far more exposed than remote ones.
// Exposure spike is conditional on the same spatial term (remote barely traces back — preserves hacking advantage).
// Per-sweep find cap (1 non-militarized / 2 militarized) means one sweep can never wipe an entire network.
function sweepInfra(militarized){
  const m=M(),reg=REG();
  const assets=[];
  for(const s of ST.structs.values())if(!s.bp&&s.espionage&&!s.isBroken)assets.push(s);
  if(!assets.length)return;
  // Fisher-Yates shuffle so the same asset isn't always checked first (Map iteration is insertion-ordered)
  for(let i=assets.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[assets[i],assets[j]]=[assets[j],assets[i]];}
  const awarenessF=clamp((reg.awareness||0)/100,0,1);
  // base: 0.06..0.20 scaling linearly with awareness. In patrol range: x3 (dangerous). Cap 0.75 pre-militarized.
  const base=0.06+0.14*awarenessF;
  const cap=militarized?2:1;   // open-stance sweeps may burn up to 2 assets; hidden: at most 1
  let found=0,firstFind=true;
  for(const s of assets){
    if(found>=cap)break;
    const inSight=underSecurity(s.x,s.y);
    const chance=Math.min(base*(inSight?3.0:1.0),0.75)*(militarized?1.3:1.0);
    if(Math.random()<chance){
      found++;
      removeStruct(s);
      // in-sight: near a patrol zone, links back to you clearly (+14..18)
      // remote: found but barely traces to the operative (+4..6) -- hacking advantage preserved
      const expSpike=inSight?RI(14,18):RI(4,6);
      m.exposure=clamp((m.exposure||0)+expSpike,0,100);
      const assetName=(DEF[s.type]&&DEF[s.type].name)||s.type;
      log("⚠ Regime sweep uncovered your "+assetName+" -- asset lost."+(inSight?" The patrol zone linked it back to you.":""),"bad");
      if(firstFind){banner&&banner("INFRA FOUND","bad");firstFind=false;}
    }
  }
  return found;
}
// the regime runs a crackdown sweep: tries to identify + burn your cells, turn informants.
function regimeSweep(militarized){
  const reg=REG(),m=M();
  log(militarized?"\u26A0 The regime moves in FORCE — open insurrection means open reprisal.":"\u26A0 The regime is running a surveillance sweep — your network is exposed.",militarized?"bad":"warn");
  // YOUR NERVE under pressure: a successful composure check warns the cells in time, blunting the sweep.
  const nerveCheck=opsCheck("nerve",12);
  if(nerveCheck.pass){m.exposure=Math.max(0,m.exposure-8);
    log("You kept your nerve and got word out — the network scatters ahead of the worst of it.","good");}
  // militarized sweeps are harder to dodge and burn more of the network
  const sweepMul=(nerveCheck.pass?0.6:1)*(militarized?1.5:1);
  const recruited=ST.pawns.filter(p=>p.recruited&&!isChild(p));
  // chance to burn each cell member scales with exposure
  for(const p of recruited){
    const burnChance=clamp((m.exposure/180+(m.stance==="open"?0.12:0))*sweepMul,0,0.6);
    if(Math.random()<burnChance){
      p.recruited=false;p.cellRole=null;
      p.allegiance=clamp((p.allegiance||0)-30,-100,100);
      if(Math.random()<0.4){p.informant=true;reg.informants.push(p.id);
        remember(p,"was turned by the regime — now informing against the cause");
        log(p.name+" was turned into a regime informant.","warn");}
      else{remember(p,"was burned in a sweep and went to ground");
        log(p.name+" was burned and pulled out of the network.","warn");}
      m.cells=Math.max(0,m.cells-(p.cellRole==="leader"?1:0));
    }
  }
  // No find → sweep resolves ambient heat. Find → spike lands clean with no -15 cancellation.
  if(!sweepInfra(militarized))m.exposure=Math.max(0,m.exposure-15);
}
// PLAYER ACTIONS (called from UI):
// recruit a wisp into the movement — costs intel, succeeds based on their potential.
function recruitWisp(p){
  const m=M();
  if(!p||p.recruited||isChild(p))return false;
  const cost=8;
  if((m.intel||0)<cost){flashMsg&&flashMsg("Need "+cost+" intel to attempt recruitment");return false;}
  m.intel-=cost;
  const pot=radicalPotential(p);
  const guileBonus=(ops(theAvatar(),"guile")-5)*0.03;   // your Guile sways the pitch
  // §9.3 LEGEND — a feared operative struggles to recruit (people won't join a monster); a beloved one
  // recruits readily (people flock to a hero). This is the cost of the fear path / the reward of belief.
  const chance=clamp((0.3+pot/120+guileBonus)*legendRecruitMod(),0.03,0.97);
  if(Math.random()<chance){
    p.recruited=true;p.allegiance=clamp((p.allegiance||0)+25,-100,100);
    p.cellRole=ST.pawns.filter(x=>x.recruited).length%4===0?"leader":"member";
    if(p.cellRole==="leader")m.cells=(m.cells||0)+1;
    emotionalReact(p,"inspired",0.7,{memory:"joined the cause — there's something worth fighting for now"});
    log(p.name+" joined your movement.","good");
    return true;
  }else{
    m.exposure=clamp((m.exposure||0)+5,0,100);  // a failed pitch risks exposure
    if(pot<-20&&Math.random()<0.3){p.informant=true;REG().informants.push(p.id);
      log(p.name+" rejected the pitch — and may talk.","warn");}
    else log(p.name+" wasn't ready to commit.","info");
    return false;
  }
}
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  BRAIN B — THE REACTIVE CITY / DIRECTOR  (design doc §3)
//  Makes the WORLD play back. Three parts:
//   (1) a tension-curve director (Build-Up -> Peak -> Relax) that paces pressure with ebb-and-flow,
//       borrowed from Left 4 Dead's AI Director;
//   (2) the regime as a STRATEGIC ACTOR that reads grip/heat/support/awareness and pushes back with
//       intent (crackdowns, propaganda, patrols) keyed to the director phase;
//   (3) a weighted event scheduler that picks incidents by current state + a regime TEMPERAMENT,
//       borrowed from RimWorld's storytellers.
//  All local logic; no API. Reads the same state the avatar (Brain A) manipulates.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// regime TEMPERAMENT — like RimWorld's three storytellers, a tunable personality over the director.
// ironfist: relentless escalation (Cassandra). calculating: withholds then strikes (balanced).
// volatile: unpredictable swings (Randy). Set via ST.regime.temperament; defaults to calculating.
const REGIME_TEMPERAMENT={
  ironfist:    {escalate:1.4, relaxFloor:0.25, eventBias:1.3, label:"Iron Fist"},
  calculating: {escalate:1.0, relaxFloor:0.15, eventBias:1.0, label:"Calculating"},
  volatile:    {escalate:1.0, relaxFloor:0.05, eventBias:1.2, label:"Volatile", swing:0.4},
};
function regimeTemperament(){return REGIME_TEMPERAMENT[(REG()&&REG().temperament)||"calculating"]||REGIME_TEMPERAMENT.calculating;}

// the director's live state lives on ST.director: {tension 0..1, phase, phaseSince, peakCount}
function initDirector(){
  if(!ST.director)ST.director={tension:0.2,phase:"buildup",phaseSince:0,peakCount:0,lastEvent:0};
  return ST.director;
}
// PHASE PModel (§3.1, L4D): tension climbs in BUILDUP, holds at PEAK, then drains in RELAX, repeat.
// The regime applies pressure, then deliberately backs off so the player recovers (ebb-and-flow).
const TENSION_PEAK=0.8, TENSION_RELAX_EXIT=0.25;
function directorTick(){
  const D=initDirector(), reg=REG(), m=M(), temp=regimeTemperament();
  // ── compute the "heat of the moment" from real state the player drives ──
  // higher when: heat high, awareness high, the avatar's been active (recent ops -> exposure), open stance.
  const heat=(ST.heat||0)/100, aware=(reg.awareness||0)/100, exposure=(m.exposure||0)/100;
  const open=m.stance==="open"?0.2:0;
  const momentPressure=clamp(heat*0.4+aware*0.35+exposure*0.25+open,0,1);
  // ── advance tension along the phase curve ──
  const dwell=ST.tick-D.phaseSince;
  if(D.phase==="buildup"){
    // tension rises toward the moment-pressure ceiling, scaled by temperament's escalation rate
    const target=Math.max(0.4,momentPressure);
    D.tension=clamp(D.tension+0.0009*temp.escalate*(1+ (temp.swing?(Math.random()-0.5)*temp.swing:0)),0,1);
    if(D.tension>=TENSION_PEAK||(dwell>TPD*1.5&&D.tension>=target)){
      D.phase="peak";D.phaseSince=ST.tick;
      D.peakDur=Math.floor(TPD*R(0.3,0.6));   // roll the peak's duration ONCE on entry (stable threshold)
    }
  } else if(D.phase==="peak"){
    // hold the peak a short, tense while -> then RELEASE into relax (the recovery beat)
    D.tension=clamp(D.tension+0.0002,0,1);
    if(dwell>(D.peakDur||Math.floor(TPD*0.45))){D.phase="relax";D.phaseSince=ST.tick;D.peakCount++;}
  } else { // relax
    // tension drains so the avatar can rebuild; temperament sets how far it falls (ironfist relaxes less)
    D.tension=clamp(D.tension-0.0011,temp.relaxFloor,1);
    if(D.tension<=Math.max(TENSION_RELAX_EXIT,temp.relaxFloor+0.05)&&dwell>TPD*0.4){D.phase="buildup";D.phaseSince=ST.tick;}
  }
}

// (2) THE REGIME AS A STRATEGIC ACTOR — keyed to the director phase, the regime takes deliberate action.
// This is separate from the passive insurrectionTick drift: it's the regime making MOVES in response to
// the state of play, so its pushback reads as intent (a strike happened -> crack down) not a difficulty knob.
function regimeStrategicTick(){
  const D=initDirector(), reg=REG(), m=M(), temp=regimeTemperament();
  // act on a cadence, not every tick (deliberate moves, with cooldown so it doesn't spam)
  if(ST.tick-(reg._lastStrategicAct||0)<TPD*0.5)return;
  const support=m.support||0, grip=reg.grip!=null?reg.grip:60;
  // PEAK phase + provocation => the regime cracks down hard
  if(D.phase==="peak"){
    // it picks the response that fits what's happening:
    if((m.exposure||0)>45||m.stance==="open"){
      // overt threat -> a show of force: heat up, post an informant, harden grip a touch
      reg._lastStrategicAct=ST.tick;
      ST.heat=Math.min(100,(ST.heat||0)+RI(6,12));
      reg.awareness=clamp((reg.awareness||0)+RI(4,9),0,100);
      // try to turn a wisp into an informant (the regime recruits eyes)
      const cand=ST.pawns.find(p=>!p.isAvatar&&!isChild(p)&&!p.informant&&!p.recruited&&(p.allegiance||0)<-10&&p.hp>0);
      if(cand&&Math.random()<0.4){cand.informant=true;reg.informants.push(cand.id);
        log("\u2696 The regime turned "+cand.name+" into an informant during the crackdown.","warn");}
      else log("\u2696 The regime tightens its grip \u2014 patrols up, the block on edge.","warn");
      banner&&banner("CRACKDOWN","bad");
    }
  } else if(D.phase==="buildup"&&support>55){
    // rising support but not yet a crisis -> COUNTER-PROPAGANDA: chip at support, target agitators
    reg._lastStrategicAct=ST.tick;
    m.support=clamp(support-RI(2,5),0,100);
    // a recruited wisp may be pressured back toward neutral
    const r=ST.pawns.find(p=>p.recruited&&!isChild(p)&&p!==theAvatar());
    if(r&&Math.random()<0.3){r.allegiance=clamp((r.allegiance||0)-RI(5,12),-100,100);}
    log("\u2696 The regime runs counter-propaganda \u2014 support softens across the block.","info");
  }
  // RELAX phase: the regime eases off (the ebb) -> nothing aggressive; let tension reset.
}

// (3) WEIGHTED EVENT SCHEDULER (§3.3, RimWorld) — choose the NEXT incident by current state + phase +
// temperament, instead of a flat random roll. PEAK favors pressure events; RELAX favors relief; the
// temperament biases the mix. Returns an event key the existing fireEvent switch understands, or null
// to fall through to the legacy random pick.
function directorPickEvent(){
  const D=initDirector(), reg=REG(), m=M(), temp=regimeTemperament();
  // PRESSURE events (raise stakes) vs RELIEF events (let the player breathe) vs NEUTRAL flavor
  const PRESSURE=["enforcer_raid","mugging","shortage","power_surge"];
  const RELIEF=["supply_windfall","black_market","wander"];
  const NEUTRAL=["brawl","medbill","gigdrought","corp_recruit"];
  let pool;
  if(D.phase==="peak"){
    // peak: mostly pressure (the squeeze), weighted up by temperament
    pool=Math.random()<0.7*temp.eventBias?PRESSURE:NEUTRAL;
  } else if(D.phase==="relax"){
    // relax: favor relief so the avatar can recover (Phoebe's mercy)
    pool=Math.random()<0.6?RELIEF:NEUTRAL;
  } else {
    // buildup: a balanced mix leaning slightly to pressure as tension climbs
    pool=Math.random()<(0.3+D.tension*0.3)?PRESSURE:(Math.random()<0.5?NEUTRAL:RELIEF);
  }
  return CH(pool);
}

// spend intel to lie low — actively reduce exposure (go to ground)
function goToGround(){
  const m=M();const cost=12;
  if((m.intel||0)<cost){flashMsg&&flashMsg("Need "+cost+" intel");return false;}
  m.intel-=cost;m.exposure=Math.max(0,m.exposure-25);REG().awareness=Math.max(0,REG().awareness-15);
  log("The network goes quiet — exposure drops.","good");return true;
}

/* ═══════════ AVATAR OPERATIONS — the player's insurgent toolkit. Each op spends intel, rolls an
   ops-check against the relevant stat, and applies consequences. HIGH RISK: failure spikes exposure +
   regime awareness and can blow back hard. Success advances the cause but still leaves a trace. Running
   ops GROWS the relevant stat over time (you get better at what you practice) and builds your district
   REPUTATION (feared/respected), which colors how wisps react to you. */
// op definitions: stat = which ops attribute, diff = base difficulty, cost = intel, target = needs a target?
const AVATAR_OPS={
  intel:     {name:"Gather Intel", stat:"insight", diff:11, cost:0, target:null, range:0, duration:60, anim:"tail", sightRange:5, witnessK:0.5,
    desc:"Work your contacts and surveil the block. Success feeds your network intel. Failure tips off the regime."},
  surveil:   {name:"Surveil a Wisp", stat:"insight", diff:12, cost:4, target:"anyPawn", range:3.5, duration:90, anim:"tail", sightRange:5, witnessK:0.5,
    desc:"Tail a specific wisp to dig up their secret. Knowing their dirt unlocks blackmail. Discreet — but not risk-free."},
  dissent:   {name:"Spread Dissent", stat:"presence", diff:12, cost:6, target:null, range:0, duration:70, anim:"rally", sightRange:9, witnessK:0.8,
    desc:"Stir the block against the regime — raise support. A rousing op moves people; a clumsy one exposes you."},
  sabotage:  {name:"Sabotage Infrastructure", stat:"tradecraft", diff:13, cost:10, target:"utility", range:1.8, duration:100, anim:"plant", sightRange:8, witnessK:1.2,
    desc:"Knock out a power or water building — blackout, chaos, a blow to the regime's grip. Failure means you're spotted."},
  steal:     {name:"Rob a Wisp", stat:"tradecraft", diff:13, cost:8, target:"anyPawn", range:2.0, duration:80, anim:"lift", sightRange:6, witnessK:0.9,
    desc:"Rob a wisp at knifepoint for their credits. They may resist or fight back, and they will ALWAYS call the regime — get caught and you're jailed."},
  bribe:     {name:"Bribe a Wisp", stat:"guile", diff:11, cost:6, target:"anyPawn", range:1.8, duration:55, anim:"confer", sightRange:4, witnessK:0.4,
    desc:"Buy a wisp's loyalty or silence with credits. The corruptible bend; the principled may report the offer."},
  frame:     {name:"Frame a Regime Asset", stat:"guile", diff:14, cost:14, target:"regime", range:1.8, duration:90, anim:"plant", sightRange:6, witnessK:1.0,
    desc:"Plant evidence on a regime loyalist — turn the district against them, weaken their grip. Hard and risky."},
  blackmail: {name:"Blackmail a Wisp", stat:"presence", diff:12, cost:6, target:"anyPawn", needsSecret:true, range:1.8, duration:60, anim:"confer", sightRange:4, witnessK:0.4,
    desc:"Use a secret you've uncovered to coerce a wisp — turn an informant, force compliance. Requires known dirt."},
  assassinate:{name:"Assassinate", stat:"nerve", diff:16, cost:20, target:"regime", range:1.6, duration:75, anim:"strike", sightRange:8, witnessK:1.4,
    desc:"Eliminate a regime figure outright. The ultimate strike — and the regime WILL hunt whoever did it. Last resort."},
  // hack pillar — remote ops (gate: hqUnlocks("hack") + hasHackReach(target))
  hackGrid:      {name:"Hack the Grid",     stat:"tradecraft", diff:16, cost:14, target:"utility", range:0, duration:120, anim:"plant", sightRange:0, witnessK:0,
    desc:"Remotely sabotage a power or water building via a placed Grid Tap — blackout from the shadows, no physical approach. Requires Server Room at HQ + a Grid Tap in reach."},
  dataHeist:     {name:"Data Heist",        stat:"tradecraft", diff:17, cost:18, target:null,      range:0, duration:140, anim:"tail",  sightRange:0, witnessK:0,
    desc:"Breach regime records via the Grid Tap network — a large intel payout without entering the building. Requires Server Room + a Grid Tap in reach of a regime building."},
  corruptRecords:{name:"Corrupt Records",   stat:"guile",      diff:15, cost:16, target:"regime",  range:0, duration:110, anim:"plant", sightRange:0, witnessK:0,
    desc:"Overwrite regime files to discredit a loyalist — a single-step digital frame. No planting, no return visit. Requires Server Room + a Grid Tap near the target."},
};
// reputation: -100 (feared/ruthless) .. +100 (beloved/respected). Built by op outcomes + their nature.
function avatarRep(){const a=theAvatar();return a?(a.rep&&a.rep.district||0):0;}
function adjAvatarRep(delta){const a=theAvatar();if(!a)return;a.rep=a.rep||{};a.rep.district=clamp((a.rep.district||0)+delta,-100,100);}

/* ═══════════ SECRETS & INFORMATION — the observe→leverage spine. Wisps carry hidden dirt; you discover
   it by gathering intel (or it surfaces on a crit). A KNOWN secret is leverage — it unlocks BLACKMAIL on
   that wisp. This is what turns subterfuge from a button into a two-act play: find the secret, then use it. */
// derive what dirt a wisp is hiding (returns a secret descriptor, or null if they're clean).
function wispSecret(p){
  if(!p||p.isAvatar||isChild(p))return null;
  if(p.informant)return {kind:"informant",text:"is secretly feeding the regime — an informant on their own neighbors"};
  if(pawnGang(p))return {kind:"gang",text:"is running with a gang — rackets, turf, the works"};
  const partner=ST.pawns.find(q=>q!==p&&!isChild(q)&&relGet(p.id,q.id)>60&&partnerOf(q)&&partnerOf(q)!==p.id);
  if(partner)return {kind:"affair",text:"is carrying on with "+partner.name+" behind their partner's back"};
  if((p.addiction||0)>45)return {kind:"addiction",text:"has a dependency they're hiding from the block"};
  if(p.framed)return {kind:"framed",text:"is quietly sitting on evidence that they were set up"};
  if((p.pers.intg||50)<25&&(p.credits||0)>60)return {kind:"graft",text:"came by their credits through skimming and graft"};
  return null;
}
// reveal a nearby wisp's secret (called on a crit intel op, or directly by surveillance). Marks it KNOWN.
function maybeSurfaceSecret(){
  const av=theAvatar();if(!av)return false;
  // prefer a wisp near you who has an undiscovered secret
  const cands=ST.pawns.filter(p=>!p.isAvatar&&!isChild(p)&&p.hp>0&&wispSecret(p)&&!(p.secretKnown));
  if(!cands.length)return false;
  // nearest first
  cands.sort((x,y)=>DIST(av.px,av.py,x.px,x.py)-DIST(av.px,av.py,y.px,y.py));
  const tgt=cands[0];const sec=wispSecret(tgt);
  tgt.secretKnown=true;tgt.secret=sec;
  (av.dossier=av.dossier||[]).push({id:tgt.id,kind:sec.kind,text:tgt.name+" "+sec.text,t:ST.tick});
  log("\u2756 INTEL: you learned that "+tgt.name+" "+sec.text+".","good");
  banner("SECRET UNCOVERED","good");
  remember(tgt,"someone's been asking about me — I don't like it");
  return true;
}
// does the player KNOW a usable secret on this wisp? (gates the blackmail op)
function knownSecret(p){return p&&p.secretKnown&&p.secret?p.secret:null;}
// ═══ INTEL FOG — a wisp's hidden stats start UNKNOWN and are revealed a few at a time by GATHER INTEL on
// that specific target. `p.intelSeen` is a set of revealed stat-keys; `intelKnown(p,key)` checks one.
// The full reveal order: disposition → individual temperament stats + skills → (the secret comes via its
// own surveil/crit path). Your operative + children are always fully known (no fog on yourself/kids). ═══
const INTEL_KEYS=["dispo","emp","intg","amb","cau","soc","imp","skills","voc"];
function intelKnown(p,key){
  if(!p)return false;
  if(p.isAvatar||isChild(p))return true;          // never fog your own operative or children
  return !!(p.intelSeen&&p.intelSeen[key]);
}
function intelProgress(p){ // 0..1 how much of this wisp you've uncovered
  if(!p||p.isAvatar||isChild(p))return 1;
  if(!p.intelSeen)return 0;
  let n=0;for(const k of INTEL_KEYS)if(p.intelSeen[k])n++;
  return n/INTEL_KEYS.length;
}
// reveal a few hidden stats on a target (called by a successful Gather Intel on them). count scales with
// how good the intel was (crit reveals more). returns the keys newly revealed (for the log).
function revealIntel(p,count){
  if(!p||p.isAvatar||isChild(p))return [];
  p.intelSeen=p.intelSeen||{};
  // disposition first (it's the headline), then the rest in a randomized trickle
  const order=["dispo",...shuffleArr(["emp","intg","amb","cau","soc","imp","skills","voc"])];
  const newly=[];
  for(const k of order){if(newly.length>=count)break;if(!p.intelSeen[k]){p.intelSeen[k]=true;newly.push(k);}}
  return newly;
}
function shuffleArr(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// render a fogged stat: the real value if intel-known, else a muted "???"
function fogVal(p,key,realHtml){
  if(intelKnown(p,key))return realHtml;
  return "<span style='color:#4a5568;letter-spacing:1px'>???</span>";
}
// ═══ ROUTINE MAPPING (surveil) — shadowing a wisp builds a dossier of their PATTERN: where they live, where
// they work, and their VULNERABLE WINDOWS (when they're alone + exposed). Each surveil reveals the next
// layer. A fully-mapped routine is what unlocks assassination targeting (you know when/where to strike). ═══
const ROUTINE_STAGES=["home","work","schedule","vulnerable"];  // revealed in order
function routineStage(p){return p&&p.routine?(p.routine.stage||0):0;}   // 0..4
function routineComplete(p){return routineStage(p)>=ROUTINE_STAGES.length;}
// advance the surveillance dossier by one stage, capturing the relevant data at that stage
function advanceRoutine(p){
  if(!p||p.isAvatar||isChild(p))return null;
  p.routine=p.routine||{stage:0};
  const s=p.routine.stage||0;
  if(s>=ROUTINE_STAGES.length)return null;
  const stageName=ROUTINE_STAGES[s];
  if(stageName==="home"){
    const h=p.home;p.routine.home=h?{x:h.door?h.door.x:(h.bed?h.bed.x:null),y:h.door?h.door.y:(h.bed?h.bed.y:null)}:null;
    p.routine.homeless=!h;
  }else if(stageName==="work"){
    if(p.assigned){const st=ST.structs.get(p.assigned);p.routine.work=st?{x:st.x,y:st.y,type:st.type}:null;}
    else p.routine.work=null;
  }else if(stageName==="schedule"){
    // capture a coarse daily rhythm from their personality (works days, leisure type, sleeps nights)
    p.routine.schedule={works:!!p.assigned,nocturnal:(p.pers&&p.pers.imp>60),leisure:(p.pers&&p.pers.soc>55?"bar":"arcade")};
  }else if(stageName==="vulnerable"){
    // the payoff: identify WHEN this target is most exposed/alone (the strike window)
    p.routine.vulnerable=computeVulnerableWindow(p);
  }
  p.routine.stage=s+1;
  return stageName;
}
// determine a target's vulnerable window — when they're predictably alone + away from regime eyes.
function computeVulnerableWindow(p){
  // commute (to/from work), or late-night if they go out, or isolated at home if homeless/loner
  if(p.homeless)return {when:"night",where:"the sprawl",desc:"sleeps rough in the sprawl after dark — no one watching"};
  if(p.pers&&p.pers.soc<35)return {when:"evening",where:"home",desc:"keeps to themselves — alone at home most evenings"};
  if(p.assigned)return {when:"commute",where:"the streets",desc:"walks the same route to work alone each morning"};
  return {when:"night",where:"home",desc:"predictable nights at home, lightly watched"};
}
// is the target's routine known well enough to ENABLE precise ops (assassination targeting)?
function routineKnownEnough(p){return routineStage(p)>=3;}   // need at least through 'schedule'

/* ═══════════ REACTIVE OP STATE — the brain of the reactive operations menu. For any op, returns its
   current playability: ready / blocked-impossible / risky-but-possible. The guiding rule is "disable only
   the impossible, signal the dangerous." Prerequisites (no intel, no secret, no target in range) are real
   impossibilities → disabled. Heat/exposure are RISK, never a block → the op stays available but flagged. */
// categories group the toolkit so the menu reads as organized intent, not a flat wall of buttons.
const OP_CATEGORY={
  intel:"INTELLIGENCE", surveil:"INTELLIGENCE",
  dissent:"INFLUENCE", bribe:"INFLUENCE", blackmail:"INFLUENCE", frame:"INFLUENCE",
  sabotage:"DIRECT ACTION", steal:"DIRECT ACTION", assassinate:"DIRECT ACTION",
  hackGrid:"REMOTE OPS", dataHeist:"REMOTE OPS", corruptRecords:"REMOTE OPS",
};
const OP_CAT_ORDER=["INTELLIGENCE","INFLUENCE","DIRECT ACTION","REMOTE OPS"];
function opState(opKey){
  const op=AVATAR_OPS[opKey];const m=M();const a=theAvatar();
  if(!op||!a)return {ok:false,reason:"unavailable",label:""};
  // PREREQUISITES (real impossibilities → the button is disabled)
  if((m.intel||0)<op.cost)return {ok:false,reason:"intel",label:"Need "+op.cost+" intel"};
  // targeted ops: need a valid target selected/in range. We can only fully check at click; here we mark
  // whether the op REQUIRES targeting so the UI can prompt the positioning step.
  const needsDirt=op.needsSecret&&!ST.pawns.some(q=>!q.isAvatar&&!isChild(q)&&knownSecret(q));
  if(needsDirt)return {ok:false,reason:"secret",label:"Surveil someone first"};
  // HACK PILLAR GATES — remote ops require Server Room + at least one placed Grid Tap
  if(opKey==="hackGrid"||opKey==="dataHeist"||opKey==="corruptRecords"){
    if(!hqUnlocks("hack"))return {ok:false,reason:"infrastructure",label:"Need a Server Room at HQ"};
    const anyTap=[...ST.structs.values()].some(s=>!s.bp&&!s.isBroken&&s.espionage&&s.pillar==="hack"&&s.type==="gridtap");
    if(!anyTap)return {ok:false,reason:"infrastructure",label:"No Grid Tap placed"};
  }
  // GEAR + VULN — preview-knowable modifiers; mirror the resolve chokepoint signs exactly
  // resolve: op.diff + expPenalty + wit.pen + fearPen - vulnPen + gearMod (wit/fear unknowable at preview)
  const expPenalty=Math.floor((m.exposure||0)/25);
  const gear=gearMod(opKey,"diff");                // typically ≤0; added at resolve
  const VULN_OPS_P=new Set(["bribe","blackmail","steal"]);
  const selPawn=ST.sel&&ST.sel[0]&&!ST.sel[0].isAvatar&&!isChild(ST.sel[0])&&ST.sel[0].hp>0?ST.sel[0]:null;
  const vulnP=VULN_OPS_P.has(opKey)&&selPawn?homeVulnerability(selPawn,opKey):0;
  const trait=traitMod(selPawn,opKey);             // ±2 when target intg discovered (bribe only)
  const previewDiff=op.diff+expPenalty-vulnP+gear+trait; // = resolve diff when wit.pen=fearPen=0
  // RISK (never a block — exposure/awareness raise a visible danger tier; gear/vuln lower it)
  const exp=m.exposure||0, aware=(REG()&&REG().awareness)||0;
  let risk=0;
  if(exp>60)risk+=2; else if(exp>35)risk+=1;
  if(aware>60)risk+=2; else if(aware>35)risk+=1;
  // loud ops (assassinate/sabotage/frame) are extra risky when the heat is up
  if(risk>0&&(op.anim==="strike"||op.anim==="plant"))risk+=1;
  // fold gear/vuln/trait: each 2 pts of difficulty change = 1 risk step
  risk=Math.max(0,risk+Math.round(gear/2)-Math.round(vulnP/2)+Math.round(trait/2));
  const riskTier=risk>=4?"extreme":risk>=2?"high":risk>=1?"raised":"low";
  return {ok:true, reason:"ready", risk:riskTier, diff:previewDiff, gear, targeted:!!op.target, range:op.range};
}
// HOME VULNERABILITY — how easy is this target to socially work right now?
// opKey scopes which drivers apply:
//   bribe/blackmail: desperation only (wealth = LESS desperate, not easier to corrupt)
//   steal:           desperation + room-quality wealth signal (rich target = worth robbing)
// Returns 0..4, subtracted from difficulty at the op-resolve chokepoint.
// Numbers are first-draft; tune from play.
function homeVulnerability(p,opKey){
  if(!p||isChild(p))return 0;
  let v=0;
  // DESPERATION: unmet needs make people pliable. Each need 0..100; below threshold = shortfall.
  // Weight food/rest most heavily (survival pressure), hyg/fun lightly.
  const needs=p.needs||{};
  const foodShort=Math.max(0,30-(needs.food!=null?needs.food:100));  // 0..30
  const restShort=Math.max(0,30-(needs.rest!=null?needs.rest:100));  // 0..30
  const hygShort =Math.max(0,20-(needs.hyg !=null?needs.hyg :100));  // 0..20
  const funShort =Math.max(0,20-(needs.fun !=null?needs.fun :100));  // 0..20
  // map combined shortfall → 0..3
  v+=clamp((foodShort*0.06+restShort*0.04+hygShort*0.02+funShort*0.01),0,3);
  // homeless = maximally pliable (no security, no stability)
  if(p.homeless)v=Math.max(v,2.0);
  // WEALTH SIGNAL: a visibly affluent home means the target is worth robbing.
  // Only applies to steal — wealth makes bribe/blackmail targets LESS desperate, not more.
  if(opKey==="steal"){
    const hr=homeRoom(p);
    if(hr){const q=roomQuality(hr);v+=clamp((q-60)*0.025,0,1);}  // 0 below q60, up to +1 at q100
  }
  return clamp(v,0,4);
}
// bribe receptivity: a feared operative buys silence more easily; a beloved one meets resistance to
// outright corruption (people don't expect it of them). Reputation now shapes a real outcome.
function bribeReceptivity(target){
  const rep=avatarRep();const base=(target&&(100-(target.pers.intg||50))/100)||0.5;
  const repMod=rep<-20?0.18:rep>30?-0.12:0;   // feared → easier, beloved → slightly harder
  return clamp(base+repMod,0.05,0.95);
}
// TRAIT MOD — target's integrity modifies bribe difficulty ONLY once discovered via intel system.
// High intg → positive → harder to bribe; low intg → negative → easier. Zero for all other ops.
function traitMod(target,opKey){
  if(opKey!=="bribe")return 0;
  if(!target||target.kind!=="pawn")return 0;
  if(!intelKnown(target,"intg"))return 0;
  return clamp(Math.round(((target.pers.intg||50)-50)/25),-2,2);
}


// running an op trains the stat used (diminishing as it climbs toward 10)
function trainOpStat(stat){const a=theAvatar();if(!a||!a.ops)return;
  a.opXp=a.opXp||{};a.opXp[stat]=(a.opXp[stat]||0)+1;
  const need=4+a.ops[stat]*2;                         // higher stats take more reps
  if(a.opXp[stat]>=need&&a.ops[stat]<10){a.opXp[stat]=0;a.ops[stat]++;
    log("Your "+stat.toUpperCase()+" sharpened to "+a.ops[stat]+" — practice pays.","good");
    float(a.px,a.py,stat.toUpperCase()+" \u2191","#22ddff");}
}
// the unified op runner. opKey ∈ AVATAR_OPS, target = optional pawn/struct depending on the op.
// ── EMBODIED OPS (Phase 1): an op is no longer instant. It STAGES an activeOp the avatar physically
// performs over time; the banded roll fires only on completion (resolveAvatarOp). runAvatarOp is kept as
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  BRAIN A — THE AUTONOMOUS OPERATIVE  (design doc §2 + §9.1/§9.4)
//  A utility-AI core that drives the avatar on AUTO: it scores high-level OBJECTIVES against game
//  state (weighted by the active posture), selects a target, resolves the prerequisite chain into a
//  concrete op, and commits — with anti-oscillation so it doesn't dither. Builds the watchable
//  autonomous playthrough. All local logic; no API.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// ---- POSTURE WEIGHT PROFILES (§2.3) — [Wstrat, Wopp, Wrisk, Wneed] ----
const POSTURE_W={
  laylow:        {strat:0.3, opp:0.4, risk:1.5, need:1.0},
  normal:        {strat:1.0, opp:1.0, risk:1.0, need:1.0},
  revolucionario:{strat:1.6, opp:1.2, risk:0.4, need:0.7},
};
function avatarWeights(){return POSTURE_W[ST.avatarPosture||"normal"]||POSTURE_W.normal;}

// ---- response curves (§2.2) ----
function curveSurvival(av){
  // quadratic: minor need barely registers, critical need shoots toward 1
  if(!av)return 0;
  const food=av.needs?av.needs.food:100, rest=av.needs?av.needs.rest:100, hp=av.hp!=null?av.hp:100;
  const worst=Math.min(food,rest,hp);                  // 0..100, lower = worse
  const lack=Math.max(0,(60-worst)/60);                // only kicks in below 60
  return Math.min(1,lack*lack);                        // squared
}
function curveRisk(){
  // soft knee: low heat ~0, climbs steeply past a threshold
  const heat=(ST.heat||0), aware=(REG()&&REG().awareness||0);
  const raw=(heat*0.6+aware*0.4)/100;                  // 0..1
  return Math.min(1,raw*raw*1.6);                      // knee
}
function enforcerProximityRisk(av){
  if(!av)return 0;let best=99;
  for(const p of ST.pawns){if(p.role==="enforcer"&&p.hp>0){const d=DIST(av.px,av.py,p.px,p.py);if(d<best)best=d;}}
  return best<8?(8-best)/8:0;                           // within 8 tiles ramps up
}

// ---- TARGET SELECTION (§2.4) — score eligible pawns, pick the best for an objective ----
function roleValue(p){return p.role==="mayor"?1.0:p.role==="enforcer"?0.7:p.informant?0.55:0.3;}
function targetVulnerability(p){
  let v=0;
  if((p.hp||100)<60)v+=0.4;
  if(p.framed)v+=0.3;
  if(p.homeless)v+=0.2;
  if(p.routine&&p.routine.vulnerable)v+=0.4;
  return Math.min(1,v);
}
function pickTarget(av,mode){
  // mode "strike" => prefer high-value + vulnerable + known; "surveil" => prefer high-value + UNKNOWN
  let best=null,bestScore=-1e9;
  for(const p of ST.pawns){
    if(p.isAvatar||isChild(p)||p.hp<=0)continue;
    const dist=DIST(av.px,av.py,p.px,p.py);
    const known=(typeof routineStage==="function")?routineStage(p)/4:0;
    let s=roleValue(p)*1.2 - dist*0.03;
    if(mode==="surveil"){
      s+= (1-known)*0.8;                                 // prefer not-yet-mapped
      s-= roleValue(p)>0.6?0:0.2;                        // bias toward important people
    } else { // strike
      s+= targetVulnerability(p)*1.0 + known*0.5;
      if(p.role==="enforcer")s-=0.3;                     // retaliation risk
    }
    if(s>bestScore){bestScore=s;best=p;}
  }
  return best;
}

// ---- OBJECTIVE SCORING (§2.2) ----
// Each objective returns {key, score, op, target} or null if infeasible. Feasibility is a HARD filter.
// pick the suspect the FOUND CLUES point to, with a confidence score. Each found clue carries {sid,w}:
// positive w incriminates that suspect, negative w exonerates. Returns {suspectId, confidence, lead} or null.
// confidence = how far the top suspect leads the field (so we only accuse when the evidence is decisive).
function caseLikelySuspect(c){
  if(!c||!c.found||!c.found.length||!c.suspects||!c.suspects.length)return null;
  const tally={};for(const sid of c.suspects)tally[sid]=0;
  for(const clue of c.found){if(clue.sid!=null&&tally[clue.sid]!=null)tally[clue.sid]+=(clue.w||0);}
  let top=null,topW=-1e9,second=-1e9;
  for(const sid of c.suspects){const w=tally[sid];if(w>topW){second=topW;topW=w;top=sid;}else if(w>second){second=w;}}
  if(top==null||topW<=0)return null;               // no incriminating evidence yet
  return {suspectId:top, confidence:topW-Math.max(0,second), lead:topW};
}
function scoreObjectives(av){
  const W=avatarWeights(), m=M(), risk=curveRisk(), prox=enforcerProximityRisk(av), need=curveSurvival(av);
  // ATTRIBUTE-GROUNDED RISK (§2.2): the operative's NERVE blunts perceived risk — a steady-nerved operative
  // reads the same heat as less threatening than a jumpy one. Grounds the matrix in p.ops, not flat constants.
  const nerveStat=ops(av,"nerve");
  const nerveBlunt=clamp(1-(nerveStat-5)*0.06,0.4,1.3);
  const riskTerm=Math.min(1,(risk*0.7+prox*0.5)*nerveBlunt);
  const out=[];
  function inertia(key){return (ST._avatarObjective===key)?0.12*(ST._avatarInertia||0):0;}

  // OBJECTIVE: Build Network (intel/recruit) — always feasible (intel is free). Scales with GUILE.
  {
    const guileBonus=(ops(av,"guile")-5)*0.04;
    const strat=0.45, opp=clamp(0.6+guileBonus,0.1,1.0);
    const score=W.strat*strat + W.opp*opp - W.risk*riskTerm*0.5 + inertia("network");
    out.push({key:"network",score,plan:()=>planNetwork(av)});
  }
  // OBJECTIVE: Weaken Regime (sabotage a building) — needs intel>=14 + a sabotage target
  {
    const intel=m.intel||0;
    if(intel>=14){
      const strat=0.8, opp=0.3;
      const score=W.strat*strat + W.opp*opp - W.risk*riskTerm + inertia("weaken");
      out.push({key:"weaken",score,plan:()=>planWeaken(av)});
    }
  }
  // OBJECTIVE: Eliminate Target — pick a high-value pawn; chain surveil->strike
  {
    const tgt=pickTarget(av,"strike");
    if(tgt){
      const rv=roleValue(tgt), vuln=targetVulnerability(tgt);
      const strat=0.5+rv*0.45, opp=0.3+vuln*0.6;
      const score=W.strat*strat + W.opp*opp - W.risk*riskTerm + inertia("eliminate");
      out.push({key:"eliminate",score,plan:()=>planEliminate(av,tgt)});
    }
  }
  // OBJECTIVE: Investigate an open case — the detective layer IS espionage. Spend intel to surface the next
  // clue on an unsolved murder/informant case. Scales with INSIGHT (deduction). Closes the "detective blind
  // spot" where an AUTO operative let cases time out. (External review catch — integrated + attribute-keyed.)
  {
    const cases=(typeof openCases==="function")?openCases():[];
    if(cases.length>0&&(m.intel||0)>=6){
      // only pursue if there's still a lead to find (don't burn intel on an exhausted case)
      const workable=cases.find(c=>c.clues&&c.found&&c.found.length<c.clues.length);
      if(workable){
        const insightStat=ops(av,"insight");
        const strat=0.6, opp=clamp(0.35+insightStat/20,0.1,1.0);
        const score=W.strat*strat + W.opp*opp - W.risk*riskTerm*0.3 + inertia("investigate");
        out.push({key:"investigate",score,plan:()=>{investigateCase(workable.id);return true;}});
      }
    }
  }
  // OBJECTIVE: Accuse — crack a case to strike at the regime. CRITICAL FIX vs naive "accuse suspects[0]":
  // a wrong accusation COSTS support+exposure, so the operative accuses the suspect the EVIDENCE points to
  // (tallied found-clue weights), and only when the lead is decisive (confidence high enough to be worth it).
  {
    const cases=(ST.cases||[]).filter(c=>!c.resolved&&c.found&&c.found.length>=2);
    let bestCase=null,bestPick=null;
    for(const c of cases){const pick=caseLikelySuspect(c);
      if(pick&&pick.confidence>=2&&(!bestPick||pick.confidence>bestPick.confidence)){bestCase=c;bestPick=pick;}}
    if(bestCase&&bestPick){
      const strat=0.85, opp=clamp(0.25+bestPick.confidence*0.12,0.1,1.0);
      const score=W.strat*strat + W.opp*opp - W.risk*riskTerm*0.5 + inertia("accuse");
      out.push({key:"accuse",score,plan:()=>{accuseSuspect(bestCase.id,bestPick.suspectId);return true;}});
    }
  }
  // OBJECTIVE: Lie Low — value rises with risk; cheap insurance when hot
  {
    const strat=0.1, opp=0.4*riskTerm;
    const score=W.strat*strat + W.opp*opp + W.risk*riskTerm*0.4 + inertia("lielow");
    out.push({key:"lielow",score,plan:()=>planLieLow(av)});
  }
  return out;
}

// ---- approach-then-act (§2.4 positioning) ----
// runAvatarOp does NOT path the avatar; it requires being in range already. For positional ops
// (sabotage on a building, surveil/frame/assassinate on a pawn) the brain must walk the avatar
// adjacent first. tryOp() fires immediately if in range; otherwise it sets a goto + remembers the
// pending op, and the next brain ticks complete it on arrival.
function avatarInRange(av,opKey,tgt){
  const op=AVATAR_OPS[opKey];if(!op)return false;
  if(!op.target)return true;                       // self/broadcast op
  if(!tgt)return false;
  // Use the SAME range test runAvatarOp uses (inOpRange / Euclidean), so the walk-to-target stops exactly
  // where the op will actually fire — otherwise the avatar arrives "Chebyshev-close" but runAvatarOp's
  // stricter Euclidean check rejects it ("Move closer"), silently dropping the pending op.
  if(typeof inOpRange==="function")return inOpRange(av,op,tgt);
  const tx=(tgt.kind==="s"||tgt.px==null)?tgt.x:tgt.px, ty=(tgt.kind==="s"||tgt.py==null)?tgt.y:tgt.py;
  return CHEB(Math.round(av.px),Math.round(av.py),Math.round(tx),Math.round(ty))<=Math.max(1,Math.ceil(op.range||1.5));
}
function tryOp(av,opKey,tgt){
  const op=AVATAR_OPS[opKey];if(!op)return false;
  if(!op.target||!tgt){return runAvatarOp(opKey,tgt);}           // no positioning needed
  if(avatarInRange(av,opKey,tgt)){                                // already adjacent -> fire
    av._pendingOp=null;
    return runAvatarOp(opKey,tgt);
  }
  // out of range -> walk there, remember what to do on arrival
  const tx=(tgt.kind==="s"||tgt.px==null)?tgt.x:tgt.px, ty=(tgt.kind==="s"||tgt.py==null)?tgt.y:tgt.py;
  av.job={t:"goto",x:tx,y:ty,adj:1};
  av._pendingOp={opKey,kind:tgt.kind||(tgt.id!=null?"pawn":"s"),id:tgt.id,key:(tgt.kind==="s"||tgt.x!=null&&tgt.id==null)?K(tgt.x,tgt.y):null,since:ST.tick};
  return true;   // we took an action this tick (started moving)
}
// resolve a pending op once the avatar arrives (called at the top of avatarBrainTick)
function resolvePendingOp(av){
  const pend=av._pendingOp;if(!pend)return false;
  // give up if we've been trying too long (stuck path) — §2.6 edge case
  if(ST.tick-pend.since>TPD*0.5){av._pendingOp=null;return false;}
  // re-resolve the target object from the saved descriptor
  let tgt=null;
  if(pend.kind==="pawn"&&pend.id!=null)tgt=ST.pawns.find(p=>p.id===pend.id);
  else if(pend.key)tgt=ST.structs.get(pend.key);
  if(!tgt||(tgt.hp!=null&&tgt.hp<=0)){av._pendingOp=null;return false;}   // target gone
  if(tgt.kind==null)tgt.kind=pend.kind;
  if(avatarInRange(av,pend.opKey,tgt)){
    const opKey=pend.opKey;av._pendingOp=null;
    return runAvatarOp(opKey,tgt);
  }
  // still walking — keep the goto alive if it got cleared
  if(!av.job||av.job.t!=="goto"){
    const tx=tgt.kind==="s"?tgt.x:tgt.px, ty=tgt.kind==="s"?tgt.y:tgt.py;
    av.job={t:"goto",x:tx,y:ty,adj:1};
  }
  return true;   // in transit
}

// ---- CHAIN-RESOLVERS (§2.3 chain-resolver) — turn an objective into a concrete op call ----
// each returns true if it launched/handled an action this tick
function planNetwork(av){
  // recruit a ripe wisp if one's nearby + cheap; else gather intel; else surveil to build dossiers
  const m=M();
  // prefer surveil on a high-value unmapped target if we have intel to spend (builds future strikes)
  if((m.intel||0)>=AVATAR_OPS.surveil.cost){
    const st=pickTarget(av,"surveil");
    if(st&&!routineKnownEnough(st)){
      st.kind="pawn";if(tryOp(av,"surveil",st))return true;
    }
  }
  return runAvatarOp("intel",null);   // intel is free + always available
}
function planWeaken(av){
  // find a sabotage-able building not currently guarded, head there
  let best=null,bd=1e9;
  for(const s of ST.structs.values()){if(s.bp)continue;const d=DEF[s.type];if(!d||!(d.utility||d.security||d.civic))continue;
    if(s.guardedUntil&&ST.tick<s.guardedUntil)continue;
    const dist=DIST(av.px,av.py,s.x,s.y);if(dist<bd){bd=dist;best=s;}}
  if(best){best.kind="s";if(tryOp(av,"sabotage",best))return true;}
  return planNetwork(av);   // nothing to hit -> fall back
}
// VULNERABLE-WINDOW TIMING (§9.4) — turn the surveil dossier into a planning substrate. A target's
// routine.vulnerable says WHEN they're exposed ("night"/"evening"/"commute"). The autonomous operative
// reads its own intelligence and strikes AT that window — waiting and pre-positioning rather than attacking
// whenever. This converts surveillance into anticipation: you watch the operative bide its time, then hit.
function inVulnerableWindow(tgt){
  if(!tgt||!tgt.routine||!tgt.routine.vulnerable)return true;   // no window mapped -> no timing constraint
  const when=tgt.routine.vulnerable.when;
  const hr=hourN();   // 0..24, day starts 06:00
  if(when==="night")    return hr>=22||hr<5;
  if(when==="evening")  return hr>=18&&hr<23;
  if(when==="commute")  return (hr>=6&&hr<9)||(hr>=17&&hr<19);  // morning/evening commute
  return true;   // unknown window descriptor -> don't block
}
function planEliminate(av,tgt){
  if(!tgt||tgt.hp<=0)return planNetwork(av);
  tgt.kind="pawn";
  // chain: if routine not known well enough, surveil; else if not weakened, soften via frame; else strike
  if(!routineKnownEnough(tgt)){
    if((M().intel||0)>=AVATAR_OPS.surveil.cost&&tryOp(av,"surveil",tgt))return true;
    return planNetwork(av);
  }
  const weakened=(tgt.hp||100)<60||tgt.framed||tgt.homeless||(tgt.routine&&tgt.routine.vulnerable);
  if(!weakened){
    // try to set up a frame (needs prior bribe) to discredit/weaken; else just surveil more / network
    if(av.opsDone&&av.opsDone.bribe&&tryOp(av,"frame",tgt))return true;
    return planNetwork(av);
  }
  // §9.4 — STRIKE AT THE WINDOW. If the dossier gives a vulnerable window and it's NOT that window yet,
  // the operative holds: it pre-positions near the target's known location and waits, rather than striking
  // at a bad time. When the window opens (or there's no window to wait for), it commits the kill.
  if(tgt.routine&&tgt.routine.vulnerable&&!inVulnerableWindow(tgt)){
    // pre-position: move toward the target's known home/work location and bide time until the window
    const loc=(tgt.routine.vulnerable.where==="home"&&tgt.routine.home)?tgt.routine.home
             :(tgt.routine.work||tgt.routine.home);
    if(loc&&loc.x!=null){av.job={t:"goto",x:loc.x,y:loc.y,adj:1};}
    av._autoOpCd=ST.tick+RI(60,140);   // wait a beat, re-evaluate (the window may open soon)
    return true;
  }
  // window is open (or none mapped) -> strike
  if(tryOp(av,"assassinate",tgt))return true;
  return planNetwork(av);
}
function planLieLow(av){
  // use the existing go-to-ground if available, else just drop ops and rest
  if(typeof goToGround==="function"){goToGround();}
  av._autoOpCd=ST.tick+RI(Math.floor(TPD*0.2),Math.floor(TPD*0.4));   // wait out heat
  return true;
}

// ---- THE DECISION FUNCTION (§2.8) — called from pawnTick when avatar is on AUTO ----
// STANCE STRATEGY (§9.1) — decide whether the autonomous movement should be hidden or open. The pivot to
// OPEN is a major escalation: it should happen when the movement is strong enough to weather the regime's
// militarized reprisal — high support, several cells, and grip already softened. Going open too early gets
// the network crushed; too late wastes the momentum. Lay Low posture never goes open; Revolucionario is eager.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  EMERGENT IDENTITY LAYER  (design doc §9.2 doctrine + §9.3 legend + §9.5 chronicle)
//  The autonomous campaign GROWS A CHARACTER from what the operative actually does. Doctrine is earned
//  from op-history (not chosen); legend (feared vs beloved) becomes a real strategic force; and the
//  chronicle auto-narrates the playthrough into a story feed. All local; reads avatarRep()/opsDone.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// ── §9.2 EMERGENT DOCTRINE ──────────────────────────────────────────────────────────────────────
// The operative EARNS an ideological identity from the ops they favor, rather than picking one up front:
//   VANGUARD  — violence-led (sabotage + assassinate dominate): strikes hit harder, fear runs ahead.
//   ORGANIZER — support-led (dissent + recruiting dominate): propaganda spreads further, people rally.
//   SHADOW    — subtlety-led (surveil + blackmail + frame dominate): the network stays quieter, leaks less.
// Earned once a clear behavioral lean emerges (enough ops + a dominant category), then feeds back as a
// soft modifier (read by the ops + insurrection systems). It can SHIFT if behavior changes markedly.
const DOCTRINE_DEF={
  vanguard: {label:"Vanguard",  blurb:"violence-led \u2014 the regime fears the strike"},
  organizer:{label:"Organizer", blurb:"support-led \u2014 the people are the weapon"},
  shadow:   {label:"Shadow",    blurb:"subtlety-led \u2014 unseen hands, deniable blows"},
};
function doctrineProfile(av){
  // tally the operative's successful ops into the three doctrinal buckets
  const od=(av&&av.opsDone)||{};
  const violence=(od.sabotage||0)+(od.assassinate||0)+(od.steal||0);
  const support =(od.dissent||0)+(od.bribe||0);                 // overt people-work
  const subtle  =(od.surveil||0)+(od.blackmail||0)+(od.frame||0)+(od.intel||0)*0.25;
  return {violence,support,subtle,total:violence+support+subtle};
}
function evaluateDoctrine(av){
  if(!av)return;
  const p=doctrineProfile(av);
  if(p.total<5)return;                       // need a real track record before an identity forms
  // which bucket dominates? require a clear lead (>40% of weighted ops) to declare/shift
  const ranked=[["vanguard",p.violence],["organizer",p.support],["shadow",p.subtle]].sort((a,b)=>b[1]-a[1]);
  const [topKey,topVal]=ranked[0];
  if(topVal/p.total<0.4)return;              // no clear lean yet — stays whatever it was
  if(M().doctrine!==topKey){
    const first=!M().doctrine;
    M().doctrine=topKey;
    const D=DOCTRINE_DEF[topKey];
    log("\u25c8 Your operative's methods have hardened into a DOCTRINE: "+D.label+" \u2014 "+D.blurb+".",first?"good":"info");
    chronicle&&chronicle((first?"The cell found its doctrine \u2014 ":"The cell's doctrine shifted to ")+D.label+".","\u25c8");
  }
}
// the soft feedback: a small multiplier other systems read by doctrine. Returns 1.0 if no doctrine yet.
function doctrineMod(kind){
  const dt=M().doctrine;if(!dt)return 1;
  // kind: "strike" (sabotage/assassinate force) | "support" (dissent spread) | "stealth" (exposure leak)
  if(dt==="vanguard"&&kind==="strike")return 1.25;
  if(dt==="organizer"&&kind==="support")return 1.25;
  if(dt==="shadow"&&kind==="stealth")return 0.75;   // LESS exposure leak (quieter)
  return 1;
}

// ── §9.3 THE LEGEND LOOP ────────────────────────────────────────────────────────────────────────
// avatarRep() (-100 feared .. +100 beloved) stops being cosmetic and becomes a STRATEGIC FORK:
//   FEARED path  (rep <= -35): coercion gets cheaper/easier (bribe + blackmail land harder), BUT
//                 recruitment dries up (people won't join a monster) and the regime escalates (fear = threat).
//   BELOVED path (rep >= +35): support + defections COMPOUND (people flock to a hero), BUT you have no
//                 coercive leverage (a beloved figure can't credibly threaten).
// These are read live by recruitWisp (recruitment) + insurrectionTick (support drift / regime response).
const LEGEND_FEARED=-35, LEGEND_BELOVED=35;
function legendTier(){const r=avatarRep();return r<=LEGEND_FEARED?"feared":r>=LEGEND_BELOVED?"beloved":"neutral";}
// recruitment multiplier: feared operatives struggle to recruit; beloved ones recruit readily.
function legendRecruitMod(){const t=legendTier();return t==="feared"?0.55:t==="beloved"?1.4:1;}
// support-drift multiplier: a beloved figure's mere presence compounds support; a feared one suppresses it.
function legendSupportMod(){const t=legendTier();return t==="feared"?0.8:t==="beloved"?1.25:1;}
// does the operative currently have COERCIVE leverage? (feared = yes, beloved = no — they're too clean)
function legendHasLeverage(){return legendTier()!=="beloved";}

// announce legend-tier crossings once, so the shift is a visible story beat (called from the brain check)
function evaluateLegend(av){
  const t=legendTier();
  if(t===ST._lastLegendTier)return;
  ST._lastLegendTier=t;
  if(t==="feared"){
    log("\u25c8 Your operative is now FEARED across the district \u2014 coercion comes easy, but few will join a monster, and the regime treats you as a threat to crush.","warn");
    chronicle&&chronicle("The operative became a figure of fear in the district.","\u2620");
  } else if(t==="beloved"){
    log("\u25c8 Your operative is now BELOVED \u2014 people flock to the cause and defect to your side, though you've no leverage to coerce anyone.","good");
    chronicle&&chronicle("The operative became beloved \u2014 a hero of the block.","\u2665");
  }
}

// ── §9.5 AUTO-NARRATED CHRONICLE (campaign beats) ───────────────────────────────────────────────
// During autonomous play, narrate the campaign's turning points into the chronicle so a spectated game
// reads as a STORY, not a log. Milestone-driven (fires once per threshold crossed), throttled, local.
function chronicleTick(){
  if(!ST._chronMarks)ST._chronMarks={};
  const M0=ST._chronMarks, m=M(), reg=REG();
  function once(key,text,icon){if(!(key in M0)){M0[key]=ST.tick;chronicle&&chronicle(text,icon||"\u25c6");}}
  // grip milestones (the long arc toward liberation)
  const grip=reg.grip!=null?reg.grip:60;
  if(grip<=45&&grip>30)once("grip45","The regime's grip on the block is slipping \u2014 below half, and the streets feel it.","\u26d3");
  if(grip<=30&&grip>15)once("grip30","The regime is losing the district \u2014 its hold has cracked open.","\u26d3");
  if(grip<=15)once("grip15","The regime's authority is in freefall \u2014 liberation is within reach.","\u26d3");
  // support milestones (the movement rising)
  const sup=m.support||0;
  if(sup>=40&&sup<60)once("sup40","The movement has real roots now \u2014 a sizable share of the block is behind the cause.","\u270a");
  if(sup>=60&&sup<80)once("sup60","The cause has become a popular tide \u2014 most of the district leans your way.","\u270a");
  if(sup>=80)once("sup80","The district belongs to the movement \u2014 the people have chosen their side.","\u270a");
  // network milestones
  if((m.cells||0)>=3)once("cells3","A true clandestine network has taken shape \u2014 multiple cells, coordinated.","\u25c8");
  // first open insurrection is already chronicled by the stance decision; nothing to add here.
}

function avatarStanceDecision(av){
  const m=M(),reg=REG();
  const post=ST.avatarPosture||"normal";
  if(post==="laylow")return;                       // lying low never declares open insurrection
  const support=m.support||0, cells=m.cells||0, grip=reg.grip!=null?reg.grip:60, exposure=m.exposure||0;
  // strength score: are we ready to fight in the open?
  const strong = support>=60 && cells>=2 && grip<=45;
  const veryStrong = support>=72 && grip<=35;      // overwhelming — go open even if cautious
  const eager = post==="revolucionario";           // revolucionario pivots sooner
  if(m.stance==="hidden"){
    const goOpen = veryStrong || (strong && (eager || support>=66));
    if(goOpen){
      m.stance="open";
      log("\u2691 The movement goes LOUD \u2014 your operative judges the moment ripe and declares OPEN insurrection. The regime will answer in force.","warn");
      chronicle&&chronicle("The insurrection went open \u2014 the operative judged the movement strong enough to fight in the daylight.","\u2691");
      banner&&banner("OPEN INSURRECTION","warn");
    }
  } else {
    // RETREAT to hidden if the open fight is going badly (network gutted, support collapsing) — survive to fight on
    const collapsing = (support<40 && cells<1) || exposure>85;
    if(collapsing && !eager){                       // revolucionario won't retreat; it commits
      m.stance="hidden";
      log("\u25d1 The open fight is faltering \u2014 your operative pulls the network back into the shadows to regroup.","info");
      chronicle&&chronicle("The operative pulled the insurrection back underground to survive.","\u25d1");
    }
  }
}
function avatarBrainTick(av){
  if(!av||av.activeOp||av.jailed)return;          // busy/held -> nothing to decide (§2.6 edge cases)
  // first: if we're mid-approach to a staged op, complete it on arrival (don't re-decide)
  if(av._pendingOp){if(resolvePendingOp(av))return;}
  if(av._pendingTalk){if(resolvePendingTalk(av))return;}   // mid-approach to a conversation -> open on arrival
  if(ST.tick<(av._autoOpCd||0))return;            // decision cooldown (§2.7 anti-oscillation #2)
  // STANCE DECISION (§9.1) — on AUTO the operative decides hidden vs open insurrection. It plays a patient
  // infiltration game while HIDDEN (build support, intel, cells), then declares OPEN insurrection once the
  // movement is strong enough to survive the regime's militarized response. That pivot is the watchable
  // "act break". Checked occasionally (not every tick) so it's a deliberate strategic move.
  if(ST.tick%200===0)avatarStanceDecision(av);
  // EMERGENT IDENTITY (§9.2/9.3/9.5) — periodically re-derive doctrine from behavior, check legend-tier
  // crossings, and narrate campaign milestones. Cheap; runs on the same cadence as the stance check.
  if(ST.tick%200===0){evaluateDoctrine(av);evaluateLegend(av);}
  if(ST.tick%120===0)chronicleTick();
  // 1) survival filter (§2.8 step 1) — response curve; revolucionario tolerates more
  const surv=curveSurvival(av), tol=(ST.avatarPosture==="revolucionario")?0.85:0.6;
  if(surv>=tol){av._autoOpCd=ST.tick+RI(40,90);return;}  // let normal needs-AI take over this tick
  // 2) score objectives, 3) pick best above floor (§2.6 idle/observe fallback)
  const objs=scoreObjectives(av);
  objs.sort((a,b)=>b.score-a.score);
  const FLOOR=0.35;
  const best=objs[0];
  if(!best||best.score<FLOOR){                    // idle/observe fallback — never force a bad op
    av._autoOpCd=ST.tick+RI(60,140);
    return;
  }
  // 4) inertia bookkeeping (§2.7 #3): bonus to staying on the same objective, decays
  if(ST._avatarObjective===best.key){ST._avatarInertia=Math.min(2,(ST._avatarInertia||0)+1);}
  else {ST._avatarObjective=best.key;ST._avatarInertia=1;}
  // 5) resolve the objective into a concrete op + commit
  let launched=false;
  try{launched=best.plan();}catch(e){launched=false;}
  // 6) cooldown before next decision (§2.7 #2) — commit-to-completion handles the in-flight op
  av._autoOpCd=ST.tick+RI(Math.floor(TPD*0.15),Math.floor(TPD*0.35));
}

// the entry point but now stages rather than resolves. Targets are stored as ID/key (never object refs)
// so saves stay clean.
function inOpRange(av,op,target){
  if(!op.target)return true;                 // self/broadcast ops have no positional gate
  if(!target)return false;
  if(op.target==="utility"){ // a structure
    return DIST(av.px,av.py,target.x+0.5,target.y+0.5)<=op.range;
  }
  return DIST(av.px,av.py,target.px,target.py)<=op.range;   // a pawn
}
// resolve a target descriptor {kind, id|key} into the live object (or null if it's gone).
function resolveOpTarget(desc){
  if(!desc)return null;
  if(desc.kind==="s")return ST.structs.get(desc.key)||null;
  if(desc.kind==="pawn")return ST.pawns.find(p=>p.id===desc.id)||null;
  return null;
}
// STAGE an op: validate, then attach an activeOp to the avatar (the perform phase runs in pawnTick).
// ═══════════════ OP READOUT — cyberpunk hacker terminal over the avatar during an op ═══════════════
// While the avatar performs a staged op, a small terminal panel streams console lines above them
// (>RUNNING EXPLOIT... >BYPASSING ICE...), building suspense, then resolves into the verdict
// (>ACCESS GRANTED / >TRACE FAILED) tinted by the outcome band. Purely visual — rides on the existing
// staged-op lifecycle and the banded roll that already happened in resolveAvatarOp.
let OPREADOUT=null;
// per-op flavour: a boot line + a few "working" lines that stream as the act progresses. Generic fallback
// covers any op without bespoke text.
const OP_TERM_SCRIPT={
  sabotage:{boot:"BREACHING GRID NODE",work:["MAPPING POWER BUS","INJECTING FAULT","OVERLOADING RELAY"]},
  steal:   {boot:"ACCESSING ASSETS",  work:["SPOOFING CREDENTIALS","SKIMMING LEDGER","WIPING TRACE"]},
  intel:   {boot:"TAPPING DATASTREAM", work:["DECRYPTING PACKETS","PARSING CHATTER","EXTRACTING"]},
  surveil: {boot:"DEPLOYING TAP",      work:["TRACKING TARGET","LOGGING PATTERN","BUILDING DOSSIER"]},
  dissent: {boot:"SEEDING NETWORK",    work:["SPREADING SIGNAL","TURNING SENTIMENT","AMPLIFYING"]},
  bribe:   {boot:"OPENING CHANNEL",    work:["TRANSFERRING FUNDS","TESTING LOYALTY","SEALING DEAL"]},
  frame:   {boot:"FORGING EVIDENCE",   work:["PLANTING DATA","ALTERING LOGS","CLOSING LOOP"]},
  blackmail:{boot:"LOADING LEVERAGE",  work:["PRESENTING PROOF","APPLYING PRESSURE","AWAITING REPLY"]},
  assassinate:   {boot:"MARKING TARGET",    work:["CLOSING DISTANCE","LINING THE SHOT","COMMITTING"]},
  hackGrid:      {boot:"SPLICING GRID NODE",work:["MAPPING POWER BUS","INJECTING FAULT","OVERLOADING RELAY"]},
  dataHeist:     {boot:"BREACHING NETWORK", work:["BYPASSING ICE","EXTRACTING RECORDS","WIPING TRACE"]},
  corruptRecords:{boot:"ACCESSING DOSSIER", work:["FORGING ENTRIES","OVERWRITING LOGS","CLOSING LOOP"]},
};
const OP_TERM_DEFAULT={boot:"RUNNING OPERATION",work:["PROCESSING","EXECUTING","FINALIZING"]};
function opReadoutStart(opKey,op){
  const sc=OP_TERM_SCRIPT[opKey]||OP_TERM_DEFAULT;
  OPREADOUT={
    opKey, phase:"run",                       // run -> reveal -> (cleared)
    boot:sc.boot, work:sc.work.slice(),
    shown:0,                                   // how many work lines have streamed in
    verdict:null, verdictAt:0,                 // set at resolution
    t0:ST.tick
  };
}
function opReadoutResolve(p,op,band){
  if(!OPREADOUT)return;
  // map the banded roll to a terminal verdict + colour
  const V={
    critwin: {txt:"ACCESS GRANTED",  sub:"FLAWLESS",  col:"#5cff9e"},
    success: {txt:"ACCESS GRANTED",  sub:"CLEAN",     col:"#5cff9e"},
    partial: {txt:"PARTIAL BREACH",  sub:"COMPLICATED",col:"#ffd24a"},
    fail:    {txt:"ACCESS DENIED",   sub:"FAILED",     col:"#ff4757"},
    critfail:{txt:"TRACE DETECTED",  sub:"BLOWN",      col:"#ff2d55"}
  }[band]||{txt:"DONE",sub:"",col:"#22ddff"};
  OPREADOUT.phase="reveal";
  OPREADOUT.verdict=V;
  OPREADOUT.verdictAt=ST.tick;
  if(typeof SFX!=="undefined"){if((band==="fail"||band==="critfail")&&SFX.alert)SFX.alert();else if(SFX.ui)SFX.ui();}
}
// called each frame from render — advances which work lines are visible based on op progress, and
// auto-clears the panel a beat after the verdict has been shown.
function opReadoutTick(av){
  if(!OPREADOUT)return;
  if(OPREADOUT.phase==="run"){
    if(av&&av.activeOp){
      const frac=Math.max(0,Math.min(1,av.activeOp.prog/av.activeOp.duration));
      // reveal work lines progressively across the duration (leave the last sliver for the verdict)
      OPREADOUT.shown=Math.min(OPREADOUT.work.length,Math.floor(frac*(OPREADOUT.work.length+0.5)));
    } else {
      // op vanished without resolving (aborted) — clear
      OPREADOUT=null;
    }
  } else if(OPREADOUT.phase==="reveal"){
    if(ST.tick-OPREADOUT.verdictAt>140)OPREADOUT=null;   // hold the verdict ~ a couple seconds, then fade
  }
}
function runAvatarOp(opKey,target){
  const op=AVATAR_OPS[opKey];if(!op)return false;
  const m=M(),a=theAvatar();
  if(!a){flashMsg&&flashMsg("No operative");return false;}
  if(a.activeOp){flashMsg&&flashMsg("Already running an operation");return false;}
  if((m.intel||0)<op.cost){flashMsg&&flashMsg("Need "+op.cost+" intel for this op");return false;}
  if(op.needsSecret&&target&&!knownSecret(target)){flashMsg&&flashMsg("No dirt on them — surveil first");return false;}
  // §9.3 LEGEND — a BELOVED operative has no coercive leverage: people don't believe a hero would follow
  // through on a threat, so blackmail simply doesn't land. This is the price of the belief path (it trades
  // coercion for compounding support). Feared/neutral operatives can still blackmail freely.
  if(opKey==="blackmail"&&typeof legendHasLeverage==="function"&&!legendHasLeverage()){
    flashMsg&&flashMsg("You're too beloved to make a credible threat — no one believes you'd follow through");return false;}
  // ═══ HARD GATES (strict tech tree) — extreme ops require prerequisite work on the SPECIFIC target ═══
  if(opKey==="assassinate"&&target&&target.kind==="pawn"){
    // assassination demands you KNOW the target's routine (surveil) AND they're weakened/framed/isolated.
    // EXCEPTION: the government envoy is a special, time-limited target — they're exposed during the visit
    // (no district home, out in the open with the Mayor), so you can strike WITHOUT the full routine dossier.
    if(!target.isEnvoy){
      if(!routineKnownEnough(target)){flashMsg&&flashMsg("You don't know "+target.name.split(" ")[0]+"'s movements — surveil them first");return false;}
      const weakened=(target.hp||100)<60||target.framed||target.homeless||(target.routine&&target.routine.vulnerable);
      if(!weakened){flashMsg&&flashMsg("No opening — weaken, frame, or fully surveil "+target.name.split(" ")[0]+" first");return false;}
    }
  }
  if(opKey==="frame"&&target){
    // framing requires you've already corrupted the ground — at least one bribe must have landed
    const a2=theAvatar();if(a2&&!(a2.opsDone&&a2.opsDone.bribe)){flashMsg&&flashMsg("You need leverage in place — bribe a wisp before you can frame a regime asset");return false;}
  }
  if(opKey==="sabotage"&&target&&target.kind==="s"){
    // a building under guard (recently sabotaged) can't be hit again until the watch lifts
    if(target.guardedUntil&&ST.tick<target.guardedUntil){flashMsg&&flashMsg("This building is under guard after the last strike — hit a different target");return false;}
    // sabotaging a building requires you've gathered intel on the district first (know the grid)
    if((m.intel||0)<14){flashMsg&&flashMsg("You need more intel on the grid before sabotage — gather intel first");return false;}
  }
  // HACK OPS — bypass avatar-adjacency; use Grid Tap reach instead
  if(opKey==="hackGrid"||opKey==="dataHeist"||opKey==="corruptRecords"){
    if(!hqUnlocks("hack")){flashMsg&&flashMsg("Need a Server Room at HQ for remote ops");return false;}
    if(opKey==="hackGrid"&&target&&target.kind==="s"){
      if(target.guardedUntil&&ST.tick<target.guardedUntil){flashMsg&&flashMsg("This building's grid is locked down — try another target");return false;}
      if(!hasHackReach(target)){flashMsg&&flashMsg("No Grid Tap in reach of this target");return false;}
    }
    if(opKey==="corruptRecords"&&target){
      if(!hasHackReach(target)){flashMsg&&flashMsg("No Grid Tap in reach of this target");return false;}
    }
    if(opKey==="dataHeist"){
      const anyReachable=[...ST.structs.values()].some(s=>!s.bp&&DEF[s.type]&&(DEF[s.type].roleHome==="enforcer"||DEF[s.type].roleHome==="mayor")&&hasHackReach(s));
      if(!anyReachable){flashMsg&&flashMsg("No Grid Tap in reach of a regime building");return false;}
    }
  } else {
    if(!inOpRange(a,op,target)){flashMsg&&flashMsg("Move closer to begin this operation");return false;}
  }
  // build a serialization-safe target descriptor
  let desc=null;
  if(op.target==="utility"&&target)desc={kind:"s",key:K(target.x,target.y)};
  else if(target&&target.id!=null)desc={kind:"pawn",id:target.id};
  a.activeOp={opKey,target:desc,prog:0,duration:op.duration,startTick:ST.tick,anim:op.anim};
  a.job=null;                                 // the op supersedes normal AI (intercepted in pawnTick)
  opReadoutStart(opKey,op);                   // boot the on-screen hacker terminal for this op
  if(typeof SFX!=="undefined"&&SFX.ui)SFX.ui();
  log("\u25b8 Operation underway: "+op.name+"\u2026","info");
  return true;
}
// advance an in-flight op each tick; resolve on completion, abort if the target vanishes.
function advanceActiveOp(p){
  const ao=p.activeOp;if(!ao)return;
  const op=AVATAR_OPS[ao.opKey];if(!op){p.activeOp=null;return;}
  // target gone mid-op -> abort cleanly
  let _tgt=null;
  if(op.target){_tgt=resolveOpTarget(ao.target);
    if(!_tgt){log("\u25b8 Operation aborted \u2014 the target slipped away.","warn");p.activeOp=null;return;}}
  // ── SURVEIL = ACTIVE TAIL — for surveillance ops, the operative SHADOWS the target (follows them at a
  //    distance) and risks being SPOTTED. This makes tailing tense + skill-driven instead of a freeze-in-place
  //    timer. The avatar paths to stay near the mark; periodic detection rolls check if the mark notices.
  if((ao.opKey==="surveil"||ao.opKey==="tail")&&_tgt&&_tgt.kind==="pawn"){
    const tp=_tgt;
    const d=DIST(p.px,p.py,tp.px,tp.py);
    // FOLLOW — keep a tailing distance: close enough to observe (within sightRange), not on top of them.
    // If they've drifted too far, move to shadow them (a tail-specific goto that doesn't end the op).
    const tailDist=Math.max(2.5,(op.range||3.5)-0.5);
    if(d>tailDist){const gx=tp.px|0,gy=tp.py|0;
      // step toward the target without overshooting onto them
      gotoCell(p,gx,gy,1);
    }
    // DETECTION ROLL — every ~30 ticks, the mark may notice the tail. Chance scales with how visible you are
    // (canSee composes distance/darkness/the mark's attention) vs your tradecraft. Closer + in-the-open = riskier.
    if(ao.prog>0&&ao.prog%30===0){
      const vis=(typeof canSee==="function")?canSee(tp,p,op):0.5;   // 0 (hidden) .. ~1+ (glaring)
      const tradecraft=(typeof ops==="function")?ops(p,"tradecraft"):5;   // 1..10 operative stat
      // base spot chance from visibility, reduced by tradecraft (1-10); closer than tailDist raises it
      let spotChance=Math.max(0,vis*0.35 - (tradecraft-5)*0.03);   // high tradecraft (10) ≈ -0.15; low (1) ≈ +0.12
      if(d<2.2)spotChance+=0.12;                                    // shadowing too close
      spotChance=Math.max(0.02,Math.min(0.6,spotChance));
      if(Math.random()<spotChance){
        // CAUGHT TAILING — the op blows: the mark notices, exposure spikes, they grow wary, regime may hear.
        const m=M();
        m.exposure=clamp((m.exposure||0)+RI(6,12)*resolveMod(),0,100);
        REG().awareness=clamp((REG().awareness||0)+RI(2,5),0,100);
        relAdj(p.id,tp.id,-10);
        if(typeof tryEmote==="function")tryEmote(tp,"angry",100);
        float(tp.px,tp.py,"SPOTTED YOU","#ff5470");
        log("\u25b8 "+tp.name.split(" ")[0]+" caught you tailing them \u2014 the surveillance is blown, and you're exposed.","warn");
        if(SFX&&SFX.alert)SFX.alert();
        p.activeOp=null;OPREADOUT=null;
        return;
      }
    }
  }
  ao.prog++;
  if(ao.prog>=ao.duration)resolveAvatarOp(p);
}
// fire the banded roll + consequences on completion (this is the former runAvatarOp body).
function resolveAvatarOp(p){
  const ao=p.activeOp;if(!ao){return;}
  const op=AVATAR_OPS[ao.opKey];const m=M();
  const target=op.target?resolveOpTarget(ao.target):null;
  // tag the live object with the kind hint the consequence fns expect
  if(target){if(ao.target.kind==="s")target.kind="s";else target.kind="pawn";}
  p.activeOp=null;                            // op is done regardless of outcome
  const expPenalty=Math.floor((m.exposure||0)/25);     // +0..4 to difficulty
  // PERCEPTION: witnesses who can see you right now raise the difficulty. Computed at resolve, so a wisp
  // who wandered into view mid-op still counts — long ops in busy places are genuinely riskier.
  const wit=witnessPenalty(p,op);
  // FEAR RESISTANCE — for social-leverage ops (bribe/blackmail) on a wisp who has WITNESSED your brutality,
  // their fear of you makes them harder to deal with: they don't want to be near you, and they're terrified
  // the regime will learn they took your money. Scales with how fresh/severe what they saw was.
  let fearPen=0;
  if((ao.opKey==="bribe"||ao.opKey==="blackmail")&&target&&target.kind==="pawn"){
    const fear=witnessFear(target);
    if(fear>0)fearPen=Math.min(8,Math.round(fear*4));   // up to +8 difficulty for a fresh kill-witness
  }
  // HOME VULNERABILITY: desperate/exposed targets are easier to bribe, coerce, or rob.
  // Only applies to the three social/physical ops that target a pawn directly.
  const VULN_OPS=new Set(["bribe","blackmail","steal"]);
  const vulnPen=(VULN_OPS.has(ao.opKey)&&target&&target.kind==="pawn")
    ?homeVulnerability(target,ao.opKey):0;
  const check=opsCheck(op.stat,op.diff+expPenalty+wit.pen+fearPen-vulnPen+gearMod(ao.opKey,"diff")+traitMod(target,ao.opKey));
  ao._witCount=wit.count;ao._witPen=wit.pen;           // remembered for the post-act fallout
  m.intel-=op.cost;
  trainOpStat(op.stat);                                // practice regardless of outcome
  switch(check.band){
    case "critwin":
      opSuccess(ao.opKey,target,check,true);
      m.exposure=clamp((m.exposure||0)+1,0,100);
      break;
    case "success":
      opSuccess(ao.opKey,target,check,false);
      m.exposure=clamp((m.exposure||0)+4,0,100);
      break;
    case "partial":
      opPartial(ao.opKey,target,check);
      m.exposure=clamp((m.exposure||0)+8,0,100);
      break;
    case "critfail":
      opFailure(ao.opKey,target,check,true);
      break;
    default:
      opFailure(ao.opKey,target,check,false);
      break;
  }
  // hand the verdict to the terminal readout so it can resolve the suspense into SUCCESS/FAIL on screen
  opReadoutResolve(p,op,check.band);
  runWitnessCheck(p,op,check,ao._witCount,ao._witPen);   // who saw it → fallout
  if(typeof syncHUD==="function")syncHUD();
  if(typeof renderInspect==="function")renderInspect();
}
// post-act fallout from being seen. Generalizes witnessCrime: witnesses escalate awareness/heat; an
// enforcer witness can mark you; a botched op in front of people is the worst case.
function runWitnessCheck(p,op,check,witCount,witPen){
  if(!witCount)return;                          // nobody saw — clean getaway, no extra fallout
  const m=M();const botch=check.band==="critfail";const failed=check.band==="fail"||botch;
  // awareness/heat rise with how many saw + how badly it went
  const sev=(witCount*1.5)+(failed?6:0)+(botch?6:0);
  if(REG())REG().awareness=clamp((REG().awareness||0)+sev,0,100);
  ST.heat=Math.min(100,(ST.heat||0)+Math.round(sev*0.6));
  // an enforcer who can see you marks you (pursuit fuel) — especially on a visible failure
  const enf=ST.pawns.find(q=>(q.role==="enforcer"||q.regimeForce)&&canSee(q,p,op)>0);
  if(enf){
    tryEmote&&tryEmote(enf,"excl",120);
    if(botch||failed||Math.random()<0.5){enf.grudgeTarget=p.id;relAdj(enf.id,p.id,-20);
      log("\u2696 An enforcer saw you \u2014 you've been marked.","bad");}
  } else if(botch){
    log("\u26a0 You were seen botching it \u2014 word will spread.","warn");
  }
  // witnesses emote alarm; sympathizers may just look away
  let alarmed=0;
  // LASTING WITNESS MEMORY (Phase 2 deepening) — beyond the immediate alarm, a witness to a SERIOUS op
  // carries it forward: it durably colors how they regard the operative. Recorded here, acted on over time
  // by witnessMemoryTick (fear-informing, allegiance drift, decay). Severity scales with the op's loudness.
  const sevK=(op&&op.witnessK!=null?op.witnessK:1);
  for(const q of ST.pawns){const w=canSee(q,p,op);if(w<=0||pawnGang(q)||q.recruited)continue;   // your own cell doesn't turn on you
    if(alarmed<3&&(q.allegiance||0)<25){tryEmote&&tryEmote(q,alarmed===0?"excl":"shock",90);alarmed++;}
    // only ops with real weight leave a lasting mark (a quiet bribe seen in passing doesn't haunt anyone)
    if(sevK<0.7)continue;
    q._opWit=q._opWit||[];
    q._opWit.push({op:op===AVATAR_OPS.assassinate?"kill":opKindLabel(op),sev:sevK*w,at:ST.tick,botched:botch});
    if(q._opWit.length>6)q._opWit.shift();
    // immediate durable shift: brutality (kill/sabotage) FRIGHTENS — a fearful wisp recoils from the cause,
    // a hardliner hardens against you; seeing it botched makes you look dangerous AND incompetent.
    const fearful=(q.pers&&(q.pers.cau||50)>55)||(q.allegiance||0)<-10;
    if(sevK>=1.2){   // a killing or heavy sabotage
      if((q.allegiance||0)>20){q.allegiance=clamp((q.allegiance||0)-RI(6,14),-100,100);   // a sympathizer is shaken
        remember(q,"saw the operative do something brutal — maybe this cause isn't what I thought");}
      else{q.disillusion=clamp((q.disillusion||0)-RI(2,6),0,100);                          // a neutral/hostile just fears you
        remember(q,"watched the operative kill — I'll keep my mouth shut and my head down");}
    }
  }
}
// a short label for what kind of act a witness saw (for their memory record)
function opKindLabel(op){if(!op)return "something";
  const n=op.name||"";
  if(/assassin/i.test(n))return "kill";
  if(/sabotage/i.test(n))return "sabotage";
  if(/frame/i.test(n))return "frame";
  if(/rob|steal/i.test(n))return "robbery";
  if(/blackmail/i.test(n))return "blackmail";
  return "op";
}
// HOW AFRAID is this wisp of the avatar, from what they personally witnessed? Returns 0 (no memory / faded)
// up to ~1+ (fresh memory of something brutal). Drives bribe-resistance and flee-on-sight. Recency-weighted:
// a fresh kill terrifies; an old or minor memory barely registers. Gang/recruited cell are never afraid of you.
function witnessFear(q){
  if(!q||!q._opWit||!q._opWit.length||pawnGang(q)||q.recruited)return 0;
  let f=0;
  for(let i=0;i<q._opWit.length;i++){const w=q._opWit[i];
    const recency=1-Math.min(1,(ST.tick-w.at)/(TPD*3));   // 1 fresh → 0 at 3 days
    if(recency<=0)continue;
    f+=w.sev*recency;                                      // heavier acts seen more recently scare more
  }
  return f;
}
// WITNESS MEMORY OVER TIME — process the lasting marks left by witnessed ops. Fresh witnesses to brutal
// acts are a standing liability: a loyal/high-integrity one may decide to INFORM (feeding the regime's
// informant network) even well after the act; fear and memory FADE over time (people move on); and a
// witness's allegiance keeps drifting from what they saw. Runs on a slow cadence (this is a slow burn).
function witnessMemoryTick(){
  if(ST.tick%150!==0)return;
  const reg=REG();
  for(const q of ST.pawns){
    if(!q._opWit||!q._opWit.length||q.hp<=0||isChild(q)||q.recruited)continue;
    // DECAY — drop marks older than ~3 days (memory/fear fades); clear the array when empty
    q._opWit=q._opWit.filter(w=>ST.tick-w.at<TPD*3);
    if(!q._opWit.length){q._opWit=null;continue;}
    // freshest, heaviest mark drives current behavior
    const worst=q._opWit.reduce((a,b)=>b.sev>a.sev?b:a,q._opWit[0]);
    const recency=1-Math.min(1,(ST.tick-worst.at)/(TPD*3));   // 1 fresh → 0 stale
    // LATER INFORMING — a witness who isn't already informing, leans loyalist/principled, and saw something
    // serious may decide to talk. The chance scales with severity + recency + their disposition. This is the
    // delayed teeth of perception: acting brazenly in front of the wrong person catches up with you.
    if(!q.informant&&!q.recruited&&(q.allegiance||0)<15){
      const principled=((q.pers&&q.pers.intg)||50)>58;
      const loyalist=(q.allegiance||0)<-20;
      const base=(loyalist?0.06:0)+(principled?0.04:0);
      const chance=base*worst.sev*recency;
      if(chance>0&&Math.random()<chance){
        q.informant=true;if(reg&&reg.informants&&!reg.informants.includes(q.id))reg.informants.push(q.id);
        if(reg)reg.awareness=clamp((reg.awareness||0)+RI(4,9),0,100);
        remember(q,"told the regime what the operative did — someone had to");
        log("\u2696 "+q.name+" came forward about something they witnessed \u2014 the regime is listening.","warn");
        q._opWit=null;   // they've acted on it
        continue;
      }
    }
    // SLOW ALLEGIANCE DRIFT from carrying the memory — a fearful witness keeps edging away from the cause
    if(recency>0.5&&worst.sev>=1.2&&Math.random()<0.25){
      q.allegiance=clamp((q.allegiance||0)-RI(1,3),-100,100);
    }
  }
}
function opSuccess(opKey,target,check,crit){
  const m=M();
  // track which op TYPES the operative has successfully pulled off — the hard-gate tech tree reads this
  // (e.g. frame requires a prior bribe). Also marks per-target progress where relevant.
  const av=theAvatar();if(av){av.opsDone=av.opsDone||{};av.opsDone[opKey]=(av.opsDone[opKey]||0)+1;}
  switch(opKey){
    case "sabotage":{
      if(target&&target.kind==="s"){
        target.sabotaged=ST.tick+Math.floor(TPD*R(1.0,1.5))*(crit?2:1);   // crit: double the outage
        const util=DEF[target.type]&&DEF[target.type].utility;
        if(util==="power"){ST.blackoutUntil=ST.tick+Math.floor(TPD*R(0.4,0.7));}
        ST.heat=Math.min(100,(ST.heat||0)+8);
        m.support=clamp((m.support||0)+(crit?10:6),0,100);              // a visible blow rallies people
        REG().grip=Math.max(0,(REG().grip||60)-(crit?9:5)*doctrineMod("strike"));   // §9.2 Vanguard hits harder
        // ── record the CRIME SCENE so the full loop (repair + investigation) can play out ──
        registerSabotage(target,theAvatar(),crit);
        // GUARD POSTED — after a strike, the regime watches this building. Repeat sabotage of the SAME
        // target is locked down for a while (stops blackout-spam; forces you to vary your targets).
        target.guardedUntil=ST.tick+Math.floor(TPD*R(2.5,4.0));
        log("\u2715 You sabotaged the "+DEF[target.type].name+" — "+(util==="power"?"the grid's down.":"the block runs dry.")+(crit?" A flawless strike — the regime reels hard.":" The regime reels.")+" A watch goes up here now.","good");
        banner(crit?"CLEAN SABOTAGE":"SABOTAGE","good");if(SFX&&SFX.alert)SFX.alert();
        chronicle("You struck the "+DEF[target.type].name+" — "+util+" sabotage.","\u2715");
        adjAvatarRep(-6);                                      // sabotage is feared, not loved
        if(crit)m.intel=(m.intel||0)+RI(3,6);                  // crit: you also lifted intel on the way out
      }
      break;}
    case "intel":{
      const gain=RI(6,12)+Math.floor(check.margin/2)+(crit?8:0);
      m.intel+=gain;
      log("\u25c6 Your operative worked the block — +"+gain+" intel."+(crit?" A goldmine.":""),"good");
      adjAvatarRep(2);
      // PROFILE A TARGET — if a wisp is selected (or one's nearby), this intel also reveals some of their
      // hidden stats. The fog lifts a few values at a time; crit reveals more.
      {const av=theAvatar();
       let mark=ST.sel&&ST.sel[0]&&ST.sel[0].kind==="pawn"&&!ST.sel[0].isAvatar&&!isChild(ST.sel[0])?ST.sel[0]:null;
       if(!mark&&av)mark=nearestStruct?null:null;   // (no struct) — try nearest unprofiled wisp instead
       if(!mark&&av){let bd=10;for(const q of ST.pawns){if(q.isAvatar||isChild(q)||q.hp<=0)continue;if(intelProgress(q)>=1)continue;const d=DIST(av.px,av.py,q.px,q.py);if(d<bd){bd=d;mark=q;}}}
       if(mark){const newly=revealIntel(mark,crit?3:RI(1,2));
         if(newly.length){log("\u25c9 Profiled "+mark.name+" — uncovered "+newly.length+" detail"+(newly.length>1?"s":"")+".","info");}}}
      if(crit)maybeSurfaceSecret();                            // crit intel can uncover a wisp's SECRET
      break;}
    case "dissent":{
      const gain=RI(5,10)+Math.floor(check.margin/2)+(crit?6:0);
      m.support=clamp((m.support||0)+gain,0,100);
      const av=theAvatar();
      // PROPAGANDA — nearby wisps respond by LOYALTY. The disillusioned warm to you; hardened loyalists
      // (high integrity + low allegiance to the cause) resist, and one may REPORT you to the regime.
      let reported=false,resisted=0;
      if(av)for(const q of ST.pawns){if(q.isAvatar||isChild(q)||q.hp<=0)continue;if(DIST(av.px,av.py,q.px,q.py)>8)continue;
        const loyalist=(q.pers&&q.pers.intg>60)&&((q.allegiance||0)<5);
        if(loyalist){
          resisted++;
          if(!reported&&Math.random()<(crit?0.12:0.25)){reported=true;
            REG().awareness=clamp((REG().awareness||0)+RI(8,15),0,100);
            m.exposure=clamp((m.exposure||0)+RI(5,10),0,100);
            remember(q,"reported an agitator stirring up trouble on the block");
          }
        } else {
          q.allegiance=clamp((q.allegiance||0)+(crit?7:4),-100,100);
        }
      }
      if(reported){
        log("\u2687 You stirred the block (support +"+gain+") — but a loyalist informed on you. The regime takes notice.","warn");
        banner("AGITATOR REPORTED","warn");
      } else if(resisted>0){
        log("\u2687 You stirred the block — support +"+gain+". "+resisted+(resisted===1?" loyalist held out.":" loyalists held out."),"good");
      } else {
        log("\u2687 You stirred the block — support +"+gain+"."+(crit?" The crowd's electric.":""),"good");
      }
      adjAvatarRep(5);                                          // championing people earns goodwill
      break;}
    case "frame":{
      if(target&&target.kind==="pawn"){
        // MULTI-STEP FRAME — the first op PLANTS evidence; the second SPRINGS it. You can't frame someone
        // in one move — you have to lay the groundwork, then trigger the reveal.
        if(!target.framingInProgress){
          // STEP 1 — plant the evidence. Nothing public yet; the trap is set.
          target.framingInProgress={since:ST.tick,solid:crit};
          log("\u2624 You planted evidence on "+target.name+" — the frame is set, but not yet sprung. Frame them again to trigger it.","good");
          banner("EVIDENCE PLANTED","good");
          adjAvatarRep(-2);
        } else {
          // STEP 2 — spring the frame. Now it goes public and the block turns on them.
          const solid=target.framingInProgress.solid||crit;
          target.framed=true;target.allegiance=clamp((target.allegiance||0)+30,-100,100);
          REG().grip=Math.max(0,(REG().grip||60)-(solid?12:8));
          m.support=clamp((m.support||0)+(solid?8:5),0,100);
          for(const q of ST.pawns){if(q.id===target.id||isChild(q))continue;if(Math.random()<(solid?0.6:0.4))relAdj(q.id,target.id,-15);}
          log("\u2624 You sprang the frame on "+target.name+" — the block turns on a regime asset."+(solid?" Airtight — they're finished.":""),"good");
          banner("ASSET FRAMED","good");
          chronicle("You framed "+target.name+", a regime loyalist.","\u2624");
          adjAvatarRep(-4);
          if(solid&&target.role){
            log(target.name+" is disgraced out of their role.","good");
          }
          delete target.framingInProgress;
        }
      }
      break;}
    case "hackGrid":{
      if(target&&target.kind==="s"){
        target.sabotaged=ST.tick+Math.floor(TPD*R(0.8,1.2))*(crit?2:1);
        const util=DEF[target.type]&&DEF[target.type].utility;
        if(util==="power"){ST.blackoutUntil=ST.tick+Math.floor(TPD*R(0.3,0.55));}
        ST.heat=Math.min(100,(ST.heat||0)+5);                              // less heat — no scene, no witnesses
        m.exposure=Math.max(0,(m.exposure||0)-3);                          // remote: offset resolveAvatarOp's +4 → net +1 per success band
        m.support=clamp((m.support||0)+(crit?8:5),0,100);
        REG().grip=Math.max(0,(REG().grip||60)-(crit?7:4)*doctrineMod("strike"));
        registerSabotage(target,theAvatar(),crit);                         // witnesses array is empty — remote
        target.guardedUntil=ST.tick+Math.floor(TPD*R(2.0,3.5));
        log("⌕ You hacked the "+DEF[target.type].name+" remotely — "+(util==="power"?"the grid's dark.":"the block runs dry.")+(crit?" Flawless breach.":"")+" No trace at the scene.","good");
        banner(crit?"CLEAN GRID HACK":"GRID HACKED","good");if(SFX&&SFX.alert)SFX.alert();
        chronicle("Remote hack — you killed the "+DEF[target.type].name+" from the shadows.","⌕");
        adjAvatarRep(-4);
        if(crit)m.intel=(m.intel||0)+RI(4,8);
      }
      break;}
    case "dataHeist":{
      const regimeBld=[...ST.structs.values()].find(s=>!s.bp&&DEF[s.type]&&(DEF[s.type].roleHome==="enforcer"||DEF[s.type].roleHome==="mayor")&&hasHackReach(s));
      const gain=RI(14,22)+Math.floor(check.margin/2)+(crit?12:0);
      m.intel=(m.intel||0)+gain;
      REG().awareness=clamp((REG().awareness||0)+(crit?5:10),0,100);      // crit: cleaner breach, less trace
      const bldName=regimeBld?(DEF[regimeBld.type].name||"regime building"):"regime network";
      log("⌔ You breached the "+bldName+" remotely — +"+gain+" intel."+(crit?" No trace.":""),"good");
      banner(crit?"CLEAN DATA HEIST":"DATA HEIST","good");if(SFX&&SFX.alert)SFX.alert();
      chronicle("Data heist: cracked the "+bldName+" for "+gain+" intel.","⌔");
      adjAvatarRep(2);
      break;}
    case "corruptRecords":{
      if(target&&target.kind==="pawn"){
        // SINGLE-STEP digital frame — no planting, no return visit; immediate discredit
        target.framed=true;
        target.allegiance=clamp((target.allegiance||0)+25,-100,100);
        REG().grip=Math.max(0,(REG().grip||60)-(crit?10:6));
        m.support=clamp((m.support||0)+(crit?6:4),0,100);
        for(const q of ST.pawns){if(q.id===target.id||isChild(q))continue;if(Math.random()<(crit?0.5:0.3))relAdj(q.id,target.id,-12);}
        log("⌘ You overwrote "+target.name+"'s records — the regime's own data discredits them."+(crit?" Airtight falsification.":""),"good");
        banner(crit?"CLEAN CORRUPT":"RECORDS CORRUPTED","good");if(SFX&&SFX.alert)SFX.alert();
        chronicle("Remote corruption — "+target.name+"'s records falsified.","⌘");
        adjAvatarRep(-3);
        if(crit&&target.role){log(target.name+" is disgraced out of their role by falsified records.","good");}
      }
      break;}
    case "surveil":{
      // dig up the target's secret specifically (vs intel-crit which finds a random nearby one)
      if(target&&target.kind==="pawn"){
        // ROUTINE MAPPING — each surveil advances the dossier one stage (where they live → work → schedule
        // → vulnerable window). This is what eventually unlocks precise ops like assassination targeting.
        const stageRevealed=advanceRoutine(target);
        const STAGE_MSG={home:"You mapped where they live",work:"You learned where they work",schedule:"You charted their daily routine",vulnerable:"You found their vulnerable window — when they're alone and exposed"};
        if(stageRevealed){
          const extra=stageRevealed==="vulnerable"&&target.routine.vulnerable?(": "+target.routine.vulnerable.desc):"";
          log("\u2756 Tailing "+target.name+" — "+(STAGE_MSG[stageRevealed]||"learned their pattern")+extra+".","good");
        }
        const sec=wispSecret(target);
        if(sec&&!target.secretKnown){target.secretKnown=true;target.secret=sec;
          (m.intel!=null)&&(m.intel+=crit?4:0);
          const av=theAvatar();if(av)(av.dossier=av.dossier||[]).push({id:target.id,kind:sec.kind,text:target.name+" "+sec.text,t:ST.tick});
          log("\u2756 ...and you found dirt: "+target.name+" "+sec.text+". You can use this.","good");
          banner("DIRT UNCOVERED","good");remember(target,"felt watched lately — unsettling");
        } else if(!stageRevealed&&!sec){
          m.intel=(m.intel||0)+RI(3,6);
          log("\u2756 You shadowed "+target.name+" — fully mapped already, but the legwork turned up some intel.","info");
        } else if(stageRevealed){
          banner("ROUTINE MAPPED","good");remember(target,"felt watched lately — unsettling");
        }
      }
      break;}
    case "steal":{
      if(target&&target.kind==="pawn"){
        // ROB A WISP — take what credits they have. Brave/impulsive wisps resist (you take less + they fight).
        const av=theAvatar();
        const resists=(target.pers&&(target.pers.imp>60||(100-(target.pers.cau||50))>65))&&Math.random()<0.5;
        const purse=Math.max(0,target.credits||0);
        let took=resists?Math.floor(purse*R(0.3,0.55)):Math.floor(purse*R(0.7,1.0))+(crit?15:0);
        took=Math.max(took, RI(8,18));   // even a broke mark yields some street cash
        target.credits=Math.max(0,purse-took);
        m.intel=(m.intel||0)+Math.floor(took/5);   // proceeds proxy into your network
        target.stress=Math.min(100,(target.stress||0)+20);
        emotionalReact&&emotionalReact(target,"robbery",0.7,{memory:"got robbed at knifepoint — shaken and angry"});
        adjAvatarRep(-8);   // mugging your own neighbors is a feared, ugly act
        if(resists&&av){
          // they fought back — you take a hit
          av.hp=Math.max(1,(av.hp||100)-RI(4,12));
          log("\u25c8 You robbed "+target.name+" — they fought back and you took "+took+"c off them, bruised.","warn");
        } else {
          log("\u25c8 You robbed "+target.name+" of "+took+"c"+(crit?" — clean and fast.":".")+"","good");
        }
        banner("ROBBERY","warn");
        // ALWAYS calls the regime — robbery is reported, heat spikes, and an enforcer may come for you
        ST.heat=Math.min(100,(ST.heat||0)+12);
        REG().awareness=clamp((REG().awareness||0)+10,0,100);
        remember(target,"called the enforcers after getting robbed");
        // chance the report leads to arrest if exposure is already high (jail system)
        if(av&&(m.exposure>45||crit===false)&&Math.random()<0.3){
          const enf=ST.pawns.find(p=>p.role==="enforcer"&&p.hp>0);
          if(enf)enf.grudgeTarget=av.id;   // an enforcer now hunts you
        }
      }
      break;}
    case "bribe":{
      if(target&&target.kind==="pawn"){
        const isCop=target.role==="enforcer"||target.regimeForce;
        target.bribed=ST.tick;
        if(isCop){
          // BRIBE A COP — buy your way out of heat + any pending arrest. The regime's muscle looks away.
          ST.heat=Math.max(0,(ST.heat||0)-RI(20,35));
          target.grudgeTarget=null;
          const avp=theAvatar();
          if(avp&&avp.jailed&&!avp.jailed.capital){avp.jailed=null;avp.job=null;log("\u25c9 "+target.name+" takes your credits and loses the paperwork — you walk free.","good");}
          else log("\u25c9 "+target.name+", an Enforcer, pockets your credits and looks the other way — the heat dies down.","good");
          target.allegiance=clamp((target.allegiance||0)+(crit?15:8),-100,100);
          banner("ENFORCER PAID OFF","good");
        } else {
          target.allegiance=clamp((target.allegiance||0)+(crit?35:22),-100,100);
          if(target.informant&&crit){target.informant=false;const idx=REG().informants.indexOf(target.id);if(idx>=0)REG().informants.splice(idx,1);
            log(target.name+" takes your credits — and quietly stops feeding the regime.","good");}
          else log("\u25c9 "+target.name+" pockets your credits and warms to you"+(crit?" — bought and loyal.":"."),"good");
          // a bribed wisp may let slip something useful — random intel
          if(Math.random()<(crit?0.65:0.4)){const info=RI(4,9);M().intel=(M().intel||0)+info;
            revealIntel&&revealIntel(target,1);
            log("...and "+target.name.split(" ")[0]+" let something useful slip (+"+info+" intel).","info");}
          relAdj(target.id,theAvatar()?theAvatar().id:target.id,crit?18:10);
        }
        adjAvatarRep(-2);  // buying people is a touch unsavory
      }
      break;}
    case "blackmail":{
      if(target&&target.kind==="pawn"){
        const sec=knownSecret(target);
        // RECURRING EXTORTION — instead of just turning them, you bleed them: they pay you every few days
        // until they break free or snap. An ongoing income stream with an ongoing reputation cost.
        target.extorted={since:ST.tick,nextPay:ST.tick+Math.floor(TPD*R(2,3)),sec:sec?sec.kind:"a secret",breakChance:crit?0.06:0.12};
        target.coerced=ST.tick;
        target.stress=Math.min(100,(target.stress||0)+18);
        if(target.informant){target.informant=false;const idx=REG().informants.indexOf(target.id);if(idx>=0)REG().informants.splice(idx,1);
          log("\u2756 You squeeze "+target.name+" with what you know — they stop informing AND start paying to keep you quiet.","good");}
        else log("\u2756 You've got "+target.name+" over a barrel"+(sec?" ("+sec.kind+")":"")+" — they'll pay regularly to keep their secret buried.","good");
        relAdj(target.id,theAvatar()?theAvatar().id:target.id,-22);
        remember(target,"someone's bleeding me dry over what they know — I'm trapped");
        adjAvatarRep(-7);
        banner("EXTORTION SET","good");
      }
      break;}
    case "assassinate":{
      if(target&&target.kind==="pawn"){
        const nm=target.name,wasRole=target.role;
        REG().awareness=clamp((REG().awareness||0)+(crit?8:20),0,100); // crit = clean; otherwise they KNOW
        // ROLE-SCALED CONSEQUENCES — who you kill matters enormously to the district.
        if(wasRole==="mayor"){
          // MAYOR — a power vacuum. Huge grip drop + a succession crisis (triggers an election).
          REG().grip=Math.max(0,(REG().grip||60)-(crit?32:24));
          m.support=clamp((m.support||0)+(crit?20:14),0,100);
          log("\u2620 You assassinated "+nm+", the Administrator. A POWER VACUUM tears open — the regime scrambles for a successor.","bad");
          banner("ADMINISTRATOR DOWN","bad");
          // (killPawn below auto-triggers openElection for a role-holder — the succession crisis)
        } else if(wasRole==="enforcer"){
          // ENFORCER — the regime's muscle. Removing them drops HEAT (less patrol) but brings a hard response.
          REG().grip=Math.max(0,(REG().grip||60)-(crit?14:9));
          ST.heat=Math.max(0,(ST.heat||0)-25);          // patrol gap — the street breathes
          REG().awareness=clamp((REG().awareness||0)+15,0,100);   // but the regime retaliates hard
          m.support=clamp((m.support||0)+(crit?12:7),0,100);
          log("\u2620 You killed "+nm+", an Enforcer. The patrols thin and the heat drops — but the regime will answer for one of its own.","bad");
          banner("ENFORCER DOWN","bad");
        } else if(target.informant){
          // INFORMANT — kills the regime's eyes on the block. Blinds their network locally.
          REG().grip=Math.max(0,(REG().grip||60)-(crit?10:6));
          const idx=REG().informants.indexOf(target.id);if(idx>=0)REG().informants.splice(idx,1);
          log("\u2620 You silenced "+nm+" — a regime informant. The block's eyes go dark; the network breathes easier.","bad");
          banner("INFORMANT SILENCED","bad");
        } else {
          // REGULAR WISP — mostly a statement. Fear ripples; little strategic gain, real reputation cost.
          REG().grip=Math.max(0,(REG().grip||60)-(crit?5:3));
          // witnesses + neighbors are TERRIFIED of you
          for(const q of ST.pawns){if(q===target||isChild(q)||q.hp<=0)continue;if(DIST(q.px,q.py,target.px,target.py)<14){q.stress=Math.min(100,(q.stress||0)+RI(10,22));addMod&&addMod(q,"terror","Saw a killing",-14,TPD);}}
          log("\u2620 You killed "+nm+". The block recoils in fear — a brutal message, but it wins you little.","bad");
          banner("TARGET ELIMINATED","bad");
        }
        if(SFX&&SFX.alert)SFX.alert();
        chronicle("You assassinated "+nm+(wasRole?", the "+ROLES[wasRole].title:"")+".","\u2620");
        adjAvatarRep(wasRole==="mayor"?-18:wasRole==="enforcer"?-10:-14);  // killing breeds fear, scaled by who
        killPawn(target,"was assassinated");   // triggers the existing death/election cascade
      }
      break;}
  }
  // ═══ ENVOY RESPONSE HOOK (stage 3) — if this successful op was aimed at the envoy or the meeting, it
  //     counts as the player's RESPONSE to the visit. Set the envoy flags (spied/disrupted/struck) that gate
  //     the crackdown, and apply envoy-specific payoffs on top of the normal op outcome. Reuses every op as-is. ═══
  envoyOpHook(opKey,target,crit);
  // GAP 4 — the city responds collectively to a successful op. Strike (you hit the regime) vs rally (hope).
  {const ax=(av&&av.px!=null)?av.px:MW/2, ay=(av&&av.py!=null)?av.py:MH/2;const big=crit?0.85:0.6;
   const tx=(target&&target.px!=null)?target.px:ax, ty=(target&&target.py!=null)?target.py:ay;
   if(opKey==="assassinate"||opKey==="sabotage")cityReact("strike",tx,ty,big);
   else if(opKey==="dissent")cityReact("rally",ax,ay,big);
   else if(opKey==="frame"||opKey==="blackmail")cityReact("strike",tx,ty,0.45);}
}
// PARTIAL — the op half-works but leaves a complication. The interesting middle ground the bands create.
function opPartial(opKey,target,check){
  const m=M();const av=theAvatar();
  switch(opKey){
    case "sabotage":{
      if(target&&target.kind==="s"){
        target.sabotaged=ST.tick+Math.floor(TPD*R(0.4,0.7));  // shorter outage
        const util=DEF[target.type]&&DEF[target.type].utility;
        if(util==="power")ST.blackoutUntil=ST.tick+Math.floor(TPD*R(0.2,0.35));
        ST.heat=Math.min(100,(ST.heat||0)+6);
        REG().awareness=clamp((REG().awareness||0)+8,0,100);  // but you were nearly seen
        log("\u2715 You damaged the "+DEF[target.type].name+", but had to rush it — partial outage, and you were nearly spotted.","warn");
      }
      break;}
    case "intel":{
      const gain=RI(2,5);m.intel+=gain;
      REG().awareness=clamp((REG().awareness||0)+5,0,100);
      log("\u25c6 You scraped together a little intel (+"+gain+"), but tipped your hand doing it.","warn");
      break;}
    case "dissent":{
      const gain=RI(2,5);m.support=clamp((m.support||0)+gain,0,100);
      // a clumsy agitation can also draw a hostile reaction from a loyalist nearby
      if(av){const loyal=ST.pawns.find(q=>!q.isAvatar&&(q.regimeForce||(q.allegiance||0)<-40)&&DIST(av.px,av.py,q.px,q.py)<8);
        if(loyal){relAdj(loyal.id,av.id,-12);log("Your message landed unevenly — "+loyal.name+" pushed back.","warn");}
        else log("You stirred a little support (+"+gain+"), but the room was lukewarm.","warn");}
      break;}
    case "frame":{
      if(target&&target.kind==="pawn"){
        // the frame doesn't fully stick — some doubt, but they're not discredited, and they suspect YOU
        for(const q of ST.pawns){if(q.id===target.id||isChild(q))continue;if(Math.random()<0.2)relAdj(q.id,target.id,-8);}
        if(av)relAdj(target.id,av.id,-20);                    // the target now has it in for you
        REG().awareness=clamp((REG().awareness||0)+10,0,100);
        log("\u2624 Your frame on "+target.name+" half-stuck — some doubt, but they smell a setup, and they're looking your way.","warn");
      }
      break;}
    case "surveil":{
      if(target&&target.kind==="pawn"){
        REG().awareness=clamp((REG().awareness||0)+6,0,100);
        log("\u2756 You tailed "+target.name+" but they nearly made you — no secret, and you've drawn notice.","warn");
      }
      break;}
    case "steal":{
      const haul=RI(8,16);m.intel=(m.intel||0)+Math.floor(haul/4);
      ST.heat=Math.min(100,(ST.heat||0)+8);REG().awareness=clamp((REG().awareness||0)+10,0,100);
      log("\u25c8 You grabbed only "+haul+"c before you had to bolt — and the theft was noticed.","warn");
      break;}
    case "bribe":{
      if(target&&target.kind==="pawn"){
        // they take it but don't fully commit — or worse, a principled wisp balks. Reputation shifts the
        // odds: a feared operative meets less resistance, a beloved one a touch more.
        const receptive=bribeReceptivity(target);
        if(receptive<0.4){
          if(theAvatar())relAdj(target.id,theAvatar().id,-10);
          REG().awareness=clamp((REG().awareness||0)+8,0,100);
          log("\u25c9 "+target.name+" refused your bribe and looked offended — that could get back to the wrong people.","warn");
        } else {
          target.allegiance=clamp((target.allegiance||0)+8,-100,100);
          log("\u25c9 "+target.name+" took the credits but made no promises — a shaky investment.","warn");
        }
      }
      break;}
    case "blackmail":{
      if(target&&target.kind==="pawn"){
        // they comply grudgingly but it costs you — deeper resentment, and they may go to the regime
        target.allegiance=clamp((target.allegiance||0)+10,-100,100);
        if(theAvatar())relAdj(target.id,theAvatar().id,-25);
        REG().awareness=clamp((REG().awareness||0)+8,0,100);
        log("\u2756 "+target.name+" bends under the threat, but barely — and they're desperate enough to be dangerous.","warn");
      }
      break;}
    case "assassinate":{
      if(target&&target.kind==="pawn"){
        // the hit goes loud — target wounded, not killed, and now the whole regime is on alert
        target.hp=Math.max(1,(target.hp||100)-RI(30,50));target.hurtT=ST.tick;
        REG().awareness=clamp((REG().awareness||0)+30,0,100);
        m.exposure=clamp((m.exposure||0)+15,0,100);
        if(target.role)target.grudgeTarget=theAvatar()?theAvatar().id:null;
        log("\u2620 The hit on "+target.name+" went loud — they survived, wounded, and the regime is on full alert. This will get worse.","bad");
        banner("HIT BOTCHED","bad");if(SFX&&SFX.alert)SFX.alert();
      }
      break;}
    case "hackGrid":{
      if(target&&target.kind==="s"){
        target.sabotaged=ST.tick+Math.floor(TPD*R(0.3,0.6));
        const util=DEF[target.type]&&DEF[target.type].utility;
        if(util==="power")ST.blackoutUntil=ST.tick+Math.floor(TPD*R(0.15,0.25));
        ST.heat=Math.min(100,(ST.heat||0)+4);
        REG().awareness=clamp((REG().awareness||0)+6,0,100);
        log("⌕ Partial breach on the "+DEF[target.type].name+" — brief outage, but the regime is scanning the network.","warn");
      }
      break;}
    case "dataHeist":{
      const gain=RI(5,9);m.intel=(m.intel||0)+gain;
      REG().awareness=clamp((REG().awareness||0)+14,0,100);
      log("⌔ You grabbed some data (+"+gain+" intel) before the alarm tripped — the regime is hunting the source.","warn");
      break;}
    case "corruptRecords":{
      if(target&&target.kind==="pawn"){
        for(const q of ST.pawns){if(q.id===target.id||isChild(q))continue;if(Math.random()<0.18)relAdj(q.id,target.id,-7);}
        REG().awareness=clamp((REG().awareness||0)+10,0,100);
        log("⌘ Partial corruption of "+target.name+"'s records — doubt sown, but the regime is scanning for the intrusion.","warn");
      }
      break;}
  }
}
function opFailure(opKey,target,check,botched){
  const m=M();
  // HIGH RISK: failure spikes exposure + awareness; a botched (critical) miss is the worst case
  const sev=botched?"botched":"slipped";
  const expHit=sev==="botched"?22:12;
  m.exposure=clamp((m.exposure||0)+expHit,0,100);
  REG().awareness=clamp((REG().awareness||0)+(sev==="botched"?14:7),0,100);
  const opName=AVATAR_OPS[opKey].name;
  // ARREST — getting caught on a serious crime can land your operative in the Holding Cells. The severity
  // scales with the op: theft/sabotage = serious (jail), a botched assassination = capital (execution risk).
  const av=theAvatar();
  const JAILABLE={steal:2,sabotage:2,assassinate:3,hackGrid:2,dataHeist:2,corruptRecords:2};   // op -> crime severity if caught
  let arrested=false;
  if(av&&JAILABLE[opKey]){
    // you're caught if it was botched, OR (on a plain fail) the regime is already aware / an enforcer saw you
    const enfSaw=ST.pawns.some(p=>p.role==="enforcer"&&p.hp>0&&canSee&&canSee(p,av,AVATAR_OPS[opKey])>0.2);
    const caught=botched||enfSaw||(m.exposure>55&&Math.random()<0.5);
    if(caught){
      const crimeName=opKey==="steal"?"robbery":opKey==="sabotage"?"sabotage":"an attempt on a regime figure";
      arrested=jailPawn(av,JAILABLE[opKey],crimeName);
    }
  }
  if(arrested)return;   // jailPawn already logged + banner'd; the arrest supersedes the normal fail message
  if(sev==="botched"){
    log("\u26a0 Your "+opName+" was BOTCHED — the regime's onto you. Exposure spikes.","bad");
    banner("OP BOTCHED","bad");if(SFX&&SFX.alert)SFX.alert();
    // a botched op near regime forces can draw an enforcer
    const enf=ST.pawns.find(p=>p.role==="enforcer"&&p.hp>0);
    if(enf&&theAvatar()&&Math.random()<0.5){enf.grudgeTarget=theAvatar().id;log("An enforcer marks you after the botched op.","warn");}
  } else {
    log("\u26a0 Your "+opName+" slipped — you weren't caught, but exposure rose.","warn");
  }
}
/* ============================================================
   INVESTIGATION / CASES — the city generates mysteries; you solve them to earn intel and weaken
   the regime. Investigation IS espionage. Three case types:
     · murder      — a wisp was killed; deduce the culprit (motive + proximity + witnesses)
     · informant   — the regime turned someone; deduce which wisp is the mole
     · conspiracy  — a regime operation is hidden in the district; deduce the agent/front
   Clues are DERIVED from existing sim state (grudges, memory, allegiance, location), not invented.
   ============================================================ */
function caseById(id){return ST.cases.find(c=>c.id===id)||null;}
function openCases(){return ST.cases.filter(c=>!c.resolved);}
// open a MURDER case when a homicide occurs. culprit is known to the sim, hidden from the player.
function openMurderCase(victim,culprit){
  if(!victim||!culprit)return null;
  // suspect pool: everyone with any plausible connection (a grudge, proximity, gang tie) + the culprit.
  const pool=new Set([culprit.id]);
  for(const p of ST.pawns){if(isChild(p)||p===victim||p.hp<=0)continue;
    const hasGrudge=relGet(p.id,victim.id)<-30||p.grudgeTarget===victim.id;
    const near=DIST(p.px,p.py,victim.px,victim.py)<18;
    if(hasGrudge||near||pawnGang(p))pool.add(p.id);}
  // cap the pool so it's solvable (3-6 suspects)
  let suspects=[...pool].slice(0,6);
  if(!suspects.includes(culprit.id)){suspects[suspects.length-1]=culprit.id;}
  const c={
    id:++ST.caseSeq, type:"murder", openedTick:ST.tick, openedDay:dayN(),
    victimId:victim.id, victimName:victim.name,
    answerId:culprit.id,                 // the hidden truth
    suspects, clues:[], found:[],        // clues generated lazily; found = player-revealed
    resolved:false, outcome:null, investedIntel:0,
  };
  // pre-generate the clue pool (revealed one at a time as the player investigates)
  c.clues=genMurderClues(c,victim,culprit);
  ST.cases.push(c);
  log("\u2622 A body — "+victim.name+" was killed. A CASE is open (Investigations).","warn");
  return c;
}
// build the clue set for a murder. Each clue points toward or away from suspects; the truth is
// deducible by weighing them. Clues are tagged strength: a culprit accrues the most pointing clues.
function genMurderClues(c,victim,culprit){
  const clues=[];
  const sus=c.suspects.map(id=>ST.pawns.find(p=>p.id===id)).filter(Boolean);
  // MOTIVE clues — grudges toward the victim
  for(const s of sus){const r=relGet(s.id,victim.id);
    if(s.grudgeTarget===victim.id)clues.push({k:"motive",sid:s.id,w:3,t:s.name+" had a bitter, standing grudge against "+victim.name+"."});
    else if(r<-50)clues.push({k:"motive",sid:s.id,w:2,t:s.name+" and "+victim.name+" were openly hostile."});
    else if(r<-25)clues.push({k:"motive",sid:s.id,w:1,t:s.name+" had friction with "+victim.name+"."});}
  // PROXIMITY clues — who was near the scene
  for(const s of sus){const d=DIST(s.px,s.py,victim.px,victim.py);
    if(d<6)clues.push({k:"proximity",sid:s.id,w:2,t:s.name+" was seen close to where "+victim.name+" fell."});
    else if(d<14)clues.push({k:"proximity",sid:s.id,w:1,t:s.name+" was in the area around the time."});}
  // GANG clue — vendetta context
  const vg=pawnGang(victim);
  for(const s of sus){const sg=pawnGang(s);
    if(sg&&vg&&sg!==vg&&relGet(s.id,victim.id)<0)clues.push({k:"gang",sid:s.id,w:2,t:s.name+"'s crew had a vendetta with "+victim.name+"'s."});}
  // WITNESS clue — someone may have actually seen it (strong, points right at the culprit)
  const wit=ST.pawns.find(w=>w!==culprit&&w!==victim&&!isChild(w)&&(w.mem||[]).some(mm=>mm.t&&mm.t.includes(culprit.name)&&mm.t.includes("attack")));
  if(wit)clues.push({k:"witness",sid:culprit.id,w:4,t:wit.name+" remembers seeing "+culprit.name+" attack "+victim.name+".",hard:true});
  // a misleading clue: an innocent suspect with surface motive (red herring) — keeps it from being trivial
  const herring=sus.find(s=>s.id!==culprit.id&&relGet(s.id,victim.id)<-25);
  if(herring)clues.push({k:"redherring",sid:herring.id,w:1,t:herring.name+" was heard threatening "+victim.name+" recently — but talk is cheap."});
  return clues;
}
// open an INFORMANT case: the regime has a mole; deduce who. answer = an actual informant.
function openInformantCase(){
  const moles=ST.pawns.filter(p=>p.informant&&!isChild(p));
  if(!moles.length)return null;
  const mole=CH(moles);
  const pool=new Set([mole.id]);
  // suspects: recruited wisps + low-allegiance wisps (plausible turncoats)
  for(const p of ST.pawns){if(isChild(p)||p.hp<=0)continue;
    if(p.recruited||(p.allegiance||0)<-10)pool.add(p.id);}
  let suspects=[...pool].slice(0,6);
  if(!suspects.includes(mole.id))suspects[suspects.length-1]=mole.id;
  const c={id:++ST.caseSeq,type:"informant",openedTick:ST.tick,openedDay:dayN(),
    answerId:mole.id,suspects,clues:[],found:[],resolved:false,outcome:null,investedIntel:0,
    victimName:"the cause"};
  c.clues=genInformantClues(c,mole);
  ST.cases.push(c);
  log("\u26A0 Intel suggests a regime INFORMANT in the network. Open a CASE to flush them out.","warn");
  return c;
}
function genInformantClues(c,mole){
  const clues=[];
  const sus=c.suspects.map(id=>ST.pawns.find(p=>p.id===id)).filter(Boolean);
  for(const s of sus){
    if(s.id===mole.id){
      clues.push({k:"behavior",sid:s.id,w:3,t:s.name+"'s movements don't match their stated loyalties."});
      clues.push({k:"behavior",sid:s.id,w:2,t:s.name+" has been seen near regime checkpoints."});
    }else if((s.allegiance||0)<-20){
      clues.push({k:"redherring",sid:s.id,w:1,t:s.name+" is cold to the cause — but cold isn't the same as treacherous."});
    }
    if((s.allegiance||0)>40&&s.id!==mole.id)
      clues.push({k:"loyalty",sid:s.id,w:-2,t:s.name+" is deeply committed — an unlikely traitor."});
  }
  return clues;
}
// PLAYER: spend intel to reveal the next clue in a case (canvass/surveil/investigate).
function investigateCase(id){
  const c=caseById(id);if(!c||c.resolved)return false;
  const cost=6;
  if((M().intel||0)<cost){flashMsg&&flashMsg("Need "+cost+" intel to investigate");return false;}
  const remaining=c.clues.filter(cl=>!c.found.includes(cl));
  if(!remaining.length){flashMsg&&flashMsg("No new leads — time to make an accusation.");return false;}
  M().intel-=cost;c.investedIntel+=cost;
  // reveal the strongest unrevealed clue first (investigation surfaces the clearest leads)
  remaining.sort((a,b)=>Math.abs(b.w)-Math.abs(a.w));
  const clue=remaining[0];c.found.push(clue);
  log("Lead uncovered: "+clue.t,"info");
  return clue;
}
// PLAYER: accuse a suspect. Correct → reward; wrong → consequence. Resolves the case.
function accuseSuspect(caseId,suspectId){
  const c=caseById(caseId);if(!c||c.resolved)return null;
  const correct=suspectId===c.answerId;
  c.resolved=true;c.outcome=correct?"solved":"wrong";
  const accused=ST.pawns.find(p=>p.id===suspectId);
  if(correct){
    // solving a case is real intel + a support bump (the district sees you deliver justice / root out a mole)
    M().intel=(M().intel||0)+15;M().support=clamp((M().support||0)+4,0,100);
    if(c.type==="murder"){
      log("\u2713 Case solved — "+(accused?accused.name:"the culprit")+" was the killer. The block trusts you more.","good");
      chronicle&&chronicle((accused?accused.name:"A killer")+" exposed as "+c.victimName+"'s murderer","crime");
      // the culprit faces justice — heavy rep hit + becomes a target
      if(accused){relAdjAll(accused,-30);accused.exposed=true;}
    }else if(c.type==="informant"){
      log("\u2713 Mole flushed — "+(accused?accused.name:"the informant")+" was feeding the regime. Network secured.","good");
      if(accused){accused.informant=false;accused.recruited=false;accused.allegiance=clamp((accused.allegiance||0)-40,-100,100);
        const idx=REG().informants.indexOf(accused.id);if(idx>=0)REG().informants.splice(idx,1);}
      M().exposure=Math.max(0,M().exposure-10);
    }
  }else{
    // a wrong accusation costs you — the real culprit/mole is still loose, and you've burned credibility
    M().support=clamp((M().support||0)-6,0,100);M().exposure=clamp((M().exposure||0)+8,0,100);
    log("\u2717 Wrong call — "+(accused?accused.name:"they")+" wasn't guilty. The cause loses face, and the guilty stay free.","warn");
    if(accused){relAdjAll(accused,-10);}  // you've wronged an innocent
  }
  return c.outcome;
}
// helper: adjust everyone's relationship toward a pawn (used for public disgrace)
function relAdjAll(target,delta){for(const p of ST.pawns){if(p===target||isChild(p))continue;relAdj(p.id,target.id,delta);}}
// daily: maybe surface an informant case if the regime has moles and none is being investigated.
function caseTick(){
  // auto-open an informant hunt occasionally when moles exist
  if(ST.tick%TPD===0&&REG().informants.length>0&&!openCases().some(c=>c.type==="informant")&&Math.random()<0.25){
    openInformantCase();
  }
  // expire very old unsolved cases (leads go cold) so the list doesn't bloat
  for(const c of ST.cases){if(!c.resolved&&ST.tick-c.openedTick>TPD*12){c.resolved=true;c.outcome="cold";
    log("A case went cold: "+(c.type==="murder"?c.victimName+"'s murder":"the informant hunt")+".","info");}}
}
// daily: clique loyalty effects + rivalry + group petitions
function cliqueTick(){
  rebuildCliques();
  if(!ST.cliques.length)return;
  const halls=countBuilt("hall");
  for(const c of ST.cliques){
    const mem=c.members.map(id=>ST.pawns.find(p=>p.id===id)).filter(Boolean);
    if(mem.length<3)continue;
    // belonging is a steady small mood lift
    for(const p of mem)addMod(p,"belong","Part of "+c.name,4,TPD*1.2);
    // loyalty rises with internal harmony, falls with internal friction
    let warmth=0,pairs=0;
    for(let i=0;i<mem.length;i++)for(let j=i+1;j<mem.length;j++){warmth+=relGet(mem[i].id,mem[j].id);pairs++;}
    const avg=pairs?warmth/pairs:0;
    c.loyalty=clamp(c.loyalty+(avg>45?2:avg<25?-3:0),0,100);
    // a community hall warms factions toward the operator + steadies loyalty
    if(halls>0){c.loyalty=clamp(c.loyalty+halls,0,100);
      if(c.stance!==undefined)c.stance=clamp((c.stance||0)+halls*1.5,-100,100);}
  }
  // clique rivalries: two cliques with a hostile cross-bond can feud
  if(ST.cliques.length>=2&&ST.tick%TPD===0){
    for(let i=0;i<ST.cliques.length;i++)for(let j=i+1;j<ST.cliques.length;j++){
      const A=ST.cliques[i],B=ST.cliques[j];
      if(A.rival===B.id||B.rival===A.id)continue;
      // sample cross hostility
      let hostile=0,n=0;
      for(const a of A.members)for(const b of B.members){hostile+=relGet(a,b);n++;}
      if(n&&hostile/n<-20&&Math.random()<0.4){A.rival=B.id;B.rival=A.id;
        log(A.name+" and "+B.name+" have a falling-out — a clique rivalry.","warn");}
    }
  }
  // group petition: a large, loyal clique may collectively press the district
  if(ST.tick%TPD===0)maybeCliquePetition();
  // ── FACTION POLITICS: stance toward the operator produces real effects ──
  if(ST.tick%TPD===0){
    for(const c of ST.cliques){
      if(c.stance===undefined)c.stance=0;
      c.stance=Math.round(c.stance*0.92);        // stance slowly decays toward neutral
      const mem=c.members.map(id=>ST.pawns.find(p=>p.id===id)).filter(Boolean);
      if(mem.length<3)continue;
      const influence=mem.length*(c.loyalty/100);  // bigger, tighter cliques carry more weight
      if(c.stance>=55){
        // a supportive bloc: lifts district morale, members work harder
        for(const p of mem){addMod(p,"backop","Backs the operator",6,TPD);if(p.career)p.career.sat=clamp(p.career.sat+3,0,100);}
        if(influence>=3&&ST.tick%(TPD*2)===0)log(c.name+" publicly backs your leadership — the block feels it.","good");
      }else if(c.stance<=-55){
        // a hostile bloc: foments unrest (heat) and may align with a gang
        ST.heat=Math.min(100,(ST.heat||0)+Math.round(influence));
        for(const p of mem)addMod(p,"opposeop","Resents the operator",-5,TPD);
        if(influence>=3){
          // hostile, influential clique can throw in with a gang
          if(ST.gangs.length&&!c.alignedGang&&Math.random()<0.25){
            const g=ST.gangs[RI(0,ST.gangs.length-1)];c.alignedGang=g.id;
            for(const p of mem)if(!pawnGang(p)&&Math.random()<0.4)g.crewIds.push(p.id);
            log(c.name+" has thrown in with "+g.name+" — a faction turned criminal.","bad");
            banner("FACTION DEFECTS","bad");
          }else if(ST.tick%(TPD*2)===0)log(c.name+" is agitating against your rule — unrest is rising.","warn");
        }
      }
    }
  }
}
function maybeCliquePetition(){
  if(!REQUESTS_ENABLED)return;
  if(ST.requests&&ST.requests.some(r=>r.status==="pending"&&r.kind==="clique"))return;
  const c=ST.cliques.find(c=>c.members.length>=4&&c.loyalty>=65);
  if(!c)return;
  // the clique asks for something that benefits the group: a district-wide morale spend
  const mem=c.members.map(id=>ST.pawns.find(p=>p.id===id)).filter(Boolean);
  if(!mem.length)return;
  const spokesId=mem[0].id,spokes=mem[0];
  const id="clique_"+c.id+"_"+ST.tick;
  ST.requests.push({id,kind:"clique",cliqueId:c.id,agentId:spokesId,agentName:c.name,
    created:ST.tick,expires:ST.tick+TPD*1.5,status:"pending",
    text:c.name+" ("+mem.length+" members, led by "+spokes.name+") asks the district to invest in their people — a morale fund, or they'll sour on the block.",
    options:[
      {label:"Fund them (-120c, big morale)",act:"fund"},
      {label:"A token gesture (-40c, small)",act:"token"},
      {label:"Refuse",act:"refuse"}]});
  renderRequests();banner("CLIQUE PETITION","warn");
}

/* ---------- structures / passability ---------- */
function structAt(x,y){return ST.structs.get(K(x,y))||null}
function addStruct(s){ST.structs.set(K(s.x,s.y),s)}
function removeStruct(s){if(ST.structs.get(K(s.x,s.y))===s)ST.structs.delete(K(s.x,s.y))}
function terCost(x,y){const t=ST.ter[x+y*MW];return t===3?0.55:1;}  // roads are cheap → pawns prefer streets
function colCost(x,y){const s=structAt(x,y);if(!s||s.bp)return terCost(x,y);
  const b=DEF[s.type].blocks;if(b===0)return terCost(x,y);if(b===2)return 1.7;return -1}
function foeCost(x,y){const s=structAt(x,y);if(!s||s.bp)return 1;const d=DEF[s.type];
  if(d.nat&&d.blocks)return -1;if(d.blocks===0)return 1;if(d.blocks===2)return 15;return 28}

/* ---------- A* pathfinding ---------- */
class Heap{constructor(){this.a=[]}
  push(n){const a=this.a;a.push(n);let i=a.length-1;
    while(i>0){const p=(i-1)>>1;if(a[p].f<=a[i].f)break;const t=a[p];a[p]=a[i];a[i]=t;i=p}}
  pop(){const a=this.a;const top=a[0];const l=a.pop();
    if(a.length){a[0]=l;let i=0;for(;;){let c=i*2+1;if(c>=a.length)break;
      if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[i].f<=a[c].f)break;
      const t=a[i];a[i]=a[c];a[c]=t;i=c}}return top}
  get size(){return this.a.length}}

const DIRS=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.45],[1,-1,1.45],[-1,1,1.45],[-1,-1,1.45]];
// PERF — A* working arrays allocated ONCE (not per call). Re-filling two 14,000-element typed arrays on
// every pathfind was the dominant A* cost (each call paid for 28k array writes regardless of path length).
// Instead we tag each cell with the search "generation": a cell is unvisited if its gen tag != the current
// search's gen. Bumping _astarGen invalidates the whole grid in O(1) — no fill needed.
const _aGS=new Float32Array(MW*MH);     // g-score per cell (valid only if _aGen[i]===gen)
const _aPar=new Int32Array(MW*MH);      // parent index per cell
const _aGen=new Int32Array(MW*MH);      // generation tag per cell
let _astarGen=0;
function astar(sx,sy,gx,gy,opt){opt=opt||{};const adj=opt.adj?1:0;const cf=opt.foe?foeCost:colCost;
  if(!INB(gx,gy)||!INB(sx,sy))return null;
  if(adj?CHEB(sx,sy,gx,gy)<=1:(sx===gx&&sy===gy))return [];
  // PRIVATE PROPERTY: if a pawn is given, route AROUND homes they may not enter by adding a
  // heavy (but finite) cost to those tiles — they'll detour if any path exists, but won't get
  // stuck if the only route is through. The destination itself is exempt (going there on purpose).
  const tp=opt.pawn;
  // PERF: precompute the few home rects this pawn may NOT enter, ONCE per path, instead of
  // scanning every pawn's home on every neighbor expansion (was the A* hot-spot).
  let forbidden=null;
  if(tp){forbidden=[];
    for(const q of ST.pawns){const h=q.home;if(!h||q===tp)continue;
      if(!canEnterHome(tp,q))forbidden.push(h);}
    if(!forbidden.length)forbidden=null;   // nothing off-limits → skip the check entirely
  }
  const trespassCost=(X,Y)=>{
    if(!forbidden)return 0;
    if(X===gx&&Y===gy)return 0;            // the goal tile is an intended destination
    for(let i=0;i<forbidden.length;i++){const h=forbidden[i];
      if(X>=h.x0&&X<h.x0+h.w&&Y>=h.y0&&Y<h.y0+h.h)return 40;}
    return 0;
  };
  // bump the generation: every cell is now implicitly "unvisited" (its tag won't match) — O(1) reset.
  const gen=++_astarGen;
  const G=(i)=>_aGen[i]===gen?_aGS[i]:Infinity;     // g-score, or Infinity if not visited this search
  const open=new Heap();
  const si=sx+sy*MW;_aGS[si]=0;_aPar[si]=-1;_aGen[si]=gen;open.push({i:si,g:0,f:CHEB(sx,sy,gx,gy)});
  let found=-1,iter=0;
  // PERF — cap node exploration. The worst-case cost was failed/huge searches grinding to the old 14000-node
  // (whole-map) limit. A path on this map almost never needs more than a few thousand nodes; an unreachable
  // target should bail FAST rather than explore everything. 4000 covers any sane route on a 140×100 grid
  // while cutting pathological searches ~3.5x. (If a real path legitimately needs more, the pawn repaths next
  // tick from a closer position as it moves, so capping doesn't strand anyone.)
  const ITER_CAP=4000;
  while(open.size&&iter++<ITER_CAP){const n=open.pop();const ni=n.i;
    if(n.g>G(ni)+1e-4)continue;
    const nx=ni%MW,ny=(ni/MW)|0;
    if(adj?CHEB(nx,ny,gx,gy)<=1:(nx===gx&&ny===gy)){found=ni;break}
    for(let k=0;k<8;k++){const dx=DIRS[k][0],dy=DIRS[k][1],m=DIRS[k][2];
      const X=nx+dx,Y=ny+dy;if(!INB(X,Y))continue;
      if(dx!==0&&dy!==0){if(cf(nx+dx,ny)<0||cf(nx,ny+dy)<0)continue}
      const c=cf(X,Y);if(c<0)continue;
      const ng=G(ni)+(c+trespassCost(X,Y))*m;const ii=X+Y*MW;
      if(ng<G(ii)-1e-3){_aGS[ii]=ng;_aPar[ii]=ni;_aGen[ii]=gen;open.push({i:ii,g:ng,f:ng+CHEB(X,Y,gx,gy)})}}}
  if(found<0)return null;
  const path=[];let cur=found;
  while(cur!==si&&cur>=0){path.push({x:cur%MW,y:(cur/MW)|0});cur=_aPar[cur]}
  path.reverse();return path}

/* ---------- economy ---------- */
function afford(cost){if(cost.income&&ST.income<cost.income){flashMsg("Need "+cost.income+"c district income");return false}return true}
function pay(cost){if(cost.income)ST.income-=cost.income}

/* ---------- placement / construction ---------- */
function entityOn(x,y){for(const p of ST.pawns)if((p.px|0)===x&&(p.py|0)===y)return true;
  return false}// foes removed
function canPlace(type,x,y){if(!INB(x,y))return false;if(structAt(x,y))return false;
  if(DEF[type].blocks!==0&&entityOn(x,y))return false;return true}
function placeBp(type,x,y){const d=DEF[type];
  if(!canPlace(type,x,y))return false;
  if(d.espionage&&d.pillar==="monitor"&&!hqUnlocks("monitor")){if(typeof flashMsg==="function")flashMsg("Need a Surveillance Hub at HQ");return false;}
  if(d.espionage&&d.pillar==="safe"&&!hqUnlocks("safe")){if(typeof flashMsg==="function")flashMsg("Need a Safe Room at HQ");return false;}
  if(d.espionage&&d.pillar==="hack"&&!hqUnlocks("hack")){if(typeof flashMsg==="function")flashMsg("Need a Server Room at HQ");return false;}
  if(!afford(d.cost||{}))return false;       // gate: can't queue what you can't pay for
  pay(d.cost||{});                            // charge district credits up front
  addStruct({id:uid(),kind:"s",type,x,y,hp:1,maxHp:d.hp,bp:true,prog:0,need:d.work,
    res:0,desig:false,decon:false,owner:0,paid:(d.cost&&d.cost.income)||0});
  syncHUD();return true}
function cancelBp(s){if(s.paid)ST.income+=s.paid;removeStruct(s);syncHUD()}
function finishBuild(s){s.bp=false;s.hp=s.maxHp;s.prog=0;ST.stats.built++;
  if(DEF[s.type].furn&&s.qual===undefined)s.qual=1;
  if(DEF[s.type].espionage){s.espionage=true;s.pillar=DEF[s.type].pillar||null;}
  SFX.build();
  if(s.type==="housing"){
    // register a new home slot near the housing unit — uses struct location as virtual bed
    ST.cityHomes.push({x0:s.x-1,y0:s.y-1,w:3,h:3,bed:{x:s.x,y:s.y},door:{x:s.x,y:s.y+1},virtual:true});
    log("New home registered — district can now support one more citizen.","good");
    float(s.x+.5,s.y+.5,"HOME +1","#39ff88")}
  // commerce auto-wrap: a player-placed vendor/refiner becomes a small walled store (if it fits)
  if((DEF[s.type].vendor||DEF[s.type].refine)&&!s.inRoom&&!s.wrapped){
    if(autoWrapStore(s)){float(s.x+.5,s.y+.5,"STORE","#22ddff");}
  }
  if(DEF[s.type].blocks!==0)nudgeOff(s.x,s.y)}
function nudgeOff(x,y){const all=ST.pawns;
  for(const e of all){if((e.px|0)!==x||(e.py|0)!==y)continue;
    let placed=false;
    for(let r=1;r<=5&&!placed;r++)
      for(let dy=-r;dy<=r&&!placed;dy++)for(let dx=-r;dx<=r&&!placed;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
        const X=x+dx,Y=y+dy;
        if(INB(X,Y)&&colCost(X,Y)>=0){e.px=X+.5;e.py=Y+.5;e.path=null;e.job=null;placed=true}}}}
function deconFinish(s){removeStruct(s);syncHUD();if(typeof drawTerrain==="function")drawTerrain()}
/* SOFT SEPARATION — wisps occupy personal space and gently push apart when they overlap, so the
   crowd reads as bodies in a place rather than stacked sprites. Runs once per tick after movement.
   Exempts: sleeping wisps (in their pods/beds), socializing pairs (socWith — they SHOULD stand close),
   and never pushes a wisp onto a blocked tile. Kept subtle so it never fights A* pathing. */
function separatePawns(){
  const P=ST.pawns,n=P.length;
  const MIND=0.62, MIND2=MIND*MIND;     // desired minimum center-to-center distance (tiles)
  for(let i=0;i<n;i++){
    const a=P[i];
    if(a.sleeping)continue;             // sleepers rest in place
    if(a.activeOp)continue;             // an avatar performing an op stays anchored to its target
    for(let j=i+1;j<n;j++){
      const b=P[j];
      if(b.sleeping)continue;
      if(b.activeOp)continue;           // don't push a performing avatar off its spot
      // socializing pairs are meant to stand together — don't shove them apart
      if(a.socWith===b.id||b.socWith===a.id)continue;
      const dx=b.px-a.px,dy=b.py-a.py;
      const d2=dx*dx+dy*dy;
      if(d2>=MIND2||d2<1e-6){
        if(d2<1e-6){ // exactly coincident — nudge on a deterministic axis so they don't lock
          a.px-=0.03;b.px+=0.03;
        }
        continue;
      }
      const d=Math.sqrt(d2);
      const overlap=(MIND-d)*0.5;       // split the correction between the two
      const ux=dx/d,uy=dy/d;
      // tentative new positions
      const anx=a.px-ux*overlap, any=a.py-uy*overlap;
      const bnx=b.px+ux*overlap, bny=b.py+uy*overlap;
      // only move each onto a walkable tile (don't push into walls/water)
      if(colCost(anx|0,any|0)>=0){a.px=anx;a.py=any;}
      if(colCost(bnx|0,bny|0)>=0){b.px=bnx;b.py=bny;}
    }
  }
}

/* ---------- map generation ---------- */
function addBuilt(type,x,y,owner){if(!INB(x,y))return;
  addStruct({id:uid(),kind:"s",type,x,y,hp:DEF[type].hp,maxHp:DEF[type].hp,bp:false,prog:0,need:0,
    res:0,desig:false,decon:false,owner:owner||0,qual:DEF[type].furn?1:undefined})}
function roomTheme(furn){if(!furn)return"den";
  const t=furn.map(f=>f.t);
  if(t.includes("stimlab"))return"toxic";
  if(t.includes("chemlab"))return"toxic";
  if(t.includes("dealer"))return"toxic";
  if(t.includes("hospital")||t.includes("medbed"))return"med";
  if(t.includes("school"))return"civic";
  if(t.includes("arcade"))return"exchange";
  if(t.includes("mineshaft")||t.includes("loggingcamp"))return"work";
  if(t.includes("workshop"))return"work";
  if(t.includes("gearshop"))return"work";
  if(t.includes("workstation"))return"work";
  if(t.includes("counter")||t.includes("bar"))return"exchange";
  return"den";}
function placeRoom(x0,y0,w,h,door,furn){
  for(let x=x0;x<x0+w;x++)for(let y=y0;y<y0+h;y++){
    const edge=(x===x0||x===x0+w-1||y===y0||y===y0+h-1);
    if(!edge)continue;
    if(door&&x===door.x&&y===door.y)addBuilt("door",x,y);else addBuilt("wall",x,y)}
  if(furn)for(const f of furn)addBuilt(f.t,x0+f.x,y0+f.y,f.o)
  const theme=roomTheme(furn);
  (ST.rooms||(ST.rooms=[])).push({x0,y0,w,h,theme});
  for(let x=x0;x<x0+w;x++)for(let y=y0;y<y0+h;y++){const st=structAt(x,y);if(st){st.inRoom=true;st.rth=theme}}
  if(typeof drawTerrain==="function")drawTerrain();  // keep static canvas in sync
}
// AUTO-WRAP a player-placed vendor/counter into a small walled STORE. Defensive: only builds
// walls on tiles that are currently empty + walkable, so it never overwrites other structures or
// walls off the counter. If the surrounding space is too crowded, leaves the bare counter.
function autoWrapStore(s){
  if(!s||s.bp)return false;
  if(s.inRoom||s.wrapped)return false;             // already in a room (e.g. starter shop)
  // already inside an existing room? (a wall/structure adjacent forming an enclosure) — skip
  for(const rm of (ST.rooms||[]))
    if(s.x>=rm.x0&&s.x<rm.x0+rm.w&&s.y>=rm.y0&&s.y<rm.y0+rm.h)return false;
  // propose a 4x4 store with the counter on the interior back wall, door on the front (south).
  // center the room so the counter sits one tile in from a wall.
  const W=4,H=4;
  const x0=s.x-1, y0=s.y-1;                         // counter at interior (1,1)
  // the door is on the south edge, offset from the counter column
  const door={x:x0+2,y:y0+H-1};
  // validate: every WALL tile we'd add must be empty + in-bounds (don't clobber anything).
  // interior tiles may contain the counter (ok) but nothing else blocking.
  for(let x=x0;x<x0+W;x++)for(let y=y0;y<y0+H;y++){
    if(!INB(x,y))return false;
    const edge=(x===x0||x===x0+W-1||y===y0||y===y0+H-1);
    const here=structAt(x,y);
    if(edge){
      if(x===door.x&&y===door.y){if(here)return false;continue;}  // door tile must be clear
      if(here)return false;                         // wall tile occupied → abort (graceful)
    }else{
      // interior: only the counter itself may be here
      if(here&&here!==s)return false;
    }
  }
  // build walls + door (skip the counter tile, it's already placed)
  for(let x=x0;x<x0+W;x++)for(let y=y0;y<y0+H;y++){
    const edge=(x===x0||x===x0+W-1||y===y0||y===y0+H-1);
    if(!edge)continue;
    if(x===door.x&&y===door.y)addBuilt("door",x,y);else addBuilt("wall",x,y);
  }
  // a display fixture inside to make it feel like a store (a second counter-adjacent prop)
  // place a 'rug' as a shop-floor accent on a free interior tile if available
  for(let yy=y0+1;yy<y0+H-1;yy++)for(let xx=x0+1;xx<x0+W-1;xx++){
    if(!structAt(xx,yy)&&!(xx===s.x&&yy===s.y)){addBuilt("rug",xx,yy);break;}
  }
  const theme=roomTheme([{t:s.type}]);
  (ST.rooms||(ST.rooms=[])).push({x0,y0,w:W,h:H,theme,store:true});
  for(let x=x0;x<x0+W;x++)for(let y=y0;y<y0+H;y++){const st=structAt(x,y);if(st){st.inRoom=true;st.rth=theme;}}
  s.wrapped=true;
  if(typeof drawTerrain==="function")drawTerrain();
  return true;
}
function genCity(){
  ST.cityHomes=[];
  // Organic spread on a 140x100 map: built-up core in the center,
  // nature/resource ring reserved on the outskirts (filled in a later pass).
  // Helper: place a home and register it
  function home(x0,y0,variant){
    // a lived-in layout, not scattered fixtures. A few variants so the block isn't all identical.
    const v=variant==null?RI(0,2):variant;
    let furn;
    if(v===0){ // "living-focused" — couch + tv den
      furn=[{t:"pod",x:1,y:1},{t:"lamp",x:2,y:1},
            {t:"shower",x:4,y:1},{t:"toilet",x:4,y:2},{t:"fridge",x:3,y:1},
            {t:"tv",x:1,y:3},{t:"rug",x:2,y:3},{t:"couch",x:2,y:2}];
    }else if(v===1){ // "studious" — bookshelf instead of a second comfort, bed on right
      furn=[{t:"pod",x:4,y:1},{t:"lamp",x:4,y:2},
            {t:"shower",x:1,y:1},{t:"toilet",x:1,y:2},{t:"fridge",x:2,y:1},
            {t:"couch",x:2,y:3},{t:"rug",x:3,y:3},{t:"bookshelf",x:3,y:1}];
    }else{ // "cozy" — rug-centered living, lamp-lit
      furn=[{t:"pod",x:1,y:1},{t:"fridge",x:2,y:1},
            {t:"shower",x:4,y:1},{t:"toilet",x:4,y:2},
            {t:"couch",x:1,y:3},{t:"rug",x:2,y:2},{t:"tv",x:3,y:3},{t:"lamp",x:3,y:1}];
    }
    placeRoom(x0,y0,6,5,{x:x0+2,y:y0+4},furn);
    const pod=furn.find(f=>f.t==="pod");
    ST.cityHomes.push({x0,y0,w:6,h:5,bed:{x:x0+(pod?pod.x:1),y:y0+(pod?pod.y:1)},door:{x:x0+2,y:y0+4}});}
  function decor(t,x,y){if(INB(x,y)&&!structAt(x,y))addBuilt(t,x,y);}

  // ── UNDERCLASS HOUSING (west of the divide) — dense, uniform, aligned rows ──
  const resY1=25, resY2=33, resX0=31;
  for(let i=0;i<4;i++)home(resX0+i*9, resY1);   // row 1: x 31,40,49,58
  for(let i=0;i<3;i++)home(resX0+i*9, resY2);   // row 2: aligned under row 1 (no stagger)

  // ── LABOR TIER (west of divide, below housing) — where the masses work ──
  placeRoom(31,50,10,6,{x:35,y:55},[{t:"workstation",x:1,y:1},{t:"workstation",x:3,y:1},{t:"workstation",x:5,y:1},{t:"workstation",x:7,y:1},{t:"gym",x:1,y:4},{t:"fridge",x:8,y:4}]);   // corp labor office
  placeRoom(44,50,8,6,{x:47,y:55},[{t:"counter",x:1,y:1},{t:"counter",x:2,y:1},{t:"counter",x:3,y:1},{t:"fridge",x:6,y:1},{t:"fridge",x:6,y:3}]);   // bodega

  // ── CORPORATE SECTOR (east of divide) — leisure + private medical for the haves ──
  placeRoom(74,26,8,6,{x:77,y:31},[{t:"bar",x:1,y:1},{t:"bar",x:2,y:1},{t:"bar",x:3,y:1},{t:"tv",x:6,y:1},{t:"tv",x:6,y:4}]);   // chrome bar
  placeRoom(86,26,9,6,{x:90,y:31},[{t:"medbed",x:1,y:1},{t:"medbed",x:3,y:1},{t:"medbed",x:5,y:1},{t:"medbed",x:7,y:1}]);   // med center

  // ── CRIME CORNER (west, below the labor tier, set apart) ──
  placeRoom(40,68,7,5,{x:43,y:72},[{t:"dealer",x:1,y:1},{t:"dealer",x:5,y:1},{t:"counter",x:3,y:1},{t:"pod",x:1,y:3},{t:"pod",x:5,y:3}]);

  // ── SURVEILLANCE: a watch post on the divide, overlooking the housing ──
  addBuilt("watchpost",68,34);

  // ── HYDRO FARM (west labor tier) — furnished farm building: spore vats + cold storage ──
  placeRoom(56,49,12,8,{x:62,y:56},[{t:"sporevat",x:1,y:1},{t:"sporevat",x:3,y:1},{t:"sporevat",x:5,y:1},{t:"sporevat",x:7,y:1},{t:"fridge",x:10,y:1},{t:"fridge",x:10,y:4},{t:"workstation",x:1,y:5}]);

  // ── FIXER ROW (west underbelly) — the broker's rough joint beside the den ──
  placeRoom(50,67,11,6,{x:55,y:72},[{t:"fixercorner",x:1,y:1},{t:"dealer",x:3,y:1},{t:"counter",x:5,y:1},{t:"streetvendor",x:8,y:1},{t:"pod",x:1,y:4},{t:"pod",x:9,y:4}]);
  // THE FIXER'S BACK ROOM — the avatar starts here, crashing in the fixer's quarters (pod at world 51,71)
  // while they build up. Registered as a home so the operative has a real base to return to & sleep in.
  ST.fixerHome={x0:50,y0:67,w:11,h:6,bed:{x:51,y:71},door:{x:55,y:72},fixerRoom:true};
  ST.cityHomes.push(ST.fixerHome);

  // ── CITY HALL (corporate sector) — the seat of district power ──
  placeRoom(76,49,11,7,{x:81,y:55},[{t:"counter",x:1,y:1},{t:"counter",x:2,y:1},{t:"workstation",x:4,y:1},{t:"workstation",x:6,y:1},{t:"workstation",x:8,y:1},{t:"lamp",x:5,y:1},{t:"bookshelf",x:1,y:4},{t:"couch",x:3,y:4},{t:"rug",x:4,y:4},{t:"art",x:9,y:4}]);

  // ── POLICE PRECINCT (east of the divide, overlooking the housing) ──
  placeRoom(72,37,9,6,{x:76,y:42},[{t:"counter",x:1,y:1},{t:"workstation",x:3,y:1},{t:"workstation",x:5,y:1},{t:"pod",x:7,y:1},{t:"pod",x:7,y:3},{t:"gym",x:1,y:3},{t:"lamp",x:4,y:1}]);

  // ── RESERVED OUTER-RING ZONES (markers only for now; filled next pass) ──
  // farms NW, woods NE, mines SW, civic SE — left as open ground intentionally
  ST.zones={
    farm:{x:10,y:14,w:24,h:18},
    woods:{x:106,y:14,w:24,h:18},
    mine:{x:10,y:70,w:24,h:18},
    civic:{x:104,y:70,w:28,h:20}
  };

  // ── POPULATE OUTER-RING ZONES (resource + civic) ──
  // Farmland (NW): a spread of open farm plots (walkable crops)
  const fz=ST.zones.farm;
  for(let fy=0;fy<3;fy++)for(let fx=0;fx<5;fx++)
    decor("farmplot", fz.x+3+fx*4, fz.y+3+fy*5);

  // The Woods (NE): logging camps among the trees
  const wz=ST.zones.woods;
  [[4,3],[12,4],[18,9],[7,12],[15,14]].forEach(([dx,dy])=>
    addBuilt("loggingcamp", wz.x+dx, wz.y+dy));

  // Old Mine (SW): mine shafts
  const mz=ST.zones.mine;
  [[4,3],[11,5],[17,4],[6,11],[14,12]].forEach(([dx,dy])=>
    addBuilt("mineshaft", mz.x+dx, mz.y+dy));

  // ── CIVIC DISTRICT (SE) — a furnished regime authority quarter laid into the cells carved by
  //    the x112 / x120 vertical arterials and the y82 horizontal. Every room is road-clean. ──
  const cz=ST.zones.civic;
  // small green frontage on the open ground just west of the district
  for(let py=0;py<3;py++)for(let px=0;px<2;px++)decor("park", 100+px, 73+py*2);

  // NW cell — LEARNING HUB (skills training; school fixture keeps the civic function)
  placeRoom(8,84,7,9,{x:14,y:88},[{t:"school",x:3,y:1},{t:"workstation",x:1,y:1},{t:"workstation",x:5,y:1},{t:"bookshelf",x:1,y:3},{t:"bookshelf",x:1,y:5},{t:"bookshelf",x:5,y:3},{t:"rug",x:3,y:4},{t:"art",x:5,y:6}]);

  // NMID cell — ADMIN VILLA (Mayor's fortified seat; mayorhouse keeps the roleHome)
  placeRoom(18,84,6,9,{x:20,y:92},[{t:"mayorhouse",x:2,y:1},{t:"art",x:4,y:1},{t:"workstation",x:1,y:3},{t:"counter",x:4,y:3},{t:"rug",x:2,y:4},{t:"couch",x:2,y:5},{t:"pod",x:1,y:6},{t:"fridge",x:4,y:6}]);

  // NE cell — HOSPITAL (north) over PRECINCT (south); copstation keeps the Enforcer's roleHome
  placeRoom(28,84,9,5,{x:28,y:86},[{t:"hospital",x:4,y:1},{t:"medbed",x:1,y:1},{t:"medbed",x:7,y:1},{t:"counter",x:1,y:3},{t:"medbed",x:7,y:3},{t:"pod",x:3,y:3}]);
  placeRoom(72,84,9,4,{x:72,y:85},[{t:"copstation",x:4,y:1},{t:"counter",x:1,y:1},{t:"workstation",x:7,y:1},{t:"pod",x:1,y:2},{t:"gym",x:7,y:2}]);
  // HOLDING CELLS — the regime lockup, right beside the precinct. Caught wisps are walked here + held.
  placeRoom(82,84,9,4,{x:82,y:84},[{t:"jail",x:4,y:1},{t:"pod",x:1,y:1},{t:"pod",x:7,y:1},{t:"pod",x:1,y:2},{t:"pod",x:7,y:2}]);

  // SW cell — ENTERTAINMENT COMPLEX (recreation; vendors earn the regime a cut)
  placeRoom(40,84,15,6,{x:47,y:84},[{t:"arcade",x:2,y:1},{t:"arcade",x:5,y:1},{t:"tv",x:8,y:1},{t:"tv",x:11,y:1},{t:"counter",x:13,y:1},{t:"couch",x:2,y:3},{t:"couch",x:5,y:3},{t:"streetvendor",x:9,y:3},{t:"rug",x:7,y:2}]);

  // SE cell — MARKET HALL (Shopkeeper's counters + the Fixer's back-alley node)
  placeRoom(58,84,9,6,{x:62,y:84},[{t:"counter",x:1,y:1},{t:"counter",x:2,y:1},{t:"streetvendor",x:4,y:1},{t:"counter",x:6,y:1},{t:"workstation",x:7,y:1},{t:"fixercorner",x:1,y:3},{t:"art",x:7,y:3},{t:"rug",x:4,y:3}]);

  // ── STREET FURNITURE — computed relative to rooms, not hardcoded ──
  // street lamps around the core perimeter and plaza
  const lampSpots=[
    [58,44],[68,44],[58,50],[68,50],   // plaza corners
    [44,49],[56,49],[75,49],[88,49],   // above production/commercial
    [50,29],[68,29],[46,46],[92,46],   // residential + edges
    [62,68],[68,68]                    // near crime corner
  ];
  lampSpots.forEach(([x,y])=>decor("streetlamp",x,y));

  // plaza benches + planters (central gathering space x58-68 y44-50)
  [[60,46],[60,48],[66,46],[66,48],[63,47]].forEach(([x,y])=>decor("bench",x,y));
  [[58,44],[68,44],[58,50],[68,50],[63,45]].forEach(([x,y])=>decor("planter",x,y));
  // planters along residential frontage
  for(let i=0;i<4;i++)decor("planter",resX0+1+i*9,resY1-1);

  // dumpsters tucked behind production/commercial buildings
  [[41,59],[54,59],[73,59],[85,59]].forEach(([x,y])=>decor("dumpster",x,y));

  // crates near production and crime corner
  [[51,53],[51,54],[62,69],[68,69],[40,50],[92,50]].forEach(([x,y])=>decor("crate",x,y));

  // vending machines on building frontages
  decor("vendmachine",39,54);decor("vendmachine",39,55);
  decor("vendmachine",93,54);decor("vendmachine",93,55);
}
function buildRoadTiles(){
  // write road type (3) into the terrain grid from the ROADS arterial definitions,
  // so pathfinding (terCost) and movement prefer the streets.
  ROADS.h.forEach(([x0,x1,ry])=>{for(let rx=x0;rx<=x1;rx++){
    if(INB(rx,ry))ST.ter[rx+ry*MW]=3;
    if(INB(rx,ry+1))ST.ter[rx+(ry+1)*MW]=3;}});
  ROADS.v.forEach(([rx,y0,y1])=>{for(let ry=y0;ry<=y1;ry++){
    if(INB(rx,ry))ST.ter[rx+ry*MW]=3;
    if(INB(rx+1,ry))ST.ter[(rx+1)+ry*MW]=3;}});
}
function genMap(){
  ST.ter=new Uint8Array(MW*MH);ST.structs.clear();ST.rooms=[];
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const h=hash2(x,y);ST.ter[x+y*MW]=h<.62?0:(h<.88?1:2)}
  buildRoadTiles();   // mark streets BEFORE the city places structures
  genCity();
}

/* ---------- pawns ---------- */
/* ============================================================
   THE AVATAR — your embodied operative (a controllable pawn). Six OPERATIVE ATTRIBUTES gate
   espionage/insurrection/investigation actions now, and will gate dialogue checks later.
   ============================================================ */
// the six attributes (0-10 scale). label + what they govern.
const OPS_ATTRS=[
  {k:"guile",     name:"Guile",     blurb:"deception, cover, misdirection"},
  {k:"insight",   name:"Insight",   blurb:"reading people, spotting lies, deduction"},
  {k:"nerve",     name:"Nerve",     blurb:"composure under pressure, courage"},
  {k:"presence",  name:"Presence",  blurb:"charisma, command, inspiring loyalty"},
  {k:"tradecraft",name:"Tradecraft",blurb:"surveillance, security, dead drops"},
  {k:"resolve",   name:"Resolve",   blurb:"willpower, conviction, resistance"},
];
// backgrounds: a flavor origin + a base stat spread (sums to a fixed budget so they're balanced).
const OPS_BACKGROUNDS=[
  {k:"analyst",  name:"Ex-Intelligence Analyst", desc:"You read the regime from the inside before you turned. Sharp eyes, steady hands.",
   stats:{guile:5,insight:8,nerve:4,presence:3,tradecraft:7,resolve:5}},
  {k:"fixer",    name:"Street Fixer", desc:"You survived the sprawl by knowing everyone and owing no one. A natural operator.",
   stats:{guile:8,insight:6,nerve:6,presence:6,tradecraft:4,resolve:3}},
  {k:"defector", name:"Defected Official", desc:"You wore the regime's colors and walked away with its secrets. Commanding, but watched.",
   stats:{guile:4,insight:5,nerve:5,presence:8,tradecraft:5,resolve:6}},
  {k:"ideologue",name:"True-Believer Ideologue", desc:"You were radicalized young and never wavered. Unbreakable, if not subtle.",
   stats:{guile:3,insight:4,nerve:7,presence:6,tradecraft:3,resolve:10}},
  {k:"ghost",    name:"Deep-Cover Ghost", desc:"You've lived a dozen lives under a dozen names. No one really knows you — least of all the regime.",
   stats:{guile:7,insight:5,nerve:6,presence:3,tradecraft:9,resolve:3}},
];
const OPS_POINT_BUDGET=4;   // extra points the player distributes after picking a background
// create the avatar pawn from a creation spec {name, bg, stats}
function mkAvatar(x,y,spec){
  const p=mkPawn(x,y,"sal");
  p.isAvatar=true;
  p.name=(spec&&spec.name)||"The Operative";
  p.ops=Object.assign({guile:5,insight:5,nerve:5,presence:5,tradecraft:5,resolve:5},(spec&&spec.stats)||{});
  p.background=(spec&&spec.bg)||"fixer";
  // the avatar is exempt from the regime's suspicion as an ordinary citizen; they're committed.
  p.allegiance=100;p.recruited=true;p.cellRole="leader";
  p.accent="#22ddff";          // distinct cyan — you on the map
  p.mem=[{d:0,h:6,t:"this is where it begins — one block, one cell, the whole city to win"}];
  p.gearOwned=[];p.equipped=[];  // gear loadout (populated via buyGear/equipGear)
  return p;
}
// attribute accessor with a safe default for non-avatars (so checks never crash)
function ops(p,k){return (p&&p.ops&&p.ops[k]!=null)?p.ops[k]:5;}
function theAvatar(){return ST.pawns.find(p=>p.isAvatar)||null;}
/* ============================================================
   NAMED ROLE-WISPS — the city's power structure & civic pillars, spawned from turn one. Each has a
   fixed identity + job + an insurrection ALIGNMENT (regime asset / civic / insurgent lever). Their
   PERSONALITY stats (intg, emp, amb, etc.) drive behavior: a low-integrity Mayor can be bought; a
   high-empathy Doctor shelters your cells. They are gameplay TARGETS — turn, bribe, expose, protect.
   ============================================================ */
const ROLES={
  doctor:   {title:"Doctor",    fname:"Doc",   align:"civic",   workType:"medbed", accent:"#5cffd0",
    desc:"runs the clinic — heals the block, sees who comes in bleeding",
    persLean:{emp:80,intg:65,cau:55}, allegianceLean:10},
  shopkeeper:{title:"Shopkeeper",fname:"Merchant",align:"civic",workType:"counter", accent:"#ffd24a",
    desc:"runs the store — the block's commerce flows through their counter",
    persLean:{amb:65,soc:60,intg:50}, allegianceLean:0},
  enforcer: {title:"Enforcer",  fname:"Sergeant",align:"regime", workType:"copstation", accent:"#ff5470",
    desc:"the regime's muscle — patrols the block, hunts dissent",
    persLean:{intg:40,imp:55,cau:35,emp:30}, allegianceLean:-60, regimeForce:true},
  mayor:    {title:"Mayor",     fname:"Administrator",align:"regime",workType:"mayorhouse", accent:"#c77dff",
    desc:"the regime's face — sets policy, keeps the district in line",
    persLean:{amb:80,intg:35,soc:65,cau:60}, allegianceLean:-45, regimeForce:true},
  informant:{title:"Informant", fname:"Citizen",align:"regime", workType:null,        accent:"#9aa7bd",
    desc:"a hidden snitch — feeds the regime in exchange for safety",
    persLean:{cau:75,intg:30,soc:45,imp:30}, allegianceLean:-20, secretInformant:true},
  fixer:    {title:"Fixer",     fname:"Broker", align:"insurgent",workType:"fixercorner", accent:"#ff9f2d",
    desc:"the black-market broker — knows everyone, owes no one, a natural ally",
    persLean:{amb:70,soc:75,intg:40,cur:65}, allegianceLean:35, insurgentLever:true},
};
// a named role-wisp at (x,y). role = key in ROLES.
function mkRoleWisp(x,y,roleKey){
  const R0=ROLES[roleKey];if(!R0)return mkPawn(x,y);
  const p=mkPawn(x,y);
  p.role=roleKey;
  // distinctive name: a title-flavored handle
  p.name=R0.fname+' "'+CH(NH)+'"';
  p.accent=R0.accent;
  // ingrain the role's personality lean into their stats (keeps individual variation though)
  for(const k in R0.persLean)p.pers[k]=clamp(Math.round((p.pers[k]+R0.persLean[k]*2)/3),0,100);
  // their starting allegiance leans per role (regime assets start hostile to your cause)
  p.allegiance=clamp((p.allegiance||0)+(R0.allegianceLean||0),-100,100);
  // regime roles + the informant carry their function flags
  if(R0.secretInformant){p.informant=true;}
  if(R0.regimeForce){p.regimeForce=true;}
  if(R0.insurgentLever){p.insurgentLever=true;}
  p.mem=[{d:0,h:6,t:"I'm the "+R0.title.toLowerCase()+" around here — everyone knows it"}];
  return p;
}
/* ═══════════ ELECTIONS — when a role-holder dies, the seat opens and the block elects a replacement.
   Candidates self-nominate by ambition (+ the player may propose one); voters weigh role-fit +
   relationship + the candidate's pitch. The role sits EMPTY during the campaign, so the loss is felt. */
function electableRole(rk){return !!ROLES[rk]&&!ROLES[rk].secretInformant;}
// how well a wisp FITS a role by personality (0..1) — closeness of their pers to the role's persLean.
function roleFit(p,rk){
  const lean=ROLES[rk]&&ROLES[rk].persLean;if(!lean)return 0.5;
  let tot=0,n=0;for(const k in lean){const diff=Math.abs((p.pers[k]||50)-lean[k]);tot+=1-diff/100;n++;}
  return n?clamp(tot/n,0,1):0.5;
}
// open an election for a vacated role. Gathers self-nominated candidates (ambitious or well-suited wisps).
function openElection(rk,deadName){
  if(!electableRole(rk))return;
  if(ST.election&&ST.election.role===rk)return;   // already electing this role
  if(ST.election&&!ST.election.resolved){          // an election is in progress — QUEUE this vacancy
    ST.electionQueue=ST.electionQueue||[];
    if(!ST.electionQueue.some(q=>q.role===rk)){ST.electionQueue.push({role:rk,deadName:deadName||null});
      log("\u2696 The "+ROLES[rk].title+" seat is also empty — that election will follow the current one.","info");}
    return;
  }
  const pool=ST.pawns.filter(p=>p.hp>0&&!isChild(p)&&!p.role&&!p.isAvatar);
  let field=pool.filter(p=>{const amb=p.pers.amb||50,fit=roleFit(p,rk);return amb>58||fit>0.62;}).map(p=>p.id);
  field.sort((a,b)=>{const pa=ST.pawns.find(p=>p.id===a),pb=ST.pawns.find(p=>p.id===b);
    return ((pb.pers.amb||50)/100+roleFit(pb,rk))-((pa.pers.amb||50)/100+roleFit(pa,rk));});
  field=field.slice(0,4);
  if(field.length<1){
    const best=pool.sort((a,b)=>roleFit(b,rk)-roleFit(a,rk))[0];
    if(best){installRole(best,rk);log("No one ran for "+ROLES[rk].title+" — "+best.name+" was pressed into the role.","warn");}
    return;
  }
  ST.election={role:rk,openedT:ST.tick,voteAt:ST.tick+Math.floor(TPD*0.6),
    candidates:field,pitches:{},playerPick:null,votes:{},resolved:false,deadName:deadName||null};
  log("\u2696 The "+ROLES[rk].title+" seat is empty. "+field.length+" candidate"+(field.length>1?"s have":" has")+" stepped forward — the block will vote.","info");
  banner("ELECTION: "+ROLES[rk].title.toUpperCase(),"info");
}
// the player proposes/backs a candidate (adds them to the field if eligible).
function proposeCandidate(pid){
  const e=ST.election;if(!e||e.resolved)return false;
  const p=ST.pawns.find(q=>q.id===pid);
  if(!p||p.hp<=0||isChild(p)||p.role)return false;
  if(!e.candidates.includes(pid))e.candidates.push(pid);
  e.playerPick=pid;
  log("You're backing "+p.name+" for "+ROLES[e.role].title+".","good");
  return true;
}
// each voter scores candidates (fit + relationship + pitch + your endorsement) and votes for their top.
function tallyElection(){
  const e=ST.election;if(!e)return null;const rk=e.role;
  const tally={};e.candidates.forEach(id=>tally[id]=0);
  for(const v of ST.pawns){
    if(v.hp<=0||isChild(v)||e.candidates.includes(v.id))continue;
    let bestId=null,bestScore=-1e9;
    for(const cid of e.candidates){
      const c=ST.pawns.find(p=>p.id===cid);if(!c)continue;
      const fit=roleFit(c,rk),rel=relGet(v.id,cid)/100;
      const pitchSway=e.pitches[cid]?0.12:0;
      const endorse=(e.playerPick===cid)?(0.10*(1+(v.allegiance||0)/200)):0;  // your backing sways, but the block can still reject a poor candidate
      const emp=(v.pers.emp||50)/100;
      const score=fit*(1.1-emp*0.4)+rel*(0.6+emp*0.5)+pitchSway+endorse+(Math.random()*0.12);
      if(score>bestScore){bestScore=score;bestId=cid;}
    }
    if(bestId){tally[bestId]++;e.votes[v.id]=bestId;}
  }
  let winId=e.candidates[0],winV=-1;
  for(const cid of e.candidates){const c=ST.pawns.find(p=>p.id===cid);
    const v=(tally[cid]||0)+(c?roleFit(c,rk)*0.01:0);if(v>winV){winV=v;winId=cid;}}
  e.tally=tally;return winId;
}
// give a wisp a role (election win or auto-fill).
function installRole(p,rk){
  if(!p||!ROLES[rk])return;
  p.role=rk;p.accent=ROLES[rk].accent;const R0=ROLES[rk];
  if(R0.regimeForce)p.regimeForce=true;
  if(R0.insurgentLever)p.insurgentLever=true;
  if(R0.workType){for(const s of ST.structs.values()){if(s.type===R0.workType&&!s.bp){p.assigned=K(s.x,s.y);break;}}}
  remember(p,"took office as "+R0.title+" — the block chose me");
}
// resolve the active election: install the winner, salt the losers, surface the result.
function resolveElection(){
  const e=ST.election;if(!e||e.resolved)return;
  const winId=tallyElection();const winner=ST.pawns.find(p=>p.id===winId);
  if(winner){
    installRole(winner,e.role);
    const wasPlayerPick=(e.playerPick===winId);
    log("\u2696 "+winner.name+" wins the "+ROLES[e.role].title+" seat"+(wasPlayerPick?" — your candidate took it.":".")+" ("+(e.tally[winId]||0)+" votes)","good");
    banner((winner.name.split(" ")[0])+" ELECTED","good");
    addMod(winner,"elected","Won the people's mandate",10,TPD*2);
    for(const cid of e.candidates){
      if(cid===winId)continue;const c=ST.pawns.find(p=>p.id===cid);if(!c)continue;
      if((c.pers.amb||50)>62){addMod(c,"lostrace","Lost the election I wanted",-12,TPD*1.5);applyDrift(c,{amb:3});
        if(relGet(c.id,winId)>-40)relAdj(c.id,winId,-15);
        remember(c,"lost the "+ROLES[e.role].title+" race to "+winner.name+". next time.");}
    }
    if(e.playerPick){const av=theAvatar();
      if(e.playerPick===winId){if(av)addMod(av,"kingmaker","Backed the winning candidate",6,TPD);}
      else{if(av)addMod(av,"backedloser","My candidate lost the race",-4,TPD);}}
  }
  e.resolved=true;ST.lastElection=ST.tick;ST.election=null;
  // if other seats opened during this campaign, kick off the next queued election now
  if(ST.electionQueue&&ST.electionQueue.length){
    const next=ST.electionQueue.shift();
    if(next&&!ST.pawns.some(p=>p.role===next.role))openElection(next.role,next.deadName);
  }
}
// a stat CHECK: roll against a difficulty, modified by the attribute. returns {pass, roll, margin}.
function opsCheck(attr,difficulty){
  const a=theAvatar();const stat=a?ops(a,attr):5;
  const die=RI(1,10);                        // the raw d10 (1 = fumble, 10 = triumph regardless of stat)
  const roll=die+stat;
  const margin=roll-difficulty;
  // BANDED OUTCOME — the dice select WHICH story you get, not just pass/fail. Your stat shifts the band.
  // A natural 1 always at least fumbles; a natural 10 always at least succeeds (skill can't be fully
  // negated by luck, nor luck by skill).
  let band;
  if(die===1) band = margin>=4 ? "partial" : "critfail";   // a fumble; only a huge stat edge salvages it
  else if(die===10) band = margin<=0 ? "partial" : "critwin"; // a triumph; lands even against the odds
  else if(margin>=5) band="critwin";
  else if(margin>=1) band="success";
  else if(margin>=-3) band="partial";        // near-miss: it half-works, with a complication
  else band="fail";
  return {pass:band==="success"||band==="critwin"||band==="partial",band,roll,die,margin,stat};
}
// RESOLVE — willpower/conviction/resistance. A high-Resolve operative weathers regime pressure: blown ops
// leak less, framing/compromise efforts against your people land softer. Returns a PENALTY MULTIPLIER in
// [0.5..1.15]: Resolve 10 → 0.5 (penalties halved), Resolve 5 → ~0.9, Resolve 1 → 1.15 (you crack easier).
function resolveMod(){
  const r=ops(theAvatar(),"resolve");           // 1..10
  return clamp(1.0 - (r-5)*0.08, 0.5, 1.15);
}
function mkPawn(x,y,spec){const t1=CH(TRAITS);let t2=CH(TRAITS);while(t2===t1)t2=CH(TRAITS);
  const sk={sal:RI(0,5),bld:RI(0,5),cook:RI(0,5),sht:RI(1,6)};
  if(spec)sk[spec]=clamp(sk[spec]+4,0,10);
  const TP={drive:RI(5,95),nerve:RI(5,95),bond:RI(5,95),guard:RI(5,95),edge:RI(5,95),grit:RI(5,95)};
  const jt=()=>RI(-7,7);
  const pers={
    amb:clamp(TP.drive+jt(),0,100),ind:clamp((TP.drive+TP.grit)/2+jt(),0,100),
    imp:clamp(TP.nerve+jt(),0,100),cau:clamp((TP.guard+100-TP.nerve)/2+jt(),0,100),
    soc:clamp(TP.bond+jt(),0,100),emp:clamp((TP.bond+100-TP.grit)/2+jt(),0,100),
    cur:clamp(TP.edge+jt(),0,100),intg:clamp((TP.guard+100-TP.edge)/2+jt(),0,100)};
  return{id:uid(),kind:"pawn",name:CH(NF)+' "'+CH(NH)+'"',
    accent:tempCols(pers)[0],tr:[t1,t2],sk,xp:{sal:0,bld:0,cook:0,sht:0},
    px:x+.5,py:y+.5,hp:100,drafted:false,needs:{food:R(80,95),rest:R(70,90),hyg:R(70,90),fun:R(60,85),socN:R(60,85)},
    mood:60,mods:[],cd:0,
    job:null,path:null,pi:0,pTx:-1,pTy:-1,claim:0,dazed:0,dz:null,sleeping:false,
    carry:null,order:null,unre:new Map(),flee:0,hurtT:-999,assigned:null,
    pers,sched:mkSched(pers,[t1,t2]),stress:0,addiction:0,rep:{corp:0,gang:0,neighbors:0,city:0},
    bias:{eat:1,sleep:1,cook:1,build:1,salvage:1,haul:1,explore:1,idle:1,hygiene:1,recreate:1,socialize:1,work:1},
    drift:{day:0,used:0},credits:R(28,50),
    career:initCareer(sk,pers),   // vocation, aspiration, work ethic, satisfaction
    attach:0,                     // attachment to owned property (builds with tenure)
    age:RI(19,46),                // adult age in years
    birthDay:null,                // null = arrived as adult; set for the colony-born
    surname:CH(NL),               // family line
    parents:null,child:false,
    // INSURRECTION: where this wisp leans. allegiance -100 (regime loyalist) .. +100 (committed
    // to your cause). Most start near neutral, nudged by personality. recruited=in a cell.
    allegiance:clamp(RI(-25,25)+Math.round((TP.nerve-50)*0.2),-100,100),
    recruited:false, cellRole:null, informant:false,
    secret:null,            // a secret this wisp knows (espionage target) — assigned lazily
    mem:[{d:0,h:6,t:"ended up on this dead block after the last squat got torched"}],
    homeless:false}}
/* ============================================================
   DYNASTIES — children, aging, generational inheritance
   ============================================================ */
const CHILD_NEEDS=()=>({food:R(80,95),rest:R(70,90),hyg:R(70,90),fun:R(70,90),socN:R(70,90)});
// a child born to two parents — blends traits, takes a parent's surname, can't work until grown
function mkChild(pa,pb,x,y){
  const blend=(a,b)=>clamp(Math.round((a+b)/2+RI(-12,12)),0,100);
  const pers={};
  for(const k of ["amb","ind","imp","cau","soc","emp","cur","intg"])
    pers[k]=blend(pa.pers[k]||50,pb.pers[k]||50);
  // children start with low skills (they'll learn as they grow / from mentors)
  const sk={sal:RI(0,1),bld:RI(0,1),cook:RI(0,1),sht:RI(0,1)};
  // inherit one trait from a parent, plus one fresh trait
  const parentTraits=[...(pa.tr||[]),...(pb.tr||[])];
  const t1=parentTraits.length?CH(parentTraits):CH(TRAITS);
  let t2=CH(TRAITS);while(t2===t1)t2=CH(TRAITS);
  const surname=Math.random()<0.5?pa.surname:pb.surname;
  return{id:uid(),kind:"pawn",name:CH(NF)+' "'+CH(NH)+'"',
    accent:tempCols(pers)[0],tr:[t1,t2],sk,xp:{sal:0,bld:0,cook:0,sht:0},
    px:x+.5,py:y+.5,hp:100,drafted:false,needs:CHILD_NEEDS(),
    mood:70,mods:[],cd:0,
    job:null,path:null,pi:0,pTx:-1,pTy:-1,claim:0,dazed:0,dz:null,sleeping:false,
    carry:null,order:null,unre:new Map(),flee:0,hurtT:-999,assigned:null,
    pers,sched:mkSched(pers,[t1,t2]),stress:0,addiction:0,rep:{corp:0,gang:0,neighbors:0,city:0},
    bias:{eat:1,sleep:1,cook:1,build:1,salvage:1,haul:1,explore:1,idle:1,hygiene:1,recreate:1,socialize:1,work:1},
    drift:{day:0,used:0},credits:0,
    career:initCareer(sk,pers),
    attach:0,
    age:0,birthDay:dayN(),
    surname,
    parents:[pa.id,pb.id],child:true,
    // INSURRECTION: colony-born children inherit a political lean from their parents — the seed of
    // the generational long game (radicalized parents tend to raise radicalized kids).
    allegiance:clamp(Math.round(((pa.allegiance||0)+(pb.allegiance||0))/2*0.6)+RI(-15,15),-100,100),
    recruited:false, cellRole:null, informant:false, secret:null,
    mem:[{d:dayN(),h:hourN()|0,t:"born on this block — it's all I've ever known"}],
    homeless:false}}
function isChild(p){return !!(p&&p.child);}
// count active (built, non-blueprint) structures of a given type
function countBuilt(type){let n=0;for(const s of ST.structs.values())if(!s.bp&&s.type===type)n++;return n;}
/* ============================================================
   FURNITURE — quality tiers, slow decay, ownership, breakdown
   ============================================================ */
const QUALITY=[
  {t:0,name:"cheap",    col:"#9aa7bd", decayMul:1.6, effMul:0.8, priceMul:0.6},
  {t:1,name:"standard", col:"#7aa2ff", decayMul:1.0, effMul:1.0, priceMul:1.0},
  {t:2,name:"premium",  col:"#ffd84a", decayMul:0.5, effMul:1.3, priceMul:2.2},
];
// base price (credits) for buying/replacing each furniture type at standard quality
const FURN_PRICE={pod:45,lamp:15,fridge:40,toilet:25,shower:25,tv:30,gym:40,
  couch:35,bookshelf:50,art:60,rug:25};
function isFurniture(s){return s&&DEF[s.type]&&DEF[s.type].furn;}
function qualOf(s){return QUALITY[s.qual||0]||QUALITY[1];}
function furnPrice(type,qual){return Math.round((FURN_PRICE[type]||30)*QUALITY[qual||1].priceMul);}
function isBroken(s){return isFurniture(s)&&s.hp<=0;}
// a furniture item's effect is suppressed when broken, scaled by quality otherwise
function furnEffective(s){return isFurniture(s)&&!s.bp&&s.hp>0;}
// slow decay: furniture loses a sliver of hp per day, faster for cheap, slower for premium.
// breakdowns are occasional, not constant. Called daily.
function furnitureDecayTick(){
  for(const s of ST.structs.values()){
    if(!isFurniture(s)||s.bp)continue;
    if(s.qual===undefined)s.qual=1;
    const wear=R(1.6,3.0)*qualOf(s).decayMul;   // ~2.3 hp/day baseline → standard breaks in ~25-30 days (cheap faster, premium slower)
    if(s.hp>0){
      s.hp=Math.max(0,s.hp-wear);
      if(s.hp<=0){
        // it just broke
        s.brokeDay=dayN();
        const owner=s.owner?ST.pawns.find(p=>p.id===s.owner):null;
        float(s.x+.5,s.y+.5,"BROKE","#ff4757");
        if(owner){addMod(owner,"brokefurn","Something broke at home",-5,TPD);
          remember(owner,"my "+DEF[s.type].name+" broke down — need to deal with it");}
        log(DEF[s.type].name+(owner?" ("+owner.name+"'s)":"")+" broke down.","warn");
      }
    }
  }
}
// NPC home-furnishing: residents with money and store access maintain & improve their homes.
// Runs daily per pawn. Priorities: (1) fix/replace broken items, (2) fill a missing want,
// (3) occasionally upgrade quality if wealthy. District earns a cut of every purchase.
const FURN_WANTS=["couch","rug","tv","bookshelf","art"];  // things a home aspires to have
function hasStore(){return countBuilt("furnstore")>0;}
function homeStructs(p){const out=[];if(!p.home)return out;const h=p.home;
  for(const s of ST.structs.values()){if(s.bp)continue;
    if(s.x>=h.x0&&s.x<h.x0+h.w&&s.y>=h.y0&&s.y<h.y0+h.h)out.push(s);}
  return out;}
/* ============================================================
   HOME VISITING & PRIVATE PROPERTY — wisps know whose home is whose,
   respect it by relationship tier, and enter for reasons (social,
   relationship, crime). Built on existing rel/grudge/gang systems.
   ============================================================ */
// which pawn OWNS the home containing tile (x,y)? null if not a home / unclaimed.
function homeOwnerAt(x,y){
  for(const p of ST.pawns){const h=p.home;if(!h)continue;
    if(x>=h.x0&&x<h.x0+h.w&&y>=h.y0&&y<h.y0+h.h)return p;}
  return null;
}
// are a and b family (partners or parent/child)?
function areFamily(a,b){
  if(!a||!b)return false;
  if(partnerOf(a)===b||partnerOf(b)===a)return true;
  if((a.parents||[]).includes(b.id)||(b.parents||[]).includes(a.id))return true;
  return false;
}
// may pawn p LEGITIMATELY enter owner's home? relationship-tiered:
//  own home / family → always; good friend (rel>50) → yes; else no.
function canEnterHome(p,owner){
  if(!owner||owner===p)return true;
  if(areFamily(p,owner))return true;
  if(relGet(p.id,owner.id)>50)return true;
  return false;
}
function spendAtStore(p,amount){
  p.credits=(p.credits||0)-amount;
  ST.income=(ST.income||0)+Math.round(amount*0.4);   // district takes a 40% cut of furniture sales
}
function tryFurnish(p){
  if(isChild(p)||p.homeless||!p.home||!hasStore())return;
  const cred=p.credits||0;
  if(cred<30)return;                                  // need a cushion before buying comfort
  const mine=homeStructs(p);
  // 1) a broken item I own → repair (cheap) or replace (pricier, maybe nicer)
  const broken=mine.find(s=>isBroken(s)&&(!s.owner||s.owner===p.id));
  if(broken){
    const repairCost=Math.round(furnPrice(broken.type,broken.qual||1)*0.35);
    if(cred>=repairCost){
      spendAtStore(p,repairCost);broken.hp=broken.maxHp;broken.owner=p.id;
      float(broken.x+.5,broken.y+.5,"REPAIRED","#39ff88");
      remember(p,"got my "+DEF[broken.type].name+" working again");
      return;}
  }
  // 2) buy a furniture WANT I don't have yet (placed on a free tile in my home)
  const have=new Set(mine.map(s=>s.type));
  const want=FURN_WANTS.find(t=>!have.has(t));
  if(want){
    // wealthier pawns buy nicer; tier by net worth
    const wt=wealthTier(p).t;
    const qual=wt>=3?2:wt>=2?1:0;
    const price=furnPrice(want,qual);
    if(cred>=price+20){
      const spot=freeHomeTile(p);
      if(spot){
        spendAtStore(p,price);
        addStruct({id:uid(),kind:"s",type:want,x:spot.x,y:spot.y,hp:DEF[want].hp,maxHp:DEF[want].hp,
          bp:false,prog:0,need:0,res:0,desig:false,decon:false,owner:p.id,qual});
        float(spot.x+.5,spot.y+.5,"+"+DEF[want].name,QUALITY[qual].col);
        addMod(p,"newfurn","Bought something nice",6,TPD*1.5);
        remember(p,"picked up a "+QUALITY[qual].name+" "+DEF[want].name+" for the place");
        return;}
    }
  }
  // 3) wealthy pawns occasionally upgrade a cheap item to premium
  if(wealthTier(p).t>=3&&cred>120&&Math.random()<0.2){
    const upgr=mine.find(s=>isFurniture(s)&&(s.qual||1)<2&&(!s.owner||s.owner===p.id));
    if(upgr){const price=furnPrice(upgr.type,2);
      if(cred>=price){spendAtStore(p,price);upgr.qual=2;upgr.hp=upgr.maxHp;upgr.owner=p.id;
        float(upgr.x+.5,upgr.y+.5,"UPGRADED","#ffd84a");
        addMod(p,"upgradefurn","Treated myself",8,TPD*2);
        remember(p,"upgraded my "+DEF[upgr.type].name+" to the good stuff");}
    }
  }
}
// find a free, walkable tile inside a pawn's home for placing new furniture
function freeHomeTile(p){
  if(!p.home)return null;const h=p.home;
  for(let yy=h.y0+1;yy<h.y0+h.h-1;yy++)for(let xx=h.x0+1;xx<h.x0+h.w-1;xx++){
    if(!INB(xx,yy))continue;
    if(structAt(xx,yy))continue;
    if(colCost(xx,yy)<0)continue;
    return{x:xx,y:yy};}
  return null;
}
/* ============================================================
   STORE ROBOTS — automate a vendor: reliable but earns less than
   a content human, costs upkeep, and can break down (needs repair).
   ============================================================ */
const ROBO_INSTALL=160;   // one-time credits to automate a store
const ROBO_UPKEEP=4;      // district income/day to run a robot
const ROBO_MAXHP=100;     // robot integrity; decays slowly, breaks at 0
function canAutomate(s){return s&&!s.bp&&DEF[s.type]&&DEF[s.type].vendor&&!s.roboStaffed;}
function roboBroken(s){return s&&s.roboStaffed&&(s.roboHp||0)<=0;}
function roboWorking(s){return s&&s.roboStaffed&&(s.roboHp||0)>0;}
// install a robot on a store (player action; charges district income)
function automateStore(s){
  if(!canAutomate(s))return false;
  if((ST.income||0)<ROBO_INSTALL){flashMsg&&flashMsg("Need "+ROBO_INSTALL+"c district income");return false;}
  ST.income-=ROBO_INSTALL;
  s.roboStaffed=true;s.roboHp=ROBO_MAXHP;
  // free any human who was working here — they'll find other work
  for(const p of ST.pawns)if(p.assigned===K(s.x,s.y)){p.assigned=null;if(p.contract&&p.contract.fixtureKey===K(s.x,s.y))p.contract=null;}
  log(DEF[s.type].name+" is now robot-staffed — reliable, but it won't spend wages back into the block.","info");
  if(typeof SFX!=="undefined"&&SFX.build)SFX.build();
  return true;
}
function deautomateStore(s){
  if(!s||!s.roboStaffed)return;
  s.roboStaffed=false;s.roboHp=0;
  log(DEF[s.type].name+" is back to human staffing.","info");
}
function repairRobo(s){
  if(!s||!s.roboStaffed)return false;
  const cost=Math.round(ROBO_INSTALL*0.3);
  if((ST.income||0)<cost){flashMsg&&flashMsg("Need "+cost+"c to repair");return false;}
  ST.income-=cost;s.roboHp=ROBO_MAXHP;
  log(DEF[s.type].name+"'s robot was repaired.","good");return true;
}
// daily: robots decay slowly + drain upkeep; broken robots stop earning until repaired
function roboTick(){
  // ── UNIVERSAL ATTENDANTS — every building that should have someone running it gets one. A wisp is
  // always preferred (they spend wages back into the block); but any building left with NO wisp worker
  // gets a robot so it's never dark/unattended. Robots cost upkeep — coverage isn't free. ──
  for(const s of ST.structs.values()){
    if(s.bp||s.roboStaffed)continue;
    const d=DEF[s.type];if(!d)continue;
    // does this building type take an attendant? (anything that produces, refines, vends, or is a civic/
    // utility post). Pure furniture/decor/walls don't.
    const needsAttendant=d.prod||d.refine||d.vendor||d.utility||d.canteen||d.civic||d.security||d.roleHome;
    if(!needsAttendant)continue;
    // is a living wisp assigned + actually able to work it?
    const hasWisp=ST.pawns.some(p=>p.assigned===K(s.x,s.y)&&p.hp>0&&!isChild(p));
    if(hasWisp){s._unstaffedDays=0;continue;}
    // role buildings (precinct/villa/fixer corner) wait for their role-holder — don't robot-staff those
    if(d.roleHome){const holder=ST.pawns.find(p=>p.role===d.roleHome&&p.hp>0);if(holder)continue;}
    // WISPS GET FIRST CLAIM — only robot-staff a building that's sat unstaffed a while (utilities are urgent
    // so they get a robot faster). This leaves room for wisps to take the jobs they'd actually work.
    s._unstaffedDays=(s._unstaffedDays||0)+1;
    const isUtility=!!d.utility;
    const patience=isUtility?1:3;     // utilities staffed next day; others get 3 days for a wisp to claim
    if(s._unstaffedDays<patience)continue;
    if(!isUtility&&(ST.income||0)<2)continue;   // can't afford a robot for non-essential right now
    s.roboStaffed=true;s.roboHp=ROBO_MAXHP;s.autoStaffed=true;   // mark as auto (vs player-chosen)
  }
  // auto-staffed robots YIELD to wisps: if an unemployed wisp could work an auto-robot building, free it
  {const idleWorkers=ST.pawns.filter(p=>!isChild(p)&&!p.isAvatar&&p.hp>0&&!p.assigned&&!p.role);
   if(idleWorkers.length){for(const s of ST.structs.values()){
     if(!s.roboStaffed||!s.autoStaffed)continue;const d=DEF[s.type];if(!d||d.utility)continue;  // keep utility bots
     if(idleWorkers.length===0)break;
     // hand this job back to a wisp
     s.roboStaffed=false;s.roboHp=0;s.autoStaffed=false;idleWorkers.pop();
   }}}
  let upkeep=0;
  for(const s of ST.structs.values()){
    if(!s.roboStaffed)continue;
    upkeep+=ROBO_UPKEEP;
    if((s.roboHp||0)>0){
      s.roboHp=Math.max(0,s.roboHp-R(0.8,1.8));   // ~slower than furniture; breaks in ~tens of days
      if(s.roboHp<=0){
        float(s.x+.5,s.y+.5,"ROBOT DOWN","#ff4757");
        log(DEF[s.type].name+"'s robot broke down — it's offline until repaired.","warn");
      }
    }
  }
  if(upkeep>0)ST.income=(ST.income||0)-upkeep;
}
const ADULT_AGE=14;   // in-game days to mature (each "year" of age ~ scaled to days)
// aging: children grow toward adulthood; daily tick advances age and matures them
function ageTick(){
  // a nursery accelerates maturation (each nursery shaves the effective threshold)
  const nurseries=countBuilt("nursery");
  const matureAt=Math.max(8,ADULT_AGE-nurseries*3);   // each nursery: -3 days, floor 8
  for(const p of ST.pawns){
    if(p.birthDay==null)continue;          // arrived as adult, no in-colony aging
    const daysAlive=dayN()-p.birthDay;
    if(p.child){
      p.age=Math.floor(daysAlive/ (ADULT_AGE/14));
      if(daysAlive>=matureAt)matureChild(p);
    }
  }
}
function matureChild(p){
  p.child=false;
  p.age=Math.max(14,p.age);
  // coming of age: a small starting skill bump + can now work
  for(const k of ["sal","bld","cook","sht"])p.sk[k]=clamp(p.sk[k]+RI(1,3),0,10);
  p.career=initCareer(p.sk,p.pers);
  addMod(p,"cameofage","Came of age",10,TPD*2);
  log(p.name+" "+(p.surname||"")+" came of age on the block.","good");
  chronicle(p.name+" "+(p.surname||"")+" came of age.","✦");
  if(typeof emote==="function")emote(p,"idea");
}
// conception: stable partnered pairs with a home may have a child (rate-limited, pop-capped)
function tryConception(){
  if(ST.pawns.length>=14)return;                  // soft population cap
  if(!ST.relMeta)return;
  const seen=new Set();
  for(const a of ST.pawns){
    const b=partnerOf(a);
    if(!b||seen.has(b.id))continue;seen.add(a.id);
    if(isChild(a)||isChild(b))continue;
    if(!a.home||a.homeless||b.homeless)continue;   // need a stable home
    // both reasonably content and not destitute
    if(a.mood<45||b.mood<45)continue;
    if((a.credits||0)+(b.credits||0)<30)continue;
    // already have a young child? space them out
    const kids=ST.pawns.filter(p=>p.parents&&(p.parents.includes(a.id))&&isChild(p));
    if(kids.length>=1)continue;
    if(Math.random()<0.5){
      const spot=a.home.bed||{x:a.px|0,y:a.py|0};
      const child=mkChild(a,b,spot.x,spot.y);
      // family bonds: strong child↔parent ties
      relAdj(child.id,a.id,55);relAdj(child.id,b.id,55);
      claimHome(child,a.home);
      ST.pawns.push(child);
      addMod(a,"newchild","New child",18,TPD*4);addMod(b,"newchild","New child",18,TPD*4);
      if(typeof emote==="function"){emote(a,"love");emote(b,"love");}
      log(a.name+" and "+b.name+" had a child — "+child.name+" "+child.surname+".","good");
      chronicle(child.name+" "+child.surname+" was born to "+a.name+" and "+b.name+".","☻");
      banner("NEW CHILD","good");
      return; // one per check
    }
  }
}
/* ============================================================
   WORK & AMBITION — vocation, aspiration, ethic, satisfaction
   ============================================================ */
// Vocations map a pawn's strongest skill to a job identity + the fixtures they prefer.
const VOCATIONS={
  fabricator:{name:"Fabricator", sk:"bld",  fix:["workshop","gearshop"],         blurb:"builds and machines"},
  techie:    {name:"Techie",     sk:"sal",  fix:["workstation","chemlab","stimlab"],blurb:"runs terminals and labs"},
  grower:    {name:"Grower",     sk:"cook", fix:["farmplot"],                     blurb:"works the farms"},
  laborer:   {name:"Scavenger",   sk:"sht",  fix:["loggingcamp","mineshaft"],      blurb:"strips scrap and runs data"},
  trader:    {name:"Trader",     sk:"sal",  fix:["counter","bar","gearshop"],     blurb:"works the counters"},
};
function initCareer(sk,pers){
  // vocation = whichever vocation's governing skill is highest (ties broken by ambition lean)
  let best="laborer",bv=-1;
  for(const k in VOCATIONS){const v=VOCATIONS[k];const s=sk[v.sk]||0;if(s>bv){bv=s;best=k}}
  const amb=pers.amb||50;
  // aspiration: ambitious pawns chase a wealth target; others want to master their craft
  const aspKind=amb>58?"wealth":amb>34?"craft":"easy";
  const aspTarget=aspKind==="wealth"?Math.round(180+amb*4):aspKind==="craft"?Math.min(10,(bv|0)+RI(3,5)):0;
  return{voc:best, ethic:clamp(Math.round((amb*0.6+(pers.ind||50)*0.4)),0,100),
    asp:{kind:aspKind,target:aspTarget,met:false}, sat:60, specialist:null, gripe:0, lastRaiseDay:0};
}
function vocationOf(p){return (p.career&&VOCATIONS[p.career.voc])||VOCATIONS.laborer;}
// does this fixture match the pawn's vocation?
function fitsVocation(p,type){const v=vocationOf(p);return v.fix.includes(type);}
// work-ethic shifts how hard/long they work: high ethic = overwork, low = slack
function ethicMul(p){const e=(p.career&&p.career.ethic)||50;return 0.7+e/100*0.6;} // 0.7..1.3
/* ============================================================
   OWNERSHIP & WEALTH — class, savings, property attachment, inheritance
   ============================================================ */
// wealth class from net worth (credits + owned-property value)
function ownedValue(p){
  let v=0;
  for(const s of ST.structs.values())if(s.owner===p.id)v+=(DEF[s.type]&&DEF[s.type].hp)||40;
  if(p.home)v+=120;            // a claimed home is real security
  if(p.hasGear)v+=40;
  return v;
}
function netWorth(p){return Math.max(0,p.credits||0)+ownedValue(p);}
const WEALTH_TIERS=[
  {t:0,name:"Destitute",  max:60},     // homeless or broke
  {t:1,name:"Scraping",   max:200},    // housed, little savings
  {t:2,name:"Comfortable",max:380},    // housed + a cushion
  {t:3,name:"Affluent",   max:650},    // real savings
  {t:4,name:"Kingpin",    max:Infinity},
];
function wealthTier(p){const w=netWorth(p);for(const tier of WEALTH_TIERS)if(w<=tier.max)return tier;return WEALTH_TIERS[WEALTH_TIERS.length-1];}
// pawns claim ownership of the home + pod they sleep in; attachment grows over time
function claimHome(p,home){
  if(!home)return;
  p.home=home;
  const bedS=structAt(home.bed.x,home.bed.y);
  if(bedS&&bedS.type==="pod"){bedS.owner=p.id;}
  p.attach=(p.attach||0); // attachment to property, builds with tenure
}
// losing owned property: big mood hit + a grudge against whoever caused it

// ═══ BASE OF OPERATIONS — the developable HQ. You grow your base by building STATIONS, each unlocking a
//    piece of the espionage economy. The HQ starts as the fixer's borrowed room; claiming + developing it
//    makes it your operational stronghold. ═══
// the station catalog — each is a capability installation. cost is district income. `unlocks` is the
// espionage-economy capability it gates (read by the gear/infra/hack systems via hasStation()).
const HQ_STATIONS={
  planning:  {name:"Planning Table",   icon:"\u25a4", cost:90,  pillar:"core",
              desc:"The ops command center \u2014 the heart of your base. Coordinate operations from here.",
              unlocks:"ops_hub", blurb:"Makes the room a true base of operations."},
  workbench: {name:"Workbench",        icon:"\u2692", cost:120, pillar:"spy",
              desc:"Craft, buy, and store operative GEAR. Your loadout is outfitted here.",
              unlocks:"gear", blurb:"Unlocks the gear catalog \u2014 outfit your operative."},
  survhub:   {name:"Surveillance Hub", icon:"\u25c9", cost:150, pillar:"monitor",
              desc:"The control room for your camera + wiretap network. Watch what your devices see.",
              unlocks:"monitor", blurb:"Unlocks + manages your surveillance infrastructure."},
  serverroom:{name:"Server Room",      icon:"\u2318", cost:180, pillar:"hack",
              desc:"A hardened cyberdeck rig. Houses your electronic-warfare capability.",
              unlocks:"hack", blurb:"Unlocks HACK ops \u2014 grid taps, data heists."},
  saferoom:  {name:"Safe Room",        icon:"\u25a3", cost:100, pillar:"defend",
              desc:"A shielded space to lie low. Exposure cools faster while you're based here.",
              unlocks:"safe", blurb:"Recover exposure faster; a fallback when your cover is blown."},
};
// claim the HQ — the borrowed fixer room becomes YOURS (the moment you commit to it as a base). Raises the
// operative's attachment to it (it's home now) and stamps when you founded it.
function claimHQ(){
  if(!ST.hq){ST.hq={claimed:false,room:ST.fixerHome||null,stations:{},foundedTick:0};}
  if(ST.hq.claimed)return false;
  ST.hq.claimed=true;ST.hq.foundedTick=ST.tick;
  if(!ST.hq.room)ST.hq.room=ST.fixerHome||null;
  const av=theAvatar();if(av)av.attach=Math.max(av.attach||0,8);   // it's yours now — attachment rises
  if(typeof flashMsg==="function")flashMsg("This place is yours now \u2014 your base of operations.");
  if(typeof log==="function")log("\u25a4 You've claimed the back room as your own \u2014 a base of operations takes shape.","good");
  return true;
}
// is a station built? (the ownership gate the espionage economy reads — gear needs workbench, hack needs
// server room, etc.)
function hasStation(kind){return !!(ST.hq&&ST.hq.claimed&&ST.hq.stations&&ST.hq.stations[kind]);}
// does the HQ grant a capability? (maps a capability string to whichever station unlocks it)
function hqUnlocks(cap){
  if(!ST.hq||!ST.hq.claimed)return false;
  for(const k in HQ_STATIONS)if(HQ_STATIONS[k].unlocks===cap&&ST.hq.stations[k])return true;
  return false;
}
// build a station — pay income, mark it built. (Placement of the physical installation in the room is a
// later visual step; this is the capability layer.) Returns true on success.
function buildStation(kind){
  const def=HQ_STATIONS[kind];if(!def)return false;
  if(!ST.hq||!ST.hq.claimed){if(typeof flashMsg==="function")flashMsg("Claim your base first");return false;}
  if(hasStation(kind)){if(typeof flashMsg==="function")flashMsg(def.name+" is already built");return false;}
  if(!afford({income:def.cost})){return false;}    // afford() flashes the shortfall
  pay({income:def.cost});
  ST.hq.stations[kind]={builtTick:ST.tick};
  if(typeof flashMsg==="function")flashMsg(def.name+" built \u2014 "+def.blurb);
  if(typeof log==="function")log("\u25a4 "+def.name+" installed in your base. "+def.blurb,"good");
  if(typeof syncHUD==="function")syncHUD();
  return true;
}
// count built stations (for progress display)
function hqStationCount(){return ST.hq&&ST.hq.stations?Object.keys(ST.hq.stations).length:0;}

/* ═══════════════════════════════════════════════════════════════════
   GEAR FRAMEWORK — step 1 of the espionage economy.
   Catalog + loadout + gearMod helper + diff hook at resolve chokepoint.
   UI (purchase screen, loadout panel) is a later step — this is data+logic only.
   ═══════════════════════════════════════════════════════════════════ */
const GEAR_SLOTS=3;   // max simultaneously equipped items — tunable

// Starter gear catalog. Each item modifies a single op-field (diff here; range/witnessK/etc. in later steps).
// cost.income is district income; costs are first-draft, tune from play.
const GEAR={
  surveil_rig:{name:"Surveillance Rig",  pillar:"spy",     cost:80,
    effect:{ops:["surveil"],          field:"diff", amount:-2},
    desc:"Directional mic + lens array. Makes tailing cleaner."},
  spoofer:    {name:"ID Spoofer",        pillar:"spy",     cost:90,
    effect:{ops:["frame","blackmail"], field:"diff", amount:-2},
    desc:"Generates convincing false identities and planted records."},
  breach_kit: {name:"Breach Kit",        pillar:"general", cost:100,
    effect:{ops:["steal","sabotage"],  field:"diff", amount:-2},
    desc:"Lock picks, bypass tools, and a compact cutting torch."},
  burner_creds:{name:"Burner Credits",   pillar:"general", cost:70,
    effect:{ops:["bribe"],             field:"diff", amount:-2},
    desc:"Untraceable currency loaded onto throwaway chips."},
};

// Ensure the avatar has gear arrays (called in newGame and as a backfill in applyState).
function initAvatarGear(av){
  if(!av)return;
  if(!Array.isArray(av.gearOwned))av.gearOwned=[];
  if(!Array.isArray(av.equipped)) av.equipped=[];
}

// Buy a gear item. Gates: HQ Workbench must be built; item must exist; not already owned; can afford.
function buyGear(id){
  const av=theAvatar();if(!av)return false;
  const g=GEAR[id];if(!g){if(typeof flashMsg==="function")flashMsg("Unknown gear: "+id);return false;}
  if(!hqUnlocks("gear")){if(typeof flashMsg==="function")flashMsg("Need a Workbench at HQ to craft gear");return false;}
  if((av.gearOwned||[]).includes(id)){if(typeof flashMsg==="function")flashMsg(g.name+" already owned");return false;}
  if(!afford({income:g.cost}))return false;
  pay({income:g.cost});
  initAvatarGear(av);
  av.gearOwned.push(id);
  if(typeof log==="function")log("Acquired: "+g.name,"good");
  return true;
}

// Equip an owned item. Gates: must own it; not already equipped; slot cap not exceeded.
function equipGear(id){
  const av=theAvatar();if(!av)return false;
  initAvatarGear(av);
  if(!av.gearOwned.includes(id)){if(typeof flashMsg==="function")flashMsg("You don't own that gear");return false;}
  if(av.equipped.includes(id)){if(typeof flashMsg==="function")flashMsg("Already equipped");return false;}
  if(av.equipped.length>=GEAR_SLOTS){if(typeof flashMsg==="function")flashMsg("Gear slots full ("+GEAR_SLOTS+")");return false;}
  av.equipped.push(id);
  return true;
}

// Unequip an item (keeps it in gearOwned).
function unequipGear(id){
  const av=theAvatar();if(!av)return false;
  initAvatarGear(av);
  const i=av.equipped.indexOf(id);if(i<0)return false;
  av.equipped.splice(i,1);
  return true;
}

// Sum the effect.amount for all equipped gear that targets opKey on the given field.
// Returns a number (negative for diff-reducing gear). Zero if nothing applies.
function gearMod(opKey,field){
  const av=theAvatar();if(!av||!Array.isArray(av.equipped)||!av.equipped.length)return 0;
  let total=0;
  for(const id of av.equipped){const g=GEAR[id];
    if(g&&g.effect&&g.effect.field===field&&g.effect.ops.includes(opKey))total+=g.effect.amount;}
  return total;
}

function loseProperty(p,reason,culpritId){
  const att=p.attach||0;
  addMod(p,"propertyloss","Lost what was mine",-(6+att*0.1),TPD*2);
  p.attach=Math.max(0,att*0.4);
  if(culpritId&&culpritId!==p.id){relAdj(p.id,culpritId,-25);}
  remember(p,reason);
}
// inheritance: on death, savings + property pass to closest living tie (partner/friend/family), else revert
function inherit(dead){
  // find the living pawn with the strongest positive bond to the deceased
  let heir=null,best=14;  // require a real bond (>14) to inherit
  for(const q of ST.pawns){if(q.id===dead.id)continue;
    const r=relGet(dead.id,q.id);if(r>best){best=r;heir=q}}
  const estate=Math.round((dead.credits||0));
  if(heir){
    heir.credits=(heir.credits||0)+estate;
    // transfer owned structures (pods etc.) to the heir
    for(const s of ST.structs.values())if(s.owner===dead.id)s.owner=heir.id;
    addMod(heir,"inherit","Inherited from a lost friend",6,TPD*2);
    remember(heir,"inherited "+dead.name+"'s estate — bittersweet, but it'll keep me afloat");
    if(estate>0)log(heir.name+" inherited "+estate+"c and property from "+dead.name+".","info");
  }else{
    // no heir → estate reverts to the district treasury
    if(estate>0){ST.income=(ST.income||0)+estate;
      log(dead.name+"'s "+estate+"c reverted to the district (no heir).","info");}
    for(const s of ST.structs.values())if(s.owner===dead.id)s.owner=0;
  }
}
// ── MENTORSHIP ──
// returns the mentor pawn for an apprentice p (meta.mentor holds the MENTOR's id)
function mentorFor(p){if(!ST.relMeta)return null;
  for(const q of ST.pawns){if(q.id===p.id)continue;
    const m=ST.relMeta[relKey(p.id,q.id)];
    if(m&&m.mentor===q.id)return q;}
  return null;}
function apprenticesOf(mentor){const out=[];if(!ST.relMeta)return out;
  for(const q of ST.pawns){if(q.id===mentor.id)continue;
    const m=ST.relMeta[relKey(mentor.id,q.id)];
    if(m&&m.mentor===mentor.id)out.push(q);}
  return out;}
// a skilled veteran organically takes on a nearby novice of the same vocation
function tryMentor(p){
  if(ST.tick%TPD!==0)return;                 // checked daily (called from careerTick)
  const voc=vocationOf(p),vsk=voc.sk;
  if((p.sk[vsk]||0)<5)return;                // must be reasonably skilled to mentor
  if(apprenticesOf(p).length>=2)return;      // cap apprentices
  // find a same-vocation novice nearby with no mentor yet
  for(const q of ST.pawns){
    if(q.id===p.id||q.hp<=0)continue;
    if(vocationOf(q).sk!==vsk)continue;       // same craft
    if((q.sk[vsk]||0)>=(p.sk[vsk]||0)-1)continue; // mentor must lead by 2+
    if(mentorFor(q))continue;                 // already has a mentor
    if(relGet(p.id,q.id)<-10)continue;        // not hostile
    if(DIST(p.px,p.py,q.px,q.py)>14)continue; // roughly co-located in the district
    const meta=relMetaFor(p.id,q.id);meta.mentor=p.id;
    relAdj(p.id,q.id,12);
    addMod(p,"mentoring","Passing on the craft",6,TPD*2);
    addMod(q,"learning","Learning from "+p.name,8,TPD*2);
    remember(q,p.name+" took me on as an apprentice — learning the "+voc.name+" trade");
    log(p.name+" took on "+q.name+" as a "+voc.name+" apprentice.","good");
    return;
  }
}
// after each completed shift: adjust job satisfaction based on fit, pay, and treatment
function careerAfterShift(p,s,wage){
  const c=p.career;if(!c)return;
  const fit=fitsVocation(p,s.type);
  const goodPay=wage>=(DEF[s.type].wage||10);
  let d=0;
  d+=fit?1.2:-1.5;            // doing what they're suited for feels good
  d+=goodPay?0.8:-0.6;
  d+=(c.specialist===K(s.x,s.y))?1.5:0;
  c.sat=clamp(c.sat+d,0,100);
  // aspiration progress
  if(c.asp.kind==="wealth"&&!c.asp.met&&(p.credits||0)>=c.asp.target){
    c.asp.met=true;addMod(p,"asphit","Hit my money goal!",16,TPD*2.5);
    log(p.name+" reached their wealth goal of "+c.asp.target+"c — flush and proud.","good");
    if(typeof emote==="function")emote(p,"party");}
  if(c.asp.kind==="craft"&&!c.asp.met&&(p.sk[vocationOf(p).sk]||0)>=c.asp.target){
    c.asp.met=true;addMod(p,"asphit","Mastered my craft!",16,TPD*2.5);
    log(p.name+" mastered their craft as a "+vocationOf(p).name+".","good");
    if(typeof emote==="function")emote(p,"idea");}
}
// daily: ambitious, unsatisfied pawns build up a gripe and may petition for a raise/transfer
function careerTick(p){
  // ── mentorship: a skilled veteran takes on a nearby novice of the same vocation ──
  tryMentor(p);
  const c=p.career;if(!c)return;
  const amb=p.pers.amb||50;
  // satisfaction slowly drifts toward neutral; low pay relative to credits-needs erodes it
  if((p.credits||0)<15)c.sat=clamp(c.sat-1.5,0,100);
  // gripe builds when an ambitious pawn is dissatisfied
  if(amb>55&&c.sat<40)c.gripe=clamp(c.gripe+1,0,10);
  else c.gripe=clamp(c.gripe-1,0,10);
  // mood reflects work life (gentle — work is one factor among many)
  if(c.sat>72)addMod(p,"satwork","Likes the work",5,TPD);
  else if(c.sat<18)addMod(p,"badwork","Hates the grind",-3,TPD);
}
function genWorkPetitions(){
  if(!REQUESTS_ENABLED)return;
  // at most one work petition per day, from the most aggrieved ambitious pawn
  if(ST.requests&&ST.requests.some(r=>r.status==="pending"&&r.kind==="work"))return;
  let worst=null;
  for(const p of ST.pawns){
    const c=p.career;if(!c)continue;
    if(c.gripe>=4&&ST.tick-(c.lastRaiseDay||0)>TPD*2){
      if(!worst||c.gripe>worst.career.gripe)worst=p;}}
  if(!worst)return;
  const p=worst,c=p.career,voc=vocationOf(p);
  // pick the petition type: specialist promotion if skilled + at a fitting fixture, else raise
  const atFit=p.assigned&&ST.structs.get(p.assigned)&&fitsVocation(p,ST.structs.get(p.assigned).type);
  const skilled=(p.sk[voc.sk]||0)>=5;
  const id="work_"+p.id+"_"+ST.tick;
  const exp=ST.tick+TPD*1.5;
  let text,options;
  if(skilled&&atFit){
    text=p.name+" ("+voc.name+") wants to be named specialist at their workplace — better pay, and they'll mentor the work.";
    options=[
      {label:"Promote to specialist",act:"promote"},
      {label:"Give a small raise instead",act:"raise"},
      {label:"Deny — they can deal with it",act:"deny"}];
  }else{
    text=p.name+" ("+voc.name+") is fed up with the pay and the grind. They want a raise or a transfer to work they're suited for.";
    options=[
      {label:"Approve a raise",act:"raise"},
      {label:"Reassign to "+voc.name+" work",act:"transfer"},
      {label:"Deny — hold the line",act:"deny"}];
  }
  ST.requests.push({id,kind:"work",agentId:p.id,agentName:p.name,created:ST.tick,expires:exp,status:"pending",text,options});
  renderRequests();banner("WORK DISPUTE","warn");if(typeof SFX!=="undefined"&&SFX.alert)SFX.alert();
}
// a wealthy resident whose home is packed (no free tiles) petitions for more space.
// the player approves (district funds an expansion) or denies. NPC then furnishes the new room.
function genExpansionPetition(){
  if(!REQUESTS_ENABLED)return;
  if(ST.requests&&ST.requests.some(r=>r.status==="pending"&&r.kind==="expand"))return;
  for(const p of ST.pawns){
    if(isChild(p)||p.homeless||!p.home)continue;
    if(wealthTier(p).t<2)continue;                  // only the comfortable+ aspire to more space
    if((p.credits||0)<60)continue;
    if(p.home.expanded)continue;                    // one expansion per home
    if(freeHomeTile(p))continue;                    // only if their home is actually full
    if(ST.tick-(p.lastExpandAsk||0)<TPD*3)continue;
    // must have room to grow into (adjacent free tiles outside the home rect)
    if(!expansionRoom(p.home))continue;
    p.lastExpandAsk=ST.tick;
    const id="expand_"+p.id+"_"+ST.tick;
    ST.requests.push({id,kind:"expand",agentId:p.id,agentName:p.name,created:ST.tick,expires:ST.tick+TPD*2,status:"pending",
      text:p.name+" "+(p.surname||"")+" has outgrown their cramped home and wants to expand. Fund the build-out?",
      options:[
        {label:"Fund the expansion (120c)",act:"fund"},
        {label:"They can pay half (60c each)",act:"split"},
        {label:"Deny — space is tight",act:"deny"}]});
    renderRequests();banner("EXPANSION REQUEST","info");if(typeof SFX!=="undefined"&&SFX.alert)SFX.alert();
    return;
  }
}
// is there free, in-bounds space adjacent to a home rect to expand into?
function expansionRoom(h){
  // try extending width by 2 to the right, else height by 2 down
  for(const [dx,dy] of [[2,0],[0,2]]){
    let ok=true;
    if(dx){for(let yy=h.y0;yy<h.y0+h.h;yy++)for(let xx=h.x0+h.w;xx<h.x0+h.w+dx;xx++){
      if(!INB(xx,yy)||structAt(xx,yy)){ok=false;break}}}
    else{for(let xx=h.x0;xx<h.x0+h.w;xx++)for(let yy=h.y0+h.h;yy<h.y0+h.h+dy;yy++){
      if(!INB(xx,yy)||structAt(xx,yy)){ok=false;break}}}
    if(ok)return [dx,dy];
  }
  return null;
}
function doExpand(h){
  const grow=expansionRoom(h);if(!grow)return false;
  const [dx,dy]=grow;
  h.w+=dx;h.h+=dy;h.expanded=true;
  return true;
}
function trMul(p,k){let m=1;for(const t of p.tr)if(t[k]!==undefined)m*=t[k];return m}
function trAdd(p,k){let v=0;for(const t of p.tr)if(t[k]!==undefined)v+=t[k];return v}
function hasTr(tr,id){return tr.some(t=>t&&t.id===id)}
function inWin(hr,a,b){a=((a%24)+24)%24;b=((b%24)+24)%24;return a<=b?(hr>=a&&hr<b):(hr>=a||hr<b)}
function nearWin(hr,c,half){c=((c%24)+24)%24;let d=Math.abs(((hr-c+12+24)%24)-12);return d<=half}
function mkSched(P,tr){
  const owl=hasTr(tr,"nightowl")||hasTr(tr,"wired"),burned=hasTr(tr,"lazy"),r2=x=>Math.round(x*100)/100;
  const wake=clamp(7.5-(P.ind-50)/22-(P.amb-50)/45+(owl?3:0)+(burned?1.3:0),5,11.5);
  const sleepAt=clamp(22.5+(owl?2.6:0)+(P.soc-50)/45+(P.imp-50)/40-(P.cau-50)/40-(P.ind-50)/55,20,27);
  const workLen=clamp(6+(P.amb-50)/14+(P.ind-50)/22,3.5,11);
  const workStart=clamp(wake+1.8+(P.cau-50)/70,wake+1,13.5);
  const workEnd=clamp(workStart+workLen,workStart+3,25.5);
  // LEISURE WINDOW: after work, before bed — when sociable/curious folk go out (bar, arcade, park, friends).
  // Social pawns start earlier and stay out later; homebodies have a short window.
  const leisureStart=r2(clamp(workEnd+0.3,16,22));
  const leisureEnd=r2(clamp(sleepAt-0.4+(P.soc-50)/60,leisureStart+0.5,26.5));
  return{wake:r2(wake),sleepAt:r2(sleepAt),workStart:r2(workStart),
    workEnd:r2(workEnd),leisureStart,leisureEnd,
    bf:r2(wake+0.4),lunch:r2(clamp(12.5+(P.imp-50)/55,11.5,14.5)),dinner:r2(clamp(18.5+(P.soc-50)/45,17,21))}}
function workSpd(p,sk){return (0.6+sk*0.09)*trMul(p,"work")}
function moveSpd(p){let s=0.32*trMul(p,"move");if(p.dazed>ST.tick)s*=.55;return s}
function gainXp(p,k){p.xp[k]=(p.xp[k]||0)+1;
  // a working bookshelf at home accelerates learning (children especially)
  if(p.home&&!p.homeless){for(const s of homeStructs(p)){
    if(s.type==="bookshelf"&&furnEffective(s)){p.xp[k]+=(isChild(p)?2:1)*Math.round(qualOf(s).effMul);break;}}}
  const need=60*(p.sk[k]+1);
  if(p.xp[k]>=need&&p.sk[k]<10){p.xp[k]=0;p.sk[k]++;
    log(p.name+" advanced: "+({sal:"Salvage",bld:"Construction",cook:"Synthcraft",sht:"Shooting"})[k]+" "+p.sk[k],"good")}}

/* mood */
function addMod(p,id,label,val,dur){
  for(let i=p.mods.length-1;i>=0;i--)if(p.mods[i].id===id)p.mods.splice(i,1);
  p.mods.push({id,l:label,v:Math.round(val),until:ST.tick+dur})}
function moodCalc(p){
  p.mods=p.mods.filter(m=>m.until>ST.tick);
  let m=42+trAdd(p,"mood");
  for(const md of p.mods)m+=md.v;
  if(p.needs.food<25)m-=8;
  if(p.needs.rest<25)m-=8;
  if(lightLevel(hourN())>.3){                       // neon lamp aura at night
    for(const s of ST.structs.values())
      if(s.type==="lamp"&&!isBroken(s)&&DIST(p.px,p.py,s.x+.5,s.y+.5)<4.5){m+=3*qualOf(s).effMul;break}}
  {let aff=0,nn=0;for(const o of ST.pawns){if(o===p)continue;
      if(DIST(p.px,p.py,o.px,o.py)<6){aff+=relGet(p.id,o.id);nn++}}
    if(nn){aff/=nn;if(aff>20)m+=5;else if(aff<-20)m-=5}}
  if(p.needs.hyg<20)m-=4;
  if(p.needs.fun<20)m-=4;
  if(p.needs.socN<20)m-=5;
  m-=(p.stress||0)*0.18;
  // home furniture comfort: couch/art/rug owned & working lift mood (art more so for the affluent)
  if(p.home&&!p.homeless){
    let comfort=0;const wt=wealthTier(p).t;
    for(const s of homeStructs(p)){
      if(!furnEffective(s))continue;const eff=DEF[s.type].furnEffect,q=qualOf(s).effMul;
      if(eff==="comfort")comfort+=2.5*q;
      else if(eff==="ambient")comfort+=1.5*q;
      else if(eff==="art")comfort+=(2+wt)*q;       // status: nicer payoff when you're doing well
    }
    m+=Math.min(comfort,12);                        // cap home-comfort contribution
    // room QUALITY: a well-built, spacious, beautiful home lifts mood; a squalid one hurts.
    const hr=homeRoom(p);
    if(hr){const q=roomQuality(hr);
      // maps 0..100 quality to roughly −6 (squalid) .. +10 (luxurious)
      m+=clamp((q-40)*0.18,-6,10);}
  }
  // soft floor: deep misery bottoms out around 6 rather than a dead 0, leaving a
  // sliver of function to recover from (prevents unrecoverable death spirals).
  // doesn't help already-content pawns — only cushions the very bottom.
  if(m<10)m=6+(m>0?m*0.4:0);
  p.mood=clamp(m,0,100)}

/* movement */
function gotoCell(p,x,y,adj){
  const cx=p.px|0,cy=p.py|0;
  if(adj?CHEB(cx,cy,x,y)<=1:(cx===x&&cy===y)){p.path=null;return "arr"}
  if(!p.path||p.pTx!==x||p.pTy!==y||p.pi>=p.path.length){
    const pa=astar(cx,cy,x,y,{adj:adj,pawn:p});
    if(!pa)return "fail";
    p.path=pa;p.pi=0;p.pTx=x;p.pTy=y;
    if(pa.length===0){p.path=null;return "arr"}}
  const node=p.path[p.pi];
  if(colCost(node.x,node.y)<0){p.path=null;return "mov"}   // blocked mid-route → repath next tick
  const tx=node.x+.5,ty=node.y+.5,sp=moveSpd(p);
  const dx=tx-p.px,dy=ty-p.py,d=Math.hypot(dx,dy);
  if(d<=sp){p.px=tx;p.py=ty;p.pi++;
    if(p.pi>=p.path.length){p.path=null;
      const a=adj?CHEB(node.x,node.y,x,y)<=1:(node.x===x&&node.y===y);
      return a?"arr":"mov"}}
  else{p.px+=dx/d*sp;p.py+=dy/d*sp}
  return "mov"}
function unre(p,x,y){const u=p.unre.get(K(x,y));return u!==undefined&&u>ST.tick}
function markUnre(p,x,y){p.unre.set(K(x,y),ST.tick+300)}
function randNear(p,r){for(let i=0;i<10;i++){
  const X=clamp((p.px|0)+RI(-r,r),0,MW-1),Y=clamp((p.py|0)+RI(-r,r),0,MH-1);
  if(colCost(X,Y)<0)continue;
  // private property: don't wander into a home that isn't yours (unless you may enter it)
  const owner=homeOwnerAt(X,Y);
  if(owner&&owner!==p&&!canEnterHome(p,owner))continue;
  return{x:X,y:Y}}return null}

/* job search */
function homeFixture(p,type){if(!p.home)return null;const h=p.home;
  for(const s of ST.structs.values()){
    if(s.bp||s.type!==type||isBroken(s))continue;
    if(s.x>=h.x0&&s.x<h.x0+h.w&&s.y>=h.y0&&s.y<h.y0+h.h&&!unre(p,s.x,s.y))return s}
  return null}
function nearestStruct(p,fn){let best=null,bd=1e9;
  for(const s of ST.structs.values()){if(!fn(s))continue;
    if(unre(p,s.x,s.y))continue;
    // private property: don't target a fixture inside a home you're not welcome in
    {const ho=homeOwnerAt(s.x,s.y);if(ho&&ho!==p&&!canEnterHome(p,ho))continue;}
    const d=DIST(p.px,p.py,s.x+.5,s.y+.5);if(d<bd){bd=d;best=s}}
  return best}
// how many OTHER wisps are currently working at this station? (each station seats a limited number)
function workersAt(s,excludeId){
  let n=0;
  for(const q of ST.pawns){if(q.id===excludeId)continue;
    if(q.job&&q.job.t==="work"&&q.job.s===s)n++;}
  return n;
}
// a station's seat capacity. Most are single-seat (one wisp per station — they occupy space now); a few
// communal/large workplaces seat more. This is what makes stations UNIQUE-USE.
function workCapacity(s){
  const d=DEF[s.type];if(!d)return 1;
  if(d.workSlots!=null)return d.workSlots;
  // communal/large workplaces seat a few; default single-seat
  if(s.type==="farmplot"||s.type==="loggingcamp"||s.type==="mineshaft"||s.type==="sporevat")return 3;
  if(s.type==="cafeteria"||s.type==="market"||s.type==="bar")return 2;
  return 1;
}
// is this station workable AND has a free seat for this pawn?
function hasFreeWorkSlot(s,p){return workersAt(s,p.id)<workCapacity(s);}
// TRAINING occupancy — count wisps currently using a station to LEARN (study/train), so training respects
// the same unique-use seating as work. A station with a learner is taken; another wisp must find a free one.
function trainersAt(s,excludeId){
  let n=0;
  for(const q of ST.pawns){if(q.id===excludeId)continue;
    if(q.job&&q.job.t==="learn"&&q.job.s===s)n++;}
  return n;
}
// a training station seats the same number as it works (most single-seat; communal ones a few)
function hasFreeTrainSlot(s,p){return trainersAt(s,p.id)<workCapacity(s);}
// GENERIC FIXTURE OCCUPANCY — count wisps currently HEADED TO or USING a given tile for ANY activity
// (eat/wash/treat/relax/etc.). Single-use fixtures (fridge, shower, toilet, medbed, couch, tv) should be
// taken by one wisp at a time; this lets every activity selector avoid the pile-up that made wisps stack
// on the nearest spot. Counts by target tile (job.x/job.y) since activity jobs store their destination there.
function fixtureUsers(x,y,excludeId){
  let n=0;
  for(const q of ST.pawns){if(q.id===excludeId||q.hp<=0)continue;
    const j=q.job;if(!j)continue;
    if(j.x===x&&j.y===y)n++;                              // headed to / at this exact fixture tile
    else if(j.s&&j.s.x===x&&j.s.y===y)n++;                // (work/learn store the struct on job.s; guarded)
  }
  return n;
}
// a single-use fixture has room if no OTHER wisp is already using/heading to it
function fixtureFree(s,p){return s&&fixtureUsers(s.x,s.y,p?p.id:-1)===0;}
// nearestStruct, but skips fixtures another wisp is already using (so wisps spread across available spots
// instead of all converging on the closest one). Falls back to null if every match is occupied → the
// activity simply isn't chosen this tick and the wisp does something else (no clustering, no stall).
function nearestFreeStruct(p,fn){
  let best=null,bd=1e9;
  for(const s of ST.structs.values()){if(!fn(s))continue;
    if(unre(p,s.x,s.y))continue;
    if(!fixtureFree(s,p))continue;            // someone's already there/heading there
    {const ho=homeOwnerAt(s.x,s.y);if(ho&&ho!==p&&!canEnterHome(p,ho))continue;}
    const d=DIST(p.px,p.py,s.x+.5,s.y+.5);if(d<bd){bd=d;best=s}}
  return best;
}
function mkEat(p){
  const home=(!p.homeless)&&homeFixture(p,"fridge");
  // shared food fixtures (counter/cafeteria/bar) are single-use → pick a FREE one so wisps don't stack
  const src=home||nearestFreeStruct(p,s=>(s.type==="fridge"||s.type==="counter"||s.type==="bar"||s.type==="cafeteria")&&!s.bp&&!isBroken(s));
  if(!src)return null;
  return{t:"eat",x:src.x,y:src.y,adj:1,prog:0,home:!!home};}
function mkSleep(p){let pod=null;
  for(const s of ST.structs.values()){
    if(s.type!=="pod"||s.bp||unre(p,s.x,s.y))continue;
    if(s.owner===p.id){pod=s;break}
    if(!s.owner&&!pod)pod=s}
  if(pod){pod.owner=p.id;return{t:"sleep",s:pod,x:pod.x,y:pod.y}}
  return{t:"sleep",s:null,x:p.px|0,y:p.py|0}}
function scoreJobs(p){
  const food=p.needs.food,rest=p.needs.rest,hp=p.hp;
  const ind=p.pers.ind,cau=p.pers.cau,cur=p.pers.cur;
  const inj=hp<40;
  const night=lightLevel(hourN())>0.3; // after dark
  const bpStr=nearestStruct(p,s=>(s.bp||s.decon)&&!s.res);
  const hyg=p.needs.hyg??80,fun=p.needs.fun??70,socN=p.needs.socN??70,soc=p.pers.soc;
  const showStr=(!p.homeless&&(homeFixture(p,"shower")||homeFixture(p,"toilet")))||nearestFreeStruct(p,s=>(s.type==="shower"||s.type==="toilet")&&!s.bp&&!isBroken(s));
  // leisure venue — biased by personality: sociable wisps gravitate to the bar, impulsive ones to the
  // arcade (where they may gamble), calmer/curious ones to the park or home. Falls back to nearest fun spot.
  let funStr=null;
  {const soc=(p.pers&&p.pers.soc)||50,imp=(p.pers&&p.pers.imp)||50,cred=p.credits||0;
   const wantBar=soc>55&&cred>=5, wantArcade=imp>55&&cred>=8;
   if(wantBar)funStr=nearestFreeStruct(p,s=>s.type==="bar"&&!s.bp&&!isBroken(s));
   if(!funStr&&wantArcade)funStr=nearestFreeStruct(p,s=>s.type==="arcade"&&!s.bp&&!isBroken(s));
   if(!funStr)funStr=nearestFreeStruct(p,s=>(s.type==="tv"||s.type==="gym"||s.type==="bar"||s.type==="park"||s.type==="arcade"||s.type==="couch")&&!s.bp&&!isBroken(s));}
  let mate=null,_md=1e9;
  // after a conversation, a pawn won't immediately start another (prevents endless re-socialize loops)
  if(!(p.socCd&&ST.tick<p.socCd))
  for(const q of ST.pawns){if(q.id===p.id)continue;
    if(relGet(p.id,q.id)<-40)continue;  // don't socialize toward rivals/enemies
    if(p.lastSocPartner===q.id&&ST.tick<(p.lastSocT||0)+400)continue; // not the same person just-talked-to
    // don't chase someone into a home you're not welcome in (no barging to socialize)
    {const ho=homeOwnerAt(q.px|0,q.py|0);if(ho&&ho!==p&&!canEnterHome(p,ho))continue;}
    let dd=DIST(p.px,p.py,q.px,q.py);
    if(sameClique(p,q))dd*=0.5;          // strongly prefer your own clique
    else if(relGet(p.id,q.id)>35)dd*=0.75; // and friends generally
    if(dd<_md){_md=dd;mate=q}}
  const cred=p.credits??40;
  const isWorkable=s=>!s.bp&&!s.roboStaffed&&(DEF[s.type].prod||DEF[s.type].refine||DEF[s.type].vendor);
  // a workplace this pawn can actually take a seat at (unique-use: skip stations that are full)
  const isOpenWork=s=>isWorkable(s)&&hasFreeWorkSlot(s,p);
  const assignedStr=p.assigned?ST.structs.get(p.assigned):null;
  // prefer a workplace matching this pawn's vocation; fall back to nearest workable — but only OPEN ones
  const vocStr=ST.tick>(p.workCd||0)?nearestStruct(p,s=>isOpenWork(s)&&fitsVocation(p,s.type)):null;
  const assignedOpen=assignedStr&&!assignedStr.bp&&hasFreeWorkSlot(assignedStr,p);
  const workStr=ST.tick>(p.workCd||0)?(assignedOpen?assignedStr:(vocStr||nearestStruct(p,isOpenWork))):null;
  // are there workplaces that exist but are all FULL? (drives the frustration reaction)
  const wantsWork=ST.tick>(p.workCd||0)&&!workStr;
  const allWorkFull=wantsWork&&[...ST.structs.values()].some(s=>isWorkable(s)&&fitsVocation(p,s.type));
  // hospital preferred over medbed (better care); prefer a FREE bed so the sick spread across beds, but
  // fall back to ANY bed if all are occupied — treatment is life-or-death, so queuing is acceptable here
  // (unlike leisure, where a wisp just does something else). This still cuts the worst of the pile-up.
  const medStr=nearestFreeStruct(p,s=>(s.type==="hospital"||s.type==="medbed")&&!s.bp)
              ||nearestStruct(p,s=>(s.type==="hospital"||s.type==="medbed")&&!s.bp);
  // school: citizens with spare time and ambition train skills. CONGESTION FIX — like work stations,
  // training stations are single-use: a wisp must pick one with a FREE seat, not just the nearest. Without
  // this, every wisp wanting to train pathed to the same station and piled up on it (unable to act, souring
  // their mood). trainersAt/hasFreeTrainSlot mirror the work-slot occupancy check.
  const schoolStr=nearestStruct(p,s=>(s.type==="school"||s.type==="bookshelf"||s.type==="workstation"||s.type==="gym")&&!isBroken(s)&&!s.bp&&hasFreeTrainSlot(s,p));
  const dlrStr=nearestStruct(p,s=>s.type==="dealer"&&!s.bp);
  const robTgt=nearestStruct(p,s=>s.type==="counter"&&!s.bp);
  const gearStr=!p.hasGear&&(p.credits||0)>=15&&(ST.goods.gear||0)>0?
    nearestStruct(p,s=>s.type==="gearshop"&&!s.bp):null;
  const stealTgt=p.pers.intg<28&&(p.credits||0)<8&&(p.addiction||0)>30&&ST.tick>(p.crimeCd||0)?
    ST.pawns.find(q=>q.id!==p.id&&(q.credits||0)>25&&DIST(p.px,p.py,q.px,q.py)<10&&relGet(p.id,q.id)>-60):null;
  // VISIT: when social, a wisp may visit a friend/partner's HOME to hang out (consensual).
  // pick the closest person whose home they may enter and who they like.
  let visitTgt=null;
  if(!isChild(p)&&socN<55&&!p.homeless){let bd=1e9;
    for(const q of ST.pawns){if(q.id===p.id||!q.home||isChild(q))continue;
      if(!canEnterHome(p,q))continue;            // only homes they're welcome in
      if(relGet(p.id,q.id)<25&&!areFamily(p,q))continue;
      const d=DIST(p.px,p.py,q.home.x0+2,q.home.y0+2);
      if(d<bd&&d<28){bd=d;visitTgt=q;}}}
  // BURGLE: a desperate, low-integrity wisp may break into a stranger's home to rob it.
  let burgleTgt=null;
  if(!isChild(p)&&p.pers.intg<26&&(p.credits||0)<10&&ST.tick>(p.crimeCd||0)){let bd=1e9;
    for(const q of ST.pawns){if(q.id===p.id||!q.home||areFamily(p,q))continue;
      if((q.credits||0)<25)continue;             // worth robbing
      if(relGet(p.id,q.id)>20)continue;          // won't rob people they like
      const d=DIST(p.px,p.py,q.home.x0+2,q.home.y0+2);
      if(d<bd&&d<22){bd=d;burgleTgt=q;}}}
  // HOMICIDE (gated, rare, dark-but-earned): only a deep grudge OR gang vendetta, and only
  // from a violent/low-integrity wisp. Telegraphed + heavy consequences at execution.
  let killTgt=null;
  if(!isChild(p)&&ST.tick>(p.killCd||0)&&p.pers.intg<28&&(p.pers.imp||0)>55){
    const g=p.grudgeTarget?ST.pawns.find(q=>q.id===p.grudgeTarget):null;
    const grudgeDeep=g&&relGet(p.id,g.id)<-70;
    const myGang=pawnGang(p);
    let vendetta=null;
    if(myGang)for(const q of ST.pawns){const qg=pawnGang(q);
      if(qg&&qg!==myGang&&relGet(p.id,q.id)<-55){vendetta=q;break;}}
    const tgt=grudgeDeep?g:vendetta;
    if(tgt&&tgt.home&&DIST(p.px,p.py,tgt.home.x0+2,tgt.home.y0+2)<26)killTgt=tgt;
  }
  const gang=pawnGang(p);
  const onTurf=gang&&gang.turf.has(K(p.px|0,p.py|0));
  const turfBonus=onTurf?20:0;
  const nightBonus=night?12:0; // crime easier after dark
  const isContracted=p.contract&&workStr&&p.contract.fixtureKey===K(workStr.x,workStr.y);
  const base={
    eat:clamp(80-food,0,100),sleep:clamp(70-rest,0,100),
    build:bpStr?50:0,
    idle:10,
    hygiene:showStr?clamp(70-hyg,0,100):0,recreate:funStr?clamp(60-fun,0,100):0,socialize:mate?clamp(60-socN,0,100):0,
    work:(!isChild(p)&&workStr&&ST.tick>(p.workCd||0))?clamp(
      ((isContracted?95:p.assigned?80:60)-cred*0.6)
      *(fitsVocation(p,workStr.type)?1.15:0.9)   // do what they're good at
      *ethicMul(p)                                 // hard workers push, slackers ease off
      *(p.career?(0.7+p.career.sat/100*0.5):1)     // satisfied pawns show up
      *(p.role?1.6:1)                              // named roles hold their post — citizens rely on them
      ,0,100):0,treat:p.sick&&medStr?95:0,
    substance:dlrStr?clamp((p.addiction||0)*0.6+((p.stress||0)>40?((p.stress||0)-40)*0.4:0),0,100):0,
    crime:(robTgt&&cred<20)?clamp(30-cred*1.1+turfBonus+nightBonus,0,100):0,
    steal:stealTgt?clamp(35-(cred*1.2)+turfBonus+nightBonus,0,100):0,
    buygear:gearStr?clamp(40-(cred*0.5),0,70):0,
    visit:visitTgt?clamp(58-socN*0.5+(relGet(p.id,visitTgt.id)>60?12:0),0,75):0,
    burgle:burgleTgt?clamp(40-cred*1.0+turfBonus+nightBonus,0,100):0,
    homicide:killTgt?clamp(55+nightBonus+turfBonus,0,100):0,
    learn:(schoolStr&&food>40&&rest>35&&!p.sick)?clamp(14+cur*0.28+ind*0.1,0,55):0};  // curious wisps learn eagerly (but a pressing need still wins)
  const pw={
    eat:0.5+cau/100,sleep:0.5+cau/100,build:0.5+ind/100,
    idle:0.5+(100-ind)/100-cur/200,                          // the curious idle less (they'd rather DO something)
    hygiene:1,recreate:0.5+cur/100,socialize:0.5+soc/100,work:0.5+ind/100,
    // empathetic wisps prioritize TENDING the sick — a high-empathy citizen practically rushes to help
    treat:0.5+cau/100+(p.pers.emp||50)/120,
    substance:0.3+p.pers.imp/150+(100-p.pers.intg)/200,
    crime:(100-p.pers.intg)/100*(0.4+p.pers.imp/150),
    steal:(100-p.pers.intg)/100*(0.3+p.pers.imp/120),
    buygear:0.5+p.pers.ind/150,
    visit:0.5+soc/100+(p.pers.emp||50)/200,                  // warm wisps check in on friends more
    burgle:(100-p.pers.intg)/100*(0.35+p.pers.imp/120),
    homicide:(100-p.pers.intg)/100*(0.25+p.pers.imp/110),
    // curiosity drives learning, but EASES when fun is critically low (a bored wisp wants fun, not a textbook)
    learn:(0.4+p.pers.amb/150+cur/150)*(fun<25?0.55:1)};                       // curiosity drives learning harder
  const sm={eat:1,sleep:1,build:1,idle:1,hygiene:1,recreate:1,socialize:1,work:1,treat:1,substance:1,crime:1,steal:1,buygear:1,learn:1,visit:1,burgle:1,homicide:1};
  // DESPERATION (Wave E): a poor, sick, failing wisp is pushed toward survival crime — the wealth/health
  // divide has teeth. their desperation makes theft/robbery far more likely than their nature alone would.
  if(p.desperate&&ST.tick<p.desperate){sm.crime*=2.4;sm.steal*=2.4;sm.burgle*=1.8;sm.treat*=1.5;}
  if(p.sched){const S=p.sched,hr=hourN();
    // STRONG night rhythm: in their sleep window, the pull to sleep is dominant (so most wisps are home
    // asleep at night and OUT during the day). Owls/enforcer have later windows → night is the operative's
    // advantage but not empty. Outside the window, sleep only wins if genuinely exhausted.
    sm.sleep*=inWin(hr,S.sleepAt,S.wake)?4.5:(rest<15?0.8:0.05);
    // and during waking daytime hours, suppress sleep hard so they stay out and active
    const deepNight=lightLevel(hr)>0.5;       // the dark core of night
    if(!inWin(hr,S.sleepAt,S.wake)&&!deepNight&&rest>30)sm.sleep*=0.3;
    sm.work*=inWin(hr,S.workStart,S.workEnd)?1.6:0.6;
    sm.eat*=(nearWin(hr,S.bf,0.9)||nearWin(hr,S.lunch,0.8)||nearWin(hr,S.dinner,1.0))?1.7:0.7;
    if(nearWin(hr,S.wake+0.6,1.0))sm.hygiene*=1.7;
    sm.learn*=inWin(hr,S.workStart,S.workEnd)?0.8:1.3; // study off-shift
    // LEISURE RHYTHM: in the evening leisure window, wisps want to go OUT and be together — unwind at a
    // venue, socialize, visit friends. Outside it they're less inclined — but a genuine NEED still pulls
    // them (a very bored or very lonely wisp will still go, just less eagerly), so the window biases
    // TIMING without hard-suppressing real needs.
    if(S.leisureStart!=null){
      const inLeisure=inWin(hr,S.leisureStart,S.leisureEnd);
      // out-of-window penalty eases as the need grows: mild when bored, near-none when desperate.
      const recPen=Math.max(0.78,1-fun/220);    // funlow → closer to 1
      const socPen=Math.max(0.78,1-socN/220);
      sm.recreate*=inLeisure?1.9:recPen;
      sm.socialize*=inLeisure?1.8:socPen;
      sm.visit*=inLeisure?1.7:Math.max(0.75,socPen);
    }
  }else if(night){sm.sleep*=1.4}
  if(inj){sm.eat*=1.3;sm.sleep*=1.3}
  const bias=p.bias;
  // FRUSTRATION — a wisp who wants to work but finds every station occupied reacts (and it sours their
  // mood). Stations are unique-use now, so a crowded shift floor breeds real friction. Throttled per-wisp.
  if(allWorkFull&&!isChild(p)&&ST.tick>(p.workFrustCd||0)){
    p.workFrustCd=ST.tick+RI(180,360);
    const r=Math.random();
    const emo=r<0.4?"anger":r<0.7?"sweat":r<0.85?"gross":"cry";   // frustration / discomfort / disgust / dejection
    tryEmote(p,emo,90);
    p.stress=clamp((p.stress||0)+RI(3,7),0,100);
    p.mood=clamp((p.mood||50)-RI(2,5),0,100);
    if((p.allegiance||0)>-100)p.allegiance=clamp((p.allegiance||0)-1,-100,100); // a daily grind grievance
    // occasionally voice it
    if(r<0.25&&typeof remember==="function")remember(p,"no open station again — sick of waiting to work");
    p.workCd=ST.tick+RI(120,260);   // back off trying for a bit (don't spam)
  }
  const acts=[
    {k:"eat",    mk:()=>mkEat(p)},
    {k:"sleep",  mk:()=>mkSleep(p)},
    {k:"build",  mk:()=>bpStr?{t:"build",s:bpStr,prog:0}:null},
    {k:"hygiene", mk:()=>showStr?{t:"hygiene",s:showStr,prog:0}:null},
    {k:"recreate",mk:()=>funStr?{t:"recreate",s:funStr,prog:0}:null},
    {k:"socialize",mk:()=>mate?{t:"socialize",oid:mate.id,prog:0}:null},
    {k:"work",   mk:()=>workStr?{t:"work",s:workStr,prog:0}:null},
    {k:"treat",  mk:()=>medStr?{t:"treat",s:medStr,prog:0}:null},
    {k:"substance",mk:()=>dlrStr?{t:"substance",s:dlrStr,prog:0}:null},
    {k:"crime",  mk:()=>robTgt?{t:"crime",s:robTgt,prog:0}:null},
    {k:"steal",  mk:()=>stealTgt?{t:"steal",oid:stealTgt.id,prog:0}:null},
    {k:"buygear",mk:()=>gearStr?{t:"buygear",s:gearStr,prog:0}:null},
    {k:"learn",  mk:()=>schoolStr?{t:"learn",s:schoolStr,prog:0}:null},
    {k:"visit",  mk:()=>visitTgt?{t:"visit",oid:visitTgt.id,prog:0}:null},
    {k:"burgle", mk:()=>burgleTgt?{t:"burgle",oid:burgleTgt.id,prog:0,phase:0}:null},
    {k:"homicide",mk:()=>killTgt?{t:"homicide",oid:killTgt.id,prog:0,phase:0}:null},
    {k:"idle",   mk:()=>{const w=randNear(p,5)||{x:p.px|0,y:p.py|0};return{t:"idle",until:ST.tick+RI(25,70),x:w.x,y:w.y}}}];
  if(p.cmd){const wanted=p.cmd;const a=acts.find(x=>x.k===p.cmd);p.cmd=null;
    // REFUSAL: a wisp with strong contrary pressure may refuse the order (the player can then FORCE).
    // e.g. ordered to work while starving/exhausted, or a defiant low-allegiance wisp resisting.
    let refuse=false;
    if(wanted==="work"&&(p.needs.rest||100)<32&&(p.needs.rest||100)>=20&&(p.needs.food||100)>22&&Math.random()<0.5)refuse=true;  // too tired to want to work
    else if((p.allegiance||0)<-25&&(p.pers.ind||50)>62&&Math.random()<0.4)refuse=true;        // defiant + independent
    else if((p.stress||0)>78&&Math.random()<0.5)refuse=true;                                   // too frayed to comply
    if(refuse&&!p.isAvatar){
      p.refusedOrder=true;p.pendingForceCmd=wanted;
      if(ST.sel&&ST.sel.includes(p))log(p.name+" refuses the order.","warn");
      // fall through to normal autonomous behavior
    }else if(a){const cj=a.mk();
      if(cj){if(cj.t==="build"&&cj.s)cj.s.res=p.id;return cj}}}
  let bestU=-1,bestMk=null;
  for(const a of acts){
    const u=base[a.k]*pw[a.k]*(bias[a.k]||1)*sm[a.k];
    if(u>bestU){bestU=u;bestMk=a.mk}}
  const j=bestMk?bestMk():null;
  if(!j)return{t:"idle",until:ST.tick+RI(25,70),x:p.px|0,y:p.py|0};
  if(j.t==="build"&&j.s)j.s.res=p.id;
  return j}
function chooseJob(p){
  if(p.needs.food<=22){const j=mkEat(p);if(j)return j}
  if(p.needs.rest<=18)return mkSleep(p);
  // ROLE ANCHOR: a named role-wisp with a post reports to work during work hours (08:00-19:00),
  // unless a need is pressing. Keeps the Doctor at the clinic, the Shopkeeper at the store, etc.,
  // so citizens can reliably find and interact with them.
  if(p.role&&p.assigned&&!p.sick&&ST.tick>(p.workCd||0)){
    const hr=hourN();
    if(hr>=8&&hr<19&&p.needs.food>30&&p.needs.rest>28){
      const ws=ST.structs.get(p.assigned);
      if(ws&&!ws.bp&&!isBroken(ws))return{t:"work",s:ws,prog:0};
    }
  }
  return scoreJobs(p)}
function clearJob(p){const j=p.job;
  if(j&&j.s&&j.s.res===p.id)j.s.res=0;
  p.job=null;p.path=null;p.sleeping=false}
function jobLabel(p){
  if(p.dazed>ST.tick)return "Dazed — wandering";
  if(p.flee>ST.tick)return "Fleeing!";
  const j=p.job;if(!j)return "Thinking…";
  switch(j.t){case "eat":return "Getting food";case "sleep":return p.sleeping?"Sleeping":"Heading to rest";
    case "build":return j.s&&j.s.decon?"Deconstructing":"Constructing";
    case "hygiene":return "Cleaning up";case "recreate":return "Unwinding";
    case "socialize":return "Socializing";case "work":return "Working";
    case "treat":return "At the clinic";case "substance":return "Using";
    case "crime":return "Running a job";case "rob":return "Robbing someone";
    case "steal":return "Scoping a mark";
    case "visit":return "Visiting";
    case "burgle":return "Breaking in";
    case "homicide":return "Stalking someone";
    case "buygear":return "Getting kitted out";
    case "learn":{const vt=j.s&&j.s.type;return vt==="gym"?"Drilling":vt==="workstation"?"Training":"Reading";}
    default:return "Idling"}}

/* combat helpers (pawn side) */
function foeNear(p,r){return false}// no foes in city sim
function damagePawn(p,d){const dmg=Math.round(d*(p.hasGear?0.75:1)*trMul(p,"dmgred"));p.hp-=dmg;p.hurtT=ST.tick;SFX.hit();applyDrift(p,{cau:3});
  const watcher=ST.pawns.find(q=>q.id!==p.id&&DIST(q.px,q.py,p.px,p.py)<8);
  if(watcher)relAdj(watcher.id,p.id,-2);
  addMod(p,"pain","In pain",-8,TPD*.4);
  if(p.flee<ST.tick){clearJob(p);p.flee=ST.tick+90}
  if(p.hp<=0)killPawn(p,"was killed in the fighting")}
function killPawn(p,why){const i=ST.pawns.indexOf(p);if(i<0)return;
  // cute-comedic death: a little ghost puffs up, a tombstone marks the spot, neighbors gasp
  emote(p,"ghost");
  spawnTombstone(p.px,p.py);
  onlookersReact(p.px,p.py,"shock",9);
  clearJob(p);ST.pawns.splice(i,1);ST.stats.deaths++;SFX.die();
  inherit(p);   // estate + property pass to closest tie, or revert to district
  log(p.name+" "+why+".","bad");banner("RUNNER DOWN","bad");
  chronicle(p.name+" "+(p.surname||"")+" "+why+".","✝");
  for(const o of ST.pawns){addMod(o,"loss","Lost a crewmate",-16,TPD*2.5);applyDrift(o,{cau:6,soc:-3});
    if(DIST(o.px,o.py,p.px,p.py)<10)tryEmote(o,"cry",120);
    // partners and close friends grieve far harder
    const meta=ST.relMeta&&ST.relMeta[relKey(o.id,p.id)];
    if(meta&&meta.partner){addMod(o,"widowed","Lost my partner",-28,TPD*4);o.stress=clamp((o.stress||0)+18,0,100);
      remember(o,"lost "+p.name+" — the one who mattered. nothing feels right now");
      log(o.name+" is devastated — lost their partner "+p.name+".","bad");}
    else if(relGet(o.id,p.id)>55){addMod(o,"grief","Lost a close friend",-15,TPD*2.5);
      remember(o,"lost "+p.name+", a real friend on this block");}}
  // a clique losing one of its own hits the whole group
  {const c=cliqueOf(p);if(c){for(const id of c.members){if(id===p.id)continue;
    const o=ST.pawns.find(q=>q.id===id);if(o)addMod(o,"cliqueloss","We lost one of ours",-12,TPD*2.5);}
    c.loyalty=clamp(c.loyalty-8,0,100);}}
  ST.sel=ST.sel.filter(e=>e!==p);renderInspect();
  // a vacated public role triggers an election — the block votes for a replacement (seat sits empty meanwhile)
  if(p.role&&electableRole(p.role)){openElection(p.role,p.name);}
  if(ST.pawns.length===0&&ST.phase==="run")gameOver()}
// comedic mini-tombstone that lingers then fades
function spawnTombstone(x,y){
  (ST.tombs||(ST.tombs=[])).push({x,y,ttl:TPD*1.5,t0:TPD*1.5});
}
function homeCell(p){const h=p&&p.home;return h?{x:h.door.x,y:h.door.y}:{x:MW/2|0,y:MH/2|0}}
function openHomes(){return ST.cityHomes.filter(h=>!ST.pawns.some(p=>p.home===h))}
function pawnGang(p){return ST.gangs.find(g=>g.crewIds.includes(p.id))||null}
function gangTick(){
  for(const g of ST.gangs){if(!g.crewIds.length)continue;
    const newTurf=new Set();
    const members=g.crewIds.map(id=>ST.pawns.find(p=>p.id===id)).filter(Boolean);
    for(const m of members){const mx=m.px|0,my=m.py|0;
      for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
        if(dx*dx+dy*dy>20)continue;
        const X=mx+dx,Y=my+dy;if(INB(X,Y)&&colCost(X,Y)>=0)newTurf.add(K(X,Y))}}
    for(const k of g.turf){if(!newTurf.has(k)&&Math.random()<0.2)g.turf.delete(k)}
    for(const k of newTurf)g.turf.add(k);
    if(g.gangHeat>0)g.gangHeat=Math.max(0,(g.gangHeat||0)-0.5)}
  // gang war: detect overlapping turf between two gangs
  if(ST.gangs.length>=2){
    for(let i=0;i<ST.gangs.length;i++)for(let j=i+1;j<ST.gangs.length;j++){
      const a=ST.gangs[i],b=ST.gangs[j];
      let overlap=0;for(const k of a.turf)if(b.turf.has(k))overlap++;
      if(overlap>15){
        a.tension=(a.tension||0)+overlap*.05;b.tension=(b.tension||0)+overlap*.05;
        ST.heat=Math.min(100,(ST.heat||0)+0.3);
        // escalate to fight when tension peaks
        if((a.tension||0)>70&&Math.random()<0.3){
          const aM=a.crewIds.map(id=>ST.pawns.find(p=>p.id===id)).filter(Boolean);
          const bM=b.crewIds.map(id=>ST.pawns.find(p=>p.id===id)).filter(Boolean);
          if(aM.length&&bM.length){
            const fa=CH(aM),fb=CH(bM);
            const dmg=RI(8,18);damagePawn(fa,dmg);damagePawn(fb,dmg);
            relAdj(fa.id,fb.id,-30);a.gangHeat=Math.min(100,(a.gangHeat||0)+20);
            b.gangHeat=Math.min(100,(b.gangHeat||0)+20);
            ST.heat=Math.min(100,(ST.heat||0)+10);
            a.tension=0;b.tension=0;
            float(fa.px,fa.py,"GANG WAR","#ff3d5a");
            log(a.name+" and "+b.name+" clashed over contested turf — violence in the sprawl.","bad");
            banner("GANG CONFLICT","bad");SFX.alert()}}
      }else{a.tension=Math.max(0,(a.tension||0)-1);b.tension=Math.max(0,(b.tension||0)-1)}}}}

/* ============================================================
   CRIME & GANGS (deeper) — recruitment, rackets, snitching, revenge
   ============================================================ */
// SECURITY: watch posts bleed off district heat and suppress crime/recruitment in range.
function securityTick(){
  const posts=[];
  for(const s of ST.structs.values())if(!s.bp&&DEF[s.type]&&DEF[s.type].security)posts.push(s);
  if(!posts.length){ST._secZones=null;return;}
  // bleed heat each tick, scaled by number of posts
  if(ST.tick%50===0)ST.heat=Math.max(0,(ST.heat||0)-posts.length*1.2);
  // cache zones for crime checks + render
  ST._secZones=posts.map(s=>({x:s.x,y:s.y,r:DEF[s.type].secRadius||18}));
  // suppress gang heat for gangs whose turf overlaps a post
  if(ST.tick%100===0&&ST.gangs.length){
    for(const g of ST.gangs){
      let covered=false;
      for(const z of ST._secZones){if(g.turf.has(K(z.x,z.y))){covered=true;break}
        // also check if any turf tile is within radius
        for(const k of g.turf){if(DIST(KX(k),KY(k),z.x,z.y)<=z.r){covered=true;break}}
        if(covered)break;}
      if(covered)g.gangHeat=Math.max(0,(g.gangHeat||0)-3);
    }
  }
}
// INFRA TICK — passive espionage infrastructure effects (mirror of securityTick)
// Cadence: ST.tick%200 (≈12×/day). Caps prevent camera-farming trivializing intel.
//   camera:   0.06/node, cap 0.30/cadence (≈3.6/day max)
//   wiretap:  0.10/node when adjacent to a regime building, cap 0.30/cadence (shared monitor cap)
//   deadDrop: 0.03 × recruited count per node, cap 0.25/cadence (network-scaled)
//   safehouse: handled in insurrectionTick's exposure cooldown block (spatial fade multiplier)
function infraTick(){
  if(!M||!M())return;
  if(ST.tick%200!==0)return;   // all effects share the same cadence — bail early if not due
  const mov=M();
  // --- MONITOR PILLAR: cameras + wiretaps + dead drops ---
  // collect all monitor-pillar assets once
  const monitorAssets=[];
  for(const s of ST.structs.values())if(!s.bp&&s.espionage&&s.pillar==="monitor"&&!s.isBroken)monitorAssets.push(s);
  if(monitorAssets.length){
    // cameras: flat drip
    const cams=monitorAssets.filter(s=>s.type==="camera");
    const camDrip=Math.min(cams.length*0.06,0.30);
    // wiretaps: drip only when within 6 tiles of a regime building (copstation or mayorhouse)
    const regimeStructs=[];
    for(const s of ST.structs.values())if(!s.bp&&DEF[s.type]&&(DEF[s.type].roleHome==="enforcer"||DEF[s.type].roleHome==="mayor"))regimeStructs.push(s);
    const taps=monitorAssets.filter(s=>s.type==="wiretap");
    let tapDrip=0;
    for(const t of taps){
      const nearRegime=regimeStructs.some(r=>DIST(t.x,t.y,r.x,r.y)<=6);
      if(nearRegime)tapDrip+=0.10;
    }
    tapDrip=Math.min(tapDrip,0.30);
    // dead drops: drip scales with recruited network
    const drops=monitorAssets.filter(s=>s.type==="deadDrop");
    const recruitedCount=ST.pawns.filter(p=>p.recruited&&!isChild(p)&&!p.isAvatar).length;
    const dropDrip=Math.min(drops.length*0.03*recruitedCount,0.25);
    mov.intel=Math.min(999,(mov.intel||0)+camDrip+tapDrip+dropDrip);
  }
  // --- HACK PILLAR: grid taps — unconditional intel drip, cap 0.20/cadence ---
  // rate: 0.05/tap. cap keeps a bank of taps from trivialising intel.
  const hackAssets=[];
  for(const s of ST.structs.values())if(!s.bp&&s.espionage&&s.pillar==="hack"&&!s.isBroken)hackAssets.push(s);
  if(hackAssets.length){
    const taps=hackAssets.filter(s=>s.type==="gridtap");
    const tapIntel=Math.min(taps.length*0.05,0.20);
    if(tapIntel>0)mov.intel=Math.min(999,(mov.intel||0)+tapIntel);
  }
}
// is a point under security coverage? (used to suppress crime)
function underSecurity(x,y){
  if(!ST._secZones)return false;
  for(const z of ST._secZones)if(DIST(x,y,z.x,z.y)<=z.r)return true;
  return false;
}
// does the avatar have hack reach to a target via a placed Grid Tap?
// hack ops use this instead of inOpRange — avatar position is irrelevant for remote ops.
// handles both struct targets ({x,y} tile coords) and pawn targets ({px,py} float coords).
function hasHackReach(target){
  if(!target)return false;
  // structs have .x/.y (tile origin) but no .px/.py; pawns have both — prefer .px/.py for live position
  const tx=(target.px!=null)?target.px:target.x+0.5;
  const ty=(target.py!=null)?target.py:target.y+0.5;
  for(const s of ST.structs.values()){
    if(s.bp||s.isBroken||!s.espionage||s.pillar!=="hack"||s.type!=="gridtap")continue;
    if(DIST(s.x+0.5,s.y+0.5,tx,ty)<=(DEF.gridtap.infraRadius))return true;
  }
  return false;
}
function crimeTick(){
  if(!ST.gangs.length)return;
  // RECRUITMENT: a gang with room recruits a desperate, low-integrity, unaffiliated pawn nearby
  if(ST.tick%180===0){
    for(const g of ST.gangs){
      if(g.crewIds.length>=4)continue;
      const members=g.crewIds.map(id=>ST.pawns.find(p=>p.id===id)).filter(Boolean);
      if(!members.length)continue;
      const recruiter=members[0];
      const prospect=ST.pawns.find(q=>!pawnGang(q)&&q.hp>0&&!isChild(q)
        &&(q.pers.intg||50)<42&&((q.credits||0)<15||q.homeless||(q.career&&q.career.sat<25))
        &&DIST(q.px,q.py,recruiter.px,recruiter.py)<8
        &&relGet(recruiter.id,q.id)>-20);
      if(prospect&&Math.random()<0.5){
        if(underSecurity(prospect.px,prospect.py)){
          // security presence disrupts the pitch
          if(ST.tick%900===0)log("A watch post disrupted a gang recruitment attempt.","good");
        }else{
        g.crewIds.push(prospect.id);
        addMod(prospect,"joinedgang","Found a crew",8,TPD*2);
        relAdj(prospect.id,recruiter.id,20);
        remember(prospect,"threw in with "+g.name+" — beats starving alone");
        log(prospect.name+" joined "+g.name+".","warn");
        if(typeof emote==="function")emote(prospect,"idea");
        }
      }
    }
  }
  // PROTECTION RACKET: established gangs shake down vendors on their turf for income
  if(ST.tick%240===0){
    for(const g of ST.gangs){
      if(g.crewIds.length<2)continue;
      // find a vendor structure on the gang's turf
      let mark=null;
      for(const s of ST.structs.values()){
        if(s.bp||!DEF[s.type].vendor)continue;
        if(g.turf.has(K(s.x,s.y))){mark=s;break}}
      if(mark){
        const take=RI(12,28);
        ST.income=Math.max(0,(ST.income||0)-Math.round(take*0.5)); // skims district income
        g.bank=(g.bank||0)+take;
        g.gangHeat=Math.min(100,(g.gangHeat||0)+6);
        float(mark.x+.5,mark.y+.5,"SHAKEDOWN","#ff7a3d");
        log(g.name+" ran a protection racket on a local vendor.","warn");
      }
    }
  }
  // CONTRABAND: gangs cook illicit goods. If you tolerate it (policy), the district
  // takes a cut but heat climbs. If you don't, it's pure gang profit + snitch risk.
  if(ST.tick%300===0){
    for(const g of ST.gangs){
      if(g.crewIds.length<2)continue;
      const cook=g.crewIds.map(id=>ST.pawns.find(p=>p.id===id)).find(p=>p&&p.hp>0&&!p.sleeping);
      if(!cook)continue;
      const batch=RI(20,45);
      g.contraband=(g.contraband||0)+batch;
      if(ST.contrabandPolicy==="allow"){
        const cut=Math.round(batch*0.4);
        ST.income=(ST.income||0)+cut;             // district profits from looking away
        ST.heat=Math.min(100,(ST.heat||0)+5);     // ...at a cost
        g.gangHeat=Math.min(100,(g.gangHeat||0)+3);
        float(cook.px,cook.py,"+"+cut+"c (cut)","#c98bff");
        if(ST.tick%900===0)log("The district quietly profits from "+g.name+"'s trade (+heat).","info");
      }else{
        g.bank=(g.bank||0)+batch;
        ST.heat=Math.min(100,(ST.heat||0)+2);
        witnessCrime(cook,cook.px,cook.py);        // someone might report it
      }
      if(typeof emote==="function"&&Math.random()<0.5)tryEmote(cook,"dizzy",200);
    }
  }
  // HEIST: a flush, motivated gang plans a big coordinated score. High payout, high heat,
  // real risk (a member can get hurt/caught). Surfaces in TASKS + diary.
  if(ST.tick%420===0){
    for(const g of ST.gangs){
      if((g.bank||0)<60||g.crewIds.length<3)continue;
      if(g.heistCd&&ST.tick<g.heistCd)continue;
      const crew=g.crewIds.map(id=>ST.pawns.find(p=>p.id===id)).filter(p=>p&&p.hp>0);
      if(crew.length<3)continue;
      // security coverage over the crew sharply reduces heist odds
      const coveredCrew=crew.filter(p=>underSecurity(p.px,p.py)).length;
      const heistOdds=coveredCrew>=2?0.12:0.45;
      if(Math.random()<heistOdds){
        const score=RI(120,260);
        g.bank=(g.bank||0)+score;
        g.gangHeat=Math.min(100,(g.gangHeat||0)+22);
        ST.heat=Math.min(100,(ST.heat||0)+18);
        g.heistCd=ST.tick+TPD*2;
        // the score gets distributed to the crew
        const cut=Math.round(score/crew.length);
        for(const p of crew){p.credits=(p.credits||0)+cut;tryEmote&&tryEmote(p,"party",120);}
        // risk: one crew member may be hurt or caught (heat spike + injury)
        if(Math.random()<0.35){
          const unlucky=crew[RI(0,crew.length-1)];
          unlucky.hp=Math.max(8,unlucky.hp-RI(20,40));
          float(unlucky.px,unlucky.py,"JOB WENT BAD","#ff4757");
          remember(unlucky,"the score went sideways — barely got out");
          log(g.name+" pulled a heist — "+score+"c, but "+unlucky.name+" got hurt. Heat is way up.","bad");
        }else{
          log(g.name+" pulled off a clean heist — "+score+"c richer. Heat is climbing.","warn");
        }
        banner("HEIST · "+g.name.toUpperCase(),"bad");
        // record for the player to see
        g.lastHeist=ST.tick;
      }
    }
  }
}
// SNITCHING: a witness to a crime may report the perp, spiking heat on them
/* ═══════════ PHASE 2 — PERCEPTION. canSee(observer, av, op) answers "can this NPC perceive the avatar
   acting right now," composing the witnessCrime model with spatial nuance. It's the basis for both the
   live difficulty penalty and the post-act witness fallout. The skill being tested is positioning:
   acting where/when no one can see you. Darkness, distance, attention-state, and allegiance all matter. */
function canSee(obs,av,op){
  if(!obs||!av||obs===av||obs.id===av.id)return 0;
  if(obs.hp<=0||obs.sleeping)return 0;          // the dead and the sleeping see nothing
  if(isChild(obs))return 0;                      // children aren't witnesses that matter
  const d=DIST(obs.px,obs.py,av.px,av.py);
  // base sight radius — loud ops are noticeable from farther; subtle ops only up close
  let sight=op?(op.sightRange||7):7;
  // DARKNESS shrinks sight (Phase 4 leans on this; wired now so night already matters a little)
  const dark=lightLevel(hourN())>0.3;
  if(dark)sight*=0.62;                            // after dark you can get much closer unseen
  // a lamp-lit tile near the observer restores some range (light pools expose you)
  if(dark&&typeof nearLamp==="function"&&nearLamp(av.px,av.py))sight*=1.4;
  if(d>sight)return 0;                            // out of perception range
  // ATTENTION — a busy NPC is a worse witness than an idle one looking around
  let attn=1;
  if(obs.job&&obs.job.t==="work")attn=0.6;        // heads-down working
  else if(obs.socWith)attn=0.7;                   // absorbed in conversation
  else if(obs.job&&obs.job.t==="sleep")attn=0.2;
  // a closer observer perceives more reliably (linear falloff inside the radius)
  const prox=1-(d/sight)*0.5;                     // 1.0 at point-blank → 0.5 at the edge
  // WHO is watching weights the threat: an enforcer/loyalist is a dangerous witness; a sympathizer less so
  let weight=1;
  if(obs.role==="enforcer"||obs.regimeForce)weight=2.6;
  else if((obs.allegiance||0)<-25)weight=1.8;     // hostile loyalist
  else if((obs.allegiance||0)>30)weight=0.5;      // sympathizer may look the other way
  if(pawnGang(obs))weight=0.15;                    // gang never really reports
  return attn*prox*weight;                         // >0 means "can see," magnitude = how damning
}
// sum the weighted witnesses who can currently see the avatar performing op → added difficulty.
function witnessPenalty(av,op){
  if(!av)return 0;
  let pen=0,n=0;
  for(const q of ST.pawns){const w=canSee(q,av,op);if(w>0){pen+=w;n++;}}
  // scale by the op's loudness (a quiet bribe is punished less for being seen than a loud assassination)
  const k=op&&op.witnessK!=null?op.witnessK:1;
  return {pen:Math.round(pen*k*1.6), count:n};
}
function witnessCrime(perp,x,y){
  // THE ENFORCER — if a loyal enforcer is near the crime, they reliably report it (it's their job).
  const enf=ST.pawns.find(p=>p.role==="enforcer"&&p.hp>0&&!p.sleeping&&(p.allegiance||0)<10&&DIST(p.px,p.py,x,y)<14);
  if(enf&&enf.id!==perp.id){
    ST.heat=Math.min(100,(ST.heat||0)+14);
    relAdj(perp.id,enf.id,-25);perp.snitchedBy=enf.id;
    tryEmote(enf,"excl",120);
    log("⚖ The Enforcer caught "+perp.name+" in the act — heat spikes.","warn");
    return;
  }
  for(const q of ST.pawns){
    if(q.id===perp.id||q.hp<=0||q.sleeping)continue;
    if(DIST(q.px,q.py,x,y)>6)continue;
    if(pawnGang(q))continue;                 // gang members don't snitch
    if((q.pers.intg||50)>62&&relGet(q.id,perp.id)<25&&Math.random()<0.3){
      ST.heat=Math.min(100,(ST.heat||0)+8);
      relAdj(perp.id,q.id,-20);              // perp resents the snitch (revenge fuel)
      perp.snitchedBy=q.id;
      tryEmote(q,"excl",120);
      log(q.name+" reported "+perp.name+"'s crime — heat is rising.","warn");
      return;
    }
  }
}
// REVENGE: a pawn wronged (robbed/snitched/attacked) may target the culprit back
function seekRevenge(p){
  if(!p.grudgeTarget)return null;
  const t=ST.pawns.find(q=>q.id===p.grudgeTarget&&q.hp>0);
  if(!t||DIST(p.px,p.py,t.px,t.py)>10)return null;
  if((p.pers.imp||50)<45)return null;       // only impulsive types act on it
  return t;
}

/* per-tick pawn logic */
// ═══ GAP 4 — cityReact: THE CENTRAL EVENT HOOK. One place the big beats route through so the city responds
//    COLLECTIVELY to the player's insurrection (and the regime's reprisals): a visible RIPPLE wave (Gap 2),
//    physical CROWD formation/scatter (Gap 3), AND a city-wide MOOD/temperature shift (the disaffected
//    emboldened by a strike, cowed by a crackdown). Ops have local witness effects already; this is the
//    collective layer on top. event drives the flavor; (x,y) epicenter; mag 0..1 scales everything.
// event: "strike" (you hit the regime) | "rally" (dissent/hope) | "crackdown" (regime reprisal) |
//        "death" (a notable death) | "turn" (a recruitment/flip).
function cityReact(event,x,y,mag){
  mag=clamp(mag==null?0.6:mag,0,1);
  const m=M(),reg=REG();
  if(event==="strike"){
    // a blow against the regime: shock ripples out; the fearful scatter, the emboldened gather to gawk/cheer;
    // city-wide the disaffected are emboldened (mood + a lean toward you), the regime's grip rattled.
    onlookersReact(x,y,{near:"shock",far:"sweat"},10+8*mag);
    formCrowd("scatter",x,y,7+3*mag,mag);                 // the frightened flee the violence
    formCrowd("gawk",x,y,13+5*mag,mag);                    // others rubberneck
    cityMoodShift({sympMood:+5*mag, sympLean:+3*mag, fearAll:+2*mag});
    reg.grip=clamp((reg.grip||0)-3*mag,0,100);
  }else if(event==="rally"){
    // you spread hope: a warm ripple; sympathizers gather in a protest; city-wide sympathy ticks up.
    onlookersReact(x,y,{near:"excl",far:"ques"},9+7*mag);
    formCrowd("protest",x,y,12+6*mag,mag);
    cityMoodShift({sympMood:+4*mag, sympLean:+5*mag});
  }else if(event==="crackdown"){
    // the regime reprisal: fear ripples; everyone scatters; city-wide the cowed lose heart (sympathizers
    // chilled, fear up), the regime's grip tightens.
    onlookersReact(x,y,{near:"shock",far:"sweat"},12+8*mag);
    formCrowd("scatter",x,y,11+6*mag,mag);
    cityMoodShift({sympMood:-5*mag, sympLean:-3*mag, fearAll:+5*mag});
    reg.awareness=clamp((reg.awareness||0)+4*mag,0,100);
  }else if(event==="death"){
    // a notable death: grief ripples; the bonded gather to mourn.
    onlookersReact(x,y,{near:"cry",far:"sweat"},9+5*mag);
    formCrowd("mourn",x,y,9+4*mag,mag);
    cityMoodShift({fearAll:+2*mag});
  }else if(event==="turn"){
    // a recruitment / flip: a quiet ripple of allegiance; small city-wide warmth.
    onlookersReact(x,y,"ques",6+3*mag);
    cityMoodShift({sympLean:+2*mag});
  }
}
// apply a city-wide mood/temperature nudge. Touches the actual sim state so the collective NUMBERS move with
// the visible texture: sympMood shifts sympathizers' mood, sympLean nudges their allegiance (Gap 1 aura tracks
// it), fearAll bumps stress across the disaffected. Small per-event; the cumulative drift is the "temperature".
function cityMoodShift(o){
  o=o||{};
  for(const p of ST.pawns){
    if(p.isAvatar||isChild(p)||p.hp<=0)continue;
    const sympathetic=(p.allegiance||0)>0||p.recruited;
    if(o.sympMood&&sympathetic)p.mood=clamp((p.mood||50)+o.sympMood,0,100);
    if(o.sympLean&&sympathetic&&!p.informant)p.allegiance=clamp((p.allegiance||0)+o.sympLean,-100,100);
    if(o.fearAll)p.stress=clamp((p.stress||0)+o.fearAll,0,100);
  }
}
// ═══ GAP 3 — PHYSICAL CROWD FORMATION. Beyond emoting, wisps physically GATHER (protest / mourn / gawk) or
//    SCATTER (flee a crackdown) in response to a significant event. formCrowd() tags eligible nearby wisps
//    with a transient p.gather goal; the gather-driver in pawnTick pulls them toward (or away from) the point
//    for a duration, then releases them back to routine. Disposition-gated: who joins depends on the mood
//    (a loyalist won't join your protest; a sympathizer will; everyone flees a massacre). ═══
// mode: "protest" | "mourn" | "gawk" | "scatter". (x,y) epicenter, radius reach, magnitude 0..1 scales size+duration.
function formCrowd(mode,x,y,radius,magnitude){
  const R=radius||10, mag=clamp(magnitude==null?0.6:magnitude,0,1);
  const dur=Math.round(TPD*(0.06+0.10*mag));     // gather lasts a fraction of a day, bigger events linger
  let joined=0;
  const CAP=Math.round(4+10*mag);                 // cap crowd size (perf + readability)
  for(const p of ST.pawns){
    if(p.isAvatar||isChild(p)||p.hp<=0||p.sleeping||p.jailed)continue;
    if(p.gather&&p.gather.until>ST.tick)continue;  // already in a crowd
    if(p.flee>ST.tick&&mode!=="scatter")continue;  // the fleeing don't join gatherings
    const d=DIST(p.px,p.py,x,y);
    if(d>R)continue;
    // DISPOSITION GATE — who participates, by mode
    const al=p.allegiance||0;
    let eligible=false;
    if(mode==="protest")      eligible=(al>10||p.recruited)&&!p.informant;   // sympathizers + your cell rally
    else if(mode==="mourn")   eligible=true;                                  // anyone can grieve a death
    else if(mode==="gawk")    eligible=Math.random()<0.6;                     // a rubbernecking subset
    else if(mode==="scatter") eligible=true;                                  // everyone flees danger
    if(!eligible)continue;
    if(mode==="scatter"){
      // SCATTER reuses the flee primitive — disperse AWAY from the epicenter
      p.flee=ST.tick+RI(60,110);clearJob(p);tryEmote&&tryEmote(p,"sweat",90);
    }else{
      p.gather={mode,x,y,until:ST.tick+dur+RI(0,40)};clearJob(p);
    }
    if(++joined>=CAP)break;
  }
  return joined;
}
// drive a gathered wisp: move toward the gather point, mill about it, emote the crowd's mood. Released by
// pawnTick when p.gather.until elapses. Returns true if it handled this pawn's movement (preempts normal AI).
function gatherDriver(p){
  const g=p.gather;if(!g)return false;
  if(ST.tick>=g.until){p.gather=null;clearJob(p);return false;}   // crowd disperses → back to routine
  const d=DIST(p.px,p.py,g.x,g.y);
  // converge to a ring around the point (not all stacking on the exact tile), then mill + emote
  if(d>2.6){gotoCell(p,g.x,g.y,2);}
  else{
    // arrived — mill slightly + emote the crowd mood
    if(ST.tick%30===0&&Math.random()<0.6){
      const EM=g.mode==="protest"?(Math.random()<0.5?"anger":"excl"):g.mode==="mourn"?"cry":"ques";
      tryEmote(p,EM,80);
    }
    if(!p.job||p.job.t!=="goto"){p.job=null;}   // let it idle-mill near the spot
  }
  return true;
}
function pawnTick(p){
  if(!p.sleeping&&colCost(p.px|0,p.py|0)<0)nudgeOff(p.px|0,p.py|0);
  // GOVERNMENT ENVOY — fully driven by envoyTick's state machine (it calls gotoCell to move the envoy to the
  // Mayor / back to the edge). pawnTick just suppresses all normal citizen AI for the envoy.
  if(p.isEnvoy)return;
  // ── ambient charm: wisps spontaneously emote based on how they feel ──
  if(ST.tick%45===0&&Math.random()<0.5){
    if(p.sleeping){if(Math.random()<0.4)tryEmote(p,"sleepy",120);}
    else if(p.dazed>ST.tick){tryEmote(p,"dizzy",100);}
    else if((p.stress||0)>65){tryEmote(p,"sweat",100);}
    else if(p.sick){if(Math.random()<0.5)tryEmote(p,"gross",140);}
    else if((p.mood||50)>72){
      // a content wisp who's also up to no good shows a cute-evil tell instead of plain cheer
      const crooked=(p.pers.intg||50)<35||pawnGang(p)||(p.addiction||0)>40;
      const greedy=(p.pers.amb||50)>70&&(p.credits||0)>40;
      if(crooked&&Math.random()<0.5)tryEmote(p,Math.random()<0.5?"scheme":"evil",120);
      else if(greedy&&Math.random()<0.4)tryEmote(p,"greed",120);
      else tryEmote(p,Math.random()<0.4?"music":"happy",110);
    }
    else if((p.mood||50)<28){tryEmote(p,"cry",140);}
    // a smug, satisfied schemer occasionally preens even in a neutral mood
    else if((p.pers.intg||50)<32&&(p.pers.amb||50)>60&&Math.random()<0.18){tryEmote(p,"smug",120);}
    // gossip: two friendly wisps near each other trade ! and ? bubbles
    else if(Math.random()<0.3){
      for(const q of ST.pawns){if(q===p||q.hp<=0||q.sleeping)continue;
        if(DIST(p.px,p.py,q.px,q.py)<3.2&&relGet(p.id,q.id)>10){
          tryEmote(p,Math.random()<0.5?"excl":"ques",100);
          if(Math.random()<0.5)tryEmote(q,"happy",100);
          // friends near each other warm up slightly
          if(relGet(p.id,q.id)>55&&Math.random()<0.2)tryEmote(p,"heart",160);
          break;}}}
  }
  const hd=100/(TPD*0.95)*trMul(p,"hung");
  const rd=100/(TPD*1.5)*trMul(p,"rest");
  p.needs.food=Math.max(0,p.needs.food-hd);
  p.needs.hyg=Math.max(0,(p.needs.hyg??80)-100/(TPD*2.2)-(p.homeless?100/(TPD*1.6):0));
  p.needs.fun=Math.max(0,(p.needs.fun??70)-100/(TPD*2.0));
  p.needs.socN=Math.max(0,(p.needs.socN??70)-100/(TPD*2.6));
  if(p.sleeping){const rate=(p.job&&p.job.s&&!p.homeless)?0.10:0.065;
    p.needs.rest=Math.min(100,p.needs.rest+rate);
    if(p.needs.food>40&&p.hp<100)p.hp=Math.min(100,p.hp+0.03)}
  else p.needs.rest=Math.max(0,p.needs.rest-rd);
  if(p.needs.food<=0){
    if(ST.tick%30===0){p.hp-=1;addMod(p,"starv","Starving",-12,80);applyDrift(p,{cau:4})}
    if(p.hp<=0){killPawn(p,"starved to death");return}}
  if(p.cd>0)p.cd--;
  if(!p.sleeping&&!p.sick&&p.hp<100&&p.needs.food>30&&ST.tick%10===0&&!foeNear(p,10))
    p.hp=Math.min(100,p.hp+0.1);
  // ── WAVE E — INFECTION STRATIFIED BY WEALTH ──
  // the better-off afford clean living + constant care: infected less, recover faster. the poor live in
  // worse conditions and can't access care: infected more, decay harder, recover slower. it's a divide
  // that drives desperation.
  const wealth=(p.credits||0);
  const poor=wealth<15, comfortable=wealth>60;
  if(ST.procgen!==false&&!p.sick&&ST.tick%60===0){
    // REBALANCE v2 — the log showed infections still outpacing recovery in a low-hygiene district (a near
    // permanent plague + log spam burying real events). Cut the base rate and the dirty-hygiene ramp further,
    // and only LOG occasionally so routine sickness doesn't drown the activity feed.
    let infectChance=0.0005+(p.needs.hyg<25?(25-p.needs.hyg)/25*0.025:0);
    if(poor)infectChance*=1.4;          // worse conditions, more exposure
    else if(comfortable)infectChance*=0.35;   // clean living, preventive care
    infectChance=Math.min(0.025,infectChance);   // hard cap halved — never more than ~2.5% per hourly check
    if(Math.random()<infectChance){
      p.sick=true;addMod(p,"sick","Infection",-10,TPD);float(p.px,p.py,"INFECTED","#ff4757");emote(p,"gross");
      if(Math.random()<0.34)log(p.name+" caught an infection.","warn")}   // log ~1 in 3 to cut spam
  }
  if(p.sick&&ST.tick%60===0){  // contagion: spread to nearby citizens
    const spreadRate=0.0015*(p.needs.hyg<30?1.6:1);  // halved; dirty carrier spreads a bit faster
    for(const q of ST.pawns){if(q===p||q.sick)continue;
      const d=DIST(p.px,p.py,q.px,q.py);if(d>3)continue;
      // bar and clinic are social hotspots — double spread rate there
      const atHotspot=nearestStruct(p,s=>(s.type==="bar"||s.type==="medbed")&&!s.bp&&
        DIST(p.px,p.py,s.x+.5,s.y+.5)<3);
      // the comfortable resist catching it (better baseline health / quicker private care)
      const qResist=(q.credits||0)>60?0.5:1;
      if(Math.random()<spreadRate*(atHotspot?2:1)*qResist){
        q.sick=true;q.sickSource=p.id;
        addMod(q,"sick","Infection",-10,TPD);float(q.px,q.py,"INFECTED","#ff4757");
        remember(q,"caught something — probably from "+p.name);
        if(Math.random()<0.34)log(q.name+" caught an infection from "+p.name+".","warn")}}}   // log ~1 in 3
  if(p.sick){
    // poor wisps without access to care decay faster; the comfortable have constant care that slows it
    if(ST.tick%60===0){let decay=1;if(poor)decay=1.6;else if(comfortable)decay=0.6;p.hp-=decay;}
    if(p.hp<=0){killPawn(p,"died of an untreated infection");return}
    // recovery: REBALANCED so the sick actually recover even in a poorer district (the old gates needed
    // hygiene>50, which low-hygiene wisps never hit → infections lingered forever). Everyone now has a
    // meaningful baseline recovery chance; clean/healthy/wealthy just recover faster.
    if(p.hp>25&&ST.tick%80===0){
      const clean=(p.needs.hyg||50)>45, healthy=p.hp>50;
      let recoverChance=clean&&healthy?0.22:(p.needs.hyg||50)>25?0.15:0.10;   // floor raised further (in/out balance)
      if(comfortable)recoverChance*=1.5;      // constant care
      else if(poor)recoverChance*=0.8;        // slower, but recovers
      if(Math.random()<recoverChance){p.sick=false;p.quarantine=false;if(Math.random()<0.5)log(p.name+" shook off the infection.","good");}
    }
    // DESPERATION — a poor, sick wisp whose health is failing is pushed toward desperate measures.
    // mark them so chooseJob's crime/steal weights spike (the divide drives them to act out).
    if(poor&&p.hp<45){p.desperate=ST.tick+400;
      if(ST.tick%120===0){emotionalReact(p,"distress",0.5,{memory:"sick, broke, and no one's helping — something has to give"});}
    }
  }
  if(ST.tick%100===0){
    let sp=-3;
    if(p.sick)sp+=3;
    if(p.needs.food<15)sp+=2;
    if(p.needs.rest<15)sp+=2;
    if(p.needs.hyg<15)sp+=1;
    if(p.needs.fun<15)sp+=1;
    if(p.needs.socN<15)sp+=1.5;
    if(p.homeless)sp+=2.5;
    if(p.addiction>40)sp+=(p.addiction-40)/25;
    // territory effects
    const pg=pawnGang(p);const px=p.px|0,py=p.py|0;
    const inOwnTurf=pg&&pg.turf.has(K(px,py));
    const inRivalTurf=!inOwnTurf&&ST.gangs.some(g=>!g.crewIds.includes(p.id)&&g.turf.has(K(px,py)));
    if(inOwnTurf)sp-=1.5;  // gang member relaxed on home turf
    if(inRivalTurf)sp+=2*trMul(p,"para");   // outsider tense in gang turf (paranoid = worse)
    p.stress=clamp((p.stress||0)+sp,0,100);
    if(p.addiction>0)p.addiction=Math.max(0,p.addiction-0.5)}
  if((ST.tick+p.id)%40===0)moodCalc(p);
  // mental break
  const brk=22+trAdd(p,"brk");
  if(p.dazed<ST.tick&&p.mood<brk&&Math.random()<0.0018+(p.stress>70?0.0025:0)){
    clearJob(p);p.dazed=ST.tick+260;p.dz=null;
    float(p.px,p.py,"SNAPPED","#b06fff");emote(p,"dizzy");onlookersReact(p.px,p.py,"sweat",6);
    log(p.name+" snapped — wandering dazed.","warn")}
  if(p.dazed>ST.tick&&p.dazed-ST.tick===1){applyDrift(p,{cau:2,soc:-1})}
  if(p.dazed>ST.tick){p.sleeping=false;
    // SURVIVAL FLOOR (death-spiral fix) — a dazed wisp normally just wanders, but it must NOT wander itself to
    // death. If critically hungry (or exhausted), break out of the aimless wander to actually EAT/SLEEP. Without
    // this, a wisp that snapped stayed dazed (re-triggering while their mood was wrecked by hunger), never ate,
    // and STARVED — exactly how the avatar "Esteban" died. Survival overrides the daze.
    const _starv=(p.needs&&p.needs.food!=null&&p.needs.food<20);
    const _exh=(p.needs&&p.needs.rest!=null&&p.needs.rest<10);
    if(_starv||_exh){
      p.dazed=ST.tick;p.dz=null;   // end the daze so survival (eat/sleep) takes over this tick — do NOT return
    } else {
      if(!p.dz||((p.px|0)===p.dz.x&&(p.py|0)===p.dz.y))p.dz=randNear(p,4);
      if(p.dz&&gotoCell(p,p.dz.x,p.dz.y,0)==="fail")p.dz=null;
      return;
    }
  }
  // relationship-driven behaviors (every 80 ticks, non-drafted non-dazed)
  if(ST.tick%80===0&&p.dazed<ST.tick){
    // REVENGE: a pawn with a standing grudge confronts the target when close
    const rev=seekRevenge(p);
    if(rev&&DIST(p.px,p.py,rev.px,rev.py)<4&&Math.random()<0.3){
      const dmg=Math.round(RI(5,12)*trMul(p,"fightdmg"));
      damagePawn(rev,dmg);damagePawn(p,Math.round(dmg*0.4));
      relAdj(p.id,rev.id,-15);ST.heat=Math.min(100,(ST.heat||0)+8);
      addMod(p,"vengeance","Settled a score",4,TPD*.5);addMod(rev,"attacked","Got jumped",-12,TPD*.5);
      remember(p,"got even with "+rev.name+" — they had it coming");
      remember(rev,p.name+" came at me out of nowhere — this isn't over");
      float(p.px,p.py,"PAYBACK","#ff4757");emote(p,"anger");onlookersReact(p.px,p.py,"shock",8);
      gossip(p.id,-4,7,p.px,p.py);defendInFight(p,rev);witnessCrime(p,p.px,p.py);
      log(p.name+" took revenge on "+rev.name+".","warn");
      p.grudgeTarget=null;          // grudge discharged
      clearJob(p);return;
    }
    for(const q of ST.pawns){if(q===p||q.hp<=0)continue;
      const rel=relGet(p.id,q.id);
      const dist=DIST(p.px,p.py,q.px,q.py);
      // enemy escalation: two enemies close + stress → fight
      if(rel<-65&&dist<4&&(p.stress>40||q.stress>40)&&Math.random()<0.12){
        const dmg=Math.round(RI(4,10)*trMul(p,"fightdmg"));
        damagePawn(p,dmg);damagePawn(q,dmg);
        relAdj(p.id,q.id,-25);ST.heat=Math.min(100,(ST.heat||0)+6);
        addMod(p,"fight","Got in a fight",-8,TPD*.3);addMod(q,"fight","Got in a fight",-8,TPD*.3);
        remember(p,"threw down with "+q.name+" in the sprawl");
        remember(q,"threw down with "+p.name+" in the sprawl");
        for(const w of ST.pawns){if(w===p||w===q)continue;
          if(DIST(w.px,w.py,p.px,p.py)<8){relAdj(w.id,p.id,-5);relAdj(w.id,q.id,-5);
            remember(w,"watched "+p.name+" and "+q.name+" beat each other up")}}
        float(p.px,p.py,"FIGHT!","#ff4757");emote(p,"anger");emote(q,"anger");onlookersReact(p.px,p.py,"shock",8);gossip(p.id,-3,7,p.px,p.py);gossip(q.id,-3,7,p.px,p.py);defendInFight(p,q);log(p.name+" and "+q.name+" came to blows.","warn");
        clearJob(p);clearJob(q);break}
      // ally mutual aid: ally is sick/starving nearby → offer 5c if can afford
      const aidRange=8+(trAdd(p,"emprange")||0);
      if(rel>50&&dist<aidRange&&(q.sick||(q.needs.food||0)<25)&&(p.credits||0)>25&&Math.random()<0.18){
        const gift=5;p.credits-=gift;q.credits=(q.credits||0)+gift;
        relAdj(p.id,q.id,4);
        remember(p,"slipped "+q.name+" some credits when they were struggling");
        remember(q,p.name+" looked out for me when I needed it — good people");
        float(p.px,p.py,"-"+gift+"c help","#39ff88");emote(p,"heart");gossip(p.id,4,7,p.px,p.py)}}}
  // quarantine: if flagged, stay home
  if(p.quarantine&&p.sick){const h=p.home;
    if(h&&((p.px|0)<h.x0||(p.px|0)>=h.x0+h.w)){clearJob(p);p.cmd="sleep"}}
  // fleeing
  // FLEE ON SIGHT (witness fear) — a wisp carrying a FRESH, SEVERE memory of the avatar's brutality who
  // finds the operative close by panics and bolts. Throttled + gated on real fear so only genuine kill/heavy
  // witnesses run (an old or minor memory doesn't trigger it). This is the visceral side of being seen: the
  // people who watched you kill won't stand near you. (Recruited cell/gang are never afraid — skipped in fear.)
  if(!p.isAvatar&&!p.jailed&&p.flee<=ST.tick&&ST.tick%20===0&&p._opWit&&p._opWit.length){
    const av=theAvatar();
    if(av&&av.hp>0&&!av.jailed){
      const fear=witnessFear(p);
      if(fear>=0.9){const d=DIST(p.px,p.py,av.px,av.py);
        if(d<6){p.flee=ST.tick+RI(80,140);clearJob(p);tryEmote&&tryEmote(p,"sweat",120);
          if(Math.random()<0.3)remember(p,"saw the operative nearby and froze — I know what they're capable of");}}
    }
  }
  if(p.gather&&gatherDriver(p))return;   // GAP 3 — gathered wisps converge/mill at a crowd, preempting normal AI
  if(p.flee>ST.tick){const c=homeCell(p);gotoCell(p,c.x,c.y,1);return}
  // sleeping wake conditions
  if(p.sleeping&&ST.tick%20===0&&foeNear(p,7)){
    p.sleeping=false;clearJob(p);addMod(p,"rude","Combat woke me",-4,TPD*.3)}
  // SOCIAL HOLD: if someone is socializing WITH this pawn, the pawn pauses to "chat back" instead of
  // wandering off. BUT only if this pawn isn't itself running a socialize job (otherwise the hold's
  // job=null would kill its own conversation progress — that was an infinite re-init loop). A hard
  // elapsed cap also guarantees release if the initiator's job ends abnormally.
  if(p.socWith&&ST.tick<(p.socUntil||0)&&!(p.job&&p.job.t==="socialize")){
    const partner=ST.pawns.find(q=>q.id===p.socWith);
    if(p.socHoldStart==null)p.socHoldStart=ST.tick;
    if(partner&&DIST(p.px,p.py,partner.px,partner.py)<3&&(ST.tick-p.socHoldStart)<80){
      p.path=null;p.job=null;                                  // stay put for the conversation
      if(ST.tick%18===0)tryEmote(p,Math.random()<0.5?"chat":"happy",60);
      return;
    } else { p.socWith=null;p.socUntil=0;p.socHoldStart=null; } // partner left or cap hit — release
  } else if(p.socWith&&!(p.job&&p.job.t==="socialize")&&ST.tick>=(p.socUntil||0)){ p.socWith=null;p.socUntil=0;p.socHoldStart=null; }

  // STUCK DETECTOR (safety net): if a pawn has a job but isn't moving AND isn't making progress, its path
  // is dead-ended (e.g. can't squeeze to a work tile). Drop the job, mark the target unreachable, pick
  // something else — prevents pawns freezing. (A pawn working/learning in place advances prog, so it's
  // NOT counted as stuck — only genuinely stalled jobs are.)
  if(p.job&&!p.sleeping&&!p.socWith){
    const here=(p.px*4|0)+","+(p.py*4|0);
    const prog=p.job.prog||0;
    if(p._lastCell===here&&prog===(p._lastProg||0)){p._stuckT=(p._stuckT||0)+1;}
    else{p._stuckT=0;p._lastCell=here;p._lastProg=prog;}
    if(p._stuckT>140){                                  // ~14s frozen with no movement AND no progress
      const j=p.job;
      if(j.s){markUnre(p,j.s.x,j.s.y);}                  // don't keep retrying the same dead-end target
      else if(j.oid){const o=ST.pawns.find(q=>q.id===j.oid);if(o){p.lastSocPartner=o.id;p.lastSocT=ST.tick;p.socCd=ST.tick+300;}}
      clearJob(p);p._stuckT=0;
    }
  } else { p._stuckT=0; }

  // EMBODIED OPS: an in-flight operation supersedes normal AI. Must run BEFORE the chooseJob line below,
  // because a null job would otherwise make the AI immediately grab a new one (interrupting the op).
  if(p.isAvatar&&p.activeOp){advanceActiveOp(p);return;}
  // AVATAR HARD SURVIVAL FLOOR — the operative is irreplaceable (its death ends the run), so survival gets
  // ABSOLUTE priority over every other state. If the avatar is critically hungry or exhausted and isn't
  // already eating/sleeping, force the survival job NOW — this runs regardless of manual/auto/posture/daze,
  // so nothing (a snapped daze, an idle manual wait, a lay-low posture) can let the avatar starve. This is
  // the safety net that should have saved "Esteban".
  if(p.isAvatar){
    const avStarv=(p.needs&&p.needs.food!=null&&p.needs.food<24);
    const avExh=(p.needs&&p.needs.rest!=null&&p.needs.rest<14);
    const eatingNow=p.job&&(p.job.t==="eat");
    const sleepingNow=p.sleeping||(p.job&&p.job.t==="sleep");
    if(avStarv&&!eatingNow){const j=mkEat(p);if(j){p.dazed=ST.tick;p.job=j;p.cmd=null;return;}}
    if(avExh&&!sleepingNow&&!avStarv){const j=mkSleep(p);if(j){p.dazed=ST.tick;p.job=j;p.cmd=null;return;}}
  }
  // WALK-TO-TALK — resolve a pending approach-to-converse BEFORE the mode gates, so it works in both manual
  // and auto (the goto job we set would otherwise stop avatarBrainTick from ever checking arrival).
  if(p.isAvatar&&p._pendingTalk){if(resolvePendingTalk(p))return;}
  // MANUAL MODE: when the player has taken direct control, the avatar doesn't pick its own busywork —
  // it waits for orders. It STILL handles critical survival (eating when starving, sleeping when
  // exhausted) so neglect can't accidentally kill your operative; everything else is the player's call.
  if(p.isAvatar&&ST.avatarManual&&!p.job&&!p.cmd){
    const starving=(p.needs&&p.needs.food!=null&&p.needs.food<18);
    const exhausted=(p.needs&&p.needs.rest!=null&&p.needs.rest<12);
    if(!starving&&!exhausted)return;                // idle, awaiting command (survival still overrides)
  }
  // POSTURE — in AUTO mode, how the operative behaves is shaped by his posture. LAY LOW skips work + stays
  // home/low-key (minimizes exposure); REVOLUCIONARIO periodically launches insurgent ops on his own (intel
  // / dissent) and pushes past comfort. NORMAL just lives. (Manual mode ignores posture — you're driving.)
  if(p.isAvatar&&!ST.avatarManual&&!p.activeOp){
    const post=ST.avatarPosture||"normal";
    // LAY LOW: he won't take WORK jobs (keeps a low profile) — drop a work job so chooseJob picks something quieter
    if(post==="laylow"&&p.job&&p.job.t==="work"){p.job=null;}
    // BRAIN A (§2) — the autonomous operative. When idle, the utility brain decides the next move:
    // score objectives, pick a target, resolve the chain, commit. Replaces the old intel/dissent stub.
    if(!p.job||post==="revolucionario"){
      avatarBrainTick(p);
      if(p.activeOp)return;   // an op was launched — it supersedes normal AI
    }
  }
  // a JAILED pawn is held — walk to the cell, then stay put (jailTick drives release/execution)
  if(p.jailed){const j=p.jailed;
    if(DIST(p.px,p.py,j.jx,j.jy)<2.9){p.job=null;return;}        // at the cell: hold, jailTick handles it
    // BUG FIX — being walked to the cell SUPERSEDES all other AI (sleep, work, brain). Previously this
    // branch re-asserted the goto job but did NOT return, so the survival-sleep logic / Brain A further
    // down could override the cell-walk — the avatar would fall asleep mid-arrest and never reach jail
    // ("arrested but left standing in the world"). The jail transport must win, like _repairing below.
    if(!p.job||p.job.t!=="goto"){p.job={t:"goto",x:j.jx,y:j.jy,adj:1};}   // still being walked there
    return;
  }
  // POWER CASCADE — a wisp dispatched to restore the grid drives to the station and supersedes routine AI
  if(p._gridFix){if(gridFixTick(p))return;}
  // a wisp actively repairing sabotage stays on the job — don't let routine AI pull them away
  if(p._repairing){const rs=ST.structs.get(p._repairing);
    if(rs&&rs.sabotaged>ST.tick){
      if(DIST(p.px,p.py,rs.x,rs.y)<2){p.job=null;return;}            // on site: hold, sabotageTick drives repair
      if(!p.job||p.job.t!=="goto"){p.job={t:"goto",x:rs.x,y:rs.y,adj:1};}   // still walking there
    } else {p._repairing=null;}   // station fixed or gone
  }
  // the enforcer working a sabotage scene stays on task until the investigation resolves
  if(p._investigating){const cs=ST.structs.get(p._investigating);
    if(cs&&cs.sabState&&cs.sabState.investStage<3){
      if(DIST(p.px,p.py,cs.x,cs.y)<3){p.job=null;return;}            // on scene: hold for questioning
      if(!p.job||p.job.t!=="goto"){p.job={t:"goto",x:cs.x,y:cs.y,adj:1};}
    } else {p._investigating=null;}
  }
  if(!p.job)p.job=chooseJob(p);
  const j=p.job;if(!j)return;
  switch(j.t){
    case "goto":{   // player-issued move order (avatar walks to a clicked tile, then resumes autonomy)
      const r=gotoCell(p,j.x,j.y,j.adj||0);
      if(r==="arr"||r==="fail"){p.job=null;}
      break;}
    case "idle":{if(ST.tick>j.until){p.job=null;break}
      // admiring art: an idling wisp near a working art piece pauses to appreciate it —
      // a brief mood lift, more for the affluent (status). Light, no trekking across town.
      if(!p.homeless&&p.home&&ST.tick%30===0&&!p.mods.some(md=>md.id==="admireart")){
        for(const s of ST.structs.values()){
          if(s.type!=="art"||s.bp||isBroken(s))continue;
          if(DIST(p.px,p.py,s.x+.5,s.y+.5)<2.5){
            const lift=2+Math.round(wealthTier(p).t*0.6*qualOf(s).effMul);
            addMod(p,"admireart","Admired the artwork",lift,TPD*.5);
            if(typeof emote==="function"&&Math.random()<0.3)emote(p,"love");
            break;}}}
      gotoCell(p,j.x,j.y,0);break}
    case "eat":{const r=gotoCell(p,j.x,j.y,j.adj);
      if(r==="fail"){markUnre(p,j.x,j.y);p.job=null;break}
      if(r==="arr"){j.prog++;
        if(j.prog>=22){
          if((ST.goods.food||0)>0){
            // eat from the communal food stockpile — free, satisfying
            ST.goods.food--;p.needs.food=100;addMod(p,"meal","Ate fresh from the farms",5,TPD*.5)}
          else if(j.home){p.needs.food=100;addMod(p,"meal","Ate at home",4,TPD*.5)}
          else if((p.credits||0)>=5){p.credits-=5;p.needs.food=100;addMod(p,"meal","Bought a meal",3,TPD*.5)}
          else{p.needs.food=Math.min(100,p.needs.food+16);addMod(p,"hungry","Couldn't afford a real meal",-7,TPD*.3)}
          let other=null,od=1e9;for(const q of ST.pawns){if(q.id===p.id)continue;const dd=Math.hypot(p.px-q.px,p.py-q.py);if(dd<od){od=dd;other=q}}
          if(other&&od<6){relAdj(p.id,other.id,3);applyDrift(p,{soc:2});tryEmote(p,"happy",80)}
          p.job=null;syncHUD()}}
      break}
    case "sleep":{
      if(j.s&&(structAt(j.s.x,j.s.y)!==j.s||j.s.bp)){clearJob(p);break}
      const r=gotoCell(p,j.x,j.y,0);
      if(r==="fail"){if(j.s)markUnre(p,j.x,j.y);clearJob(p);break}
      if(r==="arr"){p.sleeping=true;
        if(p.needs.rest>=99||p.needs.food<12){
          const pod=j.s&&!p.homeless;
          addMod(p,pod?"pod":"floor",pod?"Slept in a pod":"Slept rough",pod?4:-7,TPD*.6);
          clearJob(p)}}
      break}
    case "build":{const s=j.s;
      if(structAt(s.x,s.y)!==s||(!s.bp&&!s.decon)){p.job=null;break}
      const r=gotoCell(p,s.x,s.y,1);
      if(r==="fail"){markUnre(p,s.x,s.y);s.res=0;p.job=null;break}
      if(r==="arr"){
        if(s.decon){j.prog+=workSpd(p,p.sk.bld);
          if(j.prog>=50){deconFinish(s);p.job=null}}
        else{s.prog+=workSpd(p,p.sk.bld);
          if(ST.tick%25===0)gainXp(p,"bld");
          if(s.prog>=s.need){finishBuild(s);s.res=0;applyDrift(p,{ind:1});
  const co=ST.pawns.find(q=>q.id!==p.id&&q.job&&q.job.s===s);
  if(co)relAdj(p.id,co.id,2);
  p.job=null}}}
      break}
    case "hygiene":{const s=j.s;
      if(structAt(s.x,s.y)!==s||s.bp){p.job=null;break}
      const r=gotoCell(p,s.x,s.y,1);
      if(r==="fail"){markUnre(p,s.x,s.y);p.job=null;break}
      if(r==="arr"){j.prog++;if(j.prog>=40){p.needs.hyg=100;p.job=null}}
      break}
    case "recreate":{const s=j.s;
      if(structAt(s.x,s.y)!==s||s.bp){p.job=null;break}
      const r=gotoCell(p,s.x,s.y,1);
      if(r==="fail"){markUnre(p,s.x,s.y);p.job=null;break}
      if(r==="arr"){j.prog++;if(j.prog>=50){
        p.needs.fun=100;
        const atBar=s.type==="bar";
        const atPark=s.type==="park";
        const atArcade=s.type==="arcade";
        if(atBar&&(p.credits||0)>=5){
          p.credits-=5;p.needs.socN=Math.min(100,(p.needs.socN||0)+40);
          // boost relationships with everyone at the bar
          for(const q of ST.pawns){if(q===p)continue;
            if(DIST(p.px,p.py,q.px,q.py)<5){relAdj(p.id,q.id,5);
              addMod(q,"drinks","Had drinks together",2,TPD*.3)}}
          addMod(p,"drinks","Night at the bar",5,TPD*.5);
          remember(p,"had a good night at the bar — feels more connected to the block")}
        else if(atPark){
          // free green space — strong stress relief, small social bump
          p.stress=Math.max(0,(p.stress||0)-22);
          p.needs.socN=Math.min(100,(p.needs.socN||0)+15);
          addMod(p,"park","Time in the park",6,TPD*.5);
          for(const q of ST.pawns){if(q===p)continue;
            if(DIST(p.px,p.py,q.px,q.py)<4)relAdj(p.id,q.id,2)}}
        else if(atArcade){
          // premium entertainment — small fee feeds district income, big fun + stress relief
          if((p.credits||0)>=4){p.credits-=4;ST.income=(ST.income||0)+3;}
          p.stress=Math.max(0,(p.stress||0)-18);
          addMod(p,"arcade","Lost in the arcade",6,TPD*.5);
          // GAMBLING — an impulsive wisp with credits to spare bets on the machines. The house edge means
          // they lose more often than win; a big loss stings and can push a marginal wisp toward trouble.
          const imp=(p.pers&&p.pers.imp)||50;
          if(imp>52&&(p.credits||0)>=12&&Math.random()<(imp-50)/90){
            const stake=clamp(RI(6,Math.min(30,Math.floor((p.credits||0)*0.4))),6,30);
            const win=Math.random()<0.38;   // house edge — you lose more than you win
            if(win){const pot=Math.round(stake*RI(15,28)/10);p.credits+=pot;
              float(p.px,p.py,"WON +"+pot+"c","#5cff9e");emotionalReact(p,"delight",0.55,{memory:"hit a jackpot at the arcade"});
            } else {p.credits=Math.max(0,(p.credits||0)-stake);ST.income=(ST.income||0)+Math.round(stake*0.5);
              float(p.px,p.py,"LOST -"+stake+"c","#ff6b6b");
              const bigLoss=stake>(p.credits||0)*0.5||(p.credits||0)<8;
              emotionalReact(p,bigLoss?"distress":"disgust",bigLoss?0.55:0.35,{memory:bigLoss?"lost more than I could afford at the arcade — chasing it now":null});
              // a wisp who gambled themselves near-broke is now more recruitable/desperate
              if((p.credits||0)<8)p.disillusion=clamp((p.disillusion||0)+RI(2,5),0,100);
            }
          }}
        else if(s.type==="couch"){
          // relaxing at home: good stress relief, scaled by the couch's quality;
          // a SOCIAL spot — if someone else is on/near the couch, they bond.
          const qm=isFurniture(s)?qualOf(s).effMul:1;
          p.stress=Math.max(0,(p.stress||0)-Math.round(14*qm));
          let shared=false;
          for(const q of ST.pawns){if(q===p)continue;
            if(DIST(p.px,p.py,q.px,q.py)<2.5){shared=true;
              relAdj(p.id,q.id,4);p.needs.socN=Math.min(100,(p.needs.socN||0)+25);
              addMod(q,"couchchat","Hung out on the couch",3,TPD*.4);}}
          addMod(p,shared?"couchsocial":"couchrelax",shared?"Relaxed with company":"Put their feet up",shared?6:4,TPD*.4);
          if(shared)remember(p,"hung out on the couch with someone — felt good");}
        else addMod(p,"fun","Unwound",3,TPD*.4);
        p.job=null;syncHUD()}}
      break}
    case "socialize":{const o=ST.pawns.find(q=>q.id===j.oid);
      if(!o||o===p){p.job=null;break}
      // if they ducked into a home you're not welcome in, don't follow them inside
      {const ho=homeOwnerAt(o.px|0,o.py|0);if(ho&&ho!==p&&!canEnterHome(p,ho)){p.job=null;break}}
      const r=gotoCell(p,o.px|0,o.py|0,1);
      if(r==="fail"){p.job=null;break}
      if(r==="arr"){
        // SIDE-BY-SIDE: lock the pair together so the partner pauses, faces, and both show emotes —
        // making the interaction legible. The lock is bounded by a HARD elapsed-time cap (not job prog,
        // which can stall if pathing re-evaluates) so it always releases cleanly — no stuck pairs.
        if(j.startT==null)j.startT=ST.tick;             // remember when the chat began
        const elapsed=ST.tick-j.startT;
        p.socWith=o.id;p.socUntil=ST.tick+8;            // short rolling lock, refreshed only while adjacent
        if(!o.socWith||o.socWith===p.id){o.socWith=p.id;o.socUntil=ST.tick+8;o.path=null;}
        if(j.prog%14===0)tryEmote(p,Math.random()<0.5?"happy":"chat",60);
        if(j.prog%14===7)tryEmote(o,Math.random()<0.5?"happy":"chat",60);
        j.prog++;
        // complete on job progress OR the hard time cap (whichever first) — guarantees release
        if(j.prog>=40||elapsed>=70){p.needs.socN=100;o.needs.socN=Math.min(100,(o.needs.socN||70)+25);relAdj(p.id,o.id,3.5);
          // EMOTIONAL PAYOFF — a good conversation lifts both, more so between wisps who like each other
          const bond=relGet(p.id,o.id);
          const lift=clamp(0.35+bond/160,0.2,0.85);   // friends get a bigger boost
          const flavour=bond>45?"connected":bond>15?"joy":"amused";
          emotionalReact(p,flavour,lift,{toward:o.id});
          emotionalReact(o,flavour,lift,{toward:p.id});
          p.socWith=null;o.socWith=null;p.socUntil=0;o.socUntil=0;p.socHoldStart=null;o.socHoldStart=null;
          // cooldowns so they don't immediately re-initiate with each other (was an endless-loop bug)
          p.socCd=ST.tick+300;o.socCd=ST.tick+300;
          p.lastSocPartner=o.id;p.lastSocT=ST.tick;o.lastSocPartner=p.id;o.lastSocT=ST.tick;
          if(relGet(p.id,o.id)>=48&&Math.random()<0.06)tryFormPartnership(p,o);
          p.job=null;}}
      break}
    case "work":{const s=j.s;
      if(structAt(s.x,s.y)!==s||s.bp||(s.surgeT&&ST.tick<s.surgeT)){p.job=null;break}
      const r=gotoCell(p,s.x,s.y,1);
      if(r==="fail"){markUnre(p,s.x,s.y);p.job=null;break}
      if(r==="arr"){j.prog++;
        const d=DEF[s.type];
        const hackerMul=d.prod==="data"?trMul(p,"dataprod"):1;
        const thresh=Math.round((d.prodRate||(d.refine?160:120))/hackerMul);
        if(j.prog>=thresh){
          let wage=(p.contract&&p.contract.fixtureKey===K(s.x,s.y))?p.contract.wage:(d.wage||RI(10,15));
          // specialist bonus + vocation-fit pay bump
          if(p.career&&p.career.specialist===K(s.x,s.y))wage=Math.round(wage*1.4);
          else if(fitsVocation(p,s.type))wage=Math.round(wage*1.1);
          let didWork=true;
          // blackout halts powered production
          if(ST.blackoutUntil&&ST.tick<ST.blackoutUntil&&(d.prod||d.refine)){
            float(s.x+.5,s.y+.5,"NO POWER","#ff4757");didWork=false;
            p.workCd=ST.tick+RI(60,120);p.job=null;syncHUD();
          }else{
          // raw material production (workstation/chemlab/workshop)
          if(d.prod){ST.goods[d.prod]=(ST.goods[d.prod]||0)+1;
            float(s.x+.5,s.y+.5,"+1 "+d.prod.toUpperCase(),"#39ff88");
            addMod(p,"shift","Produced "+d.prod,3,TPD*.3)}
          // refinery (stimlab: chem+data→stims; gearshop: parts+data→gear)
          else if(d.refine){const ins=d.refine.in;const out=d.refine.out;
            const can=ins.every(k=>(ST.goods[k]||0)>0);
            if(can){ins.forEach(k=>ST.goods[k]--);ST.goods[out]=(ST.goods[out]||0)+1;
              float(s.x+.5,s.y+.5,"+1 "+out.toUpperCase(),"#c98bff");
              addMod(p,"crafted","Refined "+out,4,TPD*.4)}
            else{float(s.x+.5,s.y+.5,"NO INPUTS","#ff4757");didWork=false;
              p.credits=(p.credits||0)+Math.round(wage*0.4);}}  // standby pay
          // vendor clerk earns district income cut passively via vendorTick
          else if(d.vendor){addMod(p,"clerking","Ran the counter",2,TPD*.3)}
          }
          if(didWork){p.credits=(p.credits||0)+wage;
            // train the vocation's skill a touch each shift
            const vsk=vocationOf(p).sk;if(vsk&&p.sk[vsk]!==undefined){gainXp(p,vsk);
              // apprentices learn faster — extra XP tick when they have a mentor
              const mentor=mentorFor(p);
              if(mentor){gainXp(p,vsk);
                if(p.career)p.career.sat=clamp(p.career.sat+0.5,0,100);
                if(mentor.career&&Math.random()<0.2)mentor.career.sat=clamp(mentor.career.sat+1,0,100);}}
            careerAfterShift(p,s,wage);}
          p.workCd=ST.tick+(didWork?Math.round(RI(240,380)/ethicMul(p)):RI(80,120));  // hard workers return sooner
          applyDrift(p,{ind:didWork?1:0});p.job=null;syncHUD()}}
      break}
    case "treat":{const s=j.s;
      if(structAt(s.x,s.y)!==s||s.bp){p.job=null;break}
      const r=gotoCell(p,s.x,s.y,1);
      if(r==="fail"){markUnre(p,s.x,s.y);p.job=null;break}
      if(r==="arr"){
        // POWER CASCADE (§outage) — clinics/hospitals run on power. During a blackout they CAN'T treat;
        // the patient waits it out (and the lack of care frays them). Care resumes when power returns.
        if(gridDown()){
          if(ST.tick%60===0){p.stress=clamp((p.stress||0)+2,0,100);
            if(Math.random()<0.2)float(s.x+.5,s.y+.5,"NO POWER","#ff7a8c");}
          break;   // stay at the dark clinic, can't be treated yet
        }
        j.prog++;
        const isHosp=s.type==="hospital";
        const need=isHosp?20:30;        // hospital is faster
        if(j.prog>=need){p.sick=false;
          p.credits=(p.credits||0)-(isHosp?10:15);   // hospital cheaper
          p.hp=Math.min(100,p.hp+(isHosp?35:20));     // hospital heals more
          float(s.x+.5,s.y+.5,"TREATED","#39ff88");
          addMod(p,"heal",isHosp?"Treated at the hospital":"Treated at clinic",isHosp?6:4,TPD*.4);p.job=null;syncHUD()}}
      break}
    case "learn":{const s=j.s;
      if(structAt(s.x,s.y)!==s||s.bp){p.job=null;break}
      const r=gotoCell(p,s.x,s.y,1);
      if(r==="fail"){markUnre(p,s.x,s.y);p.job=null;break}
      if(r==="arr"){j.prog++;
        if(j.prog>=60){
          // the VENUE determines what kind of study this is — and what it trains:
          //   bookshelf/school → READING (general/cook/sal — knowledge work)
          //   workstation       → TRAINING (bld — technical drilling)
          //   gym               → PRACTICE (sht — physical/combat drilling)
          let pool, verb, gly;
          if(s.type==="gym"){pool=["sht"];verb="drilled at the gym";gly="practice";}
          else if(s.type==="workstation"){pool=["bld"];verb="trained at the terminal";gly="train";}
          else{pool=["sal","cook"];verb="read at the stacks";gly="read";}
          // train the weakest skill in this venue's pool
          let weakest=pool[0];for(const k of pool)if((p.sk[k]||0)<(p.sk[weakest]||0))weakest=k;
          const before=p.sk[weakest];
          const need=60*((p.sk[weakest]||0)+1);
          const batch=Math.max(20,Math.round(need*0.5));
          for(let i=0;i<batch;i++)gainXp(p,weakest);
          p.needs.fun=Math.max(0,(p.needs.fun||0)-6);
          applyDrift(p,{amb:1});
          if(p.sk[weakest]>before)float(s.x+.5,s.y+.5,weakest.toUpperCase()+" "+p.sk[weakest],"#7aa2ff");
          else float(s.x+.5,s.y+.5,gly==="read"?"+READ":gly==="train"?"+TRAIN":"+DRILL","#7aa2ff");
          addMod(p,"study","Studied — "+verb,3,TPD*.4);
          remember(p,"put in study time — "+verb);
          p.studyKind=gly;   // remembered so the glyph reflects the most recent study type
          p.job=null;syncHUD()}}
      break}
    case "substance":{const s=j.s;
      if(structAt(s.x,s.y)!==s||s.bp){p.job=null;break}
      const r=gotoCell(p,s.x,s.y,1);
      if(r==="fail"){markUnre(p,s.x,s.y);p.job=null;break}
      if(r==="arr"){j.prog++;
        if(j.prog>=40){p.credits=(p.credits||0)-12;
          p.needs.fun=Math.min(100,(p.needs.fun||0)+30);
          p.stress=Math.max(0,(p.stress||0)-25);
          p.addiction=Math.min(100,(p.addiction||0)+6);
          float(s.x+.5,s.y+.5,"USED","#b06fff");emote(p,"dizzy");addMod(p,"high","Chemically numb",6,TPD*.3);applyDrift(p,{intg:-1,cau:-1});p.job=null;syncHUD()}}
      break}
    case "crime":{const s=j.s;
      if(structAt(s.x,s.y)!==s||s.bp){p.job=null;break}
      const r=gotoCell(p,s.x,s.y,1);
      if(r==="fail"){markUnre(p,s.x,s.y);p.job=null;break}
      if(r==="arr"){j.prog++;
        if(j.prog>=50){
          const cg=pawnGang(p);const onCTurf=cg&&cg.turf.has(K(p.px|0,p.py|0));
          if(onCTurf)cg.gangHeat=Math.min(100,(cg.gangHeat||0)+15);
          else ST.heat=(ST.heat||0)+12;
          applyDrift(p,{intg:-2,cau:-1});
          if(Math.random()<(p.hasGear?0.80:0.65)){const take=RI(20,45);p.credits=(p.credits||0)+take;
            p.rep.city=clamp((p.rep.city||0)-10,-100,100);p.rep.gang=clamp((p.rep.gang||0)+8,-100,100);
            float(s.x+.5,s.y+.5,"+"+take+"c STOLEN","#ff4757");addMod(p,"score","Pulled off a job",6,TPD*.4)}
          else{p.credits=Math.max(0,(p.credits||0)-10);p.stress=Math.min(100,(p.stress||0)+20);
            p.rep.city=clamp((p.rep.city||0)-15,-100,100);
            float(s.x+.5,s.y+.5,"BUSTED","#ff2d95");addMod(p,"busted","Caught in the act",-14,TPD*.6)}
          p.job=null;syncHUD()}}
      break}
    case "rob":{const v=ST.pawns.find(q=>q.id===j.vid);
      if(!v||v===p||v.hp<=0){p.job=null;break}
      const r=gotoCell(p,v.px|0,v.py|0,1);
      if(r==="fail"){p.job=null;break}
      if(r==="arr"){j.prog++;
        if(j.prog>=18){
          const take=Math.min((v.credits||0),RI(15,40));
          if(take<=0){p.job=null;break}
          v.credits=(v.credits||0)-take;p.credits=(p.credits||0)+take;
          gossip(p.id,-6,8,p.px,p.py);relAdj(v.id,p.id,-30);  // victim + witnesses turn against the robber
          witnessCrime(p,p.px,p.py);                          // bystanders may snitch
          v.grudgeTarget=p.id;                                // victim now holds a grudge
          const rg=pawnGang(p);const onRTurf=rg&&rg.turf.has(K(p.px|0,p.py|0));
          if(onRTurf)rg.gangHeat=Math.min(100,(rg.gangHeat||0)+12);
          else ST.heat=(ST.heat||0)+10;
          applyDrift(p,{intg:-2,cau:-1});
          p.rep.city=clamp((p.rep.city||0)-8,-100,100);p.rep.gang=clamp((p.rep.gang||0)+6,-100,100);
          remember(p,"robbed "+v.name+" for "+take+" creds in the sprawl");
          float(p.px,p.py,"+"+take+"c ROBBED","#ff4757");emote(p,"excl");onlookersReact(p.px,p.py,"shock",7);
          v.stress=Math.min(100,(v.stress||0)+25);addMod(v,"robbed","Just got robbed",-12,TPD*.5);
          // the VICTIM visibly reacts — fear/distress, not a silent stat bump
          emotionalReact(v,"distress",0.8,{toward:p.id,relDelta:-30,float:"ROBBED!",memory:"got robbed by "+p.name+" — lost "+take+" creds, still shaking",aiEvent:"you were just robbed at knifepoint and lost "+take+" credits"});
          relAdj(p.id,v.id,-50);
          for(const w of ST.pawns){if(w===p||w===v)continue;
            if(DIST(w.px,w.py,p.px,p.py)<8){relAdj(w.id,p.id,-12);remember(w,"watched "+p.name+" rob "+v.name)}}
          log(p.name+" robbed "+v.name+" of "+take+" credits.","bad");
          p.job=null;syncHUD()}}
      break}
    case "buygear":{const s=j.s;
      if(structAt(s.x,s.y)!==s||s.bp||(ST.goods.gear||0)===0||(p.credits||0)<15){p.job=null;break}
      const r=gotoCell(p,s.x,s.y,1);
      if(r==="fail"){markUnre(p,s.x,s.y);p.job=null;break}
      if(r==="arr"){j.prog++;
        if(j.prog>=25){p.credits=(p.credits||0)-15;ST.goods.gear--;ST.income+=6;
          p.hasGear=true;p.gearExpiry=ST.tick+TPD*3;
          addMod(p,"gear","Bought some gear",4,TPD*.5);
          float(s.x+.5,s.y+.5,"KITTED","#7aa2ff");
          remember(p,"bought gear at the shop — feeling more solid");
          p.job=null;syncHUD()}}
      break}
    case "steal":{const v=ST.pawns.find(q=>q.id===j.oid);
      if(!v||v===p||v.hp<=0||(v.credits||0)<5){p.job=null;break}
      const r=gotoCell(p,v.px|0,v.py|0,1);
      if(r==="fail"){p.job=null;break}
      if(r==="arr"){j.prog++;
        if(j.prog>=30){
          const take=clamp(RI(8,14),0,v.credits||0);
          v.credits=(v.credits||0)-take;p.credits=(p.credits||0)+take;
          applyDrift(p,{intg:-1});
          // victim notices based on stress + awareness (30% base)
          const isNight=lightLevel(hourN())>0.3;
          const catchBase=(0.30+(v.stress>50?0.15:0)+(relGet(p.id,v.id)<-20?0.15:0)-(isNight?0.12:0))*trMul(p,"street");
          const caught=Math.random()<catchBase;
          if(caught){
            v.stress=Math.min(100,(v.stress||0)+18);
            relAdj(p.id,v.id,-40);ST.heat=(ST.heat||0)+8;
            float(p.px,p.py,"CAUGHT!","#ff2d95");
            addMod(v,"robbed","Caught "+p.name+" stealing",-10,TPD*.5);
            remember(v,"caught "+p.name+" lifting credits off me — "+take+"c gone");
            remember(p,"got caught lifting from "+v.name+" — bad move");
            log(p.name+" was caught stealing from "+v.name+".","warn");
            // witnesses
            for(const w of ST.pawns){if(w===p||w===v)continue;
              if(DIST(w.px,w.py,p.px,p.py)<6){relAdj(w.id,p.id,-8);
                remember(w,"saw "+p.name+" pick "+v.name+"'s pocket")}}}
          else{
            float(p.px,p.py,"+"+take+"c","#c98bff");
            remember(p,"skimmed "+take+"c off "+v.name+" — clean")}
          witnessCrime(p,p.px,p.py);          // the Enforcer or a bystander may report it
          p.crimeCd=ST.tick+RI(TPD,TPD*2);    // cooldown — no serial pickpocketing
          p.job=null;syncHUD()}}
      break}
    case "visit":{const o=ST.pawns.find(q=>q.id===j.oid);
      if(!o||o===p||!o.home||o.hp<=0){p.job=null;break}
      // go to the host's home; hang out there. Mutual social + relationship bump.
      const hx=o.home.x0+RI(1,o.home.w-2),hy=o.home.y0+RI(1,o.home.h-2);
      const r=gotoCell(p,hx,hy,0);
      if(r==="fail"){p.job=null;break}
      if(r==="arr"){j.prog++;if(j.prog>=44){
        p.needs.socN=100;relAdj(p.id,o.id,5);relAdj(o.id,p.id,4);
        const close=relGet(p.id,o.id)>=48;
        addMod(p,"visited","Visited a friend",close?6:4,TPD*.4);
        // if the host is home, they enjoy the company too
        if(DIST(o.px,o.py,hx,hy)<6){o.needs.socN=Math.min(100,(o.needs.socN||0)+30);
          addMod(o,"hosted","Had company over",close?6:4,TPD*.4);
          if(close&&Math.random()<0.05)tryFormPartnership(p,o);}
        remember(p,"spent time at "+o.name+"'s place");
        p.job=null;}}
      break}
    case "burgle":{const v=ST.pawns.find(q=>q.id===j.oid);
      if(!v||v===p||!v.home){p.job=null;break}
      // break into the victim's HOME (not their person). Riskier + bigger score than pickpocketing.
      const tx=v.home.x0+2,ty=v.home.y0+2;
      const r=gotoCell(p,tx,ty,0);
      if(r==="fail"){p.crimeCd=ST.tick+TPD;p.job=null;break}
      if(r==="arr"){j.prog++;
        // if the owner is HOME, this is far more likely to be caught (and can escalate)
        const ownerHome=DIST(v.px,v.py,tx,ty)<4&&!v.sleeping;
        if(j.prog>=40){
          const take=clamp(RI(15,30),0,v.credits||0);
          v.credits=(v.credits||0)-take;p.credits=(p.credits||0)+take;
          applyDrift(p,{intg:-2});p.crimeCd=ST.tick+RI(TPD,TPD*2);
          const isNight=lightLevel(hourN())>0.3;
          const catchBase=(ownerHome?0.6:0.22)+(relGet(p.id,v.id)<-20?0.1:0)-(isNight?0.1:0);
          if(Math.random()<catchBase){
            v.stress=Math.min(100,(v.stress||0)+25);
            relAdj(p.id,v.id,-55);ST.heat=(ST.heat||0)+12;
            if(!v.grudgeTarget)v.grudgeTarget=p.id;     // burglary breeds a grudge
            addMod(v,"burgled","Someone broke into my home",-14,TPD*.7);
            // the victim is visibly shaken — their home was violated
            emotionalReact(v,"fear",0.85,{toward:p.id,relDelta:-35,float:"BURGLED!",memory:p.name+" broke into my home and took "+take+"c — I don't feel safe"});
            remember(p,"got made breaking into "+v.name+"'s place");
            log(p.name+" broke into "+v.name+"'s home — and was seen.","warn");
            chronicle&&chronicle(p.name+" burgled "+v.name+"'s home","crime");
            for(const w of ST.pawns){if(w===p||w===v)continue;
              if(DIST(w.px,w.py,p.px,p.py)<7){relAdj(w.id,p.id,-10);
                remember(w,"saw "+p.name+" break into "+v.name+"'s home")}}
          }else{
            float(p.px,p.py,"+"+take+"c","#c98bff");
            remember(p,"cleaned out "+take+"c from "+v.name+"'s place — ghost");}
          p.job=null;syncHUD()}}
      break}
    case "homicide":{const v=ST.pawns.find(q=>q.id===j.oid);
      if(!v||v===p||v.hp<=0){p.job=null;break}
      // GATED, DARK, TELEGRAPHED. Stalk to the target's home, then a violent confrontation.
      const tx=v.home?v.home.x0+2:(v.px|0),ty=v.home?v.home.y0+2:(v.py|0);
      const r=gotoCell(p,tx,ty,1);
      if(r==="fail"){p.killCd=ST.tick+TPD*2;p.job=null;break}
      // telegraph: as the killer closes in, a warning float + the target grows fearful
      if(j.phase===0&&DIST(p.px,p.py,v.px,v.py)<5){j.phase=1;
        float(p.px,p.py,"!","#ff2d95");
        addMod(v,"stalked","Felt watched",-6,TPD*.3);}
      if(r==="arr"){j.prog++;
        if(j.prog>=35){
          p.killCd=ST.tick+TPD*4;
          // the victim may survive if they're healthy/lucky — it's an attack, not an instakill
          const lethal=Math.random()<0.6;
          ST.heat=Math.min(100,(ST.heat||0)+30);
          relAdj(p.id,v.id,-100);
          float(p.px,p.py,lethal?"MURDER":"ATTACK!","#ff2d95");
          for(const w of ST.pawns){if(w===p)continue;
            if(DIST(w.px,w.py,p.px,p.py)<9){relAdj(w.id,p.id,-60);
              w.stress=Math.min(100,(w.stress||0)+30);
              if(!w.grudgeTarget&&(relGet(w.id,v.id)>20||areFamily(w,v)))w.grudgeTarget=p.id; // loved ones swear revenge
              remember(w,"witnessed "+p.name+" attack "+v.name+" — horrifying")}}
          if(lethal){
            log("⚠ "+p.name+" murdered "+v.name+".","warn");
            chronicle&&chronicle(p.name+" killed "+v.name,"crime");
            openMurderCase(v,p);          // a mystery is born — investigate before the trail goes cold
            killPawn(v,"was murdered by "+p.name);
          }else{
            damagePawn(v,RI(30,55));
            log(p.name+" attacked "+v.name+" — they survived.","warn");
            remember(v,p.name+" tried to kill me — I won't forget");
            if(!v.grudgeTarget)v.grudgeTarget=p.id;
          }
          p.job=null;syncHUD()}}
      break}
  }
}

/* ---------- foes ---------- */
function edgeCell(){for(let i=0;i<60;i++){const side=RI(0,3);let x,y;
  if(side===0){x=RI(1,MW-2);y=1}else if(side===1){x=RI(1,MW-2);y=MH-2}
  else if(side===2){x=1;y=RI(1,MH-2)}else{x=MW-2;y=RI(1,MH-2)}
  if(foeCost(x,y)>=0&&foeCost(x,y)<5)return{x,y}}
  return{x:1,y:1}}
function float(x,y,txt,col){ST.floats.push({x,y,txt,col,ttl:46,t0:46})}

/* ---------- milestones ---------- */
const MILESTONES=[
  {id:"first_home",    label:"Home Block",       desc:"Built your first Housing Unit — the district can grow now.",
   check:()=>[...ST.structs.values()].some(s=>s.type==="housing"&&!s.bp)},
  {id:"first_gang",    label:"Crew Sanctioned",   desc:"A crew claimed territory. The block has its first gang.",
   check:()=>ST.gangs.length>0},
  {id:"survived_epidemic",label:"Outbreak Survived",desc:"Got through a multi-person sickness without losing anyone.",
   check:()=>ST.stats.epidemicSurvived},
  {id:"no_eviction_7", label:"Stable Week",       desc:"Seven days in a row without a single eviction.",
   check:()=>(ST.stats.cleanStreak||0)>=7},
  {id:"pop_10",        label:"Growing District",  desc:"Ten citizens call this block home.",
   check:()=>ST.pawns.length>=10},
  {id:"income_500",    label:"Cash Flow",         desc:"District income hit 500c for the first time.",
   check:()=>(ST.income||0)>=500},
  {id:"corp_refused",  label:"Not For Sale",      desc:"A citizen turned down a corp headhunter offer.",
   check:()=>ST.stats.corpRefused},
  {id:"clean_day",     label:"Quiet Night",       desc:"A full day passed with zero crime incidents.",
   check:()=>ST.stats.lastCleanDay===dayN()-1},
  {id:"first_gear",    label:"Kitted Out",        desc:"A citizen bought their first piece of gear.",
   check:()=>ST.pawns.some(p=>p.hasGear||p.gearExpiry>0)},
  {id:"district_500",  label:"Half a Grand",      desc:"The district treasury hit 500c.",
   check:()=>(ST.income||0)>=500},
];
function checkMilestones(){
  for(const m of MILESTONES){
    if(ST.milestones.includes(m.id))continue;
    if(m.check()){
      ST.milestones.push(m.id);
      log("MILESTONE: "+m.label+" — "+m.desc,"good");
      banner(m.label.toUpperCase(),"good");SFX.good();}}}

/* ============================================================
   DISTRICT TIERS + PROSPERITY SCORE
   ============================================================ */
// Tiers: the whole block ranks up as it grows and stabilizes.
const TIERS=[
  {t:1,name:"Dead Block",     pop:0,  income:0,   prosp:0},
  {t:2,name:"Squat",          pop:6,  income:300, prosp:30},
  {t:3,name:"Settlement",     pop:9,  income:700, prosp:45},
  {t:4,name:"District",       pop:13, income:1400,prosp:58},
  {t:5,name:"Neon Sprawl",    pop:18, income:2600,prosp:70},
];
// Prosperity (0-100): a live gauge blending economy, wellbeing, safety, growth.
function prosperity(){
  const pawns=ST.pawns;if(!pawns.length)return 0;
  // economy: income scaled (cap influence at 2000c)
  const eco=clamp((ST.income||0)/2000,0,1)*100;
  // wellbeing: average mood, minus sickness/homelessness drag
  const avgMood=pawns.reduce((s,p)=>s+(p.mood||0),0)/pawns.length;
  const sick=pawns.filter(p=>p.sick).length/pawns.length;
  const evicted=pawns.filter(p=>p.homeless).length/pawns.length;
  const well=clamp(avgMood-sick*40-evicted*45,0,100);
  // safety: inverse of district heat + active gang war tension
  const heat=ST.heat||0;
  const safety=clamp(100-heat,0,100);
  // growth: population relative to a healthy target
  const growth=clamp(pawns.length/18,0,1)*100;
  // weighted blend
  const score=eco*0.28+well*0.34+safety*0.20+growth*0.18;
  return clamp(Math.round(score),0,100);
}
function currentTier(){
  const prosp=prosperity();
  let tier=TIERS[0];
  for(const T of TIERS){
    if(ST.pawns.length>=T.pop&&(ST.income||0)>=T.income&&prosp>=T.prosp)tier=T;
  }
  return tier;
}
function checkTier(){
  const cur=currentTier();
  if(!ST.tierReached)ST.tierReached=1;
  if(cur.t>ST.tierReached){
    ST.tierReached=cur.t;
    log("DISTRICT RANKED UP — now a "+cur.name+" (Tier "+cur.t+")!","good");
    banner("TIER "+cur.t+" · "+cur.name.toUpperCase(),"good");SFX.good();
    chronicle("The district rose to "+cur.name+" (Tier "+cur.t+").","★");
    // little celebration: every citizen gets a mood lift
    for(const p of ST.pawns){addMod(p,"tierup","The block's coming up!",10,TPD*1.2);
      emote(p,"party");}
  }
}
function prospRank(s){
  return s>=80?"Thriving":s>=62?"Flourishing":s>=45?"Stable":s>=28?"Struggling":s>=12?"Failing":"Collapsing";
}

/* ---------- tutorial hints (day 1 only) ---------- */
function showTutorialHints(){
  if(dayN()>1)return;
  const hints=[
    "Welcome to the sprawl. Your district starts with 200c income and 7 citizens. Build a Workstation to start generating Data — that's your first income source.",
    "Citizens need food, rest, and hygiene to stay functional. They find it themselves — your job is to build the infrastructure. A Fridge in every home helps.",
    "Check the REQUESTS panel on the left. Citizens surface problems — feuds, sickness, theft — that need your decision. Ignore them and things escalate.",
    "Tap any citizen to inspect them. Open their full profile to see their vocation, relationships, wealth, and mood — and to manage their career or follow them around the block."
  ];
  hints.forEach((h,i)=>setTimeout(()=>log(h,"info"),i*800));
}
// CONTEXTUAL HINTS — fire once, the first time the player encounters each system.
// Teaches the deep systems organically instead of front-loading a manual.
function hintOnce(id,msg){
  if(!ST.hintsSeen)ST.hintsSeen={};
  if(ST.hintsSeen[id])return;
  ST.hintsSeen[id]=true;
  log("◈ "+msg,"info");
}
function checkContextualHints(){
  if(!ST.pawns.length)return;
  // first time a citizen forms a clique
  if(ST.cliques&&ST.cliques.length)
    hintOnce("clique","A CLIQUE has formed — a tight friend-group. They look out for each other, prefer to work together, and a loyal clique may petition you for support. Losing a member hits the whole group hard.");
  // first time a mentorship forms
  if(ST.relMeta&&Object.values(ST.relMeta).some(m=>m&&m.mentor))
    hintOnce("mentor","A MENTORSHIP formed — a skilled veteran is training a novice of the same trade. Apprentices level up much faster. Keep them near each other.");
  // first gang
  if(ST.gangs&&ST.gangs.length)
    hintOnce("gang","A GANG has taken root. They claim turf, run rackets, and recruit your broke, unhappy citizens. Keep people housed and paid to starve gangs of recruits — or manage the fallout.");
  // first partnership
  if(ST.relMeta&&Object.values(ST.relMeta).some(m=>m&&m.partner))
    hintOnce("partner","Two citizens became PARTNERS. They'll share a home and look out for each other — and grieve hard if one is lost. Relationships drive a lot of behavior here.");
  // first time someone reaches a higher wealth tier
  if(ST.pawns.some(p=>wealthTier(p).t>=3))
    hintOnce("wealth","A citizen has grown AFFLUENT. Wealth comes from wages and property; the rich and poor associate differently, and crime targets those with something to take.");
  // first time heat climbs
  if((ST.heat||0)>=40)
    hintOnce("heat","DISTRICT HEAT is rising — a measure of crime and disorder. High heat invites crackdowns and unrest. Address the causes: poverty, idle gangs, unmet needs.");
  // tier up past the first
  if((ST.tierReached||1)>=2)
    hintOnce("tier","Your district is RANKING UP. Tiers (Squat → Settlement → District → Neon Sprawl) unlock as population, income, and prosperity grow. The HUD badge tracks your standing.");
  // DYNASTIES — first colony-born child
  if(ST.pawns.some(p=>p.child))
    hintOnce("dynasty","A CHILD was born on the block. Children grow over ~14 days, inherit traits and a family name from their parents, then come of age and join the workforce. A Nursery speeds maturation; a Bookshelf at home helps them learn faster.");
  // FURNITURE — first time something breaks
  if([...ST.structs.values()].some(s=>isFurniture(s)&&isBroken(s)))
    hintOnce("furndecay","FURNITURE WEARS OUT. Appliances slowly decay and eventually break (they stop working — a broken fridge feeds no one). Residents repair or replace their own things if there's a FURNISHINGS STORE nearby and they can afford it. Premium quality lasts far longer.");
  // STORE — once one exists, explain the personal economy
  if(typeof hasStore==="function"&&hasStore())
    hintOnce("furnstore","A FURNISHINGS STORE lets residents furnish their own homes — buying couches, art, bookshelves and replacing broken appliances from their own credits. The district earns a cut of every sale. Wealthier citizens buy nicer things.");
  // FACTION POLITICS — first time a clique's stance toward you shifts notably
  if(ST.cliques&&ST.cliques.some(c=>Math.abs(c.stance||0)>=40))
    hintOnce("politics","Cliques are becoming POLITICAL. How you answer their petitions shifts their STANCE toward you — a supportive bloc lifts morale and works harder, a hostile one foments unrest and may even side with a gang. Watch the District panel for who backs you.");
  // SUPPRESSION — first watch post built
  if(typeof countBuilt==="function"&&countBuilt("watchpost")>0)
    hintOnce("watchpost","A WATCH POST projects security around it — it bleeds off district heat and suppresses crime in range (gang recruitment fails, heists are far less likely). Place them over trouble spots and production you want protected.");
  // DISASTERS — first telegraphed disaster
  if(ST.pendingDisaster)
    hintOnce("disaster","A DISASTER is looming — you get a WARNING before it strikes. Fires, blackouts, and gang raids hit hard and ripple through the district. A watchful operator can prepare: security helps pre-empt raids, and the warning buys you time to react.");
  // EXPANSION — first expansion petition
  if(ST.requests&&ST.requests.some(r=>r.kind==="expand"))
    hintOnce("expand","A resident is PETITIONING TO EXPAND their home — they've outgrown a cramped space and have the means. Fund it (or split the cost) and their home physically grows, with a lasting boost to their mood and loyalty. Deny it and they'll resent it.");
  // STORES NEED STAFF — first time a store sits idle for lack of a worker
  if([...ST.structs.values()].some(s=>s.idle&&DEF[s.type]&&DEF[s.type].vendor&&!DEF[s.type].selfRun))
    hintOnce("staffstore","Stores now need a WORKER to earn — an unstaffed store (\u26A0) sits idle. Select a citizen, then click the store and ASSIGN them, or AUTOMATE it with a robot. Unstaffed commerce makes no money.");
}

/* ---------- events ---------- */
function scheduleEv(){ST.nextEv=ST.tick+Math.floor(R(.75,1.35)*TPD)}
const PRICES={stims:22,gear:16,data:8,chem:6,parts:6,scrap:7,food:5};
/* ============================================================
   TRADE CARAVANS — periodic external traders; demand spikes & deals
   ============================================================ */
// A caravan arrives wanting to BUY a commodity at a premium (sell opportunity)
// or SELL one cheap (stock-up opportunity). Telegraphed, time-limited.
const CARAVAN_GOODS=["scrap","gear","stims","data","chem","parts"];
// pick where the caravan physically sets up: next to a Market if one exists, else near the main road edge.
function caravanSpot(){
  for(const s of ST.structs.values()){if(!s.bp&&s.type==="market"){
    // an open tile just outside the market
    for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]){const X=s.x+dx,Y=s.y+dy;if(INB(X,Y)&&colCost(X,Y)>=0)return{x:X,y:Y};}
    return{x:s.x,y:s.y-1};}}
  // fallback: a spot on the main horizontal arterial toward the east edge
  if(typeof ROADS!=="undefined"&&ROADS.h&&ROADS.h.length){const r=ROADS.h[0];return{x:Math.min(r[1]-2,r[0]+Math.floor((r[1]-r[0])*0.8)),y:r[2]};}
  return{x:Math.floor(MW*0.8),y:Math.floor(MH*0.5)};
}
function maybeCaravan(){
  if(ST.caravan)return;
  if(ST.pawns.length<3||ST.tick<TPD*2)return;
  const markets=countBuilt("market");
  if(Math.random()>0.06+markets*0.04)return;     // markets raise arrival odds (~+4%/market daily)
  const spot=caravanSpot();
  // OUTSIDERS — most caravans now bring people + news + opportunity, not just trade. Drifters from beyond
  // the district's grip: they carry intel on the wider regime, sometimes a contact, sometimes a defector
  // who'll join the cause. This ties the caravan to the insurrection instead of being a pure money sink.
  const roll=Math.random();
  if(roll<0.6){
    ST.caravan={mode:"outsiders",leaveAt:ST.tick+Math.floor(TPD*R(0.5,0.9)),done:false,claimed:false,x:spot.x,y:spot.y,
      kind: Math.random()<0.4?"defector":Math.random()<0.6?"intel":"news"};
    log("\u25c8 Outsiders have drifted in from beyond the district — word is they carry news, contacts, maybe more. Send your operative to meet them.","good");
    banner("OUTSIDERS ARRIVE","good");if(SFX&&SFX.good)SFX.good();
    panToEvent(spot.x,spot.y,"#22ddff");
    return;
  }
  // otherwise: a traditional trade caravan (still a money beat, just rarer now)
  const good=CH(CARAVAN_GOODS);
  const buying=Math.random()<0.6;
  const base=(typeof PRICES!=="undefined"&&PRICES[good])||8;
  const mkBonus=1+markets*0.12;
  if(buying){
    ST.caravan={mode:"buy",good,rate:Math.round(base*R(1.6,2.4)*mkBonus),leaveAt:ST.tick+Math.floor(TPD*R(0.5,0.9)),done:false,x:spot.x,y:spot.y};
    log("\u25c8 A trade caravan is buying "+good.toUpperCase()+" at a premium — sell your surplus before they move on.","good");
  }else{
    const qty=RI(6,14);
    ST.caravan={mode:"sell",good,qty,price:Math.max(2,Math.round(base*R(0.4,0.7)/mkBonus)),leaveAt:ST.tick+Math.floor(TPD*R(0.5,0.9)),done:false,x:spot.x,y:spot.y};
    log("\u25c8 A trade caravan is selling cheap "+good.toUpperCase()+" — stock up while it's here.","good");
  }
  banner("CARAVAN ARRIVES","good");if(SFX&&SFX.good)SFX.good();
  panToEvent(spot.x,spot.y,"#ffd24a");
}
function caravanTick(){
  maybeCaravan();
  maybeEnvoy();       // GOVERNMENT ENVOY — the regime's response to the player's heat (see envoyTick)
  envoyTick();
  const cv=ST.caravan;if(!cv)return;
  // OUTSIDERS — when your operative reaches them, they deliver: intel boost, a piece of news, or a defector
  // who joins the district already sympathetic + recruitable. One payoff per visit.
  if(cv.mode==="outsiders"){
    if(!cv.claimed){
      const av=theAvatar();
      if(av&&DIST(av.px,av.py,cv.x,cv.y)<3){
        cv.claimed=true;cv.done=true;
        const m=M();
        if(cv.kind==="defector"){
          // a defector drifts in — already leans toward the cause, easy to recruit
          const open=openHomes();const e=edgeCell();
          const p=mkPawn(cv.x,cv.y,CH(["sal","bld","sht"]));
          p.allegiance=RI(20,45);p.disillusion=RI(20,40);   // arrives sympathetic
          if(open.length)claimHome(p,open[0]);
          ST.pawns.push(p);
          revealIntel(p,2);                                 // you already know a little about them
          log("\u25c8 A defector came in with the outsiders — "+p.name+" is sympathetic to the cause already. Recruit them.","good");
          banner("DEFECTOR ARRIVES","good");if(SFX&&SFX.good)SFX.good();
          panToEvent(p.px,p.py,"#5cff9e");
        } else if(cv.kind==="intel"){
          const gain=RI(15,30);m.intel=(m.intel||0)+gain;
          log("\u25c8 The outsiders shared what they know of the regime beyond the district — +"+gain+" intel.","good");
          banner("INTEL FROM OUTSIDE","good");if(SFX&&SFX.good)SFX.good();
        } else {
          // news — a rumor that nudges the district mood / awareness
          const goodNews=Math.random()<0.5;
          if(goodNews){M().support=clamp((M().support||0)+RI(4,9),0,100);
            log("\u25c8 The outsiders bring word of unrest spreading in other districts — it stirs hope on the block.","good");}
          else{REG().awareness=Math.max(0,(REG().awareness||0)-RI(4,9));
            log("\u25c8 The outsiders report the regime's attention is fixed elsewhere — the heat here eases a little.","good");}
          banner("NEWS FROM BEYOND","good");if(SFX&&SFX.ui)SFX.ui();
        }
      }
    }
    if(ST.tick>=cv.leaveAt){
      if(!cv.claimed)log("The outsiders moved on — you never sent anyone to meet them.","info");
      ST.caravan=null;
    }
    return;
  }
  if(cv.mode==="sell"){
    // auto-buy a trickle into district stock if affordable (district invests in cheap supply)
    if(ST.tick%200===0&&cv.qty>0&&(ST.income||0)>cv.price*2){
      ST.income-=cv.price;ST.goods[cv.good]=(ST.goods[cv.good]||0)+1;cv.qty--;
    }
  }
  if(ST.tick>=cv.leaveAt){
    if(cv.mode==="buy"){
      // they buy all your surplus of `good` at the premium rate
      const have=ST.goods[cv.good]||0;
      if(have>0){const paid=have*cv.rate;ST.goods[cv.good]=0;ST.income=(ST.income||0)+paid;
        log("The caravan bought "+have+" "+cv.good.toUpperCase()+" for "+paid+"c and moved on.","good");
        banner("CARAVAN DEAL","good");}
      else log("The caravan left — you had no "+cv.good.toUpperCase()+" to sell.","info");
    }else{
      log("The supply caravan moved on.","info");
    }
    ST.caravan=null;
  }
}
/* ============================================================
   STORYTELLER — the engagement engine. Beyond disasters, the city throws INSURRECTION-THEMED
   events at you that interrupt the routine and force a DECISION (a proven engagement loop-breaker).
   Each event reads the sim state, presents 2-3 choices, and ripples through movement/regime/intel.
   ============================================================ */
// active decision shown to the player; null when none. {id, title, body, opts:[{label,fn,hint}]}
let activeEvent=null;
const STORY_EVENTS=[
  {
    id:"defector", weight:1,
    when:()=>ST.pawns.some(p=>!isChild(p)&&p.allegiance<-30&&!p.informant),
    gen:()=>{const p=CH(ST.pawns.filter(q=>!isChild(q)&&q.allegiance<-30&&!q.informant));return{
      focusId:p.id,
      title:"A Regime Loyalist Wavers",
      body:p.name+" has been a regime loyalist — but word is they're disillusioned and might be turned. Approaching them is a risk: if they're not sincere, they could expose your interest.",
      opts:[
        {label:"Approach quietly (8 intel)",hint:"chance to flip them; risk exposure",fn:()=>{
          if(M().intel<8){flashMsg("Not enough intel");return;}M().intel-=8;
          if(Math.random()<0.55){p.allegiance=clamp(p.allegiance+50,-100,100);log(p.name+" was turned — a loyalist becomes a sympathizer.","good");}
          else{M().exposure=clamp(M().exposure+10,0,100);log(p.name+" rebuffed the approach — and the regime may hear of it.","warn");}
        }},
        {label:"Leave them be",hint:"no risk, no gain",fn:()=>{log("You let the opportunity pass.","info");}},
      ]};},
  },
  {
    id:"cache", weight:1,
    when:()=>true,
    gen:()=>({
      title:"An Anonymous Tip",
      body:"A scrawled note names a location where the regime stashed supplies — credits, or intel on their operations. Acting on it means exposure if it's a trap.",
      opts:[
        {label:"Raid the cache",hint:"your operative goes in — Tradecraft improves the odds",fn:()=>{
          const av=theAvatar();const nm=av?av.name:"You";
          // your operative's Tradecraft shifts the success odds (skilled spies avoid traps)
          const check=opsCheck("tradecraft",11);
          if(check.pass){const gain=RI(12,25);M().intel+=gain;ST.income+=RI(20,50);
            log(nm+" worked the cache clean — +"+gain+" intel and credits seized.","good");}
          else{M().exposure=clamp(M().exposure+12,0,100);
            log(nm+" walked into a trap — the regime was watching. Exposure spikes.","warn");}
        }},
        {label:"Ignore it",hint:"safe",fn:()=>{log("Too risky. You let it go.","info");}},
      ]}),
  },
  {
    id:"crackdown_warning", weight:1,
    when:()=>M().exposure>40,
    gen:()=>({
      title:"Whispers of a Sweep",
      body:"Your contacts warn the regime is preparing a surveillance sweep. You can spend resources to scatter the network now, or gamble that you'll weather it.",
      opts:[
        {label:"Scatter the network (15 intel)",hint:"cut exposure hard",fn:()=>{
          if(M().intel<15){flashMsg("Not enough intel");return;}M().intel-=15;M().exposure=Math.max(0,M().exposure-30);REG().awareness=Math.max(0,REG().awareness-20);log("The network goes dark ahead of the sweep — exposure drops sharply.","good");
        }},
        {label:"Hold position",hint:"risk a sweep, but save resources",fn:()=>{log("You hold your nerve and keep the network in place.","info");}},
      ]}),
  },
  {
    id:"sympathizer_rally", weight:1,
    when:()=>M().support>35,
    gen:()=>({
      title:"The Mood Shifts",
      body:"Support for the cause is rising and people are restless. A show of defiance could swell your support — but it would draw the regime's eye.",
      opts:[
        {label:"Stage a quiet action",hint:"+support, +exposure",fn:()=>{M().support=clamp(M().support+8,0,100);M().exposure=clamp(M().exposure+6,0,100);log("A small act of defiance ripples through the block — support grows, but so does scrutiny.","good");}},
        {label:"Keep heads down",hint:"steady, safe",fn:()=>{log("Now isn't the time. You keep the movement patient.","info");}},
      ]}),
  },
];
// ═══════════════════════ GOVERNMENT ENVOY (THE ENVOY) ═══════════════════════
// A regime emissary visits the district to confer with the Mayor. Triggered by the player's HEAT (the regime
// responds to the insurrection it can feel). The visit is a decision under pressure: ignore it and the regime
// cracks down (+ compromises a sympathizer); or use the operative toolkit (surveil / sabotage venue / frame /
// strike route / strike via cell) to spy on or disrupt the meeting — at real risk. Reuses existing ops; the
// avatar never just "stands next to the rep." State machine: arriving → conferring → leaving/struck.
// Spec: NEON_SPRAWL_Government_Representative_Spec.md
function envoyMeetingSpot(){
  // the envoy meets the MAYOR — meeting point is at/near the Mayor (or a civic/government building, else center)
  const mayor=ST.pawns.find(p=>p.role==="mayor"&&p.hp>0);
  if(mayor)return{x:mayor.px|0,y:mayor.py|0,mayorId:mayor.id};
  // fallback: a civic/government building
  for(const s of ST.structs.values()){if(s.bp)continue;const d=DEF[s.type];
    if(d&&(d.civic||d.security)){return{x:s.x,y:s.y,mayorId:null};}}
  return{x:Math.floor(MW*0.5),y:Math.floor(MH*0.5),mayorId:null};
}
function maybeEnvoy(){
  if(ST.envoy||ST.caravan)return;                       // one special arrival at a time
  if(ST.pawns.length<4||ST.tick<TPD*2)return;           // not in the opening
  // COOLDOWN — a few days minimum between envoys
  if(ST.lastEnvoy&&ST.tick-ST.lastEnvoy<TPD*3)return;
  // HEAT-DRIVEN CHANCE — scales with the regime's awareness + the movement's exposure. The hotter the
  // insurrection, the more likely the regime sends someone. Some randomness so it isn't perfectly predictable.
  const m=M(),reg=REG();
  const heat=((reg.awareness||0)/100)*0.6 + ((m.exposure||0)/100)*0.4;   // 0..1
  // checked on the caravan cadence (~hourly via caravanTick); keep the per-check odds low
  const chance=0.004 + heat*0.05;                       // ~0.4%/check cold → ~5.4%/check at max heat
  if(Math.random()>chance)return;
  spawnEnvoy();
}
function spawnEnvoy(){
  const spot=envoyMeetingSpot();
  const entry=(typeof edgeCell==="function")?edgeCell():{x:Math.floor(MW*0.5),y:0};
  // the envoy is an actual wisp — a government figure who arrives, confers, and (hopefully) leaves
  const e=mkPawn(entry.x,entry.y,"sht");
  e.name="Envoy "+e.name.split(" ").slice(-1)[0];       // styled as a government envoy
  e.isEnvoy=true;e.role="envoy";e.allegiance=-90;        // hard regime loyalist
  e.govt=true;e.accent="#ff5470";                        // regime red, reads as "not local"
  e.homeless=true;                                       // no district home — just visiting
  e.dossierImmune=true;                                  // not a normal recruit/surveil target by default
  ST.pawns.push(e);
  ST.envoy={
    id:e.id, stage:"arriving",                           // arriving → conferring → leaving
    x:spot.x, y:spot.y, mayorId:spot.mayorId,
    arriveTick:ST.tick,
    conferStart:0,
    conferDuration:Math.floor(TPD*0.45),                 // how long the meeting lasts once they reach the Mayor
    leaveAt:ST.tick+Math.floor(TPD*0.9),                 // hard cap on the whole visit
    resolved:false, disrupted:false, spied:false, struck:false
  };
  ST.lastEnvoy=ST.tick;
  log("\u25c8 A GOVERNMENT ENVOY has entered the district \u2014 they're moving to confer with the Mayor. The regime is responding to the unrest.","warn");
  banner("GOVERNMENT ENVOY","warn");if(SFX&&SFX.alert)SFX.alert();
  panToEvent(e.px,e.py,"#ff5470");
}
// drive the envoy's state machine each tick
function envoyTick(){
  const ev=ST.envoy;if(!ev)return;
  const e=ST.pawns.find(p=>p.id===ev.id);
  if(!e||e.hp<=0){
    // the envoy is dead — handled by the strike resolution elsewhere; just clear the state
    ST.envoy=null;return;
  }
  // ARRIVING — walk to the Mayor / meeting spot
  if(ev.stage==="arriving"){
    // keep the meeting spot synced to the (possibly moving) Mayor
    const mayor=ev.mayorId?ST.pawns.find(p=>p.id===ev.mayorId&&p.hp>0):null;
    if(mayor){ev.x=mayor.px|0;ev.y=mayor.py|0;}
    gotoCell(e,ev.x,ev.y,1);                              // walk toward the Mayor
    if(DIST(e.px,e.py,ev.x,ev.y)<2.4){
      ev.stage="conferring";ev.conferStart=ST.tick;
      log("\u25c8 The envoy has reached the Mayor \u2014 they're conferring now. Act before the meeting concludes.","warn");
      banner("THE MEETING BEGINS","warn");
      panToEvent(e.px,e.py,"#ff5470");
    }
    return;
  }
  // CONFERRING — the meeting is underway; a countdown to conclusion. If the player did NOT disrupt or strike
  // the meeting, the conference concludes and the regime cracks down (the THREAT). If it was disrupted/struck,
  // the crackdown is skipped/blunted (handled when those actions fire). Spying reduces the crackdown severity.
  if(ev.stage==="conferring"){
    if(ST.tick-ev.conferStart>=ev.conferDuration){
      ev.stage="leaving";
      if(!ev.disrupted&&!ev.struck){
        log("\u25c8 The conference concluded \u2014 the envoy got what they came for.","warn");
        envoyCrackdown(ev);                              // THREAT: crackdown + compromise a sympathizer
      } else {
        log("\u25c8 The conference concluded, but you disrupted it \u2014 the regime leaves with less than it wanted.","good");
      }
    }
    return;
  }
  // LEAVING — the envoy departs (resolution consequences handled in a later stage)
  if(ev.stage==="leaving"){
    // walk back toward an edge, then despawn — with a DEPARTURE VARIANT message keyed to how the visit ended.
    const exit=(typeof edgeCell==="function")?edgeCell():{x:e.px|0,y:0};
    if(!ev._exit){ev._exit=exit;
      // announce the departure once, as they turn to leave (the killed-cases despawn elsewhere with their own logs)
      if(!ev._departAnnounced){ev._departAnnounced=true;
        if(ev.discredited){
          log("\u25c8 The envoy slinks out of the district under a cloud of suspicion \u2014 the regime will think twice before trusting their report.","good");
          banner("ENVOY LEAVES DISCREDITED","good");
        } else if(ev.disrupted){
          log("\u25c8 The envoy departs empty-handed \u2014 whatever they came to arrange, you broke it up.","good");
          banner("ENVOY LEAVES THWARTED","good");
        } else if(ev.resolved){
          // ignored: the crackdown already fired in the conclusion; this is the cold exit
          log("\u25c8 The envoy leaves satisfied \u2014 they got what they came for, and the regime's grip has tightened.","warn");
          banner("ENVOY DEPARTS","warn");
        } else {
          log("\u25c8 The envoy departs the district.","info");
        }
      }
    }
    gotoCell(e,ev._exit.x,ev._exit.y,0);
    if(DIST(e.px,e.py,ev._exit.x,ev._exit.y)<2||ST.tick>=ev.leaveAt){
      const idx=ST.pawns.indexOf(e);if(idx>=0)ST.pawns.splice(idx,1);
      ST.envoy=null;
    }
    return;
  }
}
// THE THREAT (stage 2) — when the envoy's meeting concludes uninterrupted, the regime tightens the noose.
// BOTH consequences (per design): (a) a temporary HARD CRACKDOWN — awareness + grip spike, an intensified
// sweep; and (b) they COMPROMISE A SYMPATHIZER — the regime IDs one of your sympathetic (not-yet-recruited)
// wisps and turns them informant. Spying on the meeting first (ev.spied) BLUNTS the crackdown (you saw it
// coming). It's temporary, not a permanent escalation — painful but recoverable.
function envoyCrackdown(ev){
  const reg=REG(),m=M();
  const spied=ev&&ev.spied;
  // (a) HARD CRACKDOWN — spike awareness + grip (reduced if you spied), and run an intensified sweep.
  const awBump=spied?RI(8,14):RI(18,28);
  const gripBump=spied?RI(3,6):RI(8,14);
  reg.awareness=clamp((reg.awareness||0)+awBump,0,100);
  reg.grip=clamp((reg.grip||0)+gripBump,0,100);
  // GAP 4 — the city visibly recoils from the crackdown (fear ripples + scatter + city-wide chill)
  {const mayor=ST.pawns.find(q=>q.role==="mayor"&&q.hp>0);
   const cx=mayor?mayor.px:MW/2, cy=mayor?mayor.py:MH/2;
   if(typeof cityReact==="function")cityReact("crackdown",cx,cy,spied?0.6:0.9);}
  reg.lastSweep=ST.tick;                                  // patrols intensify from here
  if(spied)log("\u2696 You saw the crackdown coming \u2014 the network braces, and the worst is blunted.","good");
  log("\u2696 The regime tightens the noose \u2014 awareness +"+awBump+", patrols surge across the block.","warn");
  banner("REGIME CRACKDOWN","bad");if(SFX&&SFX.alert)SFX.alert();
  // run the existing sweep mechanic (burns/turns cell members) — a regular (non-militarized) sweep, blunted if spied
  if(typeof regimeSweep==="function"){
    // temporarily soften exposure if spied so the sweep burns less
    const savedExp=m.exposure;
    if(spied)m.exposure=Math.max(0,m.exposure-20);
    regimeSweep(false);
    if(spied)m.exposure=Math.min(savedExp,m.exposure);   // don't let the spy bonus raise exposure
  }
  // (b) COMPROMISE A SYMPATHIZER — the regime turns one sympathetic (not-recruited, not-already-informant)
  // wisp into an informant. The sharper, personal cost. Spying does NOT prevent this (only the crackdown).
  const symps=ST.pawns.filter(p=>!p.isAvatar&&!isChild(p)&&!p.recruited&&!p.informant&&(p.allegiance||0)>15);
  if(symps.length){
    // prefer the MOST sympathetic (the regime targets your strongest latent ally — the biggest loss)
    symps.sort((a,b)=>(b.allegiance||0)-(a.allegiance||0));
    const victim=symps[0];
    // RESOLVE — your conviction steels your people. A high-Resolve operative's sympathizers may REFUSE to break.
    const resistChance=clamp((ops(theAvatar(),"resolve")-3)*0.09,0,0.6);   // Resolve 10 ≈ 63% capped at 60%
    if(Math.random()<resistChance){
      victim.allegiance=clamp((victim.allegiance||0)-8,-100,100);   // shaken but unbroken
      remember&&remember(victim,"was leaned on by the regime \u2014 but held firm. Your example gave them strength.");
      log("\u2696 The regime tried to turn "+victim.name+" \u2014 but they held. Your people don't break easily.","good");
    } else {
      victim.informant=true;reg.informants.push(victim.id);
      victim.allegiance=clamp((victim.allegiance||0)-25,-100,100);
      remember&&remember(victim,"was leaned on by the regime after the envoy's visit \u2014 now informing");
      log("\u2696 The regime learned who's been sympathetic \u2014 "+victim.name+" has been turned. They're informing now.","bad");
      if(typeof tryEmote==="function")tryEmote(victim,"sweat",120);
    }
  } else {
    log("\u2696 The regime hunted for sympathizers to turn \u2014 but found no one ripe. Your network held.","info");
  }
  ev.resolved=true;
}
// ENVOY RESPONSE — detect + reward ops aimed at the envoy/meeting, setting the flags that gate the crackdown.
// Approaches (all reuse existing ops):
//   surveil the envoy/Mayor  → ev.spied   (blunts the crackdown — you saw it coming)
//   sabotage a venue near the meeting → ev.disrupted (disrupts the conference, blunts the crackdown)
//   frame the envoy → ev.disrupted + envoy leaves discredited (regime distrusts its own)
//   assassinate the envoy (on route/via the op) → ev.struck (a major blow; envoy dies)
// The cell-member strike is a separate action (envoyStrikeViaCell) shown only if you have a cell.
function envoyOpHook(opKey,target,crit){
  const ev=ST.envoy;if(!ev)return;
  const e=ST.pawns.find(p=>p.id===ev.id);if(!e)return;
  const m=M();
  const targetIsEnvoy=target&&target.kind==="pawn"&&target.id===ev.id;
  const targetIsMayor=target&&target.kind==="pawn"&&ev.mayorId&&target.id===ev.mayorId;
  // SURVEIL the meeting (envoy or Mayor) → you learn the regime's plan; blunts the crackdown.
  if(opKey==="surveil"&&(targetIsEnvoy||targetIsMayor)){
    if(!ev.spied){ev.spied=true;
      m.intel=(m.intel||0)+RI(4,8);
      log("\u25c6 You surveilled the meeting \u2014 you've learned what the regime is planning. The coming crackdown won't catch you flat-footed.","good");
      banner("MEETING SURVEILLED","good");
    }
    return;
  }
  // SABOTAGE the venue (a utility building) WHILE the meeting is on → disrupts the conference.
  if(opKey==="sabotage"&&target&&target.kind==="s"&&ev.stage==="conferring"){
    if(!ev.disrupted){ev.disrupted=true;
      m.support=clamp((m.support||0)+RI(4,8),0,100);
      log("\u2715 You hit the grid during the conference \u2014 the meeting breaks up in the dark. The regime leaves with less than it came for.","good");
      banner("CONFERENCE DISRUPTED","good");
    }
    return;
  }
  // FRAME the envoy → the regime distrusts its own official; they leave discredited (a disruption).
  if(opKey==="frame"&&targetIsEnvoy){
    ev.disrupted=true;ev.discredited=true;
    REG().grip=Math.max(0,(REG().grip||60)-RI(5,9));
    log("\u2715 You planted evidence against the envoy \u2014 the regime now suspects its own emissary. They leave under a cloud, their word worthless.","good");
    banner("ENVOY DISCREDITED","good");if(SFX&&SFX.alert)SFX.alert();
    ev.stage="leaving";   // a discredited envoy cuts the visit short
    return;
  }
  // ASSASSINATE the envoy → a major blow to the regime (handled largely by killPawn, but flag + reward here).
  if(opKey==="assassinate"&&targetIsEnvoy){
    ev.struck=true;ev.killed=true;
    REG().grip=Math.max(0,(REG().grip||60)-RI(12,20));        // killing an envoy hurts the regime hard
    m.support=clamp((m.support||0)+RI(8,15),0,100);
    log("\u2620 You struck down the government envoy \u2014 a blow the regime will not forget. The block is electrified.","good");
    banner("ENVOY ELIMINATED","good");
    // killPawn already ran in opSuccess; envoyTick will see the envoy gone and clear state
    return;
  }
}
// STRIKE VIA CELL MEMBER — only available if you have a recruited cell. A cell member carries out the hit on
// the envoy, so the avatar is never exposed — but the cell member is risked (they may be caught/burned). This
// rewards building a cell (the option simply isn't offered without one).
function envoyStrikeViaCell(){
  const ev=ST.envoy;if(!ev){flashMsg&&flashMsg("No envoy is present");return false;}
  const e=ST.pawns.find(p=>p.id===ev.id);if(!e){return false;}
  const m=M();
  const cell=ST.pawns.filter(p=>p.recruited&&!isChild(p)&&p.hp>0);
  if(!cell.length){flashMsg&&flashMsg("You have no cell — recruit members before you can act through them");return false;}
  // pick the cell member best placed to act (closest to the envoy)
  cell.sort((a,b)=>DIST(a.px,a.py,e.px,e.py)-DIST(b.px,b.py,e.px,e.py));
  const operative=cell[0];
  // the strike's success leans on the cell member's allegiance + the regime's grip (harder when grip is high)
  const chance=clamp(0.5+((operative.allegiance||0)/200)-((REG().grip||60)/300),0.15,0.9);
  log("\u25b8 "+operative.name+" moves on the envoy at your order\u2026","warn");
  if(Math.random()<chance){
    ev.struck=true;ev.killed=true;
    REG().grip=Math.max(0,(REG().grip||60)-RI(12,20));
    m.support=clamp((m.support||0)+RI(8,15),0,100);
    log("\u2620 "+operative.name+" struck down the envoy and melted back into the block \u2014 the regime never saw your hand in it.","good");
    banner("ENVOY ELIMINATED","good");if(SFX&&SFX.alert)SFX.alert();
    const idx=ST.pawns.indexOf(e);if(idx>=0)ST.pawns.splice(idx,1);
    ST.envoy=null;
    return true;
  } else {
    // the cell member is caught — burned, and the regime cracks down harder for the attempt
    log("\u2716 "+operative.name+" was caught in the attempt \u2014 the strike failed, and the regime answers in force.","bad");
    banner("STRIKE FAILED","bad");if(SFX&&SFX.alert)SFX.alert();
    operative.recruited=false;operative.cellRole=null;
    if(Math.random()<0.5){operative.informant=true;REG().informants.push(operative.id);
      remember&&remember(operative,"was broken after a failed strike — now informing");}
    REG().awareness=clamp((REG().awareness||0)+RI(15,25),0,100);
    ev.disrupted=false;ev.struck=false;   // failed — the crackdown will still land (worse)
    return false;
  }
}
// ═══════════════════════ STAT-GATED DIALOGUE (authored) ═══════════════════════
// Player↔wisp conversations. The operative's 6 attributes (guile/insight/nerve/presence/tradecraft/resolve)
// gate which response options appear; opsCheck resolves the risky ones. Conversations reveal character AND
// move allegiance/intel/recruitment. Talk is the path to recruitment. No AI — pure authored content + the
// existing opsCheck. Spec: NEON_SPRAWL_Dialogue_Spec.md
//
// A conversation is a set of NODES. Each node has: a `line` (what the wisp says — can be a fn of the wisp),
// and `choices` (the player's options). Each choice has:
//   text        — the player line (string or fn(wisp))
//   gate        — optional {attr, min} : only pickable if ops(avatar,attr)>=min (else shown grayed)
//   risk        — optional {attr, diff} : fires opsCheck; outcome bands route via win/lose
//   need        — optional fn(wisp)->bool : a non-stat prerequisite (allegiance/intel/etc); hides if false
//   effect      — fn(wisp, band) : applies the outcome (allegiance/intel/etc). band is the opsCheck band or "ok"
//   reply       — wisp's response line (string or fn). win/lose variants for risky choices via {win,lose}
//   goto        — next node key, or "end" (or a fn(wisp)->key). Omitted = end.
//   kind        — "free" | "probe" | "push" (for styling; push = high-value/risky)
const DLG_STATE={active:null};   // {wispId, node, history:[]}

// the canonical attribute labels for gate display
function dlgAttrLabel(k){const a=OPS_ATTRS.find(x=>x.k===k);return a?a.name.toUpperCase():k.toUpperCase();}

// open a conversation with a wisp
function startDialogue(w,_arrived){
  if(!w||w.isAvatar||isChild(w)){flashMsg&&flashMsg("There's no one to talk to there");return false;}
  if(w.isEnvoy){flashMsg&&flashMsg("The envoy won't parley with you");return false;}
  if(w.jailed){flashMsg&&flashMsg(w.name.split(" ")[0]+" is in the holding cells");return false;}
  if(w.hp<=0)return false;
  // a terrified witness won't open up (ties into the witness-fear system)
  if(typeof witnessFear==="function"&&witnessFear(w)>=0.9){
    flashMsg&&flashMsg(w.name.split(" ")[0]+" flinches away \u2014 they're too afraid of you to talk");return false;}
  // WALK-TO-TALK — the operative physically crosses to the wisp before the conversation opens, so the two
  // are standing together (sells the "two people talking" feel). If already adjacent (or we just arrived via
  // the pending-talk resolver), open immediately.
  const av=theAvatar();
  if(av&&!_arrived){
    const d=CHEB(Math.round(av.px),Math.round(av.py),Math.round(w.px),Math.round(w.py));
    if(d>1.6){
      av._pendingTalk={id:w.id,since:ST.tick};
      av.job={t:"goto",x:w.px,y:w.py,adj:1};
      flashMsg&&flashMsg("Approaching "+w.name.split(" ")[0]+"\u2026");
      if(typeof collapseOpDock==="function")collapseOpDock();
      const _i=document.getElementById("inspect");if(_i)_i.style.display="none";
      return true;   // dialogue opens on arrival
    }
  }
  DLG_STATE.active={wispId:w.id,node:dlgEntryNode(w),history:[]};
  if(av)av._pendingTalk=null;
  // hide the inspect panel + collapse the op dock so they don't bleed through behind the dialogue panel
  const _insp=document.getElementById("inspect");if(_insp)_insp.style.display="none";
  if(typeof collapseOpDock==="function")collapseOpDock();
  renderDialogue();
  return true;
}
// resolve a pending walk-to-talk: once the operative reaches the wisp, open the conversation. Called from the
// avatar brain each tick (like resolvePendingOp). Returns true if it handled the avatar this tick.
function resolvePendingTalk(av){
  const pend=av._pendingTalk;if(!pend)return false;
  if(ST.tick-pend.since>TPD*0.5){av._pendingTalk=null;return false;}   // gave up (stuck)
  const w=ST.pawns.find(p=>p.id===pend.id);
  if(!w||w.hp<=0){av._pendingTalk=null;return false;}                  // target gone
  const d=CHEB(Math.round(av.px),Math.round(av.py),Math.round(w.px),Math.round(w.py));
  if(d<=2){av._pendingTalk=null;av.path=null;startDialogue(w,true);return true;}   // arrived (adjacent) -> open
  // still walking — actively step toward the wisp (gotoCell moves the pawn this tick, not just sets a job)
  const r=gotoCell(av,Math.round(w.px),Math.round(w.py),1);
  if(r==="arr"){av._pendingTalk=null;av.path=null;startDialogue(w,true);return true;}   // gotoCell says arrived
  return true;
}
function endDialogue(){DLG_STATE.active=null;const el=document.getElementById("dlg-panel");if(el)el.remove();
  // restore the inspect panel only if a wisp is still selected (otherwise leave the view clean)
  if(ST.sel&&ST.sel.length){const _insp=document.getElementById("inspect");if(_insp)_insp.style.display="";renderInspect&&renderInspect();}
}

// pick the entry node based on the wisp's ROLE first (special figures get bespoke trees), then their state.
function dlgEntryNode(w){
  // special figures — bespoke conversations
  if(w.role==="mayor")return "mayor_root";
  if(w.role==="enforcer"||w.regimeForce)return "enforcer_root";
  if(w.informant)return "informant_root";
  // regular wisps — disposition-based
  if(w.recruited)return "recruited_root";
  const al=w.allegiance||0;
  if(al<=-20)return "hostile_root";
  if(al>=35)return "warm_root";
  return "wary_root";
}

// ── THE CONTENT LIBRARY — authored nodes. Short conversations for the common case; the engine supports
//    trees (goto) for deeper ones. Lines vary by wisp state. This is DATA — extend freely without touching
//    the engine. ──
const DLG_NODES={
  // ENTRY: a wisp who distrusts you
  hostile_root:{
    line:w=>"\""+(w.allegiance<-45?"I've got nothing to say to you. Move along.":"What do you want? I know your type.")+"\"",
    choices:[
      {kind:"free",text:"Easy. I'm not here to cause trouble.",
       effect:(w)=>{w.allegiance=clamp((w.allegiance||0)+2,-100,100);},
       reply:"\"...Fine. Talk, then. Quickly.\"",goto:"wary_root"},
      {kind:"probe",text:"The regime's been bleeding this block dry. You feel it too.",gate:{attr:"insight",min:6},
       effect:(w)=>{w.allegiance=clamp((w.allegiance||0)+4,-100,100);M().intel=(M().intel||0)+1;},
       reply:"\"...Maybe I do. Doesn't mean I trust you.\"",goto:"wary_root"},
      {kind:"push",text:"You can drop the act. I know what you really think of them.",gate:{attr:"guile",min:7},
       risk:{attr:"guile",diff:11},
       effect:(w,band)=>{if(band==="critwin"||band==="success"){w.allegiance=clamp((w.allegiance||0)+8,-100,100);}
         else if(band==="partial"){w.allegiance=clamp((w.allegiance||0)+2,-100,100);}
         else{w.allegiance=clamp((w.allegiance||0)-6,-100,100);if(typeof tryEmote==="function")tryEmote(w,"angry",90);M().exposure=clamp((M().exposure||0)+3,0,100);}},
       reply:{win:"\"...How did you \u2014 who ARE you?\"",lose:"\"Get away from me before I call an enforcer!\""},
       goto:(w)=>(w.allegiance>=-10?"wary_root":"end")},
      {kind:"free",text:"[Leave]",goto:"end"},
    ]
  },
  // ENTRY: a wisp who's neutral/uncertain
  wary_root:{
    line:w=>"\""+(w.mood<35?"It's been a rough stretch. What is it?":"I'm listening. What's on your mind?")+"\"",
    choices:[
      {kind:"probe",text:"Tell me how things really are on the block.",
       effect:(w)=>{w.allegiance=clamp((w.allegiance||0)+2,-100,100);M().intel=(M().intel||0)+2;
         flashMsg&&flashMsg("You learn a little about "+w.name.split(" ")[0]+"'s situation (+2 intel)");},
       reply:w=>"\""+(w.homeless?"Lost my place to a regime 'audit.' Sleeping rough now.":"Work's thin, rent's up, patrols everywhere. Same as everyone.")+"\"",goto:"wary_topics"},
      {kind:"probe",text:"I can see something's eating at you.",gate:{attr:"insight",min:6},
       effect:(w)=>{w.allegiance=clamp((w.allegiance||0)+3,-100,100);if(typeof wispSecret==="function"&&wispSecret(w)){w.secretKnown=true;if(!w.secret)w.secret=wispSecret(w);}M().intel=(M().intel||0)+3;},
       reply:"\"...You're sharp. Most people don't notice.\"",goto:"wary_topics"},
      {kind:"push",text:"The regime did this to you. You don't have to just take it.",gate:{attr:"presence",min:6},
       risk:{attr:"presence",diff:10},
       effect:(w,band)=>{if(band==="critwin"){w.allegiance=clamp((w.allegiance||0)+12,-100,100);w._planted=true;}
         else if(band==="success"){w.allegiance=clamp((w.allegiance||0)+7,-100,100);w._planted=true;}
         else if(band==="partial"){w.allegiance=clamp((w.allegiance||0)+2,-100,100);}
         else{w.allegiance=clamp((w.allegiance||0)-4,-100,100);M().exposure=clamp((M().exposure||0)+2,0,100);}},
       reply:{win:"\"...You're right. I'm tired of being afraid.\"",lose:"\"Careful. Talk like that gets people disappeared.\""},
       goto:"wary_topics"},
      {kind:"free",text:"[Leave]",goto:"end"},
    ]
  },
  wary_topics:{
    line:"\"Anything else?\"",
    choices:[
      {kind:"push",text:"Join us. Help take the block back.",gate:{attr:"presence",min:7},
       need:w=>(w.allegiance||0)>=15,
       risk:{attr:"presence",diff:13},
       effect:(w,band)=>{if(band==="critwin"||band==="success"){w.allegiance=clamp((w.allegiance||0)+10,-100,100);w._recruitReady=true;
           flashMsg&&flashMsg(w.name.split(" ")[0]+" is ready \u2014 you can recruit them now");}
         else if(band==="partial"){w.allegiance=clamp((w.allegiance||0)+3,-100,100);}
         else{w.allegiance=clamp((w.allegiance||0)-8,-100,100);M().exposure=clamp((M().exposure||0)+5,0,100);if(typeof tryEmote==="function")tryEmote(w,"sweat",90);}},
       reply:{win:"\"...Yeah. Yeah, I'm in. Tell me what you need.\"",lose:"\"You're asking me to risk everything. I can't \u2014 not yet.\""},
       goto:"end"},
      {kind:"free",text:"Stay safe out there.",effect:(w)=>{w.allegiance=clamp((w.allegiance||0)+1,-100,100);},reply:"\"You too. Watch the patrols.\"",goto:"end"},
      {kind:"free",text:"[Leave]",goto:"end"},
    ]
  },
  // ENTRY: a wisp who's warm to the cause
  warm_root:{
    line:"\"Good to see a friendly face. What do you need?\"",
    choices:[
      {kind:"probe",text:"What are people on the block saying?",
       effect:(w)=>{M().intel=(M().intel||0)+3;flashMsg&&flashMsg("Word from the block (+3 intel)");},
       reply:"\"Folks are angrier than they let on. The regime's pushing too hard.\"",goto:"warm_root"},
      {kind:"push",text:"I need you with us. Officially.",
       need:w=>(w.allegiance||0)>=15&&!w.recruited,
       risk:{attr:"presence",diff:11},
       effect:(w,band)=>{if(band!=="fail"&&band!=="critfail"){w._recruitReady=true;w.allegiance=clamp((w.allegiance||0)+6,-100,100);
           flashMsg&&flashMsg(w.name.split(" ")[0]+" is ready to be recruited");}
         else{w.allegiance=clamp((w.allegiance||0)-3,-100,100);}},
       reply:{win:"\"I thought you'd never ask. I'm with you.\"",lose:"\"I want to \u2014 but I'm scared. Give me time.\""},
       goto:"end"},
      {kind:"free",text:"Just checking in. Stay strong.",effect:(w)=>{w.allegiance=clamp((w.allegiance||0)+2,-100,100);},reply:"\"Always. We're going to win this.\"",goto:"end"},
      {kind:"free",text:"[Leave]",goto:"end"},
    ]
  },
  // ENTRY: an already-recruited cell member
  recruited_root:{
    line:"\"Orders? Or just checking in?\"",
    choices:[
      {kind:"probe",text:"Anything to report?",
       effect:(w)=>{M().intel=(M().intel||0)+2;},
       reply:w=>"\""+(REG().awareness>60?"Patrols are heavy. Be careful out there.":"Quiet for now. The block's holding.")+"\"",goto:"end"},
      {kind:"free",text:"Keep your head down. We need you.",effect:(w)=>{w.allegiance=clamp((w.allegiance||0)+1,-100,100);},reply:"\"Understood. I'm not going anywhere.\"",goto:"end"},
      {kind:"free",text:"[Leave]",goto:"end"},
    ]
  },
  // ═══ THE MAYOR — a deep branching tree. The regime's local authority: a high-value target you can probe,
  //     pressure, find cracks in, or attempt to TURN. Multi-node, real stakes. ═══
  mayor_root:{
    line:w=>"\""+(REG().grip>70?"You're one of the malcontents, aren't you? The block's been restless. State your business.":"Ah. A concerned citizen. The regime values feedback. What is it?")+"\"",
    choices:[
      {kind:"free",text:"Just paying my respects to the man in charge.",
       reply:"\"Flattery. How refreshingly old-fashioned. Get to the point.\"",goto:"mayor_probe"},
      {kind:"probe",text:"I want to understand how someone like you sleeps at night.",gate:{attr:"insight",min:7},
       effect:(w)=>{M().intel=(M().intel||0)+3;},
       reply:"\"...You think I don't see it? I keep this block from being LEVELED. That's the job no one thanks me for.\"",goto:"mayor_crack"},
      {kind:"push",text:"The regime is using you. When it's done, it'll discard you too.",gate:{attr:"presence",min:7},
       risk:{attr:"presence",diff:13},
       effect:(w,band)=>{if(band==="critwin"){w._mayorDoubt=(w._mayorDoubt||0)+2;M().intel=(M().intel||0)+4;}
         else if(band==="success"){w._mayorDoubt=(w._mayorDoubt||0)+1;M().intel=(M().intel||0)+2;}
         else if(band==="fail"||band==="critfail"){REG().awareness=clamp((REG().awareness||0)+8,0,100);M().exposure=clamp((M().exposure||0)+6,0,100);}},
       reply:{win:"\"...You think I haven't considered that? Careful. You're more perceptive than is safe.\"",lose:"\"I'll remember this conversation. And your face. Leave. Now.\""},
       goto:(w)=>(w._mayorDoubt>=1?"mayor_crack":"end")},
      {kind:"free",text:"[Leave]",goto:"end"},
    ]
  },
  mayor_probe:{
    line:"\"Well? My time isn't free.\"",
    choices:[
      {kind:"probe",text:"How bad is it really? Behind the regime's numbers.",gate:{attr:"insight",min:6},
       effect:(w)=>{M().intel=(M().intel||0)+3;flashMsg&&flashMsg("The Mayor lets something slip (+3 intel)");},
       reply:"\"...Worse than they admit. Rations are short. People are angry. I hold it together with spit and fear.\"",goto:"mayor_crack"},
      {kind:"push",text:"You could be more than their puppet. Help us, quietly.",gate:{attr:"guile",min:7},
       need:w=>(w._mayorDoubt||0)>=1,
       risk:{attr:"guile",diff:14},
       effect:(w,band)=>{if(band==="critwin"||band==="success"){w._mayorTurning=true;M().support=clamp((M().support||0)+6,0,100);}
         else{REG().awareness=clamp((REG().awareness||0)+10,0,100);M().exposure=clamp((M().exposure||0)+8,0,100);}},
       reply:{win:"\"...If anyone learns we spoke of this, we're both dead. But go on. I'm listening.\"",lose:"\"TREASON. Get out before I have you taken.\""},
       goto:"end"},
      {kind:"free",text:"Nothing. Just wanted to look you in the eye.",reply:"\"...Unsettling. We're done here.\"",goto:"end"},
    ]
  },
  mayor_crack:{
    line:w=>"\""+((w._mayorDoubt||0)>=2?"You've gotten under my skin. I don't like it.":"Say what you came to say.")+"\"",
    choices:[
      {kind:"push",text:"Then stop holding it together for THEM. Hold it for the block.",gate:{attr:"presence",min:8},
       need:w=>(w._mayorDoubt||0)>=2,
       risk:{attr:"presence",diff:15},
       effect:(w,band)=>{if(band==="critwin"){w._mayorTurning=true;w.allegiance=clamp((w.allegiance||0)+30,-100,100);M().support=clamp((M().support||0)+10,0,100);REG().grip=Math.max(0,(REG().grip||60)-8);}
         else if(band==="success"){w._mayorTurning=true;w.allegiance=clamp((w.allegiance||0)+15,-100,100);M().support=clamp((M().support||0)+5,0,100);}
         else{REG().awareness=clamp((REG().awareness||0)+15,0,100);M().exposure=clamp((M().exposure||0)+10,0,100);if(typeof tryEmote==="function")tryEmote(w,"angry",90);}},
       reply:{win:"\"...God help me. Alright. I'll feed you what I can. But softly. Always softly.\"",lose:"\"You've said too much. I have to report this \u2014 or I'm finished. ENFORCER!\""},
       goto:"end"},
      {kind:"probe",text:"What would it take for you to look the other way, just once?",gate:{attr:"guile",min:6},
       effect:(w)=>{M().intel=(M().intel||0)+2;w._mayorDoubt=(w._mayorDoubt||0)+1;},
       reply:"\"...Leverage. Protection. A reason to believe you'd win. Do you have any of those?\"",goto:"end"},
      {kind:"free",text:"Think about what I said.",effect:(w)=>{w._mayorDoubt=(w._mayorDoubt||0)+1;},reply:"\"...Get out. Before I change my mind about letting you.\"",goto:"end"},
    ]
  },
  // ═══ ENFORCER — regime muscle. Dangerous to talk to; mostly intimidation/probing, low recruit odds. ═══
  enforcer_root:{
    line:"\"Move along, citizen. Unless you've got a reason to be in my face.\"",
    choices:[
      {kind:"probe",text:"Just keeping an eye on who keeps the peace around here.",
       effect:(w)=>{M().intel=(M().intel||0)+1;},
       reply:"\"Smart mouth. Keep walking before I find a reason to book you.\"",goto:"end"},
      {kind:"probe",text:"You don't strike me as someone who loves this work.",gate:{attr:"insight",min:7},
       effect:(w,band)=>{w.allegiance=clamp((w.allegiance||0)+3,-100,100);M().intel=(M().intel||0)+2;},
       reply:"\"...It's a job. Pays. Keeps my family fed. Don't read into it.\"",goto:"end"},
      {kind:"push",text:"The regime treats you like a tool. We'd treat you like a person.",gate:{attr:"presence",min:8},
       need:w=>(w.allegiance||0)>=0,
       risk:{attr:"presence",diff:15},
       effect:(w,band)=>{if(band==="critwin"||band==="success"){w.allegiance=clamp((w.allegiance||0)+10,-100,100);}
         else{REG().awareness=clamp((REG().awareness||0)+12,0,100);M().exposure=clamp((M().exposure||0)+8,0,100);if(typeof tryEmote==="function")tryEmote(w,"angry",90);}},
       reply:{win:"\"...You're either brave or stupid saying that to me. Maybe both. ...Maybe I'm listening.\"",lose:"\"That's sedition. You just made a serious mistake.\""},
       goto:"end"},
      {kind:"free",text:"[Leave]",goto:"end"},
    ]
  },
  // ═══ INFORMANT — a wisp the regime turned. Can be probed (feed disinfo) or won back. ═══
  informant_root:{
    line:"\"...Oh. It's you. What do you want?\"",
    choices:[
      {kind:"probe",text:"I know what you've been doing. Reporting to them.",gate:{attr:"insight",min:6},
       effect:(w)=>{M().intel=(M().intel||0)+2;},
       reply:"\"...They made me. You don't understand the pressure. I didn't have a choice.\"",goto:"informant_turn"},
      {kind:"push",text:"Feed them what I tell you. Become my eyes inside.",gate:{attr:"guile",min:7},
       risk:{attr:"guile",diff:13},
       effect:(w,band)=>{if(band==="critwin"||band==="success"){w._doubleAgent=true;M().intel=(M().intel||0)+4;flashMsg&&flashMsg(w.name.split(" ")[0]+" will feed the regime YOUR disinformation now");}
         else{REG().awareness=clamp((REG().awareness||0)+8,0,100);}},
       reply:{win:"\"...A double game. If they catch me, I'm dead. But I owe you that much. Alright.\"",lose:"\"I can't. They'd know. They always know. Please, just go.\""},
       goto:"end"},
      {kind:"free",text:"[Leave]",goto:"end"},
    ]
  },
  informant_turn:{
    line:"\"Are you... are you going to turn me in to the others?\"",
    choices:[
      {kind:"push",text:"No. Come back to us. Stop feeding them.",gate:{attr:"presence",min:6},
       risk:{attr:"presence",diff:12},
       effect:(w,band)=>{if(band==="critwin"||band==="success"){w.informant=false;const i=REG().informants.indexOf(w.id);if(i>=0)REG().informants.splice(i,1);w.allegiance=clamp((w.allegiance||0)+15,-100,100);flashMsg&&flashMsg(w.name.split(" ")[0]+" is no longer informing on you");}
         else{w.allegiance=clamp((w.allegiance||0)-5,-100,100);}},
       reply:{win:"\"...Okay. Okay. No more reports. I'm done being their dog.\"",lose:"\"I want to. But they'll hurt my family. I can't risk it.\""},
       goto:"end"},
      {kind:"free",text:"Just stop hurting people. That's all I ask.",reply:"\"...I'll try. That's all I can promise.\"",goto:"end"},
    ]
  },
  end:null,
};

// resolve a value that may be a string or a fn(wisp)
function dlgVal(v,w){return (typeof v==="function")?v(w):v;}

// is this wisp recruitable RIGHT NOW from within a conversation? (the talk-path has softened them)
function dlgCanRecruit(w){
  return w && !w.recruited && !w.informant && !isChild(w) && ((w._recruitReady)||((w.allegiance||0)>=40));
}
// recruit from within the conversation — routes through recruitWisp, but the conversational groundwork
// gives a real edge (a temporary allegiance bump so the underlying roll is more favorable). This is the
// PAYOFF of the talk-to-recruit path: talking your way there makes the ask far more likely to land.
function dlgRecruit(w){
  if(!dlgCanRecruit(w)){flashMsg&&flashMsg("They're not ready to be recruited yet");return false;}
  const m=M();
  if((m.intel||0)<8){flashMsg&&flashMsg("Need 8 intel to make the ask");return false;}
  // groundwork bonus: briefly boost allegiance so radicalPotential (which recruitWisp reads) is higher
  const saved=w.allegiance;
  w.allegiance=clamp((w.allegiance||0)+20,-100,100);   // the rapport you built
  const ok=recruitWisp(w);
  if(!ok)w.allegiance=Math.max(saved,w.allegiance);    // keep any net gain, don't punish below where they were
  return ok;
}

// render the conversation panel
function renderDialogue(){
  const st=DLG_STATE.active;
  let el=document.getElementById("dlg-panel");
  if(!st){if(el)el.remove();return;}
  const w=ST.pawns.find(p=>p.id===st.wispId);
  if(!w||w.hp<=0){endDialogue();return;}
  const node=DLG_NODES[st.node];
  if(!node){endDialogue();return;}
  const av=theAvatar();
  if(!el){el=document.createElement("div");el.id="dlg-panel";
    el.style.cssText="position:fixed;left:50%;transform:translateX(-50%);bottom:72px;width:min(460px,94vw);border-radius:12px;z-index:60;box-shadow:0 10px 40px rgba(0,0,0,.8);overflow:hidden";
    document.body.appendChild(el);}
  // header: who you're talking to + their disposition
  const al=w.allegiance||0;
  const disp=al<=-20?["hostile","#ff5470"]:al>=35?["warm","#5cff9e"]:al>=15?["sympathetic","#7aa2ff"]:["wary","#8aa8c8"];
  // ── ATMOSPHERIC BACKDROP — a styled "comms terminal" scene behind the dialogue, tinted by disposition.
  //    Same flow as before; this is purely a moodier stage. The disposition accent bleeds into the backdrop
  //    so a hostile talk feels cold/red, a warm one green, etc.
  const dc=disp[1];
  el.style.border="1px solid "+hexA(dc,0.45);
  // layered atmospheric background on the panel itself: a deep base + a disposition-tinted glow from the top,
  // plus a faint scanline texture for the "comms terminal" feel. Content renders above via a relative wrapper.
  el.style.background=
    "radial-gradient(120% 80% at 50% 0%, "+hexA(dc,0.16)+" 0%, rgba(6,8,18,.0) 60%),"+
    "linear-gradient(180deg, rgba(10,12,24,.985) 0%, rgba(6,8,18,.99) 100%),"+
    "repeating-linear-gradient(0deg, rgba(255,255,255,.022) 0px, rgba(255,255,255,.022) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)";
  const nm=w.name+(w.recruited?" \u00b7 <span style='color:#5cff9e'>cell</span>":"");
  let h="<div style='display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px'>";
  h+="<div style='font-family:var(--disp);font-weight:700;font-size:13px;color:#c9b3ff'>"+nm+"</div>";
  h+="<div style='font-size:9px;color:"+disp[1]+";letter-spacing:.05em'>"+disp[0].toUpperCase()+"</div></div>";
  // the wisp's line
  h+="<div style='color:#dfe8ff;font-size:12px;line-height:1.5;margin-bottom:11px;font-style:italic'>"+dlgVal(node.line,w)+"</div>";
  // the choices
  h+="<div style='display:flex;flex-direction:column;gap:5px'>";
  // DYNAMIC RECRUIT — when the talk-path has softened the wisp enough, surface the ask right here. This is
  // the front door to the cell: conversation led them to the edge, now you close.
  if(dlgCanRecruit(w)){
    h+="<button class='tb dlg-choice' data-dlg-recruit='1' style='text-align:left;padding:8px 10px;font-size:11px;border-color:rgba(92,255,158,.5);color:#5cff9e;background:rgba(92,255,158,.08)'>\u2605 \""+"Join us. For real this time."+"\" <span style='display:block;font-size:8px;opacity:.7;margin-top:1px'>Recruit "+w.name.split(" ")[0]+" \u2014 8 intel (your rapport makes this likely)</span></button>";
  }
  node.choices.forEach((c,idx)=>{
    // hidden entirely if a non-stat `need` isn't met
    if(c.need&&!c.need(w))return;
    // stat gate: locked (grayed) if the attr is too low
    let locked=false,gateLabel="";
    if(c.gate){const have=ops(av,c.gate.attr);locked=have<c.gate.min;gateLabel="["+dlgAttrLabel(c.gate.attr)+" "+c.gate.min+"+] ";}
    const riskTag=c.risk?" <span style='font-size:8px;opacity:.6'>\u26a0 "+dlgAttrLabel(c.risk.attr)+" check</span>":"";
    const kindCol=c.kind==="push"?"#ff8da3":c.kind==="probe"?"#7aa2ff":"#c8d4e8";
    if(locked){
      h+="<div style='padding:7px 10px;font-size:11px;border:1px solid rgba(120,130,160,.2);border-radius:7px;color:#5a6580;opacity:.55;cursor:not-allowed'><span style='color:#7a6aa0'>"+gateLabel+"</span>"+dlgVal(c.text,w)+riskTag+"</div>";
    }else{
      h+="<button class='tb dlg-choice' data-dlg-choice='"+idx+"' style='text-align:left;padding:7px 10px;font-size:11px;border-color:rgba(120,130,160,.35);color:"+kindCol+"'>"+(gateLabel?"<span style='color:#9a8ad0'>"+gateLabel+"</span>":"")+dlgVal(c.text,w)+riskTag+"</button>";
    }
  });
  h+="</div>";
  // wrap content in a padded layer that sits ABOVE the atmospheric backdrop, with a thin disposition accent
  // bar along the top edge (the "comms channel" line)
  el.innerHTML="<div style='height:2px;background:linear-gradient(90deg, rgba(0,0,0,0) 0%, "+dc+" 50%, rgba(0,0,0,0) 100%);opacity:.8'></div>"+
    "<div style='position:relative;padding:14px 16px 15px'>"+h+"</div>";
}

// the player picks a choice
function dlgChoose(idx){
  const st=DLG_STATE.active;if(!st)return;
  const w=ST.pawns.find(p=>p.id===st.wispId);if(!w){endDialogue();return;}
  const node=DLG_NODES[st.node];if(!node)return;
  const c=node.choices[idx];if(!c)return;
  // re-check the gate (defensive)
  if(c.gate&&ops(theAvatar(),c.gate.attr)<c.gate.min)return;
  if(c.need&&!c.need(w))return;
  SFX&&SFX.ui&&SFX.ui();
  let band="ok",replyLine=c.reply;
  // RISKY choice -> opsCheck decides the band
  if(c.risk){
    const res=opsCheck(c.risk.attr,c.risk.diff);
    band=res.band;
    const won=(band==="critwin"||band==="success"||band==="partial");
    if(c.reply&&typeof c.reply==="object")replyLine=won?c.reply.win:c.reply.lose;
    // a small float telegraphing the roll outcome
    float(w.px,w.py,band==="critwin"?"!!":band==="critfail"?"\u2717":won?"\u2713":"\u2717", won?"#5cff9e":"#ff5470");
  }
  // apply the effect
  if(c.effect){try{c.effect(w,band);}catch(e){}}
  // show the wisp's reply briefly (as a say bubble) if present
  if(replyLine){const rl=dlgVal(replyLine,w);if(typeof sayLine==="function")sayLine(w,rl.replace(/^"|"$/g,""));}
  // advance
  let next=c.goto;
  if(typeof next==="function")next=next(w);
  if(!next||next==="end"||!DLG_NODES[next]){endDialogue();return;}
  st.node=next;st.history.push(idx);
  renderDialogue();
}

// delegated click handler for dialogue choices
if(typeof document!=="undefined"&&document.addEventListener)document.addEventListener("click",e=>{
  const rb=e.target.closest&&e.target.closest("[data-dlg-recruit]");
  if(rb){const st=DLG_STATE.active;if(st){const w=ST.pawns.find(p=>p.id===st.wispId);if(w){SFX&&SFX.ui&&SFX.ui();
    const ok=dlgRecruit(w);
    if(ok){if(typeof sayLine==="function")sayLine(w,"I'm with you. Whatever it takes.");if(typeof banner==="function")banner("RECRUITED","good");endDialogue();}
    else{if(typeof sayLine==="function")sayLine(w,"I... I can't. Not yet.");renderDialogue();}}}return;}
  const b=e.target.closest&&e.target.closest("[data-dlg-choice]");
  if(b){dlgChoose(+b.dataset.dlgChoice);}
});

function maybeStoryEvent(){
  if(activeEvent)return;                          // one at a time
  if(ST.pawns.length<3||ST.tick<TPD*2)return;     // early grace
  if(ST.tick%TPD>=30)return;                       // roll ~once/day
  if(Math.random()>0.18)return;                    // ~18% daily
  const elig=STORY_EVENTS.filter(e=>{try{return e.when();}catch(_){return false;}});
  if(!elig.length)return;
  // weighted pick
  const total=elig.reduce((s,e)=>s+(e.weight||1),0);let r=Math.random()*total;
  let pick=elig[0];for(const e of elig){r-=(e.weight||1);if(r<=0){pick=e;break;}}
  const ev=pick.gen();ev.id=pick.id;
  activeEvent=ev;
  log("\u25C9 "+ev.title+" — a decision awaits (see the event panel).","warn");
  banner&&banner(ev.title.toUpperCase(),"warn");
  if(SFX&&SFX.alert)SFX.alert();
  renderEventPanel();
}
function resolveEvent(optIdx){
  if(!activeEvent)return;const opt=activeEvent.opts[optIdx];if(!opt)return;
  try{opt.fn();}catch(e){console&&console.warn&&console.warn("event fn error",e);}
  activeEvent=null;renderEventPanel();syncHUD();
}
function renderEventPanel(){
  let el=document.getElementById("event-panel");
  if(!activeEvent){if(el)el.remove();return;}
  if(!el){el=document.createElement("div");el.id="event-panel";
    el.style.cssText="position:fixed;left:50%;top:64px;transform:translateX(-50%);width:min(460px,92vw);background:rgba(8,14,28,.97);border:1px solid #ff5470;border-radius:8px;padding:14px 16px;z-index:60;box-shadow:0 6px 30px rgba(0,0,0,.7)";
    document.body.appendChild(el);}
  let h="<div style='color:#ff8da3;font-family:var(--disp);font-weight:700;font-size:15px;letter-spacing:.04em;margin-bottom:6px'>\u25C9 "+activeEvent.title+"</div>";
  h+="<div style='color:var(--tx);font-size:12px;line-height:1.5;margin-bottom:10px'>"+activeEvent.body+"</div>";
  // VIEW button — jump the camera to the wisp this event is about (if any)
  if(activeEvent.focusId){const fp=ST.pawns.find(p=>p.id===activeEvent.focusId);
    if(fp)h+="<button class='tb' id='ev-view' style='margin-bottom:8px;font-size:11px;border-color:rgba(34,221,255,.5);color:#22ddff'>\u25C9 VIEW "+fp.name+"</button>";}
  h+="<div style='display:flex;flex-direction:column;gap:6px'>";
  activeEvent.opts.forEach((o,i)=>{
    h+="<button class='tb' data-event-opt='"+i+"' style='text-align:left;padding:8px 10px;font-size:12px'>"+o.label+(o.hint?"<span style='display:block;font-size:10px;opacity:.65;margin-top:1px'>"+o.hint+"</span>":"")+"</button>";});
  h+="</div>";
  el.innerHTML=h;
}
// delegated handler for event option clicks + the VIEW button
if(typeof document!=="undefined"&&document.addEventListener)document.addEventListener("click",e=>{
  if(typeof MUSIC!=="undefined"&&MUSIC.start)MUSIC.start();   // kick off ambient music on first interaction
  const v=e.target.closest&&e.target.closest("#ev-view");
  if(v&&activeEvent&&activeEvent.focusId){SFX&&SFX.ui&&SFX.ui();
    const fp=ST.pawns.find(p=>p.id===activeEvent.focusId);
    if(fp){ST.sel=[fp];if(typeof setFollow==="function")setFollow(fp);else{cam.x=fp.px*T-VW/cam.z/2;cam.y=fp.py*T-VH/cam.z/2;if(typeof clampCam==="function")clampCam();}renderInspect&&renderInspect();}return;}
  const b=e.target.closest("[data-event-opt]");
  if(b){SFX&&SFX.ui&&SFX.ui();resolveEvent(+b.dataset.eventOpt);}});
// ═══ ENVOY RESPONSE PANEL (stage 3 UI) — surfaces the decision while the envoy is present. Options are GATED
//     by what the player can actually do (frame needs prior bribe leverage; cell-strike needs a recruited
//     cell). Buttons route to the real ops (pre-targeting the envoy) or directly to envoyStrikeViaCell. ═══
function renderEnvoyPanel(){
  let el=document.getElementById("envoy-panel");
  const ev=ST.envoy;
  // show only while the envoy is here and actionable (arriving or conferring), and not already resolved by a strike
  if(!ev||(ev.stage!=="arriving"&&ev.stage!=="conferring")){if(el)el.remove();return;}
  const e=ST.pawns.find(p=>p.id===ev.id);if(!e){if(el)el.remove();return;}
  if(!el){el=document.createElement("div");el.id="envoy-panel";
    el.style.cssText="position:fixed;right:14px;top:calc(var(--hud-h) + 14px);width:min(300px,90vw);background:rgba(10,8,16,.97);border:1px solid #ff5470;border-radius:9px;padding:13px 14px;z-index:58;box-shadow:0 6px 28px rgba(0,0,0,.7)";
    document.body.appendChild(el);}
  const av=theAvatar();
  const hasBribe=!!(av&&av.opsDone&&av.opsDone.bribe);
  const hasCell=ST.pawns.some(p=>p.recruited&&!isChild(p)&&p.hp>0);
  const m=M();
  const conferring=ev.stage==="conferring";
  // remaining time in the meeting (rough), to convey urgency
  let timeNote="";
  if(conferring){const left=Math.max(0,ev.conferDuration-(ST.tick-ev.conferStart));
    const hrs=Math.ceil(left/(TPD/24));timeNote=" \u00b7 ~"+hrs+"h left";}
  let h="<div style='color:#ff8da3;font-family:var(--disp);font-weight:700;font-size:13px;letter-spacing:.05em;margin-bottom:3px'>\u25C8 GOVERNMENT ENVOY</div>";
  h+="<div style='color:var(--dim);font-size:10px;margin-bottom:8px'>"+(conferring?"Conferring with the Mayor"+timeNote:"Approaching the Mayor")+"</div>";
  h+="<div style='color:var(--tx);font-size:10.5px;line-height:1.45;margin-bottom:9px'>Disrupt the meeting or strike now \u2014 or ignore it and the regime cracks down (and turns a sympathizer)."+(ev.spied?" <span style='color:#39ff88'>\u25c9 Spied \u2014 crackdown blunted.</span>":"")+"</div>";
  h+="<button class='tb' id='env-view' style='width:100%;margin-bottom:7px;font-size:10px;border-color:rgba(34,221,255,.5);color:#22ddff'>\u25C9 VIEW THE ENVOY</button>";
  h+="<div style='display:flex;flex-direction:column;gap:5px'>";
  // SURVEIL — always available
  h+="<button class='tb' data-envoy-act='surveil' style='text-align:left;padding:7px 9px;font-size:11px'>\u25c9 Surveil the meeting<span style='display:block;font-size:9px;opacity:.6;margin-top:1px'>Learn the regime's plan \u2014 blunts the crackdown. (intel)</span></button>";
  // SABOTAGE VENUE — guidance (player sabotages a utility building during the meeting)
  h+="<button class='tb' data-envoy-act='sabotage' style='text-align:left;padding:7px 9px;font-size:11px'>\u2715 Sabotage the venue<span style='display:block;font-size:9px;opacity:.6;margin-top:1px'>Cut the power near the meeting to break it up.</span></button>";
  // FRAME — gated on prior bribe
  if(hasBribe)h+="<button class='tb' data-envoy-act='frame' style='text-align:left;padding:7px 9px;font-size:11px'>\u2696 Frame the envoy<span style='display:block;font-size:9px;opacity:.6;margin-top:1px'>Turn the regime against its own emissary.</span></button>";
  else h+="<button class='tb' disabled style='text-align:left;padding:7px 9px;font-size:11px;opacity:.4;cursor:not-allowed'>\u2696 Frame the envoy<span style='display:block;font-size:9px;margin-top:1px'>Locked \u2014 bribe a wisp first to set up leverage.</span></button>";
  // STRIKE DIRECT — always available (high risk)
  h+="<button class='tb' data-envoy-act='strike' style='text-align:left;padding:7px 9px;font-size:11px;border-color:rgba(255,84,112,.5);color:#ff8da3'>\u2620 Strike the envoy<span style='display:block;font-size:9px;opacity:.6;margin-top:1px'>Assassinate them directly \u2014 a major blow, but exposes you.</span></button>";
  // STRIKE VIA CELL — gated on having a cell
  if(hasCell)h+="<button class='tb' data-envoy-act='cellstrike' style='text-align:left;padding:7px 9px;font-size:11px;border-color:rgba(255,84,112,.5);color:#ff8da3'>\u2620 Strike via a cell member<span style='display:block;font-size:9px;opacity:.6;margin-top:1px'>A recruit does the hit \u2014 you stay clean, but they're at risk.</span></button>";
  else h+="<button class='tb' disabled style='text-align:left;padding:7px 9px;font-size:11px;opacity:.4;cursor:not-allowed'>\u2620 Strike via a cell member<span style='display:block;font-size:9px;margin-top:1px'>Locked \u2014 recruit a cell member first.</span></button>";
  h+="</div>";
  el.innerHTML=h;
}
// delegated handler for the envoy response buttons
if(typeof document!=="undefined"&&document.addEventListener)document.addEventListener("click",e=>{
  const vw=e.target.closest&&e.target.closest("#env-view");
  if(vw&&ST.envoy){SFX&&SFX.ui&&SFX.ui();
    const ep=ST.pawns.find(p=>p.id===ST.envoy.id);
    if(ep){ST.sel=[ep];if(typeof setFollow==="function")setFollow(ep);else{cam.x=ep.px*T-VW/cam.z/2;cam.y=ep.py*T-VH/cam.z/2;if(typeof clampCam==="function")clampCam();}renderInspect&&renderInspect();}return;}
  const btn=e.target.closest&&e.target.closest("[data-envoy-act]");
  if(!btn||!ST.envoy)return;
  SFX&&SFX.ui&&SFX.ui();
  const act=btn.dataset.envoyAct;
  const ep=ST.pawns.find(p=>p.id===ST.envoy.id);if(!ep)return;
  if(act==="surveil"){
    // start a surveil op targeting the envoy (the op + its detection rolls run as normal; the hook sets spied)
    if(runAvatarOp("surveil",ep)){flashMsg&&flashMsg("Tailing the envoy \u2014 stay unseen.");}
  }else if(act==="sabotage"){
    // guidance: the player sabotages a utility building during the meeting (uses the normal sabotage flow)
    flashMsg&&flashMsg("Sabotage a power/water building near the meeting while it's underway \u2014 use the Sabotage op.");
  }else if(act==="frame"){
    if(runAvatarOp("frame",ep)){flashMsg&&flashMsg("Framing the envoy\u2026");}
  }else if(act==="strike"){
    if(runAvatarOp("assassinate",ep)){flashMsg&&flashMsg("Moving to strike the envoy\u2026");}
  }else if(act==="cellstrike"){
    envoyStrikeViaCell();
  }
  renderEnvoyPanel();
});
// A disaster is announced (telegraph), then strikes after a delay unless mitigated.
// ST.pendingDisaster = {kind, strikeAt, x, y, warned}
function maybeScheduleDisaster(){
  if(ST.pendingDisaster)return;
  if(ST.pawns.length<3)return;
  if(ST.tick<TPD*2)return;                    // grace period early game
  // only roll for a new disaster about once per day (disasterTick runs every 30 ticks)
  if(ST.tick%TPD>=30)return;
  // disasters get likelier with district stress (heat, crisis, crowding)
  const pressure=clamp((ST.heat||0)/100*0.5 + (ST.crisis?0.3:0) + (ST.pawns.length>=10?0.2:0),0,1);
  if(Math.random()>0.12+pressure*0.12)return; // ~12% daily base, up to ~24% under heavy pressure
  const roll=Math.random();
  let kind;
  // raids need a gang; fire needs structures; blackout needs production
  const hasGang=ST.gangs&&ST.gangs.some(g=>g.crewIds.length>=3);
  const prodStructs=[...ST.structs.values()].filter(s=>!s.bp&&DEF[s.type]&&(DEF[s.type].prod||DEF[s.type].refine));
  if(roll<0.4&&prodStructs.length){kind="fire";}
  else if(roll<0.7&&prodStructs.length>=2){kind="blackout";}
  else if(hasGang){kind="raid";}
  else if(prodStructs.length){kind="fire";}
  else return;
  // pick an epicenter
  let ex=MW>>1,ey=MH>>1;
  if(kind==="fire"&&prodStructs.length){const s=CH(prodStructs);ex=s.x;ey=s.y;}
  else if(ST.pawns.length){const p=CH(ST.pawns);ex=p.px|0;ey=p.py|0;}
  ST.pendingDisaster={kind,strikeAt:ST.tick+Math.floor(TPD*R(0.4,0.7)),x:ex,y:ey,warned:false};
  telegraphDisaster();
}
function telegraphDisaster(){
  const dz=ST.pendingDisaster;if(!dz||dz.warned)return;dz.warned=true;
  const msg={
    fire:"Smoke is rising near the production district — an electrical fault could spark a fire. Clear the area or build a Watch Post nearby to respond fast.",
    blackout:"The power grid is straining and lights are flickering — a blackout may hit production soon.",
    raid:"Gang chatter is spiking — a raid on the block may be coming. Shore up security."
  }[dz.kind]||"Something's brewing on the block.";
  log("⚠ WARNING: "+msg,"warn");
  banner("DISASTER LOOMING","warn");
  if(SFX&&SFX.alert)SFX.alert();
}
function disasterTick(){
  maybeScheduleDisaster();
  const dz=ST.pendingDisaster;if(!dz)return;
  // a watch post near the epicenter can pre-empt some disasters
  if(underSecurity(dz.x,dz.y)&&(dz.kind==="raid")&&Math.random()<0.04){
    log("Security presence broke up the gathering before it became a raid.","good");
    ST.pendingDisaster=null;return;
  }
  if(ST.tick>=dz.strikeAt)strikeDisaster();
}
function strikeDisaster(){
  const dz=ST.pendingDisaster;if(!dz)return;
  ST.pendingDisaster=null;
  if(dz.kind==="fire")strikeFire(dz);
  else if(dz.kind==="blackout")strikeBlackout(dz);
  else if(dz.kind==="raid")strikeRaid(dz);
}
function strikeFire(dz){
  // damages/destroys structures near the epicenter; injures nearby pawns; owners lose property
  const radius=8;let destroyed=0;
  const near=[...ST.structs.values()].filter(s=>!s.bp&&DIST(s.x,s.y,dz.x,dz.y)<=radius);
  for(const s of near){
    if(Math.random()<0.45){
      // owner loses property (ties into wealth/inheritance grief)
      if(s.owner){const o=ST.pawns.find(p=>p.id===s.owner);if(o)loseProperty(o,"a fire took what was mine on the block");}
      removeStruct(s);destroyed++;
    }
  }
  for(const p of ST.pawns){if(DIST(p.px,p.py,dz.x,dz.y)<=radius){
    damagePawn(p,RI(8,22));p.stress=Math.min(100,(p.stress||0)+20);
    addMod(p,"firescare","Survived a fire",-10,TPD);
    remember(p,"a fire tore through the block — barely got clear");}}
  ST.heat=Math.min(100,(ST.heat||0)+10);
  log("🔥 FIRE tore through the production district — "+destroyed+" structures lost.","bad");
  banner("FIRE","bad");if(SFX&&SFX.die)SFX.die();
  chronicle("A fire tore through the district.","🔥");
}
function strikeBlackout(dz){
  // halts production for a while; raises stress; crime opportunity (heat)
  ST.blackoutUntil=ST.tick+Math.floor(TPD*R(0.3,0.6));
  for(const p of ST.pawns){p.stress=Math.min(100,(p.stress||0)+10);
    if(Math.random()<0.3)remember(p,"the power went out across the block — everything stopped");}
  ST.heat=Math.min(100,(ST.heat||0)+12);   // darkness breeds crime
  log("⚡ BLACKOUT — the grid went down. Production is halted until power returns.","bad");
  banner("BLACKOUT","bad");if(SFX&&SFX.alert)SFX.alert();
  chronicle("A blackout struck the grid.","⚡");
}
function strikeRaid(dz){
  // a rival crew invades: injures pawns, steals goods/income, may hurt a defender
  const stolen=Math.min((ST.income||0),RI(40,90));
  ST.income=Math.max(0,(ST.income||0)-stolen);
  ST.goods.stims=Math.max(0,(ST.goods.stims||0)-RI(0,3));
  let hurt=0;
  for(const p of ST.pawns){if(DIST(p.px,p.py,dz.x,dz.y)<=10&&Math.random()<0.4){
    damagePawn(p,RI(10,28));p.stress=Math.min(100,(p.stress||0)+18);hurt++;
    remember(p,"a crew raided the block — it got violent");}}
  ST.heat=Math.min(100,(ST.heat||0)+20);
  log("⚔ GANG RAID — a rival crew hit the block, made off with "+stolen+"c. "+hurt+" hurt.","bad");
  banner("GANG RAID","bad");if(SFX&&SFX.die)SFX.die();
  chronicle("A gang raid hit the block.","⚔");
}
function fireEvent(){
  const r=Math.random();
  // economy-aware event injection: override random events when economy conditions are met
  const hasStimlab=[...ST.structs.values()].find(s=>s.type==="stimlab"&&!s.bp);
  const stimsLow=(ST.goods.stims||0)===0&&(ST.goods.chem||0)===0;
  const stimsHot=(ST.goods.stims||0)>=3&&ST.heat>40;
  const surplusChem=(ST.goods.chem||0)>=8;
  let ev=r<.15?"brawl":r<.32?"wander":r<.46?"mugging":r<.60?"medbill":r<.72?"gigdrought":
    r<.80?"supply_windfall":r<.87?"shortage":r<.93?"power_surge":"corp_recruit";
  // BRAIN B (§3) — the tension director picks the event by phase/state/temperament, overriding the flat
  // random roll most of the time (so events are dramatically paced, not arbitrary). The economy overrides
  // below still take precedence when their specific conditions are met.
  {const dirPick=directorPickEvent();if(dirPick&&Math.random()<0.75)ev=dirPick;
   if(ST.director)ST.director.lastEvent=ST.tick;}
  // override with economy events when conditions are met
  if(stimsLow&&hasStimlab&&Math.random()<0.4)ev="shortage";
  if(stimsHot&&Math.random()<0.35)ev="enforcer_raid";
  if(surplusChem&&Math.random()<0.3)ev="black_market";
  if(ev==="wander"&&openHomes().length===0)ev="brawl";
  switch(ev){
    case "brawl":{
      // LONE-BRAWL FIX — a brawl must be between two wisps who are ACTUALLY NEAR each other. Previously a
      // and b were both picked at random from the whole map, so they could be on opposite sides; the "BRAWL"
      // float + camera pan only showed A, so you'd see one wisp brawling "alone" while B fought from afar.
      // Now: pick an instigator A, then find a B standing close to A. If nobody's nearby, no brawl this time.
      const adults=ST.pawns.filter(p=>p.hp>0&&!isChild(p)&&!p.jailed);
      let a=null,b=null;
      // try a few instigators until one has a neighbour within brawling distance
      const shuffled=adults.slice().sort(()=>Math.random()-0.5);
      for(const cand of shuffled){
        const near=adults.filter(q=>q!==cand&&DIST(cand.px,cand.py,q.px,q.py)<3.5);
        if(near.length){a=cand;b=CH(near);break;}
      }
      if(a&&b){const dmg=RI(6,18);a.hp=Math.max(1,a.hp-dmg);b.hp=Math.max(1,b.hp-dmg);
        a.stress=Math.min(100,(a.stress||0)+12);b.stress=Math.min(100,(b.stress||0)+12);
        relAdj(a.id,b.id,-20);ST.heat=Math.min(100,(ST.heat||0)+8);
        // both combatants show the visual + emote, so it reads as an actual fight between two wisps
        float(a.px,a.py,"BRAWL","#ff4757");float(b.px,b.py,"BRAWL","#ff4757");
        tryEmote&&tryEmote(a,"angry",90);tryEmote&&tryEmote(b,"angry",90);
        // briefly make them face off (a short flee/agitation so they don't just stand calmly mid-brawl)
        a.stress=Math.min(100,a.stress+6);b.stress=Math.min(100,b.stress+6);
        panToEvent(a.px,a.py,"#ff4757");
        log(a.name+" and "+b.name+" got into it on the block — heat rising.","warn");banner("STREET BRAWL","warn");SFX.alert()}
      break}
    case "wander":{const open=openHomes();if(!open.length)break;
      const e=edgeCell();
      const p=mkPawn(e.x,e.y,CH(["sal","bld","sht"]));
      const home=open[0];claimHome(p,home);
      ST.pawns.push(p);
      log(p.name+" drifted into the district from the sprawl — there's a home for them here.","good");
      banner("NEW ARRIVAL","good");SFX.good();break}
    case "mugging":{const p=CH(ST.pawns);if(p){const loss=RI(15,35);
      p.credits=(p.credits||0)-loss;p.stress=Math.min(100,(p.stress||0)+15);
      float(p.px,p.py,"MUGGED -"+loss+"c","#ff4757");panToEvent(p.px,p.py,"#ff4757");
      log(p.name+" was mugged in the sprawl — lost "+loss+" credits.","warn");banner("MUGGING","warn");SFX.alert();remember(p,"got jumped in the sprawl — lost "+loss+" creds, still rattled")}break}
    case "medbill":{const p=CH(ST.pawns);if(p){const bill=RI(18,32);
      p.credits=(p.credits||0)-bill;p.stress=Math.min(100,(p.stress||0)+10);
      float(p.px,p.py,"MED BILL -"+bill+"c","#ff9f2d");
      log(p.name+" got hit with an unexpected medical bill ("+bill+"c).","warn");banner("MEDICAL BILL","warn");SFX.alert();remember(p,"got slammed with a "+bill+"c medical bill out of nowhere")}break}
    case "gigdrought":{const p=CH(ST.pawns);if(p){p.workCd=ST.tick+RI(600,1100);p.stress=Math.min(100,(p.stress||0)+8);
      float(p.px,p.py,"LAID OFF","#ff9f2d");
      log(p.name+" lost their gig — no work for a while.","warn");banner("GIG DROUGHT","warn");SFX.alert();remember(p,"lost my gig — no work coming in for a while")}break}
    case "shortage":{// stims/chem drought — addicted citizens get desperate
      const addicted=ST.pawns.filter(p=>(p.addiction||0)>20);
      addicted.forEach(p=>{p.stress=Math.min(100,(p.stress||0)+18);addMod(p,"withdrawal","Supply ran dry",-12,TPD*.5)});
      log("Stim supply dried up on the block — addicted citizens are getting edgy.","warn");
      banner("SUPPLY DROUGHT","warn");SFX.alert();break}
    case "enforcer_raid":{// corps hit the stimlab
      const sl=[...ST.structs.values()].find(s=>s.type==="stimlab"&&!s.bp);
      if(sl){const fine=RI(40,80);ST.income=Math.max(0,(ST.income||0)-fine);
        ST.goods.stims=0;ST.heat=Math.max(0,(ST.heat||0)-20);
        log("Corp enforcers hit the Stim Lab — seized the stock and fined the district "+fine+"c.","bad");
        banner("STIMLAB RAIDED","bad");SFX.alert();
        ST.pawns.forEach(p=>{if(DIST(p.px,p.py,sl.x+.5,sl.y+.5)<10){p.stress=Math.min(100,(p.stress||0)+15);
          remember(p,"enforcers raided the stim lab — lost everything, block's on edge")}})}
      break}
    case "black_market":{// surplus chem attracts a buyer — quick income, but risky
      const sale=RI(30,60);const risk=Math.random()<0.3;
      if(risk){ST.heat=Math.min(100,(ST.heat||0)+18);
        log("Black market deal went sideways — heat up but no payout.","warn");banner("DEAL GONE BAD","warn");SFX.alert()}
      else{ST.income=(ST.income||0)+sale;ST.goods.chem=Math.max(0,(ST.goods.chem||0)-4);
        log("Black market buyer moved "+sale+"c for surplus chem. District pockets the cut.","good");
        banner("BLACK MARKET SALE","good");SFX.good()}
      break}
    case "supply_windfall":{// random supply drop — small goods bonus
      const wg=CH(["data","chem","parts"]);const qty=RI(3,6);
      ST.goods[wg]=(ST.goods[wg]||0)+qty;
      log("A scavenger crew sold "+qty+" units of "+wg+" to the district at a good rate.","good");
      banner("SUPPLY WINDFALL","good");SFX.good();break}
    case "power_surge":{// corp grid spike — disables random production fixture briefly
      const prods=[...ST.structs.values()].filter(s=>!s.bp&&(DEF[s.type].prod||DEF[s.type].refine));
      const tgt=CH(prods);
      if(tgt){tgt.surgeT=ST.tick+RI(300,600);// fixture offline until surgeT clears
        float(tgt.x+.5,tgt.y+.5,"SURGE!","#ffc947");
        log("Corp grid surge — "+DEF[tgt.type].name+" went offline for a shift.","warn");
        banner("POWER SURGE","warn");SFX.alert();}break}
    case "corp_recruit":{// corp headhunter approaches a citizen
      const p=CH(ST.pawns.filter(q=>q.sk&&q.sk.bld+q.sk.sal>6));
      if(p){const bonus=RI(40,80);
        const req={id:uid(),agentId:p.id,agentName:p.name,created:ST.tick,
          expires:ST.tick+Math.floor(TPD*.6),status:"pending",kind:"corp_recruit",
          text:p.name+" got a corp headhunter offer — "+bonus+"c signing bonus, but they'd have to leave the block.",
          options:[{label:"Let them go (−1 citizen)",leave:true,bonus},{label:"Talk them out of it",leave:false}]};
        ST.requests.push(req);renderRequests();
        banner("CORP OFFER","warn");SFX.alert();}break}}
  scheduleEv()}

/* ---------- win / lose ---------- */
function statRows(){return "<table>"+
  "<tr><td>Days survived</td><td class='stat'>"+dayN()+"</td></tr>"+
  "<tr><td>Citizens housed</td><td class='stat'>"+ST.pawns.length+"</td></tr>"+
  "<tr><td>Structures built</td><td class='stat'>"+ST.stats.built+"</td></tr>"+
  "<tr><td>Runners lost</td><td class='stat'>"+ST.stats.deaths+"</td></tr>"+
  "<tr><td>Milestones reached</td><td class='stat'>"+(ST.milestones?ST.milestones.length:0)+"</td></tr>"+
  "</table>"}
function gameOver(){ST.phase="over";
  const condemned=ST.crisis&&ST.pawns.length>0;
  showModal("<h1>SIGNAL LOST</h1><div class='mh-sub'>"+(condemned?"DISTRICT CONDEMNED":"COLONY TERMINATED")+"</div>"+
    "<p>"+(condemned?"District finances collapsed — enforcers moved in and cleared the block.":"The last runner is down. The sprawl reclaims the block.")+"</p>"+
    statRows()+(hasSave()?"<button class='tb big' id='m-continue'>LOAD LAST SAVE</button>":"")+
    "<button class='tb big' id='m-restart'>REINITIALIZE</button>")}
// WIN STATE (§7 of the design doc) — the game had loss states but no victory. The insurrection WINS by
// breaking the regime's grip on the district and holding it broken. Grip <= WIN_GRIP sustained for
// WIN_DAYS days => District Liberated. This gives an autonomous (or manual) campaign a finish line.
const WIN_GRIP=10, WIN_DAYS=3;
function checkWinState(){
  if(ST.phase!=="run")return;
  const grip=(REG()&&REG().grip!=null)?REG().grip:60;
  if(grip<=WIN_GRIP){
    if(ST._lowGripSince==null)ST._lowGripSince=ST.tick;
    // sustained for WIN_DAYS full days?
    if(ST.tick-ST._lowGripSince>=TPD*WIN_DAYS){gameWin();}
  } else {
    ST._lowGripSince=null;   // grip recovered — reset the liberation clock
  }
}
function gameWin(){ST.phase="over";
  if(SFX&&SFX.good)SFX.good();
  showModal("<h1>DISTRICT LIBERATED</h1><div class='mh-sub'>THE REGIME'S GRIP IS BROKEN</div>"+
    "<p>The oligarchs have lost their hold on the block. Their enforcers have pulled back, their informants gone quiet, their administration in collapse. The sprawl belongs to the people who live here now — and word of what happened here is spreading to the next district.</p>"+
    statRows()+
    "<button class='tb big' id='m-restart'>BEGIN ANEW</button>")}
/* ---------- master tick ---------- */
function tick(){ST.tick++;
  if(ST.tick%5===0){const P=ST.pawns;for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++)
    if(DIST(P[i].px,P[i].py,P[j].px,P[j].py)<5)relAdj(P[i].id,P[j].id,0.02)}
  // (roguelike vat-protein production + beacon-extraction win removed — the city has neither)
  // PERF — time the two heaviest/most-suspect tick blocks (per-pawn AI loop + O(N²) separation) when the
  // perf HUD is on, so the breakdown shows WHERE simulation time goes. Zero overhead when the HUD is off.
  if(PERF_HUD){
    const _p0=PERF.now();
    for(let i=ST.pawns.length-1;i>=0;i--)pawnTick(ST.pawns[i]);
    const _p1=PERF.now();
    separatePawns();
    const _p2=PERF.now();
    _perfPawnAcc+=(_p1-_p0);_perfSepAcc+=(_p2-_p1);_perfTickCount++;
  } else {
    for(let i=ST.pawns.length-1;i>=0;i--)pawnTick(ST.pawns[i]);
    separatePawns();   // soft personal-space: keep wisps from stacking on top of each other
  }
  sabotageTick();    // drive any active sabotage's lifecycle (reaction → repair → investigation)
  reactWaveTick();   // fire queued onlooker-wave reactions whose delay has elapsed (Gap 2 — staggered ripple)
  jailTick();        // hold/release/execute jailed pawns (escalating sentences for repeat offenders)
  extortionTick();   // process recurring extortion payments from blackmail victims
  blackoutTick();    // power-outage cascade — anger the on-edge, and a regime wisp repairs the grid
  trackBlackoutEdge();   // record blackout start/end for the visual darkness ease-in
  witnessMemoryTick();   // lasting witness fallout — fear-informing, allegiance drift, decay over time
  if(ST.tick%50===0)checkWinState();   // (§7) liberation check — grip held low long enough = victory
  directorTick();                      // (§3) Brain B — advance the tension curve (buildup/peak/relax)
  regimeStrategicTick();               // (§3) Brain B — the regime makes deliberate moves keyed to phase
  for(let i=ST.floats.length-1;i>=0;i--)if(--ST.floats[i].ttl<=0)ST.floats.splice(i,1);
  if(ST.says)for(let i=ST.says.length-1;i>=0;i--)if(--ST.says[i].ttl<=0)ST.says.splice(i,1);
  tickEmotes();
  tickTombstones();
  if(ST.tick>=ST.nextEv)fireEvent();
  if(ST.tick%30===0){disasterTick();maybeStoryEvent();}
  if(ST.tick%30===0)caravanTick();
  // passive crop growth — farm plots slowly yield food on their own (tended or not)
  if(ST.tick%200===0){
    let farms=0,logs=0,mines=0,vatFood=0,vat3=0;
    for(const s of ST.structs.values()){if(s.bp)continue;
      if(s.type==="farmplot")farms++;
      else if(s.type==="sporevat"){vatFood+=vatTier(s).food;if((s.tier||1)>=3)vat3++;}
      else if(s.type==="loggingcamp")logs++;
      else if(s.type==="mineshaft")mines++;}
    // food: farms + spore vats yield (vats scale with tier), capped at a sensible reserve
    const foodUnits=Math.round(farms/5)+vatFood;
    if(foodUnits>0&&(ST.goods.food||0)<ST.pawns.length*14)
      ST.goods.food=(ST.goods.food||0)+Math.max(1,foodUnits);
    // tier-3 Bio-Reactors also trickle a little chem
    if(vat3>0&&ST.tick%600===0)ST.goods.chem=(ST.goods.chem||0)+vat3;
    // logging + mining trickle slowly when idle; dedicated workers (via assign/hire) produce faster through the work job
    if(logs>0&&ST.tick%400===0)ST.goods.scrap=(ST.goods.scrap||0)+Math.max(1,Math.round(logs/3));
    if(mines>0&&ST.tick%600===0)ST.goods.data=(ST.goods.data||0)+Math.max(1,Math.round(mines/3));}
  if(ST.tick%160===0){  // vendor sales cycle — auto-sell goods, district takes 40% cut
    const ILLEGAL={stims:true};
    // dynamic pricing: abundant goods fetch less, scarce goods fetch a premium.
    // stock is measured against a "healthy" reference of ~6 units.
    const marketPrice=(good)=>{
      const base=PRICES[good]||8;
      const stock=ST.goods[good]||0;
      // multiplier: ~1.6x when stock=0 (scarcity), ~0.55x when stock>=16 (glut)
      const mult=clamp(1.6-(stock/12),0.55,1.6);
      return Math.max(1,Math.round(base*mult));
    };
    for(const s of ST.structs.values()){if(s.bp||!DEF[s.type].vendor)continue;
      // STAFFING REQUIRED: a store only operates with a working robot OR an assigned human on
      // site. Unstaffed → idle, earns nothing. Staffing is a real decision. (dealer self-runs.)
      const robo=roboWorking(s);
      if(s.roboStaffed&&roboBroken(s))continue;   // broken robot → offline
      const clerk=robo?null:ST.pawns.find(p=>p.assigned===K(s.x,s.y)&&p.hp>0&&DIST(p.px,p.py,s.x,s.y)<3.5);
      const selfRun=DEF[s.type].selfRun;
      if(!robo&&!clerk&&!selfRun){s.idle=true;s.staffedBy=null;continue;}
      s.idle=false;
      s.staffedBy=robo?"robot":(clerk?clerk.id:"self");   // who's behind the counter (for render)
      const sells=DEF[s.type].sells;
      let good=null;
      if(sells&&(ST.goods[sells]||0)>0)good=sells;
      else if(!sells){
        // generic vendors move the premium commodities first, then raw goods
        if((ST.goods.gear||0)>0)good="gear";
        else if((ST.goods.data||0)>0)good="data";
        else if((ST.goods.scrap||0)>0)good="scrap";}
      if(!good)continue;
      ST.goods[good]--;
      const price=marketPrice(good);
      // staffing quality modifies the district's take:
      //  · a CONTENT human worker present → +25% (engaged staff sell better)
      //  · a working ROBOT → reliable but flat, slightly BELOW an unstaffed baseline's potential
      //  · nobody → baseline
      let staffMul=1.0;
      if(robo)staffMul=0.85;                       // robots: reliable, but skim less than a good clerk
      else if(clerk)staffMul=(clerk.mood||50)>=55?1.25:1.05;  // a happy human on the counter sells best
      else staffMul=0.7;                            // self-run (dealer): owner hustles, lower throughput
      const cut=Math.round(price*0.4*staffMul);
      ST.income+=cut;
      if(ILLEGAL[good])ST.heat=Math.min(100,(ST.heat||0)+2);
      // citizen effects: stims → nearest stressed citizen gets fun/stress boost
      // gear → nearest ungeared citizen gets gear buff
      if(good==="stims"){
        let best=null,bd=1e9;
        for(const p of ST.pawns){const d=DIST(s.x+.5,s.y+.5,p.px,p.py);
          if(d<bd&&(p.stress>20||(p.needs.fun||0)<50)){bd=d;best=p}}
        if(best&&bd<8){
          best.needs.fun=Math.min(100,(best.needs.fun||0)+40);
          best.stress=Math.max(0,(best.stress||0)-30);
          best.addiction=Math.min(100,(best.addiction||0)+(Math.random()<0.3?4:0));
          addMod(best,"stims","Grabbed some stims",5,TPD*.4);
          float(s.x+.5,s.y+.5,"STIMS","#c98bff")}}
      else if(good==="gear"){
        let best=null,bd=1e9;
        for(const p of ST.pawns){const d=DIST(s.x+.5,s.y+.5,p.px,p.py);
          if(d<bd&&!p.hasGear){bd=d;best=p}}
        if(best&&bd<10){
          best.hasGear=true;best.gearExpiry=ST.tick+TPD*3;
          addMod(best,"gear","Got kitted out",3,TPD*.5);
          float(s.x+.5,s.y+.5,"GEARED","#7aa2ff")}}
      else float(s.x+.5,s.y+.5,"SOLD +"+cut+"c","#39ff88")}}
  if(ST.tick%30===0){genRequests();expireRequests()}
  if(ST.tick%TPD===0&&ST.tick>0)checkMilestones(); // daily milestone check
  if(ST.tick%TPD===0&&ST.tick>0&&typeof autosave==="function")autosave(); // daily autosave
  if(ST.tick%120===0)checkTier(); // district tier progression
  if(ST.tick%100===0)tickAmbient(); // background AI musings (rate-limited internally)
  if(ST.tick%40===0)tickNpcConvo(); // NPC-to-NPC dialogue when player is watching (self-gated, cheap)
  if(ST.election&&!ST.election.resolved&&ST.tick>=ST.election.voteAt)resolveElection(); // election day
  if(ST.election&&!ST.election.resolved&&ST.tick%30===0)tickElectionPitches(); // candidates campaign (AI, gated)
  // ELECTION VISUAL PRESENCE: candidates "campaign" with little performative emotes (smug/scheme/cheer)
  // so you can spot who's running on the map, without forcing them to path anywhere (no crowd-jam risk).
  if(ST.election&&!ST.election.resolved&&ST.tick%55===0){
    for(const cid of ST.election.candidates){const c=ST.pawns.find(p=>p.id===cid);
      if(c&&c.hp>0&&!c.sleeping&&Math.random()<0.5){
        const amb=c.pers.amb||50,intg=c.pers.intg||50;
        const e=intg<40?(Math.random()<0.5?"scheme":"smug"):amb>65?"party":"happy";  // schemers smirk, idealists beam
        tryEmote(c,e,90);
      }}
  }
  if(ST.tick%100===0)driveAmbience();
  if(ST.tick%50===0)checkContextualHints();
  if(ST.tick%200===0&&ST.gangs.length)gangTick();
  securityTick();
  infraTick();
  if(ST.gangs.length)crimeTick();
  if(ST.tick%TPD===0&&ST.tick>0){
    // gear expiry check
    for(const p of ST.pawns){if(p.hasGear&&ST.tick>=(p.gearExpiry||0)){p.hasGear=false;p.gearExpiry=0}}
    // daily career update (vocation satisfaction, aspiration, gripes)
    for(const p of ST.pawns)careerTick(p);
    cliqueTick();
    insurrectionTick();   // the movement vs. regime layer
    caseTick();           // investigation/mystery layer
    ageTick();          // children grow toward adulthood
    tryConception();    // stable partnered pairs may have a child
    furnitureDecayTick(); // furniture slowly wears down, occasionally breaks
    roboTick();           // store robots decay, drain upkeep, break down
    for(const p of ST.pawns)tryFurnish(p); // residents maintain & improve their homes
    // property attachment grows with tenure; wealth class mood effects
    for(const p of ST.pawns){
      if(p.home&&!p.homeless)p.attach=clamp((p.attach||0)+1,0,100);
      const wt=wealthTier(p);
      if(wt.t>=3)addMod(p,"affluent","Doing well for myself",4,TPD);
      else if(wt.t===0)addMod(p,"destitute","Got nothing to my name",-2.5,TPD);
    }
    // daily partnership check: close, compatible, single pairs may pair up
    for(let i=0;i<ST.pawns.length;i++)for(let j=i+1;j<ST.pawns.length;j++){
      const a=ST.pawns[i],b=ST.pawns[j];
      if(partnerOf(a)||partnerOf(b))continue;
      if(relGet(a.id,b.id)>=48&&Math.random()<0.25)tryFormPartnership(a,b);
    }
    genWorkPetitions();
    genExpansionPetition();
    // district upkeep: running a bigger district costs more — a gentle money sink so income
    // can't climb forever. Only "major" operator buildings cost upkeep (not every home fixture).
    {let upkeepBuildings=0;for(const s of ST.structs.values()){
      if(s.bp||!DEF[s.type])continue;const def=DEF[s.type];
      if(def.nat||def.furn||s.type==="wall"||s.type==="door"||s.type==="pod")continue;
      // only things that represent district infrastructure (work/civic/commerce/security)
      if(def.work>=140||def.civic||def.security||def.vendor)upkeepBuildings++;}
     const upkeep=Math.round(upkeepBuildings*1.5);   // ~1.5c per major building/day
     if(upkeep>0){ST.income=(ST.income||0)-upkeep;ST.lastUpkeep=upkeep;}}
    // UTILITIES — power & water. When a staffed facility exists, the block runs clean. Without one,
    // residents suffer: no power drags mood, no water drags hygiene/health. Gives "unpowered" meaning.
    {const struts=[...ST.structs.values()];
     const hasPower=struts.some(s=>!s.bp&&!(s.sabotaged>ST.tick)&&DEF[s.type]&&DEF[s.type].utility==="power"&&ST.pawns.some(p=>p.assigned===K(s.x,s.y)));
     const hasWater=struts.some(s=>!s.bp&&!(s.sabotaged>ST.tick)&&DEF[s.type]&&DEF[s.type].utility==="water"&&ST.pawns.some(p=>p.assigned===K(s.x,s.y)));
     ST.utilPower=hasPower;ST.utilWater=hasWater;
     for(const q of ST.pawns){if(isChild(q))continue;
       if(!hasPower)addMod(q,"nopower","No power on the block",-4,TPD+50);
       if(!hasWater){addMod(q,"nowater","No clean water",-3,TPD+50);if(ST.tick%TPD===0)q.needs.hyg=Math.max(8,(q.needs.hyg||50)-4);}}}
    for(const q of ST.pawns){if(isChild(q))continue;
      // ═══ ECONOMIC LOOP — daily pay, accumulating weekly rent, personality-driven leisure ═══
      // SUBSISTENCE floor so the unemployed aren't doomed (odd jobs/scavenging). Shift wages are paid
      // live on work completion elsewhere; this is the daily reconciliation.
      const subsist=q.homeless?6:9;
      q.credits=(q.credits||0)+subsist;
      // RENT accrues DAILY but is only DUE weekly (a buffer — one bad day isn't eviction). Rent scales
      // with home quality: a nicer place costs more.
      if(!q.homeless&&q.home){
        const hr=homeRoom&&homeRoom(q);const q5=hr?roomQuality(hr):3;
        const dailyRent=clamp(6+Math.round(q5*0.8),5,16);
        q.rentAccrued=(q.rentAccrued||0)+dailyRent;
      }
      // weekly rent DAY (every 7 in-game days) — settle the accrued balance
      const dayNum=Math.floor(ST.tick/TPD);
      if(!q.homeless&&q.home&&dayNum>0&&dayNum%7===0&&q.rentAccrued>0&&(q._lastRentDay||-1)!==dayNum){
        q._lastRentDay=dayNum;
        const due=q.rentAccrued;q.rentAccrued=0;
        if((q.credits||0)>=due){
          q.credits-=due;if(q.rentDebt)q.rentDebt=0;
          if(q.homeless){q.homeless=false;}
          // payday-survivors who comfortably made rent feel a flicker of security
          if((q.credits||0)>40&&Math.random()<0.3)emotionalReact(q,"relief",0.35);
        } else {
          // couldn't cover it — partial payment, the rest becomes debt toward eviction
          const shortfall=due-(q.credits||0);q.credits=0;
          q.rentDebt=(q.rentDebt||0)+1;
          if(q.rentDebt===1)log(q.name+" missed rent this week — falling behind.","warn");
          if(Math.random()<0.5)emotionalReact(q,"distress",0.45,{memory:"couldn't make rent — the eviction notice is coming"});
          if(q.rentDebt>=3){q.homeless=true;q.rentDebt=0;q.rentAccrued=0;float(q.px,q.py,"EVICTED","#ff9f2d");log(q.name+" couldn't make rent — evicted.","bad");loseProperty(q,"couldn't make rent — got evicted, sleeping rough now and it stings to lose my place");q.home=null;emotionalReact(q,"grief",0.7,{aiEvent:"you were just evicted from your home and have nowhere to sleep"});}
        }
      }
      // crisis still bites everyone a little
      if(ST.crisis)q.credits=Math.max(0,(q.credits||0)-5);
    }
    // LEISURE SPENDING is personality-driven and happens via chooseJob (recreate/bar/arcade) during the day,
    // not in this daily block — see the leisure weights in chooseJob (sociable → bar, impulsive → arcade).
    // soft collapse: track debt days
    if(ST.income<0){ST.debtDays=(ST.debtDays||0)+1;
      if(ST.debtDays===4&&!ST.crisis){ST.crisis=true;
        banner("DISTRICT IN CRISIS","bad");log("District finances collapsed — enforcers moving in, rents spiking.","bad");
        ST.heat=Math.min(100,(ST.heat||0)+30)}
      if(ST.debtDays>=6){gameOver();return}}
    else{ST.debtDays=0;
      if(ST.crisis){ST.crisis=false;ST.heat=Math.max(0,(ST.heat||0)-20);
        banner("CRISIS RESOLVED","good");log("District finances stabilized.","good")}}
    // end-of-day report petition (once a day, surfaced to overseer)
    const dayIncome=Math.round(ST.income||0);
    const sick=ST.pawns.filter(p=>p.sick).length;
    const evicted=ST.pawns.filter(p=>p.homeless).length;
    const recentCrime=DIARY_ENTRIES.filter(e=>e.day===dayN()&&(e.cat==="crime")).length;
    // track clean streak (no crime, no eviction)
    if(recentCrime===0&&evicted===0){ST.stats.cleanStreak=(ST.stats.cleanStreak||0)+1;
      ST.stats.lastCleanDay=dayN();}
    else ST.stats.cleanStreak=0;
    const summary=
      "Day "+dayN()+" report: district income "+dayIncome+"c · "+
      (evicted?"⚠ "+evicted+" evicted · ":"")+
      (sick?"⚕ "+sick+" sick · ":"")+
      (recentCrime?recentCrime+" crime incidents · ":"")+
      ST.pawns.length+" citizens.";
    log(summary,"info");
    const id=uid(),exp=ST.tick+Math.floor(TPD*.8);
    ST.requests.push({id,agentId:"district",agentName:"DISTRICT",created:ST.tick,expires:exp,
      status:"pending",kind:"dayreport",
      text:summary,
      options:[{label:"Acknowledged"}]});
    renderRequests();}
  if(ST.tick%100===0){
    if(ST.heat>0)ST.heat=Math.max(0,ST.heat-1);
    // gang heat decay
    for(const g of ST.gangs)if(g.gangHeat>0)g.gangHeat=Math.max(0,(g.gangHeat||0)-0.5);
    if(ST.heat>60&&!ST.heatWarn){ST.heatWarn=true;log("Enforcers are taking notice of the sprawl.","warn")}
    if(ST.heat<40)ST.heatWarn=false;
    if(ST.heat>60&&ST.tick-ST.lastCrackdown>TPD*0.4&&Math.random()<0.25){
      // prefer to target the hottest gang member if gangs exist
      let tgt=null,hi=-1;
      const hotGang=ST.gangs.length?ST.gangs.reduce((a,b)=>(b.gangHeat||0)>(a.gangHeat||0)?b:a,ST.gangs[0]):null;
      if(hotGang&&(hotGang.gangHeat||0)>30){
        for(const id of hotGang.crewIds){const q=ST.pawns.find(p=>p.id===id);
          if(q&&(q.rep?.gang||0)>hi){hi=q.rep?.gang||0;tgt=q}}}
      // targeting: gang heat first, then combined rep score (gang + negative city rep = heat)
      if(!tgt)for(const q of ST.pawns){
        const score=(q.rep?.gang||0)+Math.abs(Math.min(0,q.rep?.city||0));
        if(score>hi){hi=score;tgt=q}}
      if(tgt){const fine=Math.round(Math.min(70,Math.max(20,(tgt.credits||0)*0.4+20)));
        tgt.credits=(tgt.credits||0)-fine;tgt.stress=Math.min(100,(tgt.stress||0)+25);
        if(tgt.rep){tgt.rep.gang=clamp((tgt.rep.gang||0)-20,-100,100);tgt.rep.city=clamp((tgt.rep.city||0)-5,-100,100)}
        const tg=pawnGang(tgt);if(tg)tg.gangHeat=Math.max(0,(tg.gangHeat||0)-20);
        tgt.dazed=ST.tick+200;clearJob(tgt);
        float(tgt.px,tgt.py,"BUSTED -"+fine+"c","#ff4757");
        log("Enforcers swept the sprawl — "+tgt.name+" was detained and fined "+fine+"c.","bad");banner("ENFORCER CRACKDOWN","bad")}
      ST.lastCrackdown=ST.tick;ST.heat=Math.max(0,ST.heat-45)}}
  if(ST.tick%10===0){syncHUD();renderRoster()}
  if(ST.tick%25===0){renderInspectCore();renderRequests();if(typeof renderEnvoyPanel==="function")renderEnvoyPanel();}}

/* ============================================================
   RENDERING
   ============================================================ */
const cv=$("c"),ctx=cv.getContext("2d");
const oc=document.createElement("canvas"),octx=oc.getContext("2d");
const tc=document.createElement("canvas");tc.width=MW*T;tc.height=MH*T;
const tctx=tc.getContext("2d");

// ── GLOW SPRITE CACHE ──
// Pre-render soft radial glows once; stamp them with drawImage (cheap) instead of
// allocating a new gradient every fixture every frame (expensive).
const GLOW_CACHE={};
function hexToRgb(h){const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function hexA(h,a){const[r,g,b]=hexToRgb(h);return"rgba("+r+","+g+","+b+","+a+")";}
function glowSprite(hex){
  if(GLOW_CACHE[hex])return GLOW_CACHE[hex];
  const size=32,c=document.createElement("canvas");c.width=c.height=size*2;
  const g=c.getContext("2d");const[r,gn,b]=hexToRgb(hex);
  const rg=g.createRadialGradient(size,size,0,size,size,size);
  rg.addColorStop(0,`rgba(${r},${gn},${b},1)`);
  rg.addColorStop(0.35,`rgba(${r},${gn},${b},0.55)`);
  rg.addColorStop(0.7,`rgba(${r},${gn},${b},0.18)`);
  rg.addColorStop(1,`rgba(${r},${gn},${b},0)`);
  g.fillStyle=rg;g.fillRect(0,0,size*2,size*2);
  GLOW_CACHE[hex]=c;return c;
}
// stamp a cached glow centered at world (wx,wy) with given radius + alpha
function stampGlow(hex,wx,wy,radius,alpha){
  // during a lightning strike, every glow gets a brief boost so the whole map's neon "pops" on the flash
  const sg=STORM.on?STORM.flash:0;
  ctx.globalAlpha=Math.min(1,alpha*(1+sg*1.8)+sg*0.12);
  const r2=radius*(1+sg*0.25);
  ctx.drawImage(glowSprite(hex),wx-r2,wy-r2,r2*2,r2*2);
  ctx.globalAlpha=1;
}
let VW=0,VH=0,dpr=1;
const cam={x:0,y:0,z:1.6,follow:null};
// PAN TO EVENT — smoothly ease the camera to a world location when something notable happens (fire,
// mugging, caravan, brawl) so the player actually sees it instead of missing it off-screen. Sets a
// pan target that the render loop eases toward; also drops a brief ping marker at the spot.
let camPan=null;     // {x,y,t} world-tile target + ttl
let eventPing=null;  // {x,y,until,color} a pulsing ring at the event location
function panToEvent(tx,ty,color){
  // don't yank the camera if the player is actively following their operative or has something selected
  if(cam.follow)return;
  camPan={x:tx,y:ty,t:ST.tick};
  eventPing={x:tx,y:ty,until:ST.tick+TPS*4,color:color||"#ffd24a"};
}
function updateCamPan(){
  if(!camPan)return;
  if(cam.follow){camPan=null;return;}          // following takes over
  // target cam position centers the point
  const tgtX=camPan.x*T-VW/cam.z/2, tgtY=camPan.y*T-VH/cam.z/2;
  cam.x+=(tgtX-cam.x)*0.12; cam.y+=(tgtY-cam.y)*0.12;
  if(typeof clampCam==="function")clampCam();
  if(Math.abs(tgtX-cam.x)<2&&Math.abs(tgtY-cam.y)<2){cam.x=tgtX;cam.y=tgtY;camPan=null;if(typeof clampCam==="function")clampCam();}
}
// smooth camera follow — eases toward the focused wisp each frame
function tickFollow(){
  const ind=$("follow-ind");
  if(!cam.follow){if(ind&&ind.style.display!=="none")ind.style.display="none";return;}
  const p=ST.pawns.find(q=>q.id===cam.follow);
  if(!p){cam.follow=null;if(ind)ind.style.display="none";return;}   // followed wisp died/left → stop
  const tx=p.px*T-VW/cam.z/2, ty=p.py*T-VH/cam.z/2;
  const ease=0.12;                            // higher = snappier, lower = floatier
  cam.x+=(tx-cam.x)*ease;
  cam.y+=(ty-cam.y)*ease;
  clampCam();
  if(ind){ind.style.display="block";ind.textContent="◉ FOLLOWING "+p.name.toUpperCase()+"  ·  ESC to release";}
}
function setFollow(p){
  if(!p){cam.follow=null;return;}
  cam.follow=p.id;
  // center immediately-ish so the ease starts from near the target
  refreshFollowUI();
}
function stopFollow(){cam.follow=null;refreshFollowUI();}
function refreshFollowUI(){
  // update any visible FOLLOW buttons to reflect state
  const ib=$("i-follow");if(ib){const on=cam.follow&&ST.sel[0]&&ST.sel[0].id===cam.follow;
    ib.textContent=on?"◉ FOLLOWING":"◎ FOLLOW";ib.classList.toggle("on",!!on);}
}
function resize(){dpr=window.devicePixelRatio||1;
  VW=window.innerWidth;VH=window.innerHeight;
  cv.width=Math.floor(VW*dpr);cv.height=Math.floor(VH*dpr);
  cv.style.width=VW+"px";cv.style.height=VH+"px";
  oc.width=cv.width;oc.height=cv.height;clampCam()}
function clampCam(){const vw=VW/cam.z,vh=VH/cam.z;
  cam.x=clamp(cam.x,-60,Math.max(-60,MW*T-vw+60));
  cam.y=clamp(cam.y,-60,Math.max(-60,MH*T-vh+60))}
function lightLevel(h){
  if(h>=6.5&&h<18.5)return 0;
  if(h>=18.5&&h<21)return (h-18.5)/2.5*.78;
  if(h>=21||h<4.5)return .78;
  return (1-(h-4.5)/2)*.78}
// dynamic ambience: intensity blends district heat, gang tension, crime, and population bustle
function driveAmbience(){
  if(!SFX._amb)return;
  const heat=(ST.heat||0)/100;
  const gangTension=ST.gangs&&ST.gangs.length?Math.min(1,ST.gangs.reduce((s,g)=>s+(g.gangHeat||0),0)/100):0;
  const pop=ST.pawns.length;
  const bustle=clamp(pop/12,0,1)*0.5;                       // more people = busier bed
  const danger=Math.max(heat,gangTension*0.8)*0.7;
  const crisis=ST.crisis?0.3:0;
  const intensity=clamp(bustle*0.5+danger+crisis,0,1);
  SFX.ambientSet(intensity,lightLevel(hourN())/0.78);
}

function drawTerrain(){const g=tctx;
  // deep-ocean abyss backdrop — teal gradient + depth fog + edge vignette
  {const og=g.createLinearGradient(0,0,0,MH*T);
   og.addColorStop(0,"#0c2226");og.addColorStop(.45,"#07141c");og.addColorStop(1,"#02080e");
   g.fillStyle=og;g.fillRect(0,0,MW*T,MH*T);
   // soft radial fog — sense of immense downward depth
   const fg=g.createRadialGradient(MW*T*.5,MH*T*.42,0,MW*T*.5,MH*T*.42,MW*T*.62);
   fg.addColorStop(0,"rgba(24,72,78,.12)");fg.addColorStop(1,"rgba(0,0,0,0)");
   g.fillStyle=fg;g.fillRect(0,0,MW*T,MH*T);
   // vignette — darken the far edges, pull the eye inward
   const vg=g.createRadialGradient(MW*T*.5,MH*T*.5,MH*T*.32,MW*T*.5,MH*T*.5,MW*T*.6);
   vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(0,4,8,.55)");
   g.fillStyle=vg;g.fillRect(0,0,MW*T,MH*T);}
  // bioluminescent palette for surreal nature elements
  const SPORE=["#a259ff","#6b3fa8","#ff47c8","#5c2d9c"]; // violet/magenta spores
  const MUSH_CAP=["#c084fc","#f0abfc","#e879f9","#7c3aed"]; // mushroom caps
  const BIO_GLOW=["#a855f7","#d946ef","#ec4899"]; // bioluminescent glow
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const t=ST.ter[x+y*MW],X=x*T,Y=y*T;
    const h=hash2(x*3,y*7),h2=hash2(x*7,y*13),h3=hash2(x*11,y*5);
    // float on the abyss: open ground left to the gradient; roads get only a faint darker wash
    if(t===3){g.globalAlpha=.45;g.fillStyle="#04090f";g.fillRect(X,Y,T,T);g.globalAlpha=1;}
    // cracked concrete texture — thin fracture lines
    if(t!==3){
      if(h>.72){g.strokeStyle="rgba(0,8,20,.9)";g.lineWidth=.5;
        g.beginPath();g.moveTo(X+h*T,Y);g.lineTo(X+(h2*T)|0,Y+T);g.stroke()}
      if(h2>.68&&h>.45){g.strokeStyle="rgba(0,8,20,.8)";g.lineWidth=.5;
        g.beginPath();g.moveTo(X,Y+h3*T);g.lineTo(X+T,Y+(h*T)|0);g.stroke()}}
    // bioluminescent seep through cracks — violet/magenta
    if(t!==3&&h3>.82){
      const sCol=SPORE[(h2*4)|0];
      const sx=X+(h*T*.8)|0,sy=Y+(h2*T*.8)|0;
      const sg=g.createRadialGradient(sx,sy,0,sx,sy,5);
      sg.addColorStop(0,sCol.replace(")",",0.35)").replace("rgb","rgba"));
      sg.addColorStop(1,"rgba(0,0,0,0)");
      g.globalAlpha=.5;g.fillStyle=sg;g.beginPath();g.arc(sx,sy,5,0,7);g.fill();g.globalAlpha=1;
      // glowing pixel at the brightest point
      g.fillStyle="rgba(200,150,255,.6)";g.fillRect(sx,sy,1,1)}
    // subtle grid lines — infrastructure feel
    // (grid seam removed — open abyss has no visible tile grid)
    // mushroom clusters — surreal nature on walkable tiles
    if(t!==3&&hash2(x*17,y*19)>.80){
      const cx=X+T/2,cy=Y+T/2;
      const count=2+((h3*3)|0); // 2-4 mushrooms per cluster
      for(let i=0;i<count;i++){
        const mx=cx+(((h*(i+1)*7)%1)-.5)*T*.7,my=cy+(((h2*(i+1)*5)%1)-.3)*T*.5;
        const mh=T*.22+(h2*i*.15); // stem height variation
        const capW=T*.18+(h*i*.08),capC=MUSH_CAP[((h+h2+i)%1*4)|0];
        // stem — thin, slight lean
        g.strokeStyle="rgba(140,100,180,.65)";g.lineWidth=1.2;
        g.beginPath();g.moveTo(mx,my);g.lineTo(mx+(h-.5)*2,my-mh);g.stroke();
        // cap
        const cr=g.createRadialGradient(mx,my-mh,0,mx,my-mh,capW);
        cr.addColorStop(0,capC);cr.addColorStop(.6,capC.replace(")",",0.7)").replace("#","rgba(").replace(/([0-9a-f]{2})/gi,(m,p,o)=>o>0&&o%2===0&&o<7?parseInt(m,16)+",":""));
        cr.addColorStop(1,"rgba(0,0,0,0)");
        g.globalAlpha=.72;g.fillStyle=capC;
        g.beginPath();g.ellipse(mx,my-mh,capW,capW*.45,0,0,7);g.fill();
        // bioluminescent underside glow
        const gg=g.createRadialGradient(mx,my-mh+2,0,mx,my-mh+2,capW*.8);
        gg.addColorStop(0,BIO_GLOW[(i%3)].replace(")",",0.22)").replace("rgb","rgba"));
        gg.addColorStop(1,"rgba(0,0,0,0)");
        g.fillStyle=gg;g.beginPath();g.ellipse(mx,my-mh+2,capW*.8,capW*.3,0,0,7);g.fill();
        g.globalAlpha=1}}}
  // infrastructure grid overlay removed — abyss stays open; faint world-edge only
  g.strokeStyle="rgba(0,212,255,.05)";g.lineWidth=.4;g.strokeRect(.5,.5,MW*T-1,MH*T-1);

  // ── ROAD NETWORK (procedural, scales with map) ──
  // Arterials defined once in ROADS (module-level) so streets line up with the core.
  const roadSet=new Set();
  ROADS.h.forEach(([x0,x1,ry])=>{for(let rx=x0;rx<=x1;rx++){roadSet.add(rx+ry*MW);roadSet.add(rx+(ry+1)*MW)}});
  ROADS.v.forEach(([rx,y0,y1])=>{for(let ry=y0;ry<=y1;ry++){roadSet.add(rx+ry*MW);roadSet.add((rx+1)+ry*MW)}});

  // asphalt base
  for(const k of roadSet){const rx=k%MW,ry=(k/MW)|0;
    const X=rx*T,Y=ry*T;
    g.fillStyle="#04060c";g.fillRect(X,Y,T,T);
    const hv=hash2(rx*5,ry*9);
    if(hv>.6){g.fillStyle="rgba(255,255,255,.015)";g.fillRect(X,Y,T,T)}}

  // sidewalk curbs + center/edge lines per horizontal arterial
  ROADS.h.forEach(([x0,x1,ry])=>{
    const px0=x0*T,px1=(x1+1)*T;
    // curb edges
    g.strokeStyle="rgba(180,200,220,.22)";g.lineWidth=1;
    g.beginPath();g.moveTo(px0,ry*T);g.lineTo(px1,ry*T);g.stroke();
    g.beginPath();g.moveTo(px0,(ry+2)*T);g.lineTo(px1,(ry+2)*T);g.stroke();
    // dashed yellow centerline
    g.strokeStyle="rgba(255,180,0,.32)";g.lineWidth=1;g.setLineDash([T*.6,T*.8]);
    g.beginPath();g.moveTo(px0,(ry+1)*T+.5);g.lineTo(px1,(ry+1)*T+.5);g.stroke();
    g.setLineDash([]);
    // white edge lines
    g.strokeStyle="rgba(255,255,255,.1)";g.lineWidth=.8;
    g.beginPath();g.moveTo(px0,ry*T+1);g.lineTo(px1,ry*T+1);g.stroke();
    g.beginPath();g.moveTo(px0,(ry+2)*T-1);g.lineTo(px1,(ry+2)*T-1);g.stroke();});
  // vertical arterial centerlines
  ROADS.v.forEach(([rx,y0,y1])=>{
    g.strokeStyle="rgba(255,180,0,.3)";g.lineWidth=1;g.setLineDash([T*.6,T*.8]);
    g.beginPath();g.moveTo((rx+1)*T+.5,y0*T);g.lineTo((rx+1)*T+.5,(y1+1)*T);g.stroke();
    g.setLineDash([]);});

  // manholes + drains + puddles spaced along horizontal arterials
  ROADS.h.forEach(([x0,x1,ry])=>{
    for(let mx=x0+6;mx<x1;mx+=14){
      const X=mx*T+T/2,Y=ry*T+T;
      g.fillStyle="#060a14";g.beginPath();g.arc(X,Y,5,0,7);g.fill();
      g.strokeStyle="rgba(100,130,160,.5)";g.lineWidth=.8;g.beginPath();g.arc(X,Y,5,0,7);g.stroke();
      g.strokeStyle="rgba(80,100,130,.4)";
      for(let i=0;i<4;i++){const a=i*Math.PI/4;
        g.beginPath();g.moveTo(X+Math.cos(a)*2,Y+Math.sin(a)*2);g.lineTo(X+Math.cos(a)*4.5,Y+Math.sin(a)*4.5);g.stroke()}}
    for(let px=x0+3;px<x1;px+=18){
      const hv=hash2(px*3,ry*7);if(hv<.4)continue;
      const X=px*T,Y=ry*T+T*1.3;
      const rg=g.createRadialGradient(X+T*.4,Y,0,X+T*.4,Y,T*.7);
      rg.addColorStop(0,"rgba(0,180,255,.06)");rg.addColorStop(1,"rgba(0,0,0,0)");
      g.globalAlpha=.5+hv*.3;g.fillStyle=rg;
      g.beginPath();g.ellipse(X+T*.4,Y+T*.3,T*.6,T*.2,0,0,7);g.fill();g.globalAlpha=1}});

  // ── GRAFFITI removed for the clean suspended look ──
  const grafSpots=[];
  grafSpots.forEach(({x,y,tag,col,angle})=>{
    const X=x*T,Y=y*T+T*.6;
    g.save();g.translate(X,Y);g.rotate(angle);
    g.globalAlpha=.55;g.fillStyle=col;
    g.font="bold 7px monospace";g.fillText(tag,0,0);
    g.globalAlpha=.2;g.fillStyle=col;
    for(let i=0;i<tag.length;i+=3){const hd=hash2(x+i,y);if(hd>.65)g.fillRect(i*4.2,2,1,2+hd*4)}
    g.globalAlpha=1;g.restore()});

  // ── GROUND LITTER — scattered debris on walkable ground, baked into the static terrain (zero per-frame cost,
  //    deterministic per tile so it never flickers). The AMOUNT scales inversely with district prosperity: a
  //    thriving block is clean, a failing one is strewn with trash. So litter doubles as a visual health signal.
  {const prosp=(typeof prosperity==="function")?prosperity():50;
   const litterDensity=clamp((100-prosp)/100,0.08,0.85);   // poor district → more litter
   const LITTER_COL=["#3a3320","#2e2a1e","#403a2a","#2a2418","#38301f"];  // muted browns/grays — trash, not glowing
   for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
     const t=ST.ter[x+y*MW];
     // litter on walkable ground + roads (trash blows onto streets); skip water/abyss tiles
     if(t===0||t===3){
       const lh=hash2(x*23,y*29);              // a different hash basis than cracks/mushrooms so it scatters independently
       if(lh < litterDensity*0.22){            // only a fraction of eligible tiles get a piece
         const X=x*T,Y=y*T;
         const lh2=hash2(x*31,y*37),lh3=hash2(x*13,y*41);
         const lx=X+2+lh2*(T-4), ly=Y+2+lh3*(T-4);
         const col=LITTER_COL[(lh2*5)|0];
         const kind=(lh3*3)|0;
         g.globalAlpha=0.35+lh*0.25;
         if(kind===0){ // a small scrap / wrapper — a tiny angular blot
           g.fillStyle=col;g.fillRect(lx,ly,2,1);g.fillRect(lx+1,ly+1,1,1);
         }else if(kind===1){ // a bottle/can — a thin vertical sliver with a faint highlight
           g.fillStyle=col;g.fillRect(lx,ly,1,3);
           g.globalAlpha*=0.5;g.fillStyle="rgba(120,140,150,.5)";g.fillRect(lx,ly,1,1);
         }else{ // a debris cluster — a couple of scattered pixels
           g.fillStyle=col;g.fillRect(lx,ly,1,1);g.fillRect(lx+2,ly+1,1,1);
           if(lh>0.6)g.fillRect(lx+1,ly-1,1,1);
         }
         g.globalAlpha=1;
       }
     }
   }}
}
function rr(x,y,w,h,col){ctx.fillStyle=col;ctx.fillRect(x,y,w,h)}
const PODTH={
  work:{c:"#2ee89a",fill:"rgba(46,232,154,.10)"},
  den:{c:"#a06bff",fill:"rgba(160,107,255,.10)"},
  med:{c:"#00e0c8",fill:"rgba(0,224,200,.10)"},
  exchange:{c:"#ffd86a",fill:"rgba(255,216,106,.09)"},
  civic:{c:"#7aa2ff",fill:"rgba(122,162,255,.10)"},
  toxic:{c:"#ff3db0",fill:"rgba(255,61,176,.11)"}};
function rrect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
/* ============================================================
   ROOM QUALITY — a room's space, beauty, and
   upkeep combine into a quality score that affects how it LOOKS and
   how its occupants FEEL. Computed lazily + cached per room per day.
   ============================================================ */
// beauty contribution per furniture/decor type (the "nice things" in a room)
const ROOM_BEAUTY={art:14,bookshelf:8,couch:7,rug:5,tv:4,lamp:3,gym:3,pod:2,
  fridge:2,shower:1,toilet:1};
function structsInRoom(rm){
  const out=[];
  for(const s of ST.structs.values()){if(s.bp)continue;
    if(s.x>=rm.x0&&s.x<rm.x0+rm.w&&s.y>=rm.y0&&s.y<rm.y0+rm.h)out.push(s);}
  return out;
}
function roomOccupants(rm){
  return ST.pawns.filter(p=>p.home&&p.home.x0===rm.x0&&p.home.y0===rm.y0);
}
// compute a 0..100 quality score: space (room not cramped) + beauty (nice furniture,
// scaled by quality tier) − penalties (broken items, squalor). Cached on rm.qual/qualDay.
function computeRoomQuality(rm){
  const area=rm.w*rm.h;
  const occ=Math.max(1,roomOccupants(rm).length);
  const items=structsInRoom(rm);
  // SPACE: comfortable at ~9 tiles/occupant, cramped below, diminishing returns above
  const perCap=area/occ;
  let space=clamp((perCap-4)/8*40,0,40);            // 0 at ≤4 tiles, ~40 at ~12+/occupant
  // BEAUTY: sum of furniture beauty, scaled by each item's quality tier; broken = negative
  let beauty=0,broken=0;
  for(const s of items){
    const b=ROOM_BEAUTY[s.type];if(!b)continue;
    if(isBroken(s)){broken++;beauty-=4;continue;}
    const q=isFurniture(s)?qualOf(s).effMul:1;
    beauty+=b*q;
  }
  beauty=clamp(beauty,0,55);
  // UPKEEP penalty: broken things drag a room down hard
  const upkeep=clamp(broken*6,0,20);
  const score=clamp(Math.round(space+beauty+15-upkeep),0,100);  // +15 base "it's a home"
  return score;
}
function roomQuality(rm){
  const today=dayN();
  if(rm.qualDay===today&&rm.qual!=null)return rm.qual;
  rm.qual=computeRoomQuality(rm);rm.qualDay=today;
  return rm.qual;
}
// quality tier label/color for UI + visual richness
const ROOMQ_TIERS=[
  {min:0, name:"Squalid",   c:"#ff4757"},
  {min:25,name:"Drab",      c:"#ff8c42"},
  {min:45,name:"Decent",    c:"#ffd84a"},
  {min:65,name:"Pleasant",  c:"#39ff88"},
  {min:82,name:"Luxurious", c:"#7af7ff"},
];
function roomQTier(q){let t=ROOMQ_TIERS[0];for(const r of ROOMQ_TIERS)if(q>=r.min)t=r;return t;}
// the home a pawn lives in, as a room object (for mood hook)
function homeRoom(p){
  if(!p.home)return null;
  for(const rm of (ST.rooms||[]))if(rm.x0===p.home.x0&&rm.y0===p.home.y0)return rm;
  return null;
}
function drawPod(rm){const th=PODTH[rm.theme]||PODTH.den;
  const X=rm.x0*T+1,Y=rm.y0*T+1,W=rm.w*T-2,H=rm.h*T-2;
  const q=roomQuality(rm);const qt=roomQTier(q);
  const qf=clamp(q/100,0,1);                 // 0..1 quality factor drives richness
  ctx.save();
  // faint themed wash — glass pane over the abyss
  ctx.globalAlpha=0.05+qf*0.06;ctx.fillStyle=th.c;rrect(X,Y,W,H,8);ctx.fill();ctx.globalAlpha=1;
  // INNER LUMINANCE — soft radial glow rising from the room's heart, tinted to theme
  stampGlow(th.c,X+W/2,Y+H/2,Math.max(W,H)*0.55,0.05+qf*0.06);
  // LAYERED NEON BORDER — wide soft halo, then a tight bright line (glossier with quality)
  ctx.strokeStyle=th.c;ctx.shadowColor=th.c;
  ctx.shadowBlur=13+qf*9;ctx.globalAlpha=.42;ctx.lineWidth=2.4;rrect(X,Y,W,H,8);ctx.stroke();
  ctx.shadowBlur=5+qf*5;ctx.globalAlpha=.95;ctx.lineWidth=1.6;rrect(X,Y,W,H,8);ctx.stroke();
  ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.lineWidth=1;
  // inner secondary line
  ctx.globalAlpha=.2;ctx.lineWidth=.8;
  rrect(X+3,Y+3,W-6,H-6,6);ctx.stroke();
  // animated corner accent nodes — pulsing neon studs with a glow (animated trim)
  {const tt=performance.now()*0.001, pls=0.5+0.5*Math.sin(tt*2.4+X*0.05+Y*0.03);
   const r=1.3+pls*0.7;ctx.fillStyle=qt.c;
   for(const [cx,cy] of [[X,Y],[X+W,Y],[X,Y+H],[X+W,Y+H]]){
     if(q>=45){ctx.globalAlpha=(.3+.45*pls);ctx.drawImage(glowSprite(qt.c),cx-5,cy-5,10,10);}
     ctx.globalAlpha=(.45+qf*.4)*(0.55+0.45*pls);ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fill();}}
  ctx.globalAlpha=1;ctx.lineWidth=1;ctx.restore()}
function drawRoomStruct(s){
  // walls are drawn by the room outline already — skip them
  if(s.type==="wall")return;
  // subtle emissive lift so fixtures read as luminous (richer furniture)
  if(DEF[s.type]&&DEF[s.type].furn){const gX=s.x*T,gY=s.y*T;stampGlow("#3aa0c8",gX+T/2,gY+T/2,T*.5,.07);}
  // draw full fixture art for everything else
  // temporarily clear inRoom flag so drawStruct renders the full sprite
  s.inRoom=false;
  drawStruct(s);
  s.inRoom=true;}
// ── OPTIONAL SPRITE LAYER ──────────────────────────────────────────────
// Buildings can OPTIONALLY use a pixel-art image sprite instead of live vector art.
// This is purely additive: if a sprite for a type isn't registered or hasn't loaded,
// drawStruct falls back to the existing vector switch. Sprites are small transparent
// PNGs in ./sprites/, lazily loaded once and cached. Nothing breaks if the folder is absent.
const SPRITE_SRC={
  // Optional building sprites. Empty by default — the vector renderer is the chosen path for
  // buildings (sprites clashed with the top-down projection). The layer below stays as harmless
  // infrastructure in case a single hero/landmark asset is ever wanted; add "type":"file.png" to use.
};
const _spriteCache={};   // type -> {img, ready:bool, failed:bool}
function getSprite(type){
  if(!SPRITE_SRC[type]||typeof Image==="undefined")return null;
  let e=_spriteCache[type];
  if(e)return e.ready?e:null;            // loaded (or still loading/failed)
  // begin lazy load
  e={img:new Image(),ready:false,failed:false};
  _spriteCache[type]=e;
  e.img.onload=()=>{e.ready=true;};
  e.img.onerror=()=>{e.failed=true;};   // missing file → silently keep using vector art
  e.img.src="sprites/"+SPRITE_SRC[type];
  return null;                           // not ready this frame; vector art draws
}
// draw a building's sprite scaled to its tile footprint (1 tile unless DEF.spriteTiles set)
function drawSprite(s,e){
  const def=DEF[s.type]||{};
  const tw=(def.spriteTiles&&def.spriteTiles[0])||1;
  const th=(def.spriteTiles&&def.spriteTiles[1])||1;
  const X=s.x*T,Y=s.y*T;
  ctx.imageSmoothingEnabled=false;       // crisp pixel art
  ctx.drawImage(e.img,X,Y,T*tw,T*th);
  ctx.imageSmoothingEnabled=true;
}
function drawStruct(s){const X=s.x*T,Y=s.y*T;
  if(s.surgeT&&ST.tick<s.surgeT){
    ctx.fillStyle="rgba(255,201,71,.08)";ctx.fillRect(X,Y,T,T);
    ctx.strokeStyle="rgba(255,201,71,.5)";ctx.setLineDash([2,3]);
    ctx.strokeRect(X+.5,Y+.5,T-1,T-1);ctx.setLineDash([]);
    ctx.fillStyle="#ffc947";ctx.font="8px monospace";ctx.textAlign="center";
    ctx.fillText("!",X+T/2,Y+T/2+3);ctx.textAlign="left";return}
  if(s.inRoom&&!s.bp&&!s.desig&&!s.decon)return drawRoomStruct(s);
  if(s.bp){
    const phase=performance.now()*0.003;
    ctx.fillStyle="rgba(0,212,255,.07)";ctx.fillRect(X+1,Y+1,T-2,T-2);
    ctx.strokeStyle="rgba(0,212,255,.5)";ctx.setLineDash([3,3]);
    ctx.strokeRect(X+1.5,Y+1.5,T-3,T-3);ctx.setLineDash([]);
    if(s.prog>0){
      for(let i=0;i<3;i++){const sp=(phase+i*2.1)%1;
        const sx=X+4+((s.x*7+i*5)%(T-8));const sy=Y+4+((s.y*5+i*4)%(T-8));
        ctx.globalAlpha=Math.abs(Math.sin(phase*3+i));
        ctx.fillStyle="#00d4ff";ctx.fillRect(sx,sy,1,1);ctx.globalAlpha=1;}
      ctx.fillStyle="#00d4ff";ctx.fillRect(X+2,Y+T-4,(T-4)*clamp(s.prog/s.need,0,1),2)}}
  else{
    const t=performance.now()*0.001;
    // optional sprite: if a pixel-art sprite is registered AND loaded, draw it and skip
    // the vector switch. Overlays (HP bar, broken/quality marks) still draw below.
    const spr=getSprite(s.type);
    if(spr){drawSprite(s,spr);}
    else
    switch(s.type){
    case "ruin":
      rr(X,Y,T,T,"#14101a");rr(X+1,Y+1,T-2,3,"#24202a");
      rr(X+2,Y+6,5,3,"#1c181e");rr(X+9,Y+10,5,3,"#1c181e");
      rr(X+3,Y+9,3,2,"#14101a");ctx.fillStyle="rgba(162,89,255,.12)";ctx.fillRect(X+4,Y+11,4,2);break;
    case "scrap":
      rr(X+2,Y+6,12,8,"#2c3040");rr(X+1,Y+9,9,6,"#363d50");
      rr(X+7,Y+4,7,7,"#252d3c");rr(X+5,Y+7,2,2,"#ff8c42");rr(X+11,Y+11,2,2,"#ff8c42");
      rr(X+3,Y+11,3,1,"#4a5568");rr(X+10,Y+6,2,2,"#4a5568");break;
    case "cache":
      rr(X+2,Y+3,12,11,"#4a3f22");rr(X+2,Y+8,12,2,"#332c18");rr(X+7,Y+3,2,11,"#332c18");
      rr(X+3,Y+4,3,3,"#665530");rr(X+9,Y+4,3,3,"#665530");
      ctx.fillStyle="#ffc947";ctx.fillRect(X+4,Y+13,2,1);break;
    case "wall":{
      const wN=structAt(s.x,s.y-1),wS=structAt(s.x,s.y+1);
      const wE=structAt(s.x+1,s.y),wW=structAt(s.x-1,s.y);
      const isW=ss=>ss&&(ss.type==="wall"||ss.type==="door");
      rr(X,Y,T,T,"#0c1020");// darker base for contrast
      // structural edge shading
      if(!isW(wN))rr(X+1,Y,T-2,2,"#1a2748");
      if(!isW(wS))rr(X+1,Y+T-2,T-2,2,"#080c18");
      if(!isW(wE))rr(X+T-2,Y+1,2,T-2,"#101a30");
      if(!isW(wW))rr(X,Y+1,2,T-2,"#162240");
      // neon emissive accent line — themed to the room this wall belongs to
      const wth=PODTH[s.rth];
      if(wth){
        const ne=hexToRgb(wth.c);const pulse=0.5+0.5*Math.sin(t*1.2+(s.x+s.y)*.4);
        // thin glowing strip along the interior-facing top edge
        ctx.globalAlpha=0.35+0.25*pulse;
        ctx.fillStyle=`rgba(${ne[0]},${ne[1]},${ne[2]},1)`;
        ctx.fillRect(X+2,Y+T-3,T-4,1);
        ctx.globalAlpha=1;
        // corner glow nodes where walls meet
        if((!isW(wN)&&!isW(wW))||(!isW(wN)&&!isW(wE))||(!isW(wS)&&!isW(wW))||(!isW(wS)&&!isW(wE))){
          stampGlow(wth.c,X+T/2,Y+T/2,5,0.18*pulse);}
      }
      rr(X+3,Y+6,T-6,1,"rgba(0,0,0,.35)");rr(X+3,Y+11,T-6,1,"rgba(0,0,0,.25)");
      if(s.hp<s.maxHp){ctx.strokeStyle="rgba(255,61,90,.4)";ctx.lineWidth=.7;
        ctx.beginPath();ctx.moveTo(X+T*.3,Y+T*.2);ctx.lineTo(X+T*.55,Y+T*.7);ctx.stroke();ctx.lineWidth=1;}
      break;}
    case "door":{
      // futuristic sliding blast door — parts from the centre when a citizen nears, glowing portal behind
      const cx=X+T/2, innerX=X+2, innerY=Y+3, innerW=T-4, innerH=T-6, half=innerW/2;
      const near=ST.pawns.some(p=>DIST(p.px,p.py,s.x+.5,s.y+.5)<2.4);
      const tgt=near?1:0;
      s._do=(s._do==null)?tgt:s._do+(tgt-s._do)*0.16;       // smooth open/close each frame
      const o=clamp(s._do,0,1), ease=o*o*(3-2*o);            // smoothstep panel travel
      const aCol=near?"#00e5ff":"#0c3a5a";
      rr(X,Y,T,T,"#0a1322");                                  // housing
      // glowing portal core revealed as the panels part
      if(o>0.02){const pg=ctx.createRadialGradient(cx,Y+T/2,0,cx,Y+T/2,half+1);
        pg.addColorStop(0,"rgba(130,242,255,"+(0.55*o).toFixed(3)+")");
        pg.addColorStop(1,"rgba(0,40,70,0)");
        ctx.fillStyle=pg;ctx.fillRect(innerX,innerY,innerW,innerH);}
      // two sliding panels parting from the centre
      const gap=ease*half, pw=Math.max(0,half-gap);
      if(pw>0){ctx.fillStyle="#13243c";
        ctx.fillRect(innerX,innerY,pw,innerH);               // left panel
        ctx.fillRect(cx+gap,innerY,pw,innerH);               // right panel
        ctx.strokeStyle=aCol;ctx.lineWidth=1;ctx.globalAlpha=.55+.45*o;
        ctx.beginPath();ctx.moveTo(cx-gap,innerY);ctx.lineTo(cx-gap,innerY+innerH);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx+gap,innerY);ctx.lineTo(cx+gap,innerY+innerH);ctx.stroke();
        ctx.globalAlpha=1;}
      // housing frame glow — brighter when open
      ctx.strokeStyle=aCol;ctx.lineWidth=1.3;ctx.globalAlpha=.45+.45*o;
      rrect(X+1.5,Y+1.5,T-3,T-3,3);ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=1;break;}
    case "pod":
      rr(X+1,Y+3,T-2,T-6,"#0e1826");rr(X+2,Y+4,T-4,T-8,"#070c16");
      rr(X+3,Y+5,4,T-10,"#1a2e48");
      ctx.strokeStyle=s.owner?"#39ff88":"#162838";ctx.lineWidth=1.2;
      ctx.strokeRect(X+1.5,Y+3.5,T-3,T-7);
      if(s.owner){ctx.fillStyle="rgba(57,255,136,.08)";ctx.fillRect(X+2,Y+4,T-4,T-8);}
      ctx.lineWidth=1;break;
    case "lamp":{
      rr(X+T/2-1,Y+5,2,T-7,"#242e48");rr(X+T/2-4,Y+3,8,3,"#303c5a");
      const flk=0.88+0.12*Math.sin(t*11.3+s.x);
      stampGlow("#ffc850",X+T/2,Y+4,T*.7,flk*.6);
      ctx.fillStyle="#ffe0a0";ctx.fillRect(X+T/2-3,Y+3,6,3);break;}
    case "fridge":
      rr(X+3,Y+1,T-6,T-2,"#1c2836");rr(X+4,Y+2,T-8,5,"#243040");rr(X+4,Y+8,T-8,6,"#1e2c3c");
      rr(X+10,Y+3,1,3,"#5a7aaa");rr(X+10,Y+9,1,3,"#5a7aaa");
      rr(X+5,Y+2,2,1,"#39ff88");rr(X+4,Y+7,T-8,1,"rgba(0,0,0,.35)");break;
    case "toilet":
      rr(X+4,Y+2,8,3,"#263040");rr(X+4,Y+5,8,7,"#304055");rr(X+3,Y+10,10,3,"#1a2230");
      rr(X+5,Y+3,6,1,"rgba(150,200,255,.12)");break;
    case "shower":
      rr(X+3,Y+2,T-6,T-3,"#101c28");
      for(let i=0;i<4;i++){const dy=(t*3+i*.7)%1;
        ctx.globalAlpha=.35+.25*Math.sin(t*4+i);ctx.fillStyle="#5a8aee";
        ctx.fillRect(X+5+i*3,(Y+4+dy*(T-7))|0,1,2);}
      ctx.globalAlpha=1;rr(X+T/2-1,Y+2,2,2,"#8aa4c8");break;
    case "tv":{
      rr(X+2,Y+3,T-4,9,"#04080e");rr(X+3,Y+4,T-6,7,"#071220");
      const scanY=((t*18)%(T-8))|0;
      ctx.fillStyle="rgba(0,212,255,.14)";ctx.fillRect(X+3,Y+4+scanY,T-6,1);
      for(let i=0;i<3;i++)rr(X+4,Y+5+i*2,T-8,1,"rgba(0,212,255,.07)");
      ctx.fillStyle="rgba(0,212,255,.55)";ctx.fillRect(X+4,Y+5,T-8,1);
      rr(X+T/2-1,Y+12,2,2,"#202a40");break;}
    case "gym":
      rr(X+2,Y+4,2,8,"#202e44");rr(X+T-4,Y+4,2,8,"#202e44");
      rr(X+2,Y+4,T-4,1,"#5a7aaa");rr(X+4,Y+8,T-8,3,"#141e30");
      rr(X+5,Y+5,2,2,"#ff8c42");rr(X+T-7,Y+5,2,2,"#ff8c42");break;
    case "workstation":{
      stampGlow("#00d4ff",X+T/2,Y+6,T*.5,0.22);// emissive screen bloom
      rr(X+2,Y+9,T-4,4,"#101828");rr(X+4,Y+3,T-8,6,"#04080e");rr(X+5,Y+4,T-10,4,"#07122a");
      const sc=((t*12)%4)|0;
      rr(X+5,Y+4+sc,T-10,1,"rgba(0,212,255,.3)");
      rr(X+5,Y+5,T-10,1,"rgba(0,212,255,.18)");rr(X+5,Y+7,T-10,1,"rgba(0,212,255,.08)");
      ctx.fillStyle="#00efff";ctx.fillRect(X+6,Y+5,T-12,1);
      rr(X+7,Y+10,3,2,"#182034");break;}
    case "counter":
      rr(X+2,Y+6,T-4,7,"#1c1626");rr(X+2,Y+5,T-4,2,"#302040");
      rr(X+9,Y+2,4,3,"#201830");rr(X+10,Y+3,2,1,"#39ff88");
      rr(X+3,Y+7,2,4,"rgba(255,255,255,.03)");break;
    case "bar":{
      rr(X+2,Y+6,T-4,7,"#120a18");rr(X+2,Y+5,T-4,2,"#200e1a");
      const bc=(t*.6)%1;
      const bCol="hsl("+((bc*360)|0)+",100%,62%)";
      stampGlow("#e040fb",X+T/2,Y+5,T*.55,0.2);// neon sign bloom
      rr(X+2,Y+5,T-4,1,bCol);
      rr(X+4,Y+2,1,3,"#39ff88");rr(X+7,Y+2,1,3,"#00d4ff");rr(X+10,Y+2,1,3,"#ffc947");
      rr(X+4,Y+1,2,1,"#39ff88");rr(X+7,Y+1,2,1,"#00d4ff");rr(X+10,Y+1,2,1,"#ffc947");
      break;}
    case "medbed":{
      stampGlow("#39ff88",X+T/2,Y+8,T*.5,0.14);// vital monitor bloom
      rr(X+2,Y+5,T-4,8,"#0c1c1c");rr(X+3,Y+6,T-6,5,"#142e28");
      const hbp=(t*1.8)%1;
      ctx.strokeStyle="#39ff88";ctx.lineWidth=1.1;
      ctx.beginPath();
      const hbW=T-6,hbX=X+3,hbY=Y+8;
      for(let i=0;i<=hbW;i++){const f=((i/hbW+hbp)%1);
        const spike=f>0.4&&f<0.5?-(Math.sin((f-0.4)/0.1*Math.PI)*4.5):
          f>0.5&&f<0.55?(Math.sin((f-0.5)/0.05*Math.PI)*1.8):0;
        i===0?ctx.moveTo(hbX+i,hbY+spike):ctx.lineTo(hbX+i,hbY+spike);}
      ctx.stroke();ctx.lineWidth=1;
      rr(X+3,Y+5,T-6,1,"#00d4ff");
      ctx.fillStyle="rgba(57,255,136,.07)";ctx.fillRect(X+3,Y+6,T-6,5);break;}
    case "dealer":{
      const dp=0.5+0.5*Math.sin(t*2.5);
      stampGlow("#e040fb",X+8,Y+10,T*.5,dp*.22);
      rr(X+5,Y+6,6,7,"#0e0a14");rr(X+5,Y+6,6,2,"#200e20");
      rr(X+6,Y+9,4,2,"#ff5ffb");rr(X+7,Y+4,2,2,"#160e1c");break;}
    case "housing":
      rr(X+2,Y+2,T-4,T-4,"#101828");rr(X+4,Y+4,T-8,T-8,"#080e1c");
      ctx.fillStyle="#39ff88";ctx.fillRect(X+T/2-1,Y+3,2,5);ctx.fillRect(X+3,Y+T/2-1,5,2);
      ctx.fillStyle="#00d4ff";ctx.fillRect(X+T-5,Y+T/2-1,2,2);break;
    case "chemlab":{
      rr(X+2,Y+2,T-4,T-4,"#0c1614");
      rr(X+4,Y+5,4,7,"#0a1c12");rr(X+9,Y+5,4,7,"#0a1c12");
      rr(X+4,Y+4,8,2,"#142a1e");
      const bub=(t*2.2+s.x)%1;
      ctx.globalAlpha=.75;ctx.fillStyle="#39ff88";
      ctx.fillRect(X+6,(Y+10-bub*4)|0,2,2);
      ctx.fillStyle="#b8ff5e";ctx.fillRect(X+11,(Y+8-bub*3)|0,1,2);
      ctx.globalAlpha=1;
      rr(X+5,Y+4,7,1,"#203c2c");ctx.fillStyle="#b8ff5e";
      ctx.fillRect(X+6,Y+11,1,2);ctx.fillRect(X+10,Y+11,1,2);break;}
    case "workshop":{
      rr(X+2,Y+2,T-4,T-4,"#141210");
      rr(X+3,Y+9,4,4,"#222010");rr(X+10,Y+7,3,2,"#ff8c42");
      rr(X+6,Y+4,5,3,"#2c2810");
      const sp=(t*8+s.y)%1;
      if(sp<0.3){ctx.globalAlpha=sp/.3;ctx.fillStyle="#ffe08a";
        ctx.fillRect(X+5+((sp*20)|0),Y+11+((sp*10)|0)%3,1,1);ctx.globalAlpha=1;}
      rr(X+4,Y+12,3,2,"#ffc947");break;}
    case "stimlab":{
      rr(X+2,Y+2,T-4,T-4,"#0e0818");rr(X+6,Y+4,5,8,"#220e30");
      rr(X+5,Y+3,7,2,"#180c22");
      const glow=0.5+0.5*Math.sin(t*3.2);
      stampGlow("#c864ff",X+8,Y+8,T*.5,glow*.3);
      ctx.globalAlpha=glow*.85;ctx.fillStyle="#d8a0ff";ctx.fillRect(X+7,Y+6,3,4);
      ctx.globalAlpha=1;ctx.fillStyle="#e040fb";ctx.fillRect(X+8,Y+11,2,2);break;}
    case "gearshop":{
      rr(X+2,Y+2,T-4,T-4,"#0a1016");rr(X+4,Y+8,T-8,5,"#0e1822");
      rr(X+5,Y+4,T-10,4,"#081218");
      ctx.strokeStyle="#7aa2ff";ctx.lineWidth=1.1;
      ctx.beginPath();
      for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/6;
        i===0?ctx.moveTo(X+8+4*Math.cos(a),Y+6+4*Math.sin(a)):
          ctx.lineTo(X+8+4*Math.cos(a),Y+6+4*Math.sin(a));}
      ctx.closePath();ctx.stroke();ctx.lineWidth=1;
      ctx.fillStyle="#7aa2ff";ctx.fillRect(X+6,Y+5,5,2);
      ctx.fillStyle="#39ff88";ctx.fillRect(X+11,Y+9,2,2);break;}
    // ── RESOURCE PRODUCTION ──
    case "sporevat":{
      const vt=vatTier(s),tier=s.tier||1;
      rr(X+2,Y+2,T-4,T-4,"#0c0f1a");                          // tank housing
      ctx.strokeStyle=vt.core;ctx.globalAlpha=.7;ctx.lineWidth=1.2;
      rrect(X+2.5,Y+2.5,T-5,T-5,2);ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=1;
      const vpulse=0.6+0.4*Math.sin(t*2+s.x);
      if(tier===1){          // glowing mushroom caps cultivated in the vat
        for(let i=0;i<3;i++){const mx=X+5+i*4,my=Y+T-4;
          ctx.fillStyle=vt.core;ctx.globalAlpha=.55+.3*vpulse;
          ctx.beginPath();ctx.ellipse(mx,my-3,2,1.3,0,0,7);ctx.fill();
          ctx.fillRect(mx-.4,my-3,.8,3);}
        ctx.globalAlpha=1;
      }else if(tier===2){    // hydroponic algae racks
        for(let i=0;i<4;i++){const bx=X+4+i*3;
          ctx.fillStyle=vt.core;ctx.globalAlpha=.4+.35*vpulse;
          ctx.fillRect(bx,Y+5,1.6,T-9);}
        ctx.globalAlpha=1;
      }else{                 // engineered bio-reactor — glowing core + ring
        ctx.fillStyle=vt.core;ctx.globalAlpha=.55+.4*vpulse;
        ctx.beginPath();ctx.arc(X+T/2,Y+T/2,3,0,7);ctx.fill();
        ctx.strokeStyle=vt.core;ctx.globalAlpha=.4;ctx.lineWidth=.8;
        ctx.beginPath();ctx.arc(X+T/2,Y+T/2,5,0,7);ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=1;
      }
      stampGlow(vt.glow,X+T/2,Y+T/2,T*.6,(0.14+0.10*vpulse)*(0.7+tier*0.15));
      for(let i=0;i<tier;i++){ctx.fillStyle=vt.glow;ctx.fillRect(X+2+i*2.4,Y+1.5,1.8,1.8);}  // tier pips
      break;}
    case "farmplot":{
      // tilled soil base
      rr(X+1,Y+1,T-2,T-2,"#1a1208");
      // crop rows — green sprouts, slight sway
      const sway=Math.sin(t*1.5+s.x*.6)*1;
      for(let row=0;row<3;row++){const ry=Y+4+row*4;
        rr(X+2,ry,T-4,1,"#0e1a0c");
        for(let cx=0;cx<4;cx++){const px=X+3+cx*3+sway*(row%2?1:-1);
          ctx.fillStyle=row===2?"#b8ff5e":"#39ff88";
          ctx.fillRect(px,ry-2,1,2)}}
      // ripe glow when food stocked
      if((ST.goods.food||0)>0)stampGlow("#b8ff5e",X+T/2,Y+T/2,T*.5,.12);
      break;}
    case "loggingcamp":{
      rr(X+2,Y+2,T-4,T-4,"#120e08");
      // stacked logs
      rr(X+3,Y+9,T-6,2,"#3a2818");rr(X+3,Y+11,T-6,2,"#2e2012");
      for(let i=0;i<3;i++){ctx.fillStyle="#1a1208";ctx.beginPath();
        ctx.arc(X+4+i*3,Y+10,1,0,7);ctx.fill()}
      // standing trunk + axe glint
      rr(X+10,Y+3,2,6,"#2e2012");
      const sw=Math.sin(t*3)*1.5;
      ctx.strokeStyle="#8a9bb5";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(X+6,Y+4);ctx.lineTo(X+6+sw,Y+7);ctx.stroke();
      ctx.fillStyle="#39ff88";ctx.fillRect(X+4,Y+3,2,1);break;}
    case "mineshaft":{
      rr(X+2,Y+2,T-4,T-4,"#0c0a10");
      // shaft entrance — dark arch with support beams
      rr(X+4,Y+5,T-8,T-7,"#040308");
      rr(X+4,Y+4,T-8,1,"#3a3020");rr(X+4,Y+5,1,7,"#2e2618");rr(X+T-5,Y+5,1,7,"#2e2618");
      // ore glints inside
      const gl=0.5+0.5*Math.sin(t*2.2+s.x);
      ctx.globalAlpha=gl;ctx.fillStyle="#ffc947";
      ctx.fillRect(X+7,Y+9,1,1);ctx.fillRect(X+10,Y+11,1,1);ctx.fillRect(X+8,Y+12,1,1);
      ctx.globalAlpha=1;
      // minecart rail hint
      rr(X+3,Y+T-2,T-6,1,"#4a3a28");
      if((ST.goods.data||0)>0)stampGlow("#47c8ff",X+T/2,Y+T/2,T*.5,gl*.14);
      break;}
    // ── CIVIC ──
    case "park":{
      // grass base
      rr(X+1,Y+1,T-2,T-2,"#0c1a0e");
      // tree canopy — soft bloom
      stampGlow("#39ff88",X+T/2,Y+6,T*.5,.18);
      ctx.fillStyle="#1e3a1e";ctx.beginPath();ctx.arc(X+T/2,Y+6,4.5,0,7);ctx.fill();
      ctx.fillStyle="#2e5a2e";ctx.beginPath();ctx.arc(X+T/2-1,Y+5,3,0,7);ctx.fill();
      rr(X+T/2-1,Y+9,2,4,"#2e2012"); // trunk
      // path + bench dot
      rr(X+2,Y+T-3,T-4,1,"#243040");
      ctx.fillStyle="#5a7aaa";ctx.fillRect(X+4,Y+T-4,2,1);break;}
    case "arcade":{
      rr(X+2,Y+2,T-4,T-4,"#0a0814");
      // cabinet screens flashing color
      const c1=`hsl(${((t*40)%360)|0},90%,60%)`;
      const c2=`hsl(${((t*40+120)%360)|0},90%,60%)`;
      rr(X+3,Y+4,4,6,"#040308");ctx.fillStyle=c1;ctx.fillRect(X+4,Y+5,2,3);
      rr(X+9,Y+4,4,6,"#040308");ctx.fillStyle=c2;ctx.fillRect(X+10,Y+5,2,3);
      stampGlow(((t*40)%360<180)?"#e040fb":"#00d4ff",X+T/2,Y+6,T*.5,.16);
      rr(X+3,Y+11,T-6,2,"#1a1228");break;}
    case "hospital":{
      rr(X+2,Y+2,T-4,T-4,"#0c1614");
      rr(X+3,Y+3,T-6,T-6,"#0e201c");
      // big green cross, gently pulsing
      const hp=0.7+0.3*Math.sin(t*1.8);
      stampGlow("#39ff88",X+T/2,Y+T/2,T*.5,hp*.2);
      ctx.fillStyle="#39ff88";ctx.globalAlpha=hp;
      ctx.fillRect(X+T/2-1,Y+4,3,T-8);ctx.fillRect(X+5,Y+T/2-1,T-10,3);
      ctx.globalAlpha=1;break;}
    case "school":{
      rr(X+2,Y+2,T-4,T-4,"#0a1018");
      // roof + door
      ctx.fillStyle="#1e2c44";ctx.beginPath();
      ctx.moveTo(X+2,Y+6);ctx.lineTo(X+T/2,Y+2);ctx.lineTo(X+T-2,Y+6);ctx.closePath();ctx.fill();
      rr(X+T/2-2,Y+9,4,5,"#0e1828");
      // glowing window of knowledge
      const sg=0.6+0.4*Math.sin(t*1.4);
      ctx.globalAlpha=sg;ctx.fillStyle="#7aa2ff";ctx.fillRect(X+4,Y+8,3,3);ctx.fillRect(X+T-7,Y+8,3,3);
      ctx.globalAlpha=1;
      stampGlow("#7aa2ff",X+T/2,Y+9,T*.45,sg*.12);break;}
    // ── STREET DECOR ──
    case "streetlamp":{
      // pole
      rr(X+T/2-1,Y+2,2,T-3,"#2a3450");
      // lamp head (horizontal arm)
      rr(X+T/2-4,Y+2,8,2,"#303c58");
      rr(X+T/2+2,Y+2,2,4,"#303c58");// hanging bracket
      // lamp glass — warm amber glow animated
      const la=lightLevel(hourN());
      const lflk=0.9+0.1*Math.sin(t*13.7+s.x*0.4);
      if(la>0.05){stampGlow("#ffc850",X+T/2+3,Y+3,T*.95,la*lflk*.7);}
      ctx.fillStyle=la>0.05?"#ffe0a0":"#404c68";
      ctx.fillRect(X+T/2+1,Y+2,3,3);
      rr(X+T/2-2,Y+T-2,4,2,"#202840");break;}
    case "bench":{
      // seat plank
      rr(X+2,Y+8,T-4,2,"#2a1e14");rr(X+2,Y+8,T-4,1,"#3a2a1a");
      // legs
      rr(X+3,Y+9,2,4,"#201612");rr(X+T-5,Y+9,2,4,"#201612");
      // back rest
      rr(X+2,Y+5,T-4,1,"#2a1e14");rr(X+3,Y+5,2,3,"#201612");rr(X+T-5,Y+5,2,3,"#201612");
      // worn surface detail
      ctx.fillStyle="rgba(255,220,180,.04)";ctx.fillRect(X+3,Y+8,T-6,1);break;}
    case "crate":{
      rr(X+2,Y+4,T-4,T-6,"#2a2010");rr(X+3,Y+5,T-6,T-8,"#1e1808");
      // wood grain lines
      rr(X+2,Y+8,T-4,1,"rgba(0,0,0,.4)");rr(X+T/2-1,Y+4,1,T-6,"rgba(0,0,0,.3)");
      // corner brackets
      ctx.fillStyle="rgba(180,160,100,.3)";
      ctx.fillRect(X+2,Y+4,2,2);ctx.fillRect(X+T-4,Y+4,2,2);
      ctx.fillRect(X+2,Y+T-6,2,2);ctx.fillRect(X+T-4,Y+T-6,2,2);
      // stencil mark
      ctx.fillStyle="rgba(255,140,0,.25)";ctx.font="5px monospace";
      ctx.textAlign="center";ctx.fillText("CORP",X+T/2,Y+T/2+1);ctx.textAlign="left";break;}
    case "dumpster":{
      rr(X+1,Y+4,T-2,T-5,"#1a2218");rr(X+2,Y+5,T-4,T-7,"#0e1410");
      // lid
      rr(X+1,Y+3,T-2,3,"#243020");rr(X+1,Y+3,T-2,1,"#303c28");
      // handle
      rr(X+T/2-2,Y+2,4,2,"#1a2218");
      // graffiti on side
      ctx.fillStyle="rgba(224,64,251,.4)";ctx.font="5px monospace";
      ctx.textAlign="center";ctx.fillText("NO",X+T/2,Y+9);ctx.textAlign="left";
      // wheel hints
      rr(X+2,Y+T-2,2,2,"#0a0e0c");rr(X+T-4,Y+T-2,2,2,"#0a0e0c");break;}
    case "vendmachine":{
      rr(X+2,Y+1,T-4,T-2,"#0e1c28");rr(X+3,Y+2,T-6,T-4,"#08121c");
      // screen
      rr(X+4,Y+3,T-8,6,"#060c14");
      const vs=Math.sin(t*0.8+s.x)>.5;
      ctx.fillStyle=vs?"#39ff88":"#00d4ff";ctx.fillRect(X+5,Y+4,T-10,1);
      ctx.fillStyle="rgba(57,255,136,.1)";ctx.fillRect(X+4,Y+3,T-8,6);
      // selection buttons
      for(let i=0;i<4;i++){
        ctx.fillStyle=i%2===0?"#ff3d5a":"#ffc947";
        ctx.fillRect(X+4+i*3,Y+10,2,2);}
      // coin slot
      rr(X+T/2-2,Y+T-4,4,1,"#1a2a38");
      // brand stripe
      ctx.fillStyle="rgba(0,212,255,.3)";ctx.fillRect(X+2,Y+1,T-4,1);break;}
    case "planter":{
      // pot
      rr(X+3,Y+9,T-6,T-10,"#2a1808");rr(X+4,Y+10,T-8,T-12,"#1a1006");
      // soil
      rr(X+4,Y+8,T-8,2,"#1a1208");
      // plant — small abstract foliage
      const pc=["#39ff88","#2ee89a","#b8ff5e"];
      ctx.fillStyle=pc[s.x%3];
      ctx.beginPath();ctx.arc(X+T/2,Y+5,4,0,7);ctx.fill();
      ctx.fillStyle=pc[(s.x+1)%3];
      ctx.beginPath();ctx.arc(X+T/2-2,Y+6,2.5,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(X+T/2+2,Y+7,2,0,7);ctx.fill();
      // bioluminescent tip glow
      ctx.globalAlpha=.3;ctx.fillStyle="#a259ff";
      ctx.beginPath();ctx.arc(X+T/2,Y+4,2,0,7);ctx.fill();ctx.globalAlpha=1;break;}
    default:{
      // generic civic/utility building — tinted box + centered glyph (nursery, market, hall, etc.)
      rr(X+2,Y+2,T-4,T-4,"#0c1422");
      rr(X+2,Y+2,T-4,2,"#22304a");
      const gi=(typeof BUILD_ICON!=="undefined"&&BUILD_ICON[s.type])||"▪";
      const gg=0.55+0.45*Math.sin(t*1.3+s.x);
      ctx.globalAlpha=gg;ctx.fillStyle="#7aa2ff";ctx.font="9px monospace";ctx.textAlign="center";
      ctx.fillText(gi,X+T/2,Y+T/2+3);ctx.textAlign="left";ctx.globalAlpha=1;
      stampGlow("#7aa2ff",X+T/2,Y+T/2,T*.4,gg*.10);break;}
    }}
  if(!s.bp&&s.hp<s.maxHp&&DEF[s.type].hp>1&&!isFurniture(s)){
    ctx.fillStyle="#08101e";ctx.fillRect(X+1,Y-4,T-2,3);
    const hpF=clamp(s.hp/s.maxHp,0,1);
    ctx.fillStyle=hpF>0.5?"#39ff88":hpF>0.25?"#ffc947":"#ff3d5a";
    ctx.fillRect(X+1,Y-4,(T-2)*hpF,3);}
  if(s.desig){ctx.strokeStyle="#ff8c42";ctx.globalAlpha=.65;
    ctx.strokeRect(X+.5,Y+.5,T-1,T-1);ctx.globalAlpha=1;}
  // robot-staffed store indicator (you read the map): small cyan gear, red when broken
  if(!s.bp&&s.roboStaffed){
    ctx.font="7px monospace";ctx.textAlign="center";
    ctx.fillStyle=roboBroken(s)?"#ff4757":"#7aa2ff";
    ctx.fillText("\u2699",X+4,Y+T-2);ctx.textAlign="left";
  }
  // idle store (needs a worker): pulsing amber "no staff" cue so the player can see it
  if(!s.bp&&s.idle&&DEF[s.type]&&DEF[s.type].vendor&&!DEF[s.type].selfRun){
    const pul=0.55+0.45*Math.sin(ST.tick*0.12);
    ctx.globalAlpha=pul;ctx.fillStyle="#ffb454";ctx.font="bold 9px monospace";ctx.textAlign="center";
    ctx.fillText("\u26A0",X+T/2,Y-3);ctx.globalAlpha=1;ctx.textAlign="left";
  }
  // STAFFED store: a small badge above the counter shows who's behind it — a robot or a clerk.
  // This makes "this store is working, and by whom" legible at a glance.
  if(!s.bp&&s.staffedBy&&DEF[s.type]&&DEF[s.type].vendor){
    ctx.textAlign="center";ctx.font="bold 8px monospace";
    if(s.staffedBy==="robot"){ctx.fillStyle="#7aa2ff";ctx.fillText("\u2699",X+T/2,Y-3);}      // robot gear
    else{
      // human clerk (or self-run): a small head/shoulders glyph + a subtle "open" glow on the counter
      ctx.fillStyle="#5cff9e";ctx.fillText("\u25D4",X+T/2,Y-3);                              // staffed marker
      ctx.globalAlpha=0.18+0.10*Math.sin(ST.tick*0.08);ctx.fillStyle="#5cff9e";
      ctx.fillRect(X+2,Y+2,T-4,T-4);ctx.globalAlpha=1;                                       // "open for business" tint
    }
    ctx.textAlign="left";
  }
  if(s.decon){ctx.strokeStyle="#ff3d5a";ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(X+3,Y+3);ctx.lineTo(X+T-3,Y+T-3);
    ctx.moveTo(X+T-3,Y+3);ctx.lineTo(X+3,Y+T-3);ctx.stroke();ctx.lineWidth=1;}
  // furniture status: broken = red spark glyph; premium = small gold corner glint
  if(!s.bp&&isFurniture(s)){
    if(isBroken(s)){
      ctx.fillStyle="#ff3d5a";ctx.font="8px monospace";ctx.textAlign="center";
      ctx.fillText("⚡",X+T-4,Y+6);ctx.textAlign="left";
      ctx.globalAlpha=0.35;ctx.fillStyle="#000";ctx.fillRect(X+2,Y+2,T-4,T-4);ctx.globalAlpha=1;
    }else if((s.qual||1)===2){
      ctx.fillStyle="#ffd84a";ctx.globalAlpha=.8;
      ctx.fillRect(X+T-4,Y+2,2,2);ctx.globalAlpha=1;
    }
  }}

function tempCols(P){
  const T=[[(P.amb+P.ind)/2,"#ff2d95"],[(P.imp+100-P.cau)/2,"#ff4757"],
    [(P.soc+P.emp)/2,"#39ff88"],[(P.cau+P.intg)/2,"#00e5ff"],
    [(P.cur+100-P.intg)/2,"#b06fff"],[(P.ind+100-P.emp)/2,"#ff9f2d"]];
  T.sort((a,b)=>b[0]-a[0]);return[T[0][1],T[1][1]]}
function renderRoster(){
  // roster panel removed from home screen — keep the heat HUD update + live overlay refresh
  const hb=$("h-heat");if(hb){hb.textContent=ST.heat|0;hb.className="hud-val"+(ST.heat>60?" danger":ST.heat>30?" warn":"");}
  if(OV.view==="crew"||OV.view==="district")renderOverlay();}
function animaColor(p){
  const s=clamp(p.stress||0,0,100)/100,m=clamp(p.mood||0,0,100)/100;
  let r,g,b;
  if(s<0.5){const t=s*2;r=160*t;g=224+(107-224)*t;b=200+(255-200)*t;}
  else{const t=(s-0.5)*2;r=160+(255-160)*t;g=107+(61-107)*t;b=255+(144-255)*t;}
  const br=0.4+m*0.6;r=Math.round(r*br);g=Math.round(g*br);b=Math.round(b*br);
  // quantize hex to limit glow cache size (steps of 16)
  const qr=Math.min(255,r+30)&0xF0,qg=Math.min(255,g+30)&0xF0,qb=Math.min(255,b+30)&0xF0;
  const hex="#"+((1<<24)+(qr<<16)+(qg<<8)+qb).toString(16).slice(1);
  return{col:"rgb("+r+","+g+","+b+")",core:"rgb("+Math.min(255,r+45)+","+Math.min(255,g+45)+","+Math.min(255,b+45)+")",hex:hex,glowA:(0.32+m*0.45)};}
function drawTaskGlyph(x,y,t){
  const C={eat:"#ffb454",sleep:"#6ad0ff",cook:"#ff9f4a",build:"#ffd84a",salvage:"#ff9f2d",haul:"#9aa7bd",hygiene:"#4ec3ff",recreate:"#ffd84a",socialize:"#8be0ff",work:"#5ad0ff",treat:"#39ff88",substance:"#c98bff",crime:"#ff4757",rob:"#ff4757",idle:"#6b7793",dazed:"#b06fff",read:"#7aa2ff",train:"#5ad0ff",practice:"#ffd24a"};
  const c=C[t]||"#9aa7bd";ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=1;
  const L=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};
  const RC=(X0,Y0,w,h)=>{L(X0,Y0,X0+w,Y0);L(X0+w,Y0,X0+w,Y0+h);L(X0+w,Y0+h,X0,Y0+h);L(X0,Y0+h,X0,Y0)};
  const dot=(dx,dy,r)=>{ctx.beginPath();ctx.arc(dx,dy,r||1,0,7);ctx.fill()};
  const tri=(ax,ay,bx,by,cx,cy)=>{ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.lineTo(cx,cy);ctx.fill()};
  switch(t){
    case"eat":L(x-2,y-3,x-2,y-.5);L(x,y-3,x,y-.5);L(x+2,y-3,x+2,y-.5);L(x,y-.5,x,y+3);break;            // fork
    case"sleep":ctx.beginPath();ctx.moveTo(x-2,y-2);ctx.lineTo(x+2,y-2);ctx.lineTo(x-2,y+2);ctx.lineTo(x+2,y+2);ctx.stroke();break; // Z
    case"cook":ctx.fillRect(x-3,y,6,3);L(x-1,y-3,x-1,y);L(x+1,y-4,x+1,y);break;                          // pot + steam
    case"build":ctx.fillRect(x-3,y-3,6,2);ctx.fillRect(x-.7,y-1,1.5,4);break;                            // hammer
    case"salvage":L(x-2,y+3,x+2,y-2);ctx.beginPath();ctx.arc(x+2,y-2,2,3.6,5.7);ctx.stroke();break;      // pick
    case"haul":RC(x-3,y-3,6,6);L(x-3,y,x+3,y);break;                                                     // crate
    case"hygiene":tri(x,y-3.5,x-2.3,y+1,x+2.3,y+1);dot(x,y+1,1.6);break;                                 // droplet
    case"recreate":RC(x-3,y-2.5,6,5);dot(x,y,1.1);break;                                                 // screen
    case"socialize":RC(x-3,y-3,6,4.5);L(x-2,y+1.5,x-3,y+3.5);break;                                      // speech bubble
    case"work":ctx.fillRect(x-3,y-2.5,6,4);ctx.fillRect(x-1,y+1.5,2,1.3);break;                          // monitor + stand
    case"treat":ctx.fillRect(x-.8,y-3,1.6,6);ctx.fillRect(x-3,y-.8,6,1.6);break;                         // cross
    case"substance":dot(x-2,y,1.4);dot(x+2,y,1.4);ctx.fillRect(x-2,y-1.4,4,2.8);break;                   // pill
    case"crime":case"rob":tri(x-1.3,y-3,x+1.3,y-3,x,y+1);ctx.fillRect(x-1,y+1,2,2.5);break;              // knife
    case"dazed":ctx.beginPath();ctx.arc(x,y,2.4,.6,5.7);ctx.stroke();dot(x+2.2,y-1,.8);break;            // swirl
    case"read":RC(x-3,y-2.5,3,5);RC(x,y-2.5,3,5);L(x,y-2.5,x,y+2.5);break;                              // open book
    case"train":ctx.fillRect(x-3,y-2.5,6,4);L(x-1.5,y-.5,x+1.5,y-.5);L(x-1.5,y+.8,x+1.5,y+.8);break;     // terminal w/ code lines
    case"practice":dot(x-2.5,y,1.6);dot(x+2.5,y,1.6);ctx.fillRect(x-2.5,y-.8,5,1.6);break;               // dumbbell
    default:dot(x-2.5,y,1);dot(x,y,1);dot(x+2.5,y,1);                                                    // idle ...
  }
}
// ── 8-BIT FACE RENDERER ──
// Face is drawn in a 7x7 pixel grid centered at (cx,cy), scaled by px size
// Each face expression is defined as pixel coords relative to top-left of 7x7 grid
const FACE={
  // [eyes_L, eyes_R, mouth_pixels...]  — each entry is [col,row]
  happy:   {e:[[1,1],[5,1]],        m:[[1,4],[2,5],[3,5],[4,5],[5,4]]},
  good:    {e:[[1,1],[5,1]],        m:[[2,4],[3,5],[4,4]]},
  neutral: {e:[[1,1],[5,1]],        m:[[1,4],[2,4],[3,4],[4,4],[5,4]]},
  sad:     {e:[[1,2],[5,2]],        m:[[1,5],[2,4],[3,4],[4,4],[5,5]]},
  angry:   {e:[[1,2],[5,2],[1,1],[5,1]],m:[[1,5],[2,4],[3,4],[4,4],[5,5],[0,1],[6,1]]},
  scared:  {e:[[1,1],[5,1],[2,1],[4,1]],m:[[2,4],[3,5],[4,4]]},  // wide eyes
  dazed:   {e:[[1,1],[5,1],[1,2],[5,2]],m:[[2,4],[3,4],[4,4]]},  // X eyes
  sick:    {e:[[1,1],[3,1],[5,1]],   m:[[1,5],[2,4],[3,4],[4,4],[5,5]]},  // jagged
  sleep:   {e:[[1,2],[2,2],[4,2],[5,2]],m:[[2,4],[3,4],[4,4]]}, // closed lines
  hooked:  {e:[[1,1],[5,1]],         m:[[1,4],[2,4],[4,4],[5,4]]},  // gap mouth
};
function drawFace(cx,cy,expr,col,ps){
  // ps = pixel size (1 at normal zoom, bigger when selected)
  const f=FACE[expr]||FACE.neutral;
  // dark face background circle
  ctx.globalAlpha=0.85;
  ctx.fillStyle="rgba(0,0,0,0.7)";
  ctx.beginPath();ctx.arc(cx,cy,ps*3.8,0,7);ctx.fill();
  // pixel grid origin: top-left of 7x7 box
  const ox=cx-ps*3.5,oy=cy-ps*3.5;
  ctx.globalAlpha=1;ctx.fillStyle=col;
  // eyes
  for(const [c,r] of f.e)ctx.fillRect(ox+c*ps,oy+r*ps,ps,ps);
  // mouth
  for(const [c,r] of f.m)ctx.fillRect(ox+c*ps,oy+r*ps,ps,ps);}

function faceExpr(p){
  if(p.sleeping)return"sleep";
  if(p.dazed>ST.tick)return"dazed";
  if(p.sick)return"sick";
  if(p.flee>ST.tick)return"scared";
  if((p.addiction||0)>40)return"hooked";
  if((p.stress||0)>70||(p.mood||50)<22)return"angry";
  if((p.stress||0)>45||(p.mood||50)<35)return"sad";
  if((p.mood||50)>70)return"happy";
  if((p.mood||50)>55)return"good";
  return"neutral";}

/* ============================================================
   WISP CHARM — cute emotes + reactions
   ============================================================ */
// floating emote bubbles above pawns. kind drives the symbol + color + motion.
const EMOTES={
  heart:   {s:"\u2665", c:"#ff6fae", rise:14, life:46, wob:1,   bloom:1.3},  // heart
  love:    {s:"\u2661", c:"#ff8fc4", rise:14, life:46, wob:1.4, bloom:1.3},  // open heart
  music:   {s:"\u266a", c:"#7ad0ff", rise:13, life:44, wob:1.6, bloom:1.1},  // note
  happy:   {s:"\u273f", c:"#ffe14d", rise:12, life:40, wob:1,   bloom:1.4},  // black florette — cheery bloom
  party:   {s:"\u2740", c:"#ffc947", rise:16, life:52, wob:2,   bloom:1.5},  // white florette burst
  sweat:   {s:"\u2235", c:"#9fd8ff", rise:8,  life:34, wob:.4,  bloom:.9},   // little drops
  shock:   {s:"\u2757", c:"#ffe066", rise:11, life:40, wob:.6,  bloom:1.2},  // rounded heavy !
  excl:    {s:"\u2757", c:"#ffe066", rise:11, life:34, wob:.5,  bloom:1.1},  // rounded heavy !
  ques:    {s:"\u2753", c:"#aec6ff", rise:11, life:36, wob:.7,  bloom:1.1},  // rounded heavy ?
  anger:   {s:"\u2763", c:"#ff7a8c", rise:9,  life:36, wob:.7,  bloom:1.2},  // heart-! — even mad it's cute
  cry:     {s:"\u2767", c:"#7ec8ff", rise:7,  life:40, wob:.5,  bloom:1.0},  // rotated bud — teary
  sleepy:  {s:"z", c:"#aef3ff", rise:9, life:42, wob:.5, bloom:1.0},          // zzz
  ghost:   {s:"\u2727", c:"#dfe6ff", rise:20, life:64, wob:2.2, bloom:1.3},  // soft sparkle puff for KO
  dizzy:   {s:"\u2733", c:"#c98bff", rise:8, life:42, wob:1.9,  bloom:1.1},   // swirly spark
  idea:    {s:"\u273c", c:"#fff1a8", rise:12, life:40, wob:.8,  bloom:1.5},   // teardrop-spoked star — idea!
  gross:   {s:"\u2235", c:"#a8ff78", rise:8, life:34, wob:.6,  bloom:.9},     // queasy drops
  chat:    {s:"\u266c", c:"#bfe8ff", rise:11, life:36, wob:.7,  bloom:1.0},   // chatty notes
  // ── "evil but cute" set — scheming, smug, mischievous — rounded & appealing, never harsh ──
  scheme:  {s:"\u263b", c:"#c77dff", rise:10, life:44, wob:.9,  bloom:1.5},   // filled smiley — smug little schemer
  evil:    {s:"\u2665", c:"#b15cff", rise:11, life:42, wob:1.0, bloom:1.5},   // violet heart — cute menace
  smug:    {s:"\u2734", c:"#ff9f4a", rise:9,  life:40, wob:.7,  bloom:1.3},   // eight-point — pleased
  greed:   {s:"\u2742", c:"#ffd24a", rise:10, life:42, wob:.8,  bloom:1.5},   // circled star — $$ sparkle-eyes
};
function emote(p,kind){
  if(!p||p.hp<=0&&kind!=="ghost")return;
  const e=EMOTES[kind]||EMOTES.happy;
  (ST.emotes||(ST.emotes=[])).push({
    x:p.px,y:p.py,kind,ttl:e.life,t0:e.life,
    seed:Math.random()*6.28});
  // brief reaction cooldown so we don't spam
  p.lastEmote=ST.tick;
}
// throttle helper — only emote if this pawn hasn't recently
function tryEmote(p,kind,gap){
  if(!p)return;
  if(p.lastEmote&&ST.tick-p.lastEmote<(gap||60))return;
  emote(p,kind);
}
// nearby onlookers react to a dramatic event at (x,y). The reaction propagates as a WAVE — wisps nearest the
// epicenter react first, those farther a beat later — so a dramatic moment visibly ripples across the crowd
// instead of flashing all at once. Reactions are queued in ST.pendingReacts and fired by reactWaveTick().
// kind can be a single emote string, OR a {near, far} pair to shade the reaction by distance (e.g. shock up
// close, unease at the edge). radius caps how far the wave reaches.
function onlookersReact(x,y,kind,radius){
  const R=radius||7;
  if(!ST.pendingReacts)ST.pendingReacts=[];
  const WAVE_SPEED=3.2;          // tiles per tick the wave front travels (tune: lower = slower, more visible wave)
  for(const q of ST.pawns){
    if(q.hp<=0||q.sleeping||isChild(q))continue;
    const d=DIST(q.px,q.py,x,y);
    if(d>R)continue;
    // pick the emote: a {near,far} pair shades by distance; a string is uniform
    let em=kind;
    if(kind&&typeof kind==="object"){em=(d<R*0.45)?(kind.near||"shock"):(kind.far||kind.near||"sweat");}
    const delay=Math.round(d/WAVE_SPEED);    // farther = later → the wave front
    ST.pendingReacts.push({id:q.id,kind:em,at:ST.tick+delay});
  }
}
// fire queued wave reactions whose moment has arrived (called each tick). Self-cleaning.
function reactWaveTick(){
  const q=ST.pendingReacts;if(!q||!q.length)return;
  for(let i=q.length-1;i>=0;i--){
    const r=q[i];
    if(ST.tick<r.at)continue;
    const p=ST.pawns.find(pp=>pp.id===r.id);
    if(p&&p.hp>0&&!p.sleeping)tryEmote(p,r.kind,70);
    q.splice(i,1);
  }
}
// ═══ WAVE C — EMOTIONAL REACTIVITY. A single place that makes a wisp's feelings VISIBLE and proportional
// to what just happened: mood + stress shift, a fitting emote, and (for strong events) a lasting memory and
// a relationship colouring. Interactions used to change stats silently; now they read on the wisp's face. ═══
// kind drives the emotional flavour; intensity (0..1) scales the magnitude.
function emotionalReact(p,kind,intensity,opts){
  if(!p||p.hp<=0||isChild(p)&&!(opts&&opts.allowChild))return;
  intensity=clamp(intensity==null?0.5:intensity,0,1);opts=opts||{};
  // emotional profiles: [emote, moodDelta, stressDelta] at full intensity
  const PROFILES={
    joy:["happy",  +14, -10], delight:["heart",+18,-12], amused:["party", +12,-6],
    connected:["love",+16,-9], inspired:["idea",+10,-5],  proud:["smug",  +12,-4],
    anger:["anger", -8, +16],  fear:["shock",  -10,+20],  distress:["cry",-16,+22],
    disgust:["gross",-6, +8],  shame:["sweat", -8, +10],  grief:["cry",   -22,+14],
    betrayed:["anger",-14,+18],unsettled:["ques",-4,+6],  relief:["happy",+10,-14],
  };
  const prof=PROFILES[kind]||PROFILES.unsettled;
  tryEmote(p,opts.emote||prof[0],opts.gap||80);
  p.mood=clamp((p.mood||50)+prof[1]*intensity,0,100);
  p.stress=clamp((p.stress||0)+prof[2]*intensity,0,100);
  // strong moments stick as a memory
  if(opts.memory&&intensity>0.45&&typeof remember==="function")remember(p,opts.memory);
  // and a really strong, visible moment can make them SPEAK an AI-generated reaction (if AI is enabled)
  if(opts.aiEvent&&intensity>0.5&&typeof aiReactLine==="function")aiReactLine(p,opts.aiEvent);
  // and can colour a relationship with whoever caused it
  if(opts.toward!=null&&opts.relDelta)relAdj(p.id,opts.toward,opts.relDelta);
  // a float for the most visceral ones (robbed, attacked, overjoyed)
  if(opts.float&&typeof float==="function")float(p.px,p.py,opts.float,prof[1]>=0?"#5cff9e":"#ff6b6b");
}
// draw NPC speech bubbles — a small rounded bubble above the speaker with their line, fading in/out.
function roundRectPath(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function drawSays(x0,y0,x1,y1){
  if(!ST.says||!ST.says.length)return;
  ctx.textAlign="left";ctx.font="7px monospace";
  for(const s of ST.says){
    const p=ST.pawns.find(q=>q.id===s.id);if(!p)continue;
    if(p.px<x0-2||p.px>x1+2||p.py<y0-2||p.py>y1+2)continue;
    // fade: in over first 12%, hold, out over last 18%
    const prog=1-s.ttl/s.t0;
    let a=1; if(prog<0.12)a=prog/0.12; else if(prog>0.82)a=(1-prog)/0.18;
    a=clamp(a,0,1); if(a<=0)continue;
    // wrap text to ~22 chars/line
    const words=s.txt.split(" ");const lines=[];let cur="";
    for(const w of words){if((cur+" "+w).trim().length>22){lines.push(cur.trim());cur=w;}else cur+=" "+w;}
    if(cur.trim())lines.push(cur.trim());
    const lh=8, padX=4, padY=3;
    let maxW=0; for(const ln of lines)maxW=Math.max(maxW,ctx.measureText(ln).width);
    const bw=maxW+padX*2, bh=lines.length*lh+padY*2;
    const cx=p.px*T, by=p.py*T-14-bh;     // above the pawn's head
    const bx=cx-bw/2;
    ctx.globalAlpha=a*0.92;
    // bubble body
    ctx.fillStyle="rgba(8,14,26,0.92)";roundRectPath(bx,by,bw,bh,3);ctx.fill();
    ctx.strokeStyle="rgba(120,180,230,0.5)";ctx.lineWidth=0.7;ctx.stroke();
    // little tail
    ctx.fillStyle="rgba(8,14,26,0.92)";ctx.beginPath();ctx.moveTo(cx-2,by+bh);ctx.lineTo(cx+2,by+bh);ctx.lineTo(cx,by+bh+3);ctx.closePath();ctx.fill();
    // text
    ctx.globalAlpha=a;ctx.fillStyle="#cfe6ff";ctx.textAlign="left";
    for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],bx+padX,by+padY+lh*(i+1)-2);
  }
  ctx.globalAlpha=1;ctx.textAlign="left";
}
function drawEmotes(x0,y0,x1,y1){
  if(!ST.emotes||!ST.emotes.length)return;
  ctx.textAlign="center";
  for(const em of ST.emotes){
    if(em.x<x0-2||em.x>x1+2||em.y<y0-2||em.y>y1+2)continue;
    // if this pawn has an active speech bubble, skip the emote so they don't stack/overlap above the head
    if(ST.says&&ST.says.length){const sp=ST.pawns.find(q=>Math.abs(q.px-em.x)<0.6&&Math.abs(q.py-em.y)<0.6);if(sp&&ST.says.some(s=>s.id===sp.id))continue;}
    const def=EMOTES[em.kind]||EMOTES.happy;
    const prog=1-em.ttl/em.t0;
    const a=clamp(em.ttl<8?em.ttl/8:1,0,1); // fade out at end
    const rise=prog*def.rise;
    const wob=Math.sin(prog*7+em.seed)*def.wob;
    // CUTE bounce-in: pop slightly past full size in the first ~18% of life, then settle (squash-stretch feel)
    let pop=1;
    if(prog<0.18){const t=prog/0.18;pop=0.3+1.1*t;}      // spring up from small
    else if(prog<0.30){const t=(prog-0.18)/0.12;pop=1.4-0.4*t;} // overshoot settles back
    const sz=Math.round(((em.kind==="ghost"?11:9)+prog*1.5)*pop);
    const X=em.x*T+wob, Y=em.y*T-10-rise;
    ctx.globalAlpha=a;
    // SOFT GLOW BLOOM behind the symbol — makes it pop & feel rounded/cute rather than flat text
    const bloom=(def.bloom||1.1);
    if(typeof glowSprite==="function"){
      ctx.globalAlpha=a*0.5;
      const gr=sz*bloom*0.9;
      ctx.drawImage(glowSprite(def.c),X-gr,Y-gr*0.75-2,gr*2,gr*2);
      ctx.globalAlpha=a;
    }
    ctx.font="bold "+sz+"px monospace";
    ctx.fillStyle=def.c;
    ctx.fillText(def.s,X,Y);
    ctx.globalAlpha=1;
  }
  ctx.textAlign="left";
}
function tickEmotes(){
  if(!ST.emotes)return;
  for(let i=ST.emotes.length-1;i>=0;i--)if(--ST.emotes[i].ttl<=0)ST.emotes.splice(i,1);
}
// draw the trade caravan on the map while it's in town — a glowing cart with a goods banner, so the
// "caravan arrives" event corresponds to something the player can actually SEE and walk to.
function drawCaravan(x0,y0,x1,y1){
  const cv=ST.caravan;if(!cv||cv.x==null)return;
  if(cv.x<x0||cv.x>=x1||cv.y<y0||cv.y>=y1)return;
  const X=cv.x*T,Y=cv.y*T,t=performance.now()*0.001;
  const col=cv.mode==="buy"?"#39ff88":cv.mode==="outsiders"?"#22ddff":"#ffc947";
  // soft ground glow so it reads as a destination
  ctx.save();ctx.globalAlpha=0.18+0.06*Math.sin(t*2);
  const gg=ctx.createRadialGradient(X+T/2,Y+T/2,0,X+T/2,Y+T/2,T*1.6);
  gg.addColorStop(0,col);gg.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=gg;ctx.beginPath();ctx.arc(X+T/2,Y+T/2,T*1.6,0,7);ctx.fill();ctx.restore();
  // cart body
  ctx.fillStyle="#1a1206";ctx.fillRect(X+1,Y+4,T-2,T-6);
  ctx.fillStyle="#2a1c0a";ctx.fillRect(X+2,Y+5,T-4,T-8);
  // striped awning
  for(let i=0;i<4;i++){ctx.fillStyle=i%2?col:"#0a0a0a";ctx.fillRect(X+1+i*((T-2)/4),Y+2,(T-2)/4,3);}
  // wheel hints
  ctx.fillStyle="#0a0a0a";ctx.fillRect(X+2,Y+T-2,2,2);ctx.fillRect(X+T-4,Y+T-2,2,2);
  // floating goods banner
  ctx.save();ctx.textAlign="center";ctx.font="bold 6px monospace";
  const lit=0.7+0.3*Math.sin(t*2.4);
  ctx.globalAlpha=0.55;ctx.fillStyle="rgba(2,6,14,.9)";ctx.fillRect(X+T/2-16,Y-9,32,7);
  ctx.globalAlpha=lit;ctx.fillStyle=col;
  ctx.fillText((cv.mode==="buy"?"BUY ":"SELL ")+cv.good.toUpperCase(),X+T/2,Y-3.5);
  ctx.restore();
}
function drawTombstones(x0,y0,x1,y1){
  if(!ST.tombs||!ST.tombs.length)return;
  for(const tb of ST.tombs){
    if(tb.x<x0-1||tb.x>x1+1||tb.y<y0-1||tb.y>y1+1)continue;
    const X=tb.x*T,Y=tb.y*T;
    const a=clamp(tb.ttl<60?tb.ttl/60:1,0,1);
    ctx.globalAlpha=a*.9;
    // little rounded headstone
    ctx.fillStyle="#3a4258";
    ctx.beginPath();
    ctx.moveTo(X+5,Y+13);ctx.lineTo(X+5,Y+7);
    ctx.arc(X+8,Y+7,3,Math.PI,0);ctx.lineTo(X+11,Y+13);ctx.closePath();ctx.fill();
    // RIP scratch
    ctx.fillStyle="#8a93ad";ctx.font="4px monospace";ctx.textAlign="center";
    ctx.fillText("RIP",X+8,Y+10);ctx.textAlign="left";
    // soft mound
    ctx.fillStyle="rgba(40,50,30,.5)";ctx.fillRect(X+3,Y+12,10,2);
    ctx.globalAlpha=1;
  }
}
function tickTombstones(){
  if(!ST.tombs)return;
  for(let i=ST.tombs.length-1;i>=0;i--)if(--ST.tombs[i].ttl<=0)ST.tombs.splice(i,1);
}

// ── POLITICAL-LEAN CUE (Living City, Gap 1) — surface a wisp's relationship to the insurrection as a SUBTLE
//    aura, layered onto the existing mood/stress body color (animaColor). Lets you read the city's POLITICAL
//    temperature at a glance: pockets of sympathy (warm), your cell (allied green), loyalists (none/faint
//    cold), informants (cold warning). Derived live from existing state — nothing stored, nothing serialized.
//    Returns {col, strength} or null for "no meaningful lean" (ordinary loyalist → no aura, keeps the map calm).
function politicalTint(p){
  if(!p||p.isAvatar||isChild(p))return null;       // the operative + kids get no political aura
  if(p.informant){                                  // TURNED AGAINST YOU — a cold, wrong cyan-white warning
    return {col:[120,190,220], strength:0.5};
  }
  if(p.recruited){                                  // YOUR CELL — a clear allied green
    return {col:[80,255,150], strength:0.62};
  }
  const al=p.allegiance||0;
  if(al<=5)return null;                             // loyalist / neutral → no aura (the regime's quiet majority)
  // SYMPATHIZER — a warm ember that intensifies as they ripen toward you. radicalPotential blends allegiance
  // + mood + disillusion into a single "ripeness" score; we lean on it so the warmth tracks recruitability.
  const ripe=(typeof radicalPotential==="function")?clamp(radicalPotential(p),0,100):al;
  const t=clamp(ripe/100,0,1);
  // amber (just warming) → hot orange-red (nearly ready to recruit)
  const col=[Math.round(255), Math.round(150-70*t), Math.round(70-40*t)];
  return {col, strength:0.28+0.34*t};              // faint when barely warm, stronger as they radicalize
}
function drawPawn(p){
  const now=performance.now();
  // motion personality: walking bob, idle breathing, happy bounce, stressed jitter
  const moving=!p.sleeping&&p.job&&p.job.t!=="idle"&&p.path;
  const mood=p.mood||50,stress=p.stress||0;
  let bobY=0,squash=1;
  if(p.sleeping){bobY=Math.sin(now*0.002+p.px)*0.6;} // gentle sleep rise/fall
  else if(moving){bobY=Math.sin(now*0.014+(p.px+p.py))*1.4;squash=1+Math.sin(now*0.014+(p.px+p.py))*0.06;}
  else{
    // idle: soft breathing; happy wisps do a little bounce; stressed ones jitter
    const breathe=Math.sin(now*0.004+p.px*1.3)*0.7;
    const hop=mood>68?Math.max(0,Math.sin(now*0.006+p.py))*1.8:0;
    const jit=stress>60?(Math.random()-0.5)*0.7:0;
    bobY=breathe-hop+jit;
    squash=1+Math.sin(now*0.004+p.px*1.3)*0.04+(mood>68?hop*0.02:0);
  }
  const X=p.px*T,Y=p.py*T+bobY;
  const sel=ST.sel.includes(p),ac=animaColor(p),slp=p.sleeping;
  const pls=0.5+0.5*Math.sin(performance.now()*0.0028+(p.px+p.py)*0.5);
  const young=p.child?0.62:1;                          // children are visibly smaller wisps
  const rad=((slp?8:12)+(slp?0:pls*2.5))*young;
  const ga=(slp?ac.glowA*0.5:ac.glowA)*(0.72+0.28*pls);
  // ground shadow — soft ellipse anchored to the foot (uses unbobbed Y)
  ctx.globalAlpha=0.28;ctx.fillStyle="#000";
  ctx.beginPath();ctx.ellipse(X,p.py*T+6,slp?5:6,2.2,0,0,7);ctx.fill();
  ctx.globalAlpha=1;
  // ── soft organic wisp bloom (layered, no per-frame gradient) ──
  // outer soft halo using cached white glow tinted by orb color via composite
  ctx.save();
  ctx.globalCompositeOperation="lighter";
  // build a stamp color from the animaColor rgb
  const acHex=ac.hex||"#a259ff";
  ctx.globalAlpha=ga*0.55;
  ctx.drawImage(glowSprite(acHex),X-rad,Y-rad,rad*2,rad*2);
  // inner brighter bloom
  ctx.globalAlpha=ga*0.7;
  ctx.drawImage(glowSprite(acHex),X-rad*0.6,Y-rad*0.6,rad*1.2,rad*1.2);
  ctx.restore();
  // ── POLITICAL-LEAN AURA (Gap 1) — a subtle outer ring keyed to the wisp's stance toward the insurrection.
  //    Drawn OUTSIDE the mood bloom so the body color (mood/stress) stays primary; this reads as atmosphere.
  //    Sympathizers glow warm (intensifying as they ripen), your cell allied-green, informants cold. Loyalists
  //    get nothing (politicalTint returns null) so the regime's quiet majority keeps the map calm.
  if(!slp){const _pt=politicalTint(p);
    if(_pt){
      const pulse=0.7+0.3*Math.sin(performance.now()*0.0022+(p.px-p.py)*0.7);
      const aR=rad*0.92, aStr=_pt.strength*pulse;
      ctx.save();ctx.globalCompositeOperation="lighter";
      // two soft concentric strokes — a faint halo, not a hard ring
      ctx.strokeStyle="rgba("+_pt.col[0]+","+_pt.col[1]+","+_pt.col[2]+","+(aStr*0.5).toFixed(3)+")";
      ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(X,Y,aR,0,7);ctx.stroke();
      ctx.strokeStyle="rgba("+_pt.col[0]+","+_pt.col[1]+","+_pt.col[2]+","+(aStr*0.28).toFixed(3)+")";
      ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(X,Y,aR+2.5,0,7);ctx.stroke();
      ctx.restore();
    }
  }
  // selection ring — animated rotating dashes
  if(sel){
    const rot=performance.now()*0.002;
    ctx.save();ctx.translate(X,Y);ctx.rotate(rot);
    ctx.strokeStyle="rgba(234,255,244,.95)";ctx.lineWidth=1.5;
    ctx.setLineDash([4,3]);
    ctx.beginPath();ctx.arc(0,0,11,0,7);ctx.stroke();
    ctx.setLineDash([]);ctx.restore();}
  // solid orb body
  ctx.fillStyle=ac.col;ctx.beginPath();ctx.arc(X,Y,(slp?4:5.5)*young,0,7);ctx.fill();
  // accent ring
  ctx.strokeStyle=p.accent;ctx.globalAlpha=slp?0.45:0.78;ctx.lineWidth=1.4;
  ctx.beginPath();ctx.arc(X,Y,(slp?5.5:7.5)*young,0,7);ctx.stroke();ctx.lineWidth=1;ctx.globalAlpha=1;
  // ── 8-bit face ──
  const ps=sel?1.2:1;  // slightly bigger pixel when selected
  const expr=faceExpr(p);
  const faceCol=expr==="angry"?"#ff6b6b":expr==="sick"?"#a8ff78":expr==="happy"?"#ffd700":
    expr==="dazed"?"#c98bff":expr==="scared"?"#ffa500":"#ffffff";
  drawFace(X,Y-0.5,expr,faceCol,ps);
  // sleeping zzz
  if(slp){ctx.fillStyle="#aef3ff";ctx.font="7px monospace";ctx.fillText("z",X+7,Y-8)}
  // status badges (above pawn) — surface the deep systems on the map, where the eye lives.
  // kept to the few highest-signal states so it never clutters.
  const _bdg=[];
  if(p.sick)_bdg.push(["+","#ff4757"]);                 // infected — needs a clinic
  if(p.homeless)_bdg.push(["H","#ff8c42"]);             // evicted
  if(p.grudgeTarget)_bdg.push(["!","#ff4757"]);         // holds a grudge — may lash out
  {const g=pawnGang(p);if(g)_bdg.push(["\u25C6",g.color]);}  // gang member (turf color)
  if(p.addiction>50)_bdg.push(["~","#c98bff"]);         // hooked
  if(_bdg.length){ctx.font="6px monospace";ctx.textAlign="center";
    const _x0=X-(_bdg.length-1)*4;
    for(let _i=0;_i<_bdg.length;_i++){ctx.fillStyle=_bdg[_i][1];ctx.fillText(_bdg[_i][0],_x0+_i*8,Y-14)}
    ctx.textAlign="left"}
  // task glyph below
  if(!slp){let _t=p.dazed>ST.tick?"dazed":(p.job?p.job.t:"idle");
    // studying shows a distinct glyph by venue (read/train/practice)
    if(_t==="learn"&&p.job&&p.job.s){const vt=p.job.s.type;_t=vt==="gym"?"practice":vt==="workstation"?"train":"read";}
    drawTaskGlyph(X,Y+15,_t)}
  // HP bar (always show when selected or recently hurt)
  if(sel||ST.tick-p.hurtT<60){
    ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(X-8,Y+9,16,3);
    const hpCol=p.hp>60?"#39ff88":p.hp>30?"#ffc947":"#ff3d5a";
    ctx.fillStyle=hpCol;ctx.fillRect(X-8,Y+9,16*clamp(p.hp/100,0,1),3)}
  // NAME — shown BELOW the wisp, with readability scaled to zoom so a busy map doesn't turn into a wall
  // of overlapping labels. Your operative + named roles + the selected wisp are ALWAYS legible; ordinary
  // wisps' names fade in only as you zoom in close enough to read them. (Emotions/alerts render ABOVE the
  // wisp, names BELOW — clean separation.)
  {const isRole=!!p.role,isYou=!!p.isAvatar;
   const nm=p.name.split(" ")[0];
   // ordinary wisps: name visibility ramps with zoom (invisible when zoomed out, clear when zoomed in)
   const ordinaryVis=clamp((cam.z-1.0)/0.6,0,1);   // 0 at z<=1.0, full by z>=1.6
   const show=isYou||isRole||sel||ordinaryVis>0.05;
   if(show){
     ctx.textAlign="center";
     const ny=Y+22;
     let col,fnt,alpha=1;
     if(isYou){fnt="bold 8px monospace";col="#22ddff";}
     else if(isRole){fnt="bold 7px monospace";col=p.accent;}
     else if(sel){fnt="7px monospace";col=p.accent;}
     else{fnt="7px monospace";col="rgba(190,205,225,1)";alpha=ordinaryVis*0.8;}
     ctx.font=fnt;
     const w=ctx.measureText(nm).width;
     // consistent dark backing for EVERY visible name (was only role/you/selected before) — legibility
     ctx.globalAlpha=alpha*(isYou||isRole||sel?0.6:0.5*ordinaryVis);
     ctx.fillStyle="rgba(2,8,20,.85)";
     ctx.fillRect(X-w/2-2,ny-7,w+4,9);
     ctx.globalAlpha=alpha;ctx.fillStyle=col;
     ctx.fillText(nm,X,ny);
     ctx.globalAlpha=1;ctx.textAlign="left";
   }}
  // ROLE marker — a small colored diamond above named role-wisps so the cast is findable at a glance
  if(p.role&&!p.isAvatar){const R0=ROLES[p.role];if(R0){
    ctx.fillStyle=R0.accent;ctx.globalAlpha=0.9;
    ctx.beginPath();ctx.moveTo(X,Y-15);ctx.lineTo(X-3,Y-18);ctx.lineTo(X,Y-21);ctx.lineTo(X+3,Y-18);ctx.closePath();ctx.fill();
    ctx.globalAlpha=1;}}
  // AVATAR marker — a pulsing cyan ring + a chevron above, so YOU are always findable
  if(p.isAvatar){
    const pul=0.5+0.35*Math.sin(ST.tick*0.1);
    ctx.strokeStyle="#22ddff";ctx.globalAlpha=pul;ctx.lineWidth=1.6;
    ctx.beginPath();ctx.arc(X,Y,11,0,7);ctx.stroke();ctx.globalAlpha=1;
    // (chevron removed — the pulsing ring alone marks the avatar; cleaner read)
    // OP IN FLIGHT: a filling arc shows the deed performing, tinted by op type
    if(p.activeOp){const ao=p.activeOp;const frac=Math.max(0,Math.min(1,ao.prog/ao.duration));
      const oc=ao.anim==="strike"?"#ff4757":ao.anim==="confer"?"#ffd24a":ao.anim==="plant"?"#ff8c42":ao.anim==="lift"?"#5cff9e":ao.anim==="rally"?"#22ddff":"#b06fff";
      ctx.strokeStyle=oc;ctx.lineWidth=2.4;ctx.globalAlpha=0.95;
      ctx.beginPath();ctx.arc(X,Y,15,-Math.PI/2,-Math.PI/2+frac*Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
      // a faint full-circle track behind it
      ctx.strokeStyle=oc;ctx.globalAlpha=0.18;ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(X,Y,15,0,7);ctx.stroke();ctx.globalAlpha=1;
      // ── PER-OP MOTION (Phase 3) — distinct visual on top of the progress ring, so each deed READS ──
      if(ao.anim==="strike"){
        // ASSASSINATION — a violent red slash that sweeps across the operative, sharpening as the kill nears.
        // Cadence quickens with progress (~every 22 ticks early → ~every 10 ticks at the end); each slash is a
        // hard diagonal streak with a bright leading point, plus a brief red flash-ring on the strike beat.
        const period=Math.max(10,22-Math.round(frac*12));
        const phase=ST.tick%period;            // 0..period-1
        const inStrike=phase<5;                // the slash is visible for ~5 ticks of each cycle
        if(inStrike){
          const t=phase/5;                     // 0→1 across the slash
          const len=10+18*frac;                // longer, more committed slash as the op progresses
          // diagonal slash through the operative (top-right → bottom-left), swept by t
          const ang=-Math.PI/4;                // 45° downward
          const cx=X,cy=Y;
          const sweep=(t-0.5)*len*1.6;         // the streak travels across as t advances
          const dx=Math.cos(ang),dy=Math.sin(ang);
          // perpendicular offset gives the slash its travel
          const px=-dy*sweep,py=dx*sweep;
          ctx.strokeStyle="#ff2d3d";ctx.globalAlpha=0.92*(1-t*0.4);ctx.lineWidth=2.6;ctx.lineCap="round";
          ctx.beginPath();
          ctx.moveTo(cx+px-dx*len*0.5,cy+py-dy*len*0.5);
          ctx.lineTo(cx+px+dx*len*0.5,cy+py+dy*len*0.5);
          ctx.stroke();
          // bright leading point of the blade
          ctx.fillStyle="#ffd0d4";ctx.globalAlpha=0.9*(1-t*0.5);
          ctx.beginPath();ctx.arc(cx+px+dx*len*0.5,cy+py+dy*len*0.5,2.1,0,7);ctx.fill();
          ctx.lineCap="butt";ctx.globalAlpha=1;
        }
        // a hard red flash-ring on the first tick of each strike cycle — the "impact" beat
        if(phase===0){
          ctx.strokeStyle="#ff2d3d";ctx.globalAlpha=0.6;ctx.lineWidth=3;
          ctx.beginPath();ctx.arc(X,Y,17,0,7);ctx.stroke();ctx.globalAlpha=1;
        }
      }
    }
  }}
function toolColor(){if(!TOOL)return "#00e5ff";
  return TOOL.k==="salv"?"#ff9f2d":(TOOL.k==="decon"||TOOL.k==="cancel")?"#ff4757":"#00e5ff"}
function drawToolOverlay(){
  if(PT.marq){const m=PT.marq;
    ctx.strokeStyle=m.rect?toolColor():"#00e5ff";ctx.setLineDash([4,3]);
    ctx.strokeRect(Math.min(m.x0,m.x1),Math.min(m.y0,m.y1),
      Math.abs(m.x1-m.x0),Math.abs(m.y1-m.y0));ctx.setLineDash([])}
  if(TOOL&&TOOL.k==="build"&&INB(PT.hoverX,PT.hoverY)){
    const x=PT.hoverX*T,y=PT.hoverY*T;
    const ok=canPlace(TOOL.type,PT.hoverX,PT.hoverY)&&afford(DEF[TOOL.type].cost);
    ctx.fillStyle=ok?"rgba(0,229,255,.22)":"rgba(255,71,87,.22)";ctx.fillRect(x,y,T,T);
    ctx.strokeStyle=ok?"#00e5ff":"#ff4757";ctx.strokeRect(x+.5,y+.5,T-1,T-1)}
  else if(TOOL&&INB(PT.hoverX,PT.hoverY)){ctx.strokeStyle=toolColor();
    ctx.strokeRect(PT.hoverX*T+.5,PT.hoverY*T+.5,T-1,T-1)}}

function nightPass(){const la=lightLevel(hourN());if(la<=.02)return;
  const z=cam.z;
  octx.setTransform(1,0,0,1,0,0);octx.clearRect(0,0,oc.width,oc.height);
  octx.globalCompositeOperation="source-over";
  // deeper blue-black night sky
  octx.fillStyle="rgba(1,2,12,"+la.toFixed(2)+")";octx.fillRect(0,0,oc.width,oc.height);
  octx.globalCompositeOperation="destination-out";
  function light(wx,wy,r,a,warm){
    const sx=(wx*T-cam.x)*z*dpr,sy=(wy*T-cam.y)*z*dpr,sr=r*T*z*dpr;
    if(sx<-sr||sy<-sr||sx>oc.width+sr||sy>oc.height+sr)return;
    const g=octx.createRadialGradient(sx,sy,0,sx,sy,sr);
    // warm lamps punch more amber into the darkness
    const col=warm?"rgba(255,200,80,"+a+")":"rgba(255,255,255,"+a+")";
    g.addColorStop(0,col);g.addColorStop(1,"rgba(255,255,255,0)");
    octx.fillStyle=g;octx.beginPath();octx.arc(sx,sy,sr,0,7);octx.fill()}
  for(const s of ST.structs.values()){if(s.bp)continue;
    if(s.type==="lamp")light(s.x+.5,s.y+.5,5.5,.98,true);
    if(s.type==="streetlamp")light(s.x+.5,s.y+.5,7,.85,true); // wider warm glow
    // screens cast cool blue-white
    if(s.type==="tv"||s.type==="workstation")light(s.x+.5,s.y+.5,2.5,.45,false);}
  for(const p of ST.pawns)light(p.px,p.py,1.8,.6,false);
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(oc,0,0)}

function menuBg(){ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle="#04050a";ctx.fillRect(0,0,VW,VH);
  ctx.strokeStyle="rgba(0,229,255,.06)";
  const o=(performance.now()/60)%40;
  for(let x=-140+o;x<VW+40;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-100,VH);ctx.stroke()}}

let MOTES=null;
let BLOBS=null;
function initBlobs(){const COL=["#39d4ff","#7af7ff","#a259ff","#5cffd0"],a=[];
  const N=16;   // a few more floating clusters for ambience (was 10) — still sparse, not busy
  for(let i=0;i<N;i++){
    const orbs=2+RI(0,2),cl=[];                       // 2-4 orbs per cluster
    for(let k=0;k<orbs;k++)cl.push({dx:(Math.random()-.5)*9,dy:(Math.random()-.5)*9,r:1.3+Math.random()*1.7});
    a.push({x:RI(3,MW-3)*T,y:RI(3,MH-3)*T,c:COL[i%COL.length],ph:Math.random()*6.28,
      vx:(Math.random()-.5)*.05,vy:(Math.random()-.5)*.05,orbs:cl});}
  return a;}
function initMotes(){const SPORE=["#39ff88","#5cffd0","#7affb0","#a259ff","#5cffd0"],a=[];
  const N=18; // a few more drifting sparks for ambience (was 12) — kept tasteful
  for(let i=0;i<N;i++){
    // bias spawn toward map edges (nature outskirts), but let more drift through the core too
    let mx,my;
    if(Math.random()<0.55){
      // edge band
      const edge=RI(0,3);
      if(edge===0){mx=RI(2,MW-3);my=RI(2,18)}
      else if(edge===1){mx=RI(2,MW-3);my=RI(MH-18,MH-3)}
      else if(edge===2){mx=RI(2,18);my=RI(2,MH-3)}
      else{mx=RI(MW-18,MW-3);my=RI(2,MH-3)}
    }else{mx=RI(2,MW-3);my=RI(2,MH-3)}
    a.push({x:mx*T,y:my*T,
      c:SPORE[i%5],hex:SPORE[i%5],r:0.5+Math.random()*1.1,sp:0.04+Math.random()*.09,
      ph:Math.random()*6.28,b:0.3+Math.random()*.5,drift:(Math.random()-.5)*.02});}
  return a;}
// ── STREET LAYER — signs, posters, puddle shimmer ──
function drawStreetLayer(x0,y0,x1,y1){
  const t=performance.now()*0.001;
  // helper: draw neon sign plate
  function neonSign(wx,wy,label,col,w,h){
    if(wx<x0||wx>x1||wy<y0||wy>y1)return;
    const X=wx*T,Y=wy*T;
    // backing plate
    ctx.fillStyle="rgba(0,0,0,.75)";ctx.fillRect(X,Y,w,h);
    ctx.strokeStyle=col;ctx.lineWidth=1.2;
    ctx.strokeRect(X+.5,Y+.5,w-1,h-1);
    // glow
    const pulse=0.7+0.3*Math.sin(t*1.4+(wx+wy)*.3);
    ctx.shadowColor=col;ctx.shadowBlur=6*pulse;
    ctx.fillStyle=col;ctx.globalAlpha=pulse*.9;
    ctx.font="bold 6px monospace";ctx.textAlign="center";
    ctx.fillText(label,X+w/2,Y+h*.72);
    ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.textAlign="left";}
  // helper: hand-painted graffiti sign (residential style)
  function grafSign(wx,wy,label,col,angle){
    if(wx<x0||wx>x1||wy<y0||wy>y1)return;
    const X=wx*T,Y=wy*T;
    ctx.save();ctx.translate(X+T/2,Y+T/2);ctx.rotate(angle);
    ctx.globalAlpha=.72;ctx.fillStyle=col;
    ctx.font="bold 7px monospace";ctx.textAlign="center";
    ctx.fillText(label,0,0);
    ctx.globalAlpha=.18;
    ctx.fillRect(-label.length*2.5,2,label.length*5,1);// underline drip
    ctx.globalAlpha=1;ctx.restore();}
  // helper: poster on wall
  function poster(wx,wy,lines,bg,col){
    if(wx<x0||wx>x1||wy<y0||wy>y1)return;
    const X=wx*T+1,Y=wy*T+1;
    ctx.fillStyle=bg;ctx.fillRect(X,Y,T-2,T-2);
    ctx.fillStyle=col;ctx.font="5px monospace";
    lines.forEach((l,i)=>{ctx.textAlign="center";ctx.fillText(l,X+T/2,Y+5+i*5)});
    ctx.textAlign="left";
    ctx.strokeStyle="rgba(255,255,255,.15)";ctx.lineWidth=.5;
    ctx.strokeRect(X,Y,T-2,T-2);}

  // ── BUILDING NEON SIGNS (positioned above new core buildings) ──
  // Labor tier (corp office x31-40 y50, bodega x44-51 y50)
  neonSign(31,49,"▲ NEXUS CORP",  "#00d4ff",54,10);
  neonSign(44,49,"BODEGA",          "#ffc947",46,10);
  // Corporate sector (chrome bar x74-81 y26, med center x86-94 y26)
  const barCol=`hsl(${((t*.4)%1*360)|0},100%,65%)`;
  neonSign(74,25,"CHROME BAR",      barCol,   48,10);
  neonSign(86,25,"✚ MEDCENTER",  "#39ff88",54,10);
  // Crime corner (dealer x40-46 y68)
  neonSign(40,67,"THE DEN",         "#a259ff",40,9);
  // new districts
  neonSign(57,48,"HYDRO FARM",      "#39ff88",52,9);
  neonSign(50,66,"FIXER ROW",       "#ff8c42",46,9);
  neonSign(76,48,"⌂ CITY HALL",   "#7af7ff",54,10);
  neonSign(73,36,"⚖ PRECINCT",    "#47c8ff",50,9);

  // ── HOLOGRAPHIC BILLBOARDS — floating animated corp signage over open ground ──
  const billboards=[[96,42,9,5,"#19d4ff"],[34,60,8,4,"#ff2da6"],[100,20,9,5,"#7af7ff"],[60,58,8,4,"#39ffd0"]];
  billboards.forEach(([bx,by,bw,bh,col],bi)=>{
    if(bx+bw<x0||bx>x1||by+bh<y0||by>y1)return;
    const X=bx*T,Y=by*T,W=bw*T,H=bh*T,fl=0.55+0.45*Math.sin(t*3+bi*1.3);
    ctx.save();ctx.globalCompositeOperation="lighter";
    ctx.globalAlpha=0.06*fl;ctx.fillStyle=col;ctx.fillRect(X,Y,W,H);            // holo panel
    ctx.globalAlpha=0.11*fl;ctx.strokeStyle=col;ctx.lineWidth=0.6;              // scanlines
    for(let sy=Y+2;sy<Y+H;sy+=3){ctx.beginPath();ctx.moveTo(X,sy);ctx.lineTo(X+W,sy);ctx.stroke();}
    ctx.globalAlpha=0.5*fl;ctx.lineWidth=1;ctx.shadowColor=col;ctx.shadowBlur=6;
    ctx.strokeRect(X+.5,Y+.5,W-1,H-1);ctx.shadowBlur=0;                          // border
    const bg=ctx.createLinearGradient(X+W/2,Y+H,X+W/2,Y+H+T*3);                  // projector beam
    bg.addColorStop(0,col);bg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.globalAlpha=0.05*fl;ctx.fillStyle=bg;ctx.fillRect(X+W*.32,Y+H,W*.36,T*3);
    ctx.restore();ctx.globalAlpha=1;});

  // ── HOUSING BLOCK LABELS (above the aligned home rows) ──
  const resX0=31;
  for(let i=0;i<4;i++)grafSign(resX0+i*9,24,"HOME "+(i+1),
    ["#39ff88","#ffc947","#e040fb","#00d4ff"][i],(i%2?.04:-.05));
  for(let i=0;i<3;i++)grafSign(resX0+i*9,32,"HOME "+(i+5),
    ["#39ff88","#ffc947","#e040fb"][i],(i%2?-.04:.05));

  // ── ZONE LABELS + WALL POSTERS removed for the clean suspended look ──
  // (building name labels kept as wayfinding)

  // ── PUDDLE SHIMMER (on horizontal arterials near core) ──
  // PERF: build the radial gradient ONCE at the origin, then translate to each puddle, instead of
  // allocating a fresh createRadialGradient per puddle per frame (was a per-frame hotspot).
  const pshimmer=0.08+0.06*Math.sin(t*2.1);
  if(!_puddleGrad){_puddleGrad=ctx.createRadialGradient(T*.4,T*.2,0,T*.4,T*.2,T*.6);
    _puddleGrad.addColorStop(0,"rgba(0,180,255,.5)");_puddleGrad.addColorStop(1,"rgba(0,0,0,0)");}
  ctx.fillStyle=_puddleGrad;
  ROADS.h.forEach(([rx0,rx1,ry])=>{
    for(let px=rx0+5;px<rx1;px+=20){
      if(px<x0||px>x1||ry<y0||ry>y1)continue;
      const X=px*T,Y=ry*T+T*.9;
      ctx.globalAlpha=pshimmer;
      ctx.save();ctx.translate(X,Y);
      ctx.beginPath();ctx.ellipse(T*.4,T*.2,T*.55,T*.18,0,0,7);ctx.fill();
      ctx.restore();
      ctx.globalAlpha=1;}});

  // ── ZEBRA CROSSING at the central spine / mid-arterial intersection ──
  ctx.fillStyle="rgba(255,255,255,.08)";
  for(let xi=66;xi<=70;xi+=2){
    if(xi<x0||xi>x1)continue;
    ctx.fillRect(xi*T,48*T,T,T*2);}

  // ── NEON ARTERIAL STRIPS — glowing animated centerlines along the roads (cyberpunk road glow) ──
  ctx.save();ctx.globalCompositeOperation="lighter";ctx.lineCap="round";
  const hCols=["#19d4ff","#ffb020"], vCols=["#ff2da6","#19d4ff"];   // cyan/amber on h, magenta/cyan on v
  ROADS.h.forEach(([rx0,rx1,ry],idx)=>{
    if(ry<y0-2||ry>y1+1)return;
    const Y=(ry+1)*T, ax0=Math.max(rx0,x0)*T, ax1=Math.min(rx1,x1)*T;
    if(ax1<=ax0)return; const col=hCols[idx%hCols.length];
    ctx.shadowColor=col;
    ctx.strokeStyle=col;ctx.globalAlpha=.30;ctx.lineWidth=2.5;ctx.shadowBlur=8;
    ctx.beginPath();ctx.moveTo(ax0,Y);ctx.lineTo(ax1,Y);ctx.stroke();
    ctx.globalAlpha=.65;ctx.lineWidth=1;ctx.shadowBlur=3;
    ctx.beginPath();ctx.moveTo(ax0,Y);ctx.lineTo(ax1,Y);ctx.stroke();
    const span=ax1-ax0, head=ax0+((t*70+idx*140)%(span+140))-70;   // travelling pulse
    const g=ctx.createLinearGradient(head-70,0,head+18,0);
    g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(.85,col);g.addColorStop(1,"rgba(255,255,255,0)");
    ctx.strokeStyle=g;ctx.globalAlpha=.9;ctx.lineWidth=2.5;ctx.shadowBlur=10;
    ctx.beginPath();ctx.moveTo(Math.max(head-70,ax0),Y);ctx.lineTo(Math.min(head+18,ax1),Y);ctx.stroke();});
  ROADS.v.forEach(([rx,ry0,ry1],idx)=>{
    if(rx<x0-2||rx>x1+1)return;
    const X=(rx+1)*T, ay0=Math.max(ry0,y0)*T, ay1=Math.min(ry1,y1)*T;
    if(ay1<=ay0)return; const col=vCols[idx%vCols.length];
    ctx.shadowColor=col;
    ctx.strokeStyle=col;ctx.globalAlpha=.30;ctx.lineWidth=2.5;ctx.shadowBlur=8;
    ctx.beginPath();ctx.moveTo(X,ay0);ctx.lineTo(X,ay1);ctx.stroke();
    ctx.globalAlpha=.65;ctx.lineWidth=1;ctx.shadowBlur=3;
    ctx.beginPath();ctx.moveTo(X,ay0);ctx.lineTo(X,ay1);ctx.stroke();
    const span=ay1-ay0, head=ay0+((t*62+idx*110)%(span+140))-70;
    const g=ctx.createLinearGradient(0,head-70,0,head+18);
    g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(.85,col);g.addColorStop(1,"rgba(255,255,255,0)");
    ctx.strokeStyle=g;ctx.globalAlpha=.9;ctx.lineWidth=2.5;ctx.shadowBlur=10;
    ctx.beginPath();ctx.moveTo(X,Math.max(head-70,ay0));ctx.lineTo(X,Math.min(head+18,ay1));ctx.stroke();});
  // ── CIRCUIT-BOARD TRACES — subtle PCB branch stubs + via-pads off the arterials (replaces round junction glows) ──
  const _np=0.6+0.4*Math.sin(t*2.2);
  // a glowing PCB via-pad: soft halo + bright annular ring + bright center
  const _vp=(px,py,col,rad)=>{
    ctx.globalAlpha=.45*_np;ctx.drawImage(glowSprite(col),px-rad*2.3,py-rad*2.3,rad*4.6,rad*4.6);
    ctx.globalAlpha=.9;ctx.strokeStyle=col;ctx.lineWidth=1.3;ctx.shadowColor=col;ctx.shadowBlur=4;
    ctx.beginPath();ctx.arc(px,py,rad,0,7);ctx.stroke();
    ctx.globalAlpha=.95;ctx.fillStyle="#dffcff";ctx.beginPath();ctx.arc(px,py,rad*.42,0,7);ctx.fill();
    ctx.shadowBlur=0;};
  // a glowing trace stub (wide soft glow + tight bright core)
  const _stub=(xa,ya,xb,yb,col)=>{
    ctx.strokeStyle=col;ctx.shadowColor=col;
    ctx.globalAlpha=.28;ctx.lineWidth=2.2;ctx.shadowBlur=7;
    ctx.beginPath();ctx.moveTo(xa,ya);ctx.lineTo(xb,yb);ctx.stroke();
    ctx.globalAlpha=.68;ctx.lineWidth=.9;ctx.shadowBlur=2;
    ctx.beginPath();ctx.moveTo(xa,ya);ctx.lineTo(xb,yb);ctx.stroke();};
  // branch stubs off horizontal arterials (alternate up/down), each ending in a via-pad
  ROADS.h.forEach(([rx0,rx1,ry],idx)=>{ if(ry<y0-5||ry>y1+5)return;
    const Y=(ry+1)*T, col=hCols[idx%hCols.length];
    for(let bx=rx0+9;bx<rx1-3;bx+=17){
      if(bx<x0-4||bx>x1+4)continue;
      const dir=((bx+idx)&1)?1:-1, X=bx*T, len=(3+(bx%2))*T;
      _stub(X,Y,X,Y+dir*len,col); _vp(X,Y+dir*len,col,3.1);}});
  // branch stubs off vertical arterials (alternate left/right)
  ROADS.v.forEach(([rx,ry0,ry1],idx)=>{ if(rx<x0-5||rx>x1+5)return;
    const X=(rx+1)*T, col=vCols[idx%vCols.length];
    for(let by=ry0+11;by<ry1-3;by+=19){
      if(by<y0-4||by>y1+4)continue;
      const dir=((by+idx)&1)?1:-1, Y=by*T, len=(3+(by%2))*T;
      _stub(X,Y,X+dir*len,Y,col); _vp(X+dir*len,Y,col,3.1);}});
  // larger PCB via-pads where arterials cross (replaces the round junction glow)
  ROADS.h.forEach(([hx0,hx1,hy])=>{ if(hy<y0-2||hy>y1+1)return;
    ROADS.v.forEach(([vx,vy0,vy1])=>{
      if(vx<hx0||vx>hx1||hy<vy0||hy>vy1)return;                 // arterials must actually cross
      if(vx<x0-1||vx>x1+1)return;
      _vp((vx+1)*T,(hy+1)*T,"#7af7ff",4.3);});});
  ctx.globalAlpha=1;ctx.shadowBlur=0;
  ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.lineCap="butt";ctx.restore();
}

function render(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle="#04100c";ctx.fillRect(0,0,VW,VH);
  if(ST.phase==="menu"){menuBg();return}
  const z=cam.z;
  ctx.setTransform(dpr*z,0,0,dpr*z,-cam.x*dpr*z,-cam.y*dpr*z);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(tc,0,0);
  const x0=clamp(Math.floor(cam.x/T)-1,0,MW-1),y0=clamp(Math.floor(cam.y/T)-1,0,MH-1);
  const x1=clamp(Math.ceil((cam.x+VW/z)/T)+1,0,MW),y1=clamp(Math.ceil((cam.y+VH/z)/T)+1,0,MH);
  // ── FLOOR CAUSTICS — slow underwater light shimmer drifting over the abyss (additive, faint) ──
  {ctx.save();ctx.globalCompositeOperation="lighter";const cw=MW*T,ch=MH*T,ct=performance.now()*0.001;
   for(let i=0;i<6;i++){
     const px=cw*0.5+Math.sin(ct*0.15+i*1.7)*cw*0.42, py=ch*0.5+Math.cos(ct*0.11+i*2.3)*ch*0.42;
     if(px<x0*T-90||px>x1*T+90||py<y0*T-90||py>y1*T+90)continue;
     const rad=72+Math.sin(ct*0.3+i)*22;
     ctx.globalAlpha=0.03+0.02*Math.sin(ct*0.5+i);
     ctx.drawImage(glowSprite("#2ad8e0"),px-rad,py-rad,rad*2,rad*2);}
   ctx.restore();ctx.globalAlpha=1;}
  // drifting spore-motes
  if(!MOTES)MOTES=initMotes();
  for(const mo of MOTES){mo.y-=mo.sp;mo.x+=mo.drift||0;mo.ph+=0.04;
    if(mo.y<0){mo.y=MH*T;mo.x=Math.random()*MW*T}
    if(mo.x<0)mo.x=MW*T;if(mo.x>MW*T)mo.x=0;
    if(mo.x<x0*T||mo.x>x1*T||mo.y<y0*T||mo.y>y1*T)continue;
    const ma=(0.3+0.25*Math.sin(mo.ph))*mo.b;
    // soft bloom halo (cached) + bright core
    ctx.save();ctx.globalCompositeOperation="lighter";
    ctx.globalAlpha=ma*0.5;
    ctx.drawImage(glowSprite(mo.hex||"#a259ff"),mo.x-mo.r*3,mo.y-mo.r*3,mo.r*6,mo.r*6);
    ctx.restore();
    ctx.globalAlpha=ma;ctx.fillStyle=mo.c;
    ctx.beginPath();ctx.arc(mo.x,mo.y,mo.r,0,7);ctx.fill()}
  ctx.globalAlpha=1;
  // lingering plankton-blobs — slow bioluminescent jellyfish-clusters hovering in the void
  if(!BLOBS)BLOBS=initBlobs();
  for(const bl of BLOBS){
    bl.x+=bl.vx;bl.y+=bl.vy;bl.ph+=0.012;
    if(bl.x<T){bl.x=T;bl.vx=Math.abs(bl.vx)}if(bl.x>(MW-1)*T){bl.x=(MW-1)*T;bl.vx=-Math.abs(bl.vx)}
    if(bl.y<T){bl.y=T;bl.vy=Math.abs(bl.vy)}if(bl.y>(MH-1)*T){bl.y=(MH-1)*T;bl.vy=-Math.abs(bl.vy)}
    if(bl.x<x0*T||bl.x>x1*T||bl.y<y0*T||bl.y>y1*T)continue;
    const bob=Math.sin(bl.ph)*2,base=0.20+0.12*Math.sin(bl.ph*1.3);
    ctx.save();ctx.globalCompositeOperation="lighter";
    for(const o of bl.orbs){const ox=bl.x+o.dx,oy=bl.y+o.dy+bob;
      ctx.globalAlpha=base*0.6;ctx.drawImage(glowSprite(bl.c),ox-o.r*4,oy-o.r*4,o.r*8,o.r*8);
      ctx.globalAlpha=base*1.1;ctx.fillStyle=bl.c;ctx.beginPath();ctx.arc(ox,oy,o.r,0,7);ctx.fill();
      const spk=Math.sin(bl.ph*2.3+o.dx);                      // occasional bright sparkle
      if(spk>0.86){ctx.globalAlpha=(spk-0.86)*7*base;ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(ox,oy,o.r*0.7,0,7);ctx.fill();}}
    ctx.restore();}
  ctx.globalAlpha=1;
  // gang territory tint (drawn over terrain, under structures)
  if(ST.gangs.length){
    for(const g of ST.gangs){if(!g.turf.size)continue;
      ctx.globalAlpha=0.11;ctx.fillStyle=g.color;
      for(const k of g.turf){const gx=KX(k),gy=KY(k);
        if(gx<x0||gx>=x1||gy<y0||gy>=y1)continue;
        ctx.fillRect(gx*T,gy*T,T,T);}
      ctx.globalAlpha=1;}
    ctx.globalAlpha=1;}
  // stockpile zone
  ctx.fillStyle="rgba(0,229,255,.05)";ctx.strokeStyle="rgba(0,229,255,.18)";
  // bio-pod canopies (drawn under the room glints below)
  for(const rm of (ST.rooms||[])){if(rm.x0+rm.w<x0||rm.x0>x1||rm.y0+rm.h<y0||rm.y0>y1)continue;drawPod(rm)}
  drawStreetLayer(x0,y0,x1,y1);
  // (watch-post coverage rings removed per circuit-aesthetic pass — _secZones still drives gameplay coverage, just not drawn as a circle)
  // structures — iterate the structure set directly and viewport-cull each,
  // instead of scanning every tile in the viewport (huge win at zoom-out).
  for(const s of ST.structs.values()){
    if(s.x<x0||s.x>=x1||s.y<y0||s.y>=y1)continue;
    if(DEF[s.type]&&DEF[s.type].nat)continue;   // suspended-void look: hide open-area decor (benches, lamps, crates, dumpsters, planters)
    drawStruct(s);}
  drawCaravan(x0,y0,x1,y1);
  for(const p of ST.pawns)drawPawn(p);
  drawTombstones(x0,y0,x1,y1);
  drawEmotes(x0,y0,x1,y1);
  drawSays(x0,y0,x1,y1);
  // floating text
  ctx.font="7px monospace";ctx.textAlign="center";
  for(const f of ST.floats){const prog=1-f.ttl/f.t0;const a=clamp(1-prog*prog,0,1);
    ctx.globalAlpha=a;ctx.fillStyle=f.col;
    const rise=prog*prog*22; // ease-out upward
    const sz=Math.round(9+prog*2); // slight grow then shrink
    ctx.font="bold "+sz+"px monospace";ctx.textAlign="center";
    ctx.fillText(f.txt,f.x*T,(f.y*T)-rise);
    ctx.textAlign="left";ctx.font="9px monospace";}
  ctx.globalAlpha=1;ctx.textAlign="left";
  drawToolOverlay();
  nightPass();
  // screen-space effects
  ctx.setTransform(dpr,0,0,dpr,0,0);
  // day/night sky tint — shifts the vignette color by hour
  const hr=hourN();
  // night = deep blue, dawn/dusk = warm, day = neutral
  let tintR,tintG,tintB;
  if(hr<5||hr>=21){tintR=4;tintG=8;tintB=24;}        // night — blue
  else if(hr<7){const k=(hr-5)/2;tintR=4+40*k;tintG=8+18*k;tintB=24-6*k;}  // dawn warm
  else if(hr<19){tintR=8;tintG=10;tintB=16;}          // day neutral
  else{const k=(hr-19)/2;tintR=8+50*k;tintG=10+10*k;tintB=16+6*k;}  // dusk warm-orange
  const vg=vignetteGradient(tintR|0,tintG|0,tintB|0);
  ctx.fillStyle=vg;ctx.fillRect(0,0,VW,VH);
  // ── DAY/NIGHT VISUAL CYCLE — tint the whole district by the time of day (tied to the same lightLevel the
  // wisps' schedules use, so the world visibly darkens when they go home to sleep and brightens by day).
  {const ll=lightLevel(hourN());   // 0 in daylight → ~0.78 deep night
   if(ll>0.01){
     // cool blue night wash; deepens toward the small hours. A touch of magenta at the edges = neon dusk.
     const a=Math.min(0.6,ll*0.72);
     ctx.fillStyle="rgba(6,12,30,"+a.toFixed(3)+")";ctx.fillRect(0,0,VW,VH);
     // dusk/dawn warmth: when light is changing (not full night), a faint warm band
     const hr=hourN();
     if((hr>17&&hr<20)||(hr>5&&hr<7.5)){ctx.fillStyle="rgba(60,20,50,0.06)";ctx.fillRect(0,0,VW,VH);}
   }}
  // blackout: drop the district into darkness with a faint flicker
  if(ST.blackoutUntil&&ST.tick<ST.blackoutUntil){
    const flick=0.62+0.06*Math.sin(performance.now()*0.02)+(Math.random()<0.03?0.1:0);
    ctx.fillStyle="rgba(2,4,10,"+flick.toFixed(2)+")";ctx.fillRect(0,0,VW,VH);
  }
  // ── ATMOSPHERE OVERLAY (rain + drifting smog) — opt-in via the ☂ HUD toggle, off by default
  // so it never costs framerate unless the player wants the mood. Screen-space, cheap.
  if(ATMO.on){drawAtmosphere();}
  // ── LIGHTNING (⚡ toggle) — periodic flashes; the flash value also drives sprite-glow elsewhere.
  if(STORM.on){drawLightning();}
  // ── MAPPED-HOME HIGHLIGHT — when a surveilled wisp is selected and you've mapped where they live, mark
  //    their house on the map so the intel is VISIBLE (not just "Home: mapped" text in the panel). A pulsing
  //    bracketed marker over the home tile, color-keyed to surveillance. Only the selected wisp's home shows. ──
  {const selP=ST.sel&&ST.sel.length===1&&ST.sel[0]&&ST.sel[0].kind!=="struct"?ST.sel[0]:null;
   if(selP&&selP.routine&&selP.routine.home&&typeof routineStage==="function"&&routineStage(selP)>=1){
     const hx=selP.routine.home.x,hy=selP.routine.home.y;
     if(hx!=null&&hy!=null){
       const cx=hx*T+T/2,cy=hy*T+T/2;
       const pulse=0.5+0.5*Math.sin(performance.now()*0.004);
       const r=T*0.62+pulse*3;
       ctx.save();
       ctx.strokeStyle="#22ddff";ctx.globalAlpha=0.55+0.35*pulse;ctx.lineWidth=2;
       // corner brackets around the home tile (a "marked location" look, not a full box)
       const b=r,gap=r*0.5;
       const corners=[[-1,-1],[1,-1],[-1,1],[1,1]];
       for(const [sx,sy] of corners){
         ctx.beginPath();
         ctx.moveTo(cx+sx*b, cy+sy*b - sy*gap);
         ctx.lineTo(cx+sx*b, cy+sy*b);
         ctx.lineTo(cx+sx*b - sx*gap, cy+sy*b);
         ctx.stroke();
       }
       // a faint "HOME" tag above the marker
       ctx.globalAlpha=0.8;ctx.fillStyle="#22ddff";ctx.font="bold 7px monospace";ctx.textAlign="center";
       ctx.fillText("HOME", cx, cy - r - 3);
       ctx.restore();ctx.globalAlpha=1;ctx.textAlign="left";
     }
   }
  }
  // ── EVENT PING — a pulsing ring marking where something just happened (fire/mugging/caravan/brawl)
  if(eventPing){
    if(ST.tick>=eventPing.until){eventPing=null;}
    else{const px=eventPing.x*T,py=eventPing.y*T;
      const age=(eventPing.until-ST.tick)/(TPS*4);            // 1 → 0 over its life
      const pulse=0.5+0.5*Math.sin(ST.tick*0.25);
      ctx.save();
      ctx.strokeStyle=eventPing.color;ctx.globalAlpha=age*0.9;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(px,py,10+pulse*8+(1-age)*14,0,7);ctx.stroke();
      ctx.globalAlpha=age*0.5;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(px,py,6+pulse*4,0,7);ctx.stroke();
      ctx.restore();ctx.globalAlpha=1;
    }
  }
  // ── OP READOUT — the cyberpunk hacker terminal above the avatar during an operation (on top of all)
  drawOpReadout();
  // ── BLACKOUT DARKNESS — when the grid is down (sabotage/disaster), actually DARKEN the screen so the
  //    outage is VISIBLE, not just a state. Screen-space overlay (uniform dim), eased in/out, with a faint
  //    flicker so it reads as a power failure rather than nightfall. Logic (production/medical halt) already
  //    keys off gridDown(); this is the missing visual half.
  if(gridDown()){
    ctx.setTransform(dpr,0,0,dpr,0,0);           // screen space — cover the whole viewport
    const left=ST.blackoutUntil-ST.tick;
    const easeIn=Math.min(1,(ST._blackoutStart!=null?(ST.tick-ST._blackoutStart):TPS)/TPS);
    const easeOut=Math.min(1,left/TPS);
    const k=Math.max(0,Math.min(1,Math.min(easeIn,easeOut)));
    const flicker=0.04*Math.sin(performance.now()*0.013)+0.03*Math.sin(performance.now()*0.047);
    const dim=Math.max(0,(0.62+flicker)*k);      // up to ~62% black, flickering
    ctx.globalAlpha=dim;ctx.fillStyle="#02060a";ctx.fillRect(0,0,VW,VH);ctx.globalAlpha=1;
  }
}

// draw the streaming op terminal in screen space, anchored above the avatar's head
function drawOpReadout(){
  const av=theAvatar();
  opReadoutTick(av);
  if(!OPREADOUT)return;
  if(!av||(!av.activeOp&&OPREADOUT.phase==="run"))return;
  const z=cam.z;
  // avatar screen position (same world->screen math the sprite pass uses)
  const sx=(av.px*T-cam.x)*z, sy=(av.py*T-cam.y)*z;
  // build the visible lines
  const lines=[];
  lines.push({t:">"+OPREADOUT.boot+(OPREADOUT.phase==="run"?"...":""),c:"#22ddff"});
  for(let i=0;i<OPREADOUT.shown&&i<OPREADOUT.work.length;i++){
    lines.push({t:">"+OPREADOUT.work[i]+"...",c:"#7fe9ff"});
  }
  let cursor=OPREADOUT.phase==="run"&&(ST.tick%20<10);   // blinking cursor while running
  if(OPREADOUT.phase==="reveal"&&OPREADOUT.verdict){
    const v=OPREADOUT.verdict;
    // a glitchy reveal: for the first few ticks the verdict text scrambles, then locks
    const age=ST.tick-OPREADOUT.verdictAt;
    let vt=v.txt;
    if(age<10){const g="!<>-_\\/[]{}—=+*^?#";vt=v.txt.split("").map(ch=>ch===" "?" ":g[Math.floor(Math.random()*g.length)]).join("");}
    lines.push({t:">"+vt,c:v.col,big:true});
    if(age>=10&&v.sub)lines.push({t:"["+v.sub+"]",c:v.col,dim:true});
  }
  // panel geometry
  ctx.save();
  ctx.textAlign="left";
  const padX=7,padY=6,lh=12,bigLh=15;
  ctx.font="9px monospace";
  let maxW=0;for(const ln of lines){ctx.font=(ln.big?"bold 11px":"9px")+" monospace";maxW=Math.max(maxW,ctx.measureText(ln.t).width);}
  const panelW=Math.max(108,maxW+padX*2);
  let panelH=padY*2;for(const ln of lines)panelH+=ln.big?bigLh:lh;
  // position: above the avatar, clamped to stay on screen
  let px=sx-panelW/2, py=sy-46-panelH;
  px=Math.max(6,Math.min(VW-panelW-6,px));
  py=Math.max(6,py);
  // backdrop — dark translucent terminal with a bright top border
  ctx.fillStyle="rgba(2,8,16,0.92)";
  ctx.fillRect(px,py,panelW,panelH);
  const borderC=OPREADOUT.phase==="reveal"&&OPREADOUT.verdict?OPREADOUT.verdict.col:"#22ddff";
  ctx.fillStyle=borderC;ctx.globalAlpha=0.9;ctx.fillRect(px,py,panelW,2);ctx.globalAlpha=1;
  // faint scanlines for the CRT feel
  ctx.globalAlpha=0.05;ctx.fillStyle="#22ddff";
  for(let yy=py+3;yy<py+panelH;yy+=3)ctx.fillRect(px,yy,panelW,1);
  ctx.globalAlpha=1;
  // a thin connector line down to the avatar
  ctx.strokeStyle=borderC;ctx.globalAlpha=0.4;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx,py+panelH);ctx.lineTo(sx,sy-30);ctx.stroke();ctx.globalAlpha=1;
  // text
  let ty=py+padY+9;
  for(const ln of lines){
    ctx.font=(ln.big?"bold 11px":"9px")+" monospace";
    ctx.globalAlpha=ln.dim?0.7:1;
    ctx.fillStyle=ln.c;
    ctx.fillText(ln.t,px+padX,ty);
    ty+=ln.big?bigLh:lh;
  }
  // blinking cursor on the last running line
  if(cursor&&lines.length){
    ctx.font="9px monospace";ctx.fillStyle="#7fe9ff";
    const lastW=ctx.measureText(lines[lines.length-1].t).width;
    ctx.fillRect(px+padX+lastW+2,ty-lh-7,5,8);
  }
  ctx.globalAlpha=1;ctx.restore();
}

// rain + smog atmosphere, drawn in screen space. State + particle pool created lazily.
const ATMO={on:false,drops:null,fog:0};
// LIGHTNING storm: when on, schedules flashes. STORM.flash (0..1) ramps up on a strike and decays —
// it's read by drawLightning (screen flash) AND by the sprite glow (stormGlow()) so neon pops on strikes.
const STORM={on:false,flash:0,nextAt:0,seq:0};
function stormGlow(){return STORM.on?STORM.flash:0;}   // 0..1 extra glow factor during a flash
function drawLightning(){
  const now=performance.now();
  // schedule the next strike
  if(now>=STORM.nextAt){
    STORM.flash=1; STORM.seq++;
    STORM.nextAt=now+2200+Math.random()*5200;   // a strike every ~2.2–7.4s
  }
  if(STORM.flash>0.001){
    // a strike is often a quick double-flash; model with a fast decay + a small secondary bump
    STORM.flash*=0.86;
    if(STORM.flash>0.55&&Math.random()<0.12)STORM.flash=Math.min(1,STORM.flash+0.4); // flicker
    // screen flash: cool white-blue, brightest at the top (sky) fading down
    const a=STORM.flash;
    const fg=ctx.createLinearGradient(0,0,0,VH);
    fg.addColorStop(0,"rgba(200,225,255,"+(0.42*a).toFixed(3)+")");
    fg.addColorStop(0.5,"rgba(170,200,255,"+(0.22*a).toFixed(3)+")");
    fg.addColorStop(1,"rgba(140,170,230,"+(0.06*a).toFixed(3)+")");
    ctx.fillStyle=fg;ctx.fillRect(0,0,VW,VH);
    // an occasional jagged bolt across the sky on the strongest flashes
    if(a>0.7){
      ctx.save();ctx.globalAlpha=a;ctx.strokeStyle="rgba(220,235,255,0.9)";ctx.lineWidth=2;ctx.lineCap="round";
      let bx=VW*(0.2+Math.random()*0.6),by=0;ctx.beginPath();ctx.moveTo(bx,by);
      const segs=5+((Math.random()*4)|0);
      for(let i=0;i<segs;i++){bx+=(Math.random()-0.5)*VW*0.12;by+=VH/segs*(0.7+Math.random()*0.6);ctx.lineTo(bx,by);}
      ctx.stroke();ctx.restore();
    }
  }
}
function initRain(){const a=[];const n=Math.round((VW*VH)/5500);  // density scales to canvas
  for(let i=0;i<n;i++)a.push({x:Math.random()*VW,y:Math.random()*VH,len:6+Math.random()*10,sp:7+Math.random()*7,w:Math.random()*0.5+0.3});
  return a;}
function drawAtmosphere(){
  // drifting smog haze — a slow-moving translucent gradient wash, layered for depth
  const t=performance.now()*0.00006;
  ATMO.fog=Math.min(1,ATMO.fog+0.02);   // fades in when toggled on
  const fogA=0.10*ATMO.fog;
  ctx.save();
  for(let i=0;i<2;i++){
    const ox=((Math.sin(t*(i+1))*0.5+0.5)*VW*0.4)-(VW*0.1);
    const fg=ctx.createLinearGradient(ox,0,ox+VW,VH);
    fg.addColorStop(0,"rgba(40,30,60,0)");
    fg.addColorStop(0.5,"rgba("+(30+i*15)+","+(24+i*8)+","+(50+i*10)+","+fogA+")");
    fg.addColorStop(1,"rgba(20,30,50,0)");
    ctx.fillStyle=fg;ctx.fillRect(0,0,VW,VH);
  }
  ctx.restore();
  // rain — diagonal streaks, brighter and denser so it clearly reads as falling rain
  if(!ATMO.drops)ATMO.drops=initRain();
  ctx.save();
  const skew=3.0;  // slant
  ctx.lineWidth=1.1;ctx.lineCap="round";
  for(const d of ATMO.drops){
    d.y+=d.sp;d.x+=skew*0.45;
    if(d.y>VH){d.y=-d.len;d.x=Math.random()*VW;}
    if(d.x>VW)d.x-=VW;
    ctx.globalAlpha=(d.w*0.55+0.35)*ATMO.fog;
    ctx.strokeStyle="rgba(170,205,240,0.9)";
    ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-skew*d.len*0.22,d.y+d.len);ctx.stroke();
  }
  ctx.globalAlpha=1;ctx.restore();
}

// cached day/night vignette — rebuilds only when the (quantized) tint or canvas size changes,
// instead of allocating a full-screen radial gradient every frame.
let _vigCache=null,_vigKey="";
let _puddleGrad=null;   // cached radial gradient for puddle shimmer (built once, translated per puddle)
function vignetteGradient(r,g,b){
  const key=r+","+g+","+b+"|"+VW+"x"+VH;
  if(_vigCache&&_vigKey===key)return _vigCache;
  const vg=ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.42,VW/2,VH/2,Math.max(VW,VH)*.8);
  vg.addColorStop(0,"rgba(0,0,0,0)");
  vg.addColorStop(1,"rgba("+r+","+g+","+b+",.5)");
  _vigCache=vg;_vigKey=key;return vg;}

/* ============================================================
   INPUT & TOOLS
   ============================================================ */
const PT={down:false,btn:0,sx:0,sy:0,lx:0,ly:0,moved:false,panning:false,
  marq:null,paint:null,lastC:null,hoverX:-1,hoverY:-1,hwx:0,hwy:0,
  touches:new Map(),pinch:null};
let TOOL=null;
const KEYS={};
function s2w(sx,sy){return{wx:sx/cam.z+cam.x,wy:sy/cam.z+cam.y}}
function cellAt(sx,sy){const w=s2w(sx,sy);
  return{x:Math.floor(w.wx/T),y:Math.floor(w.wy/T),wx:w.wx,wy:w.wy}}
function selPawns(){return ST.sel.filter(e=>e.kind==="pawn")}
let INSPECT_TAB="status";   // which character-panel tab is active: status|person|ties|mind
// wispThoughts — surfaces a wisp's inner state as short thoughts. Outliers + critical events + a
// little mundane chatter. Each {txt, col}. Derived from the wisp's current state, no AI cost.
function wispThoughts(p){
  const out=[];const add=(txt,col)=>out.push({txt,col:col||"#9fb4d8"});
  const mood=p.mood||50,stress=p.stress||0;
  // EXTREMES (outliers) — strongest signals first
  if(mood<18)add("Everything is falling apart. I can't keep doing this.","#ff6b6b");
  else if(mood>82)add("Things are actually good right now. I could get used to this.","#5cff9e");
  if(stress>80)add("My nerves are shot. One more thing and I'll snap.","#ff8da3");
  if((p.needs.food||100)<15)add("I'm starving. I need to eat something, anything.","#ffb454");
  if((p.needs.rest||100)<15)add("So tired. I can barely keep my eyes open.","#ffb454");
  if(p.homeless)add("No bed tonight. Sleeping rough again — this isn't living.","#ff8c42");
  if(p.sick)add("I feel awful. Burning up. I need a clinic.","#ff6b6b");
  if((p.addiction||0)>50)add("I need a hit. I can't think about anything else.","#c98bff");
  // CRITICAL EVENTS — recent strong memories
  if(p.mem&&p.mem.length){const recent=p.mem.slice(-3);
    for(const m of recent){const t=m.t||"";
      if(/evicted/i.test(t)){add("Losing my place still stings. They threw me out like nothing.","#ff8c42");break;}
      if(/robbed|lifting|pocket/i.test(t)&&/got|caught/i.test(t)){add("Someone took what was mine. I won't forget it.","#ff6b6b");break;}
      if(/witnessed|attack|kill/i.test(t)){add("I saw something I can't unsee. It plays over and over.","#ff8da3");break;}
    }}
  // INSURRECTION state
  if(p.recruited)add("I'm part of something now. The cause is bigger than any of us.","#5cff9e");
  else if(p.informant)add("If they ever find out what I've told the regime... I can't think about it.","#ff5470");
  else if((p.allegiance||0)>50)add("Something has to change in this city. Maybe I could help.","#5cff9e");
  else if((p.allegiance||0)<-50)add("These agitators are going to get us all killed. Order matters.","#ff8da3");
  // MUNDANE CHATTER — only if nothing pressing, and only sometimes (keeps it from being noise)
  if(out.length===0){
    const idx=(p.id+Math.floor(ST.tick/TPD))%6;   // stable-ish per day so it doesn't flicker
    const chatter=[
      "Another day on the block. Same as the last.",
      "Wonder what's cooking at the market today.",
      "Could use a drink and some quiet.",
      "The neon never really lets you sleep, does it.",
      "Keeping my head down. That's how you survive here.",
      "One of these days I'll get out of this sprawl.",
    ];
    if(p.mood>40)add(chatter[idx],"rgba(159,180,216,.7)");
  }
  return out.slice(0,3);
}
function pawnAt(wx,wy){let best=null,bd=.8;
  for(const p of ST.pawns){const d=DIST(wx/T,wy/T,p.px,p.py);if(d<bd){bd=d;best=p}}return best}
function setTool(t){TOOL=t;$("cancelTool").style.display=t?"block":"none";refreshToolBtns()}
function dragToolKind(){if(!TOOL)return null;
  if(TOOL.k==="build")return TOOL.type==="wall"?"paint":"single";
  return "rect"}
function applyCell(x,y){if(!INB(x,y)||!TOOL)return;
  switch(TOOL.k){
    case "build":placeBp(TOOL.type,x,y);break;
    case "salv":{const s=structAt(x,y);
      if(s&&(s.type==="scrap"||s.type==="cache")){s.desig=true;ST.flags.salv=true}break}
    case "cancel":{const s=structAt(x,y);
      if(s){if(s.bp)cancelBp(s);else{s.desig=false;s.decon=false}}break}
    case "decon":{const s=structAt(x,y);
      if(s&&!s.bp&&(s.type==="ruin"||DEF[s.type].cat==="b"))s.decon=true;break}}}
function applyRect(x0,y0,x1,y1){
  const ax=clamp(Math.min(x0,x1),0,MW-1),bx=clamp(Math.max(x0,x1),0,MW-1);
  const ay=clamp(Math.min(y0,y1),0,MH-1),by=clamp(Math.max(y0,y1),0,MH-1);
  for(let y=ay;y<=by;y++)for(let x=ax;x<=bx;x++)applyCell(x,y)}
function paintCell(x,y){if(!PT.paint)return;const k=K(x,y);
  if(PT.paint.has(k))return;PT.paint.add(k);applyCell(x,y)}
function paintTo(c){if(!PT.lastC){PT.lastC=c;paintCell(c.x,c.y);return}
  const x=PT.lastC.x,y=PT.lastC.y;
  const n=Math.max(Math.abs(c.x-x),Math.abs(c.y-y));
  for(let i=1;i<=n;i++)paintCell(Math.round(x+(c.x-x)*i/n),Math.round(y+(c.y-y)*i/n));
  PT.lastC=c}

function clickSelect(c){const p=pawnAt(c.wx,c.wy);
  // AVATAR OP TARGETING: if we're picking a target for sabotage/frame, resolve it here
  if(ST.opTargeting){
    const opKey=ST.opTargetingOp;const need=ST.opTargeting;const opDef=AVATAR_OPS[opKey];
    if(need==="utility"){
      const s=structAt(c.x,c.y);
      if(s&&DEF[s.type]&&DEF[s.type].utility&&!s.bp){
        // WALK-TO-TARGET: if in range, fire now; otherwise the operative walks there and executes on arrival.
        s.kind="s";const av=theAvatar();
        if(av){av.manualHold=false;
          if(tryOp(av,opKey,s)){
            ST.opTargeting=null;ST.opTargetingOp=null;
            if(!avatarInRange(av,opKey,s))flashMsg&&flashMsg("Moving to the target\u2026");
            collapseOpDock();
          }
        }
        ST.sel=[theAvatar()].filter(Boolean);renderInspect();syncHUD();return;
      }else{flashMsg&&flashMsg("Not a power/water building \u2014 targeting cancelled.");ST.opTargeting=null;ST.opTargetingOp=null;syncHUD();return;}
    }else if(need==="regime"){
      if(p&&!p.isAvatar&&!isChild(p)&&(p.regimeForce||p.informant||(p.allegiance||0)<-20)){
        p.kind="pawn";const av=theAvatar();
        if(av){av.manualHold=false;
          if(tryOp(av,opKey,p)){
            ST.opTargeting=null;ST.opTargetingOp=null;
            if(!avatarInRange(av,opKey,p))flashMsg&&flashMsg("Moving to the target\u2026");
            collapseOpDock();
          }
        }
        ST.sel=[theAvatar()].filter(Boolean);renderInspect();syncHUD();return;
      }else{flashMsg&&flashMsg("Not a regime asset (need a loyalist/enforcer/informant) \u2014 targeting cancelled.");ST.opTargeting=null;ST.opTargetingOp=null;syncHUD();return;}
    }else if(need==="anyPawn"){
      if(p&&!p.isAvatar&&!isChild(p)&&p.hp>0){
        // blackmail requires a KNOWN secret on this target — this is a SOFT fail: keep targeting active so
        // the player can pick a different (valid) wisp, but only flash the hint ONCE (not every click).
        if(opDef&&opDef.needsSecret&&!knownSecret(p)){
          if(ST._lastDirtWarn!==p.id){ST._lastDirtWarn=p.id;flashMsg&&flashMsg("You have no dirt on "+p.name.split(" ")[0]+" \u2014 surveil them first, or pick someone you've already surveilled.");}
          return;
        }
        ST._lastDirtWarn=null;
        p.kind="pawn";const av=theAvatar();
        if(av){av.manualHold=false;
          if(tryOp(av,opKey,p)){
            ST.opTargeting=null;ST.opTargetingOp=null;
            if(!avatarInRange(av,opKey,p))flashMsg&&flashMsg("Moving to the target\u2026");
            collapseOpDock();
          }
        }
        ST.sel=[theAvatar()].filter(Boolean);renderInspect();syncHUD();return;
      }else{flashMsg&&flashMsg("Not a valid target \u2014 targeting cancelled.");ST.opTargeting=null;ST.opTargetingOp=null;ST._lastDirtWarn=null;syncHUD();return;}
    }
  }
  if(p){ST.sel=[p];renderInspect();return}
  const s=structAt(c.x,c.y);if(s){ST.sel=[s];renderInspect();return}
  // AVATAR MOVE-ON-CLICK: if your operative is selected and you click an empty walkable tile, walk it there.
  // If an op is in flight, moving ABORTS it (a deliberate bail) — you can break off if the heat changes.
  const selA=ST.sel&&ST.sel[0];
  if(selA&&selA.isAvatar&&colCost(c.x,c.y)>=0){
    if(selA.activeOp){selA.activeOp=null;flashMsg&&flashMsg("Operation abandoned.");} OPREADOUT=null;
    selA.job={t:"goto",x:c.x,y:c.y};selA.cmd=null;
    if(typeof SFX!=="undefined"&&SFX.ui)SFX.ui();
    return;
  }
  ST.sel=[];renderInspect()}
function marqueeSelect(m){
  const ax=Math.min(m.x0,m.x1),bx=Math.max(m.x0,m.x1);
  const ay=Math.min(m.y0,m.y1),by=Math.max(m.y0,m.y1);
  const got=ST.pawns.filter(p=>p.px*T>=ax&&p.px*T<=bx&&p.py*T>=ay&&p.py*T<=by);
  if(got.length)ST.sel=got;else ST.sel=[];
  renderInspect()}
// RIGHT-CLICK = COMMAND THE OPERATIVE. We always act from the avatar's perspective, so a right-click is an
// order to YOUR operative — no need to select it first. On empty walkable ground: go manual + path there.
// On a wisp/structure: select it (surfacing the valid ops you can perform on that target) AND start moving
// toward it so you're in range to act. This is the unified move+target flow.
function rmbAction(c){
  if(TOOL){setTool(null);return}
  if(ST.phase!=="run")return;
  const av=theAvatar();if(!av||av.hp<=0)return;
  // a target wisp under the cursor? select it (shows what we can do TO them) and close in.
  const tp=pawnAt(c.wx,c.wy);
  if(tp&&tp!==av){
    ST.sel=[tp];
    // move the operative adjacent to the target so an op is in range (manual takeover)
    if(!av.jailed){
      ST.avatarManual=true;
      if(av.activeOp){av.activeOp=null;OPREADOUT=null;flashMsg&&flashMsg("Operation abandoned.");}
      av.job={t:"goto",x:tp.px|0,y:tp.py|0,adj:1};av.cmd=null;
    }
    renderInspect();syncHUD();
    if(typeof SFX!=="undefined"&&SFX.ui)SFX.ui();
    return;
  }
  // a structure under the cursor? select it (sabotage-able buildings show their op) and close in.
  const s=structAt(c.x,c.y);
  if(s){
    ST.sel=[s];
    if(!av.jailed){ST.avatarManual=true;
      if(av.activeOp){av.activeOp=null;OPREADOUT=null;flashMsg&&flashMsg("Operation abandoned.");}
      av.job={t:"goto",x:s.x,y:s.y,adj:1};av.cmd=null;}
    renderInspect();syncHUD();
    if(typeof SFX!=="undefined"&&SFX.ui)SFX.ui();
    return;
  }
  // empty WALKABLE ground → go manual and walk there.
  if(colCost(c.x,c.y)>=0&&!av.jailed){
    ST.avatarManual=true;
    if(av.activeOp){av.activeOp=null;OPREADOUT=null;flashMsg&&flashMsg("Operation abandoned.");}
    av.job={t:"goto",x:c.x,y:c.y};av.cmd=null;
    ST.sel=[av];                                  // keep the operative in focus so the ops bar shows
    renderInspect();syncHUD();
    if(typeof SFX!=="undefined"&&SFX.ui)SFX.ui();
    return;
  }
}
function tapAction(c){
  if(TOOL){applyCell(c.x,c.y);return}
  const p=pawnAt(c.wx,c.wy);
  if(p){ST.sel=[p];renderInspect();syncHUD();return}
  const s=structAt(c.x,c.y);
  if(s){ST.sel=[s];renderInspect();return}
  // AVATAR MOVE-ON-CLICK: operative selected + empty walkable tile -> walk there (aborts an op if in flight)
  const selA=ST.sel&&ST.sel[0];
  if(selA&&selA.isAvatar&&colCost(c.x,c.y)>=0){
    if(selA.activeOp){selA.activeOp=null;flashMsg&&flashMsg("Operation abandoned.");} OPREADOUT=null;
    selA.job={t:"goto",x:c.x,y:c.y};selA.cmd=null;
    if(typeof SFX!=="undefined"&&SFX.ui)SFX.ui();
    return;
  }
  ST.sel=[];renderInspect()}


/* mouse */
cv.addEventListener("mousedown",e=>{e.preventDefault();SFX.wake();
  if(ST.phase!=="run")return;
  const c=cellAt(e.clientX,e.clientY);
  if(e.button===0){PT.down=true;PT.btn=0;PT.sx=e.clientX;PT.sy=e.clientY;PT.moved=false;
    const dk=dragToolKind();
    if(dk==="paint"){PT.paint=new Set();PT.lastC=c;paintCell(c.x,c.y)}
    else if(dk==="rect")PT.marq={x0:c.wx,y0:c.wy,x1:c.wx,y1:c.wy,rect:true};
    else if(!TOOL)PT.marq={x0:c.wx,y0:c.wy,x1:c.wx,y1:c.wy,rect:false}}
  else{
    // RIGHT/MIDDLE BUTTON. Panning with the mouse now requires CTRL+right-drag (so a plain right-click is
    // free to COMMAND the operative via rmbAction on mouseup). Middle-button still pans freely. We still
    // arm a "panning" drag for ctrl+right and middle so the move handler can pan; a plain right-click that
    // doesn't drag falls through to rmbAction on mouseup.
    PT.panning=true;PT.btn=e.button;PT.lx=e.clientX;PT.ly=e.clientY;PT.moved=false;
    PT.panAllowed=(e.button===1)||(e.button===2&&(e.ctrlKey||e.metaKey));   // middle = always; right = ctrl only
  }});
window.addEventListener("mousemove",e=>{
  const c=cellAt(e.clientX,e.clientY);
  PT.hoverX=c.x;PT.hoverY=c.y;PT.hwx=c.wx;PT.hwy=c.wy;
  if(PT.panning){const dx=e.clientX-PT.lx,dy=e.clientY-PT.ly;
    if(Math.abs(dx)+Math.abs(dy)>3)PT.moved=true;
    if(PT.panAllowed){cam.x-=dx/cam.z;cam.y-=dy/cam.z;clampCam();if(cam.follow)stopFollow();}
    PT.lx=e.clientX;PT.ly=e.clientY;return}
  if(!PT.down)return;
  if(Math.hypot(e.clientX-PT.sx,e.clientY-PT.sy)>4)PT.moved=true;
  if(PT.paint)paintTo(c);
  else if(PT.marq){PT.marq.x1=c.wx;PT.marq.y1=c.wy}});
window.addEventListener("mouseup",e=>{
  if(PT.panning){PT.panning=false;
    if(e.button===2&&!PT.moved&&ST.phase==="run")rmbAction(cellAt(e.clientX,e.clientY));
    return}
  if(!PT.down)return;PT.down=false;
  if(ST.phase!=="run"){PT.paint=null;PT.marq=null;return}
  const c=cellAt(e.clientX,e.clientY);
  if(PT.paint){PT.paint=null;PT.lastC=null;return}
  if(PT.marq){const m=PT.marq;PT.marq=null;
    if(m.rect){applyRect(Math.floor(m.x0/T),Math.floor(m.y0/T),
      Math.floor(m.x1/T),Math.floor(m.y1/T));return}
    if(!PT.moved)clickSelect(c);else marqueeSelect(m);
    syncHUD();return}
  if(TOOL&&dragToolKind()==="single")applyCell(c.x,c.y)});
cv.addEventListener("contextmenu",e=>e.preventDefault());
cv.addEventListener("wheel",e=>{e.preventDefault();if(ST.phase!=="run")return;
  const f=e.deltaY<0?1.12:1/1.12;
  const nz=clamp(cam.z*f,.35,3);
  const w=s2w(e.clientX,e.clientY);
  cam.x=w.wx-e.clientX/nz;cam.y=w.wy-e.clientY/nz;cam.z=nz;clampCam()},{passive:false});

/* keyboard */
window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();
  if(e.target&&e.target.tagName==="INPUT")return;
  KEYS[k]=true;
  // ESC PRIORITY CHAIN: settings → system menu → overlay → modal → inspect → (nothing open) open system menu
  if(k==="escape"&&typeof settingsOpen==="function"&&settingsOpen()){closeSettings();SFX.ui&&SFX.ui();return;}
  if(k==="escape"&&typeof sysMenuOpen==="function"&&sysMenuOpen()){closeSysMenu();SFX.ui&&SFX.ui();return;}
  // overlay open: Esc closes it (takes priority)
  if($("overlay").classList.contains("open")){
    if(k==="escape"){closeOverlay();SFX.ui();}return}
  if($("modal").classList.contains("open")){
    if(k==="escape"&&ST.phase==="run")hideModal();return}
  if(ST.phase!=="run"){
    // even before run, allow Esc to open the menu (e.g. paused) — but only if a game exists
    return}
  // Esc closes the inspect/operative panel if it's showing
  if(k==="escape"&&ST.sel&&ST.sel.length){ST.sel=[];$("inspect").style.display="none";SFX.ui&&SFX.ui();return;}
  // Esc with a tool/submenu open: cancel it
  if(k==="escape"&&typeof subCat!=="undefined"&&subCat){if(typeof closeSub==="function")closeSub();SFX.ui&&SFX.ui();return;}
  // Esc with nothing open: open the system menu (New Game / Save / Load / Settings)
  if(k==="escape"){if(typeof openSysMenu==="function"){openSysMenu();SFX.ui&&SFX.ui();}return;}
  if(k===" "){togglePause();e.preventDefault()}
  else if(k==="1")setSpeed(1);else if(k==="2")setSpeed(2);else if(k==="3")setSpeed(3);
  else if(k==="j")openOverlay("diary");
  else if(k==="k")openOverlay("crew");
  else if(k==="l")openOverlay("district");
  else if(k==="t")openOverlay("tasks");
  else if(k==="p")togglePerfHUD();
  else if(k==="escape"){if(TOOL)setTool(null);
    else if(cam.follow){stopFollow();renderInspect();}
    else{ST.sel=[];renderInspect();closeSub();syncHUD()}}});
window.addEventListener("keyup",e=>{KEYS[e.key.toLowerCase()]=false});

/* touch */
cv.addEventListener("touchstart",e=>{e.preventDefault();SFX.wake();
  if(ST.phase!=="run")return;
  for(const t of e.changedTouches)
    PT.touches.set(t.identifier,{x:t.clientX,y:t.clientY,sx:t.clientX,sy:t.clientY,t0:performance.now()});
  if(PT.touches.size===2){const a=[...PT.touches.values()];
    PT.pinch={d:Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y)};
    PT.marq=null;PT.paint=null;PT.lastC=null}
  else if(PT.touches.size===1&&TOOL&&dragToolKind()==="paint"){
    const c=cellAt(e.changedTouches[0].clientX,e.changedTouches[0].clientY);
    PT.paint=new Set();PT.lastC=c;paintCell(c.x,c.y)}},{passive:false});
cv.addEventListener("touchmove",e=>{e.preventDefault();if(ST.phase!=="run")return;
  for(const t of e.changedTouches){const r=PT.touches.get(t.identifier);
    if(r){r.px=r.x;r.py=r.y;r.x=t.clientX;r.y=t.clientY}}
  const a=[...PT.touches.values()];
  if(a.length>=2&&PT.pinch){
    const d=Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y);
    const ccx=(a[0].x+a[1].x)/2,ccy=(a[0].y+a[1].y)/2;
    const nz=clamp(cam.z*d/Math.max(1,PT.pinch.d),.35,3);
    const w=s2w(ccx,ccy);
    cam.x=w.wx-ccx/nz;cam.y=w.wy-ccy/nz;cam.z=nz;PT.pinch.d=d;clampCam();return}
  if(a.length===1){const r=a[0];
    const moved=Math.hypot(r.x-r.sx,r.y-r.sy);
    const c=cellAt(r.x,r.y);
    PT.hoverX=c.x;PT.hoverY=c.y;PT.hwx=c.wx;PT.hwy=c.wy;
    if(TOOL){const dk=dragToolKind();
      if(dk==="paint"&&PT.paint)paintTo(c);
      else if(dk==="rect"&&moved>8){
        if(!PT.marq){const s0=cellAt(r.sx,r.sy);
          PT.marq={x0:s0.wx,y0:s0.wy,x1:c.wx,y1:c.wy,rect:true}}
        else{PT.marq.x1=c.wx;PT.marq.y1=c.wy}}
      return}
    if(moved>8&&r.px!==undefined){
      cam.x-=(r.x-r.px)/cam.z;cam.y-=(r.y-r.py)/cam.z;clampCam();if(cam.follow)stopFollow()}}},{passive:false});
cv.addEventListener("touchend",e=>{e.preventDefault();if(ST.phase!=="run")return;
  for(const t of e.changedTouches){const r=PT.touches.get(t.identifier);
    PT.touches.delete(t.identifier);
    if(!r||PT.touches.size>0)continue;
    PT.pinch=null;
    const dur=performance.now()-r.t0;
    const moved=Math.hypot(t.clientX-r.sx,t.clientY-r.sy);
    const c=cellAt(t.clientX,t.clientY);
    if(PT.paint){PT.paint=null;PT.lastC=null;continue}
    if(PT.marq){const m=PT.marq;PT.marq=null;
      applyRect(Math.floor(m.x0/T),Math.floor(m.y0/T),
        Math.floor(m.x1/T),Math.floor(m.y1/T));continue}
    if(dur<400&&moved<10)tapAction(c)}},{passive:false});
cv.addEventListener("touchcancel",e=>{
  for(const t of e.changedTouches)PT.touches.delete(t.identifier);
  PT.pinch=null;PT.paint=null;PT.marq=null;PT.lastC=null});

/* ============================================================
   UI / DOM
   ============================================================ */
// ── DIARY SYSTEM ──
const DIARY_ENTRIES=[];
// ── DISTRICT CHRONICLE: a curated saga of only the major, lasting story beats ──
// (births, deaths, comings-of-age, unions, factions, wars, disasters, milestones)
const CHRONICLE=[];
function chronicle(text,icon){
  CHRONICLE.unshift({day:dayN(),h:hourN()|0,text,icon:icon||"◆"});
  if(CHRONICLE.length>80)CHRONICLE.pop();
}
let DIARY_FILTER="saga";
const DIARY_CATS={
  // NOTE order matters — classifyEntry returns the FIRST category whose keyword appears. "caught" was bare
  // here and stole "caught an infection" from health (everything sick showed as [CRIME]). Crime's catch is
  // specifically "caught <committing a crime>", so it's narrowed; health is also checked ahead of crime below.
  health:["sick","infected","infection","clinic","treated","shook off","quarantine","epidemic","outbreak","contagion"],
  crime:["robbed","stolen","caught robbing","caught stealing","caught breaking","busted","fight","brawl","broke into","assault","snitch","racket"],
  eco:["income","credits","sold","debt","crisis","district finance","stim lab","gear shop","supply","market","gig","laid off","workstation","production"],
  social:["truce","feud","crew","gang","relationship","arrived","wandered","drift","mugged","sanctioned","broke up"],
  district:["enforcer","crackdown","raid","heat","evict","rent","housing","home","district","day "]
};
function classifyEntry(msg){
  const m=msg.toLowerCase();
  for(const [cat,keys] of Object.entries(DIARY_CATS))
    for(const k of keys)if(m.includes(k))return cat;
  return "info";}
function log(msg,cls){
  // also write to hidden #log for any code that reads its content
  const d=document.createElement("div");
  d.className=cls||"info";d.textContent=msg;
  const L=$("log");if(L){L.prepend(d);while(L.children.length>80)L.removeChild(L.lastChild)}
  // diary entry
  const cat=cls==="bad"||cls==="warn"?classifyEntry(msg):(cls==="good"?"district":classifyEntry(msg));
  DIARY_ENTRIES.unshift({day:dayN(),h:hourN(),msg,cls:cls||"info",cat});
  if(DIARY_ENTRIES.length>120)DIARY_ENTRIES.pop();
  renderDiary();}
// ── LOG EXPORT — compile the ENTIRE activity record (full diary log + the saga chronicle) into clean
// plaintext, then copy it to the clipboard AND offer a file download. Lets you capture a whole session's
// events to review or share. Exports the full stores, not just the on-screen filtered slice.
function buildLogExport(){
  const lines=[];
  lines.push("NEON SPRAWL \u2014 SESSION ACTIVITY LOG");
  lines.push("Exported: Day "+dayN()+", "+String(Math.floor(hourN())).padStart(2,"0")+":00");
  const m=M(),reg=REG();
  lines.push("Movement: support "+(m.support|0)+" \u00b7 intel "+(m.intel|0)+" \u00b7 exposure "+(m.exposure|0)+" \u00b7 cells "+(m.cells||0)+" \u00b7 stance "+(m.stance||"hidden")+(m.doctrine?" \u00b7 doctrine "+m.doctrine:""));
  lines.push("Regime: grip "+(reg.grip|0)+" \u00b7 awareness "+(reg.awareness|0));
  lines.push("");
  // ── SAGA (the curated chronicle) ──
  lines.push("==================== SAGA (major beats) ====================");
  if(CHRONICLE.length){
    // CHRONICLE is newest-first; print oldest-first for a readable timeline
    for(const e of CHRONICLE.slice().reverse()){
      lines.push("Day "+e.day+" "+String(e.h).padStart(2,"0")+":00  "+e.icon+"  "+e.text);
    }
  } else lines.push("(no major beats yet)");
  lines.push("");
  // ── FULL LOG (every diary entry, all categories) ──
  lines.push("==================== FULL ACTIVITY LOG ====================");
  if(DIARY_ENTRIES.length){
    // DIARY_ENTRIES is newest-first; reverse for chronological
    let lastDay=-1;
    for(const e of DIARY_ENTRIES.slice().reverse()){
      if(e.day!==lastDay){lines.push("");lines.push("--- DAY "+e.day+" ---");lastDay=e.day;}
      const tag=e.cat==="info"?"":"["+e.cat.toUpperCase()+"] ";
      lines.push(String(Math.floor(e.h)).padStart(2,"0")+":00  "+tag+e.msg);
    }
  } else lines.push("(no entries yet)");
  return lines.join("\n");
}
function exportLog(){
  const text=buildLogExport();
  // 1) try to copy to clipboard (best-effort; may fail without user gesture/https)
  let copied=false;
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=>{},()=>{});
      copied=true;
    }
  }catch(e){}
  // fallback copy via a temporary textarea
  if(!copied){
    try{const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";
      document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);copied=true;}catch(e){}
  }
  // 2) trigger a file download so it can be saved/shared regardless
  try{
    const blob=new Blob([text],{type:"text/plain"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="neon-sprawl-log-day"+dayN()+".txt";
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(e){}
  flashMsg&&flashMsg(copied?"Log copied to clipboard + downloaded":"Log downloaded");
  if(SFX&&SFX.good)SFX.good();
}
function renderDiary(){
  // renders into the overlay body when the diary view is active
  if(OV.view!=="diary")return;
  const body=$("ov-body");if(!body)return;
  const f=DIARY_FILTER;
  const filtered=f==="all"?DIARY_ENTRIES:DIARY_ENTRIES.filter(e=>e.cat===f);
  let h="",lastDay=-1;
  for(const e of filtered.slice(0,120)){
    if(e.day!==lastDay){
      h+="<div class='dday'>DAY "+e.day+"</div>";lastDay=e.day}
    const hh=String(Math.floor(e.h)).padStart(2,"0");
    const tagCls=e.cat==="info"?"info":e.cat;
    const tagLabel=e.cat==="info"?"—":e.cat.toUpperCase();
    h+="<div class='dent'><span class='dtime'>"+hh+":00</span>"
      +"<span class='dtag "+tagCls+"'>"+tagLabel+"</span>"
      +"<span class='dmsg' style='color:"+(e.cls==="bad"?"var(--rd)":e.cls==="warn"?"var(--yl)":e.cls==="good"?"var(--gn)":"var(--tx)")+"'>"+e.msg+"</span></div>"}
  body.innerHTML=h||"<div style='color:var(--dim);font-size:11px;padding:12px'>No entries yet. Events will appear here as the district lives.</div>";}

/* ============================================================
   OVERLAY WINDOWS — diary / crew / district
   ============================================================ */
const OV={view:null,crewFocus:null};
function openOverlay(view){
  OV.view=view;
  if(ST.phase==="run"){OV.wasPaused=ST.paused;}
  $("overlay").classList.add("open");
  renderOverlay();
}
function closeOverlay(){
  OV.view=null;OV.crewFocus=null;
  $("overlay").classList.remove("open");
}
function renderOverlay(){
  if(!OV.view)return;
  if(OV.view==="diary")renderDiaryOverlay();
  else if(OV.view==="crew")renderCrewOverlay();
  else if(OV.view==="district")renderDistrictOverlay();
  else if(OV.view==="tasks")renderTasksOverlay();
  // "slots" view is static — not re-rendered on tick
}
function renderDiaryOverlay(){
  $("ov-title").textContent="DIARY";
  const cats=[["saga","SAGA"],["all","ALL"],["crime","CRIME"],["eco","ECO"],["social","SOCIAL"],["health","HEALTH"],["district","DISTRICT"]];
  $("ov-tabs").innerHTML=cats.map(([c,l])=>
    "<span class='ov-tab"+(DIARY_FILTER===c?" on":"")+"' data-dcat='"+c+"'>"+l+"</span>").join("")
    +"<span class='ov-tab' id='diary-export' title='Copy the full activity log to clipboard + download as a text file' style='margin-left:auto;border-color:rgba(34,221,255,.45);color:#22ddff'>\u2913 EXPORT LOG</span>";
  $("ov-tabs").style.display="flex";
  if(DIARY_FILTER==="saga")renderChronicle();else renderDiary();
}
// the curated saga view — major story beats only, as a district history
function renderChronicle(){
  const body=$("ov-body");if(!body)return;
  if(!CHRONICLE.length){body.innerHTML="<div class='sub' style='opacity:.6;padding:12px'>No major events yet. As citizens are born, pair up, come of age, and the district faces crises, your saga will be written here.</div>";return;}
  let h="<div class='chronicle'>";
  for(const e of CHRONICLE){
    h+="<div class='chron-row'><span class='chron-day'>Day "+e.day+"</span><span class='chron-ic'>"+e.icon+"</span><span class='chron-txt'>"+e.text+"</span></div>";
  }
  h+="</div>";
  body.innerHTML=h;
}
function crewFlagHTML(p){
  const flags=[];
  if(p.sick)flags.push(["SICK","#ff4757"]);
  if(p.homeless)flags.push(["EVICTED","#ff8c42"]);
  if((p.addiction||0)>40)flags.push(["HOOKED","#c98bff"]);
  if((p.credits||0)<0)flags.push(["BROKE","#ff4757"]);
  if(p.hasGear)flags.push(["GEARED","#7aa2ff"]);
  if(p.dazed>ST.tick)flags.push(["DAZED","#b06fff"]);
  return flags.map(([t,c])=>"<span class='crew-flag' style='background:"+c+"22;color:"+c+"'>"+t+"</span>").join("");
}
function renderCrewOverlay(){
  if(OV.crewFocus){renderCrewDetail();return;}
  $("ov-title").textContent="CREW · "+ST.pawns.length;
  $("ov-tabs").style.display="none";$("ov-tabs").innerHTML="";
  const body=$("ov-body");
  let h="<div class='crew-grid'>";
  // sort: trouble first (sick/evicted/broke), then by name
  const sorted=[...ST.pawns].sort((a,b)=>{
    const score=p=>(p.sick?4:0)+(p.homeless?3:0)+((p.credits||0)<0?2:0)+(p.mood<25?1:0);
    return score(b)-score(a);});
  for(const p of sorted){
    const mood=p.mood|0;
    const moodCol=mood>60?"var(--gn)":mood>35?"var(--yl)":"var(--rd)";
    const task=p.dazed>ST.tick?"dazed":jobLabel(p);
    // HIGHLIGHT — classify the card so its left edge signals status at a glance
    const inCrisis=p.sick||((p.credits||0)<0)||mood<25;
    const needsAttn=!inCrisis&&(p.homeless||(p.addiction||0)>40);
    const thriving=!inCrisis&&!needsAttn&&mood>65&&!p.homeless;
    const cardCls="crew-card"+(inCrisis?" crew-crisis":needsAttn?" crew-warn":thriving?" crew-good":"");
    // task readability — idle/sleeping is lower-weight, active work pops
    const tl=task.toLowerCase();
    const stCls=(tl.indexOf("sleep")>=0||tl.indexOf("idl")>=0||tl.indexOf("dazed")>=0)?"crew-st idle":"crew-st busy";
    h+="<div class='"+cardCls+"' data-cid='"+p.id+"'>"+
       "<div class='crew-ava' style='background:"+p.accent+"'>"+p.name.charAt(0)+"</div>"+
       "<div class='crew-meta'>"+
         "<div class='crew-nm'>"+p.name+(p.career?" <span style='color:var(--dim);font-weight:400;font-size:9px'>· "+vocationOf(p).name+"</span>":"")+"</div>"+
         "<div class='"+stCls+"'>"+task+" · <span style='color:"+moodCol+";font-weight:700'>mood "+mood+"</span></div>"+
         (crewFlagHTML(p)?"<div class='crew-flags'>"+crewFlagHTML(p)+"</div>":"")+
       "</div></div>";
  }
  h+="</div>";
  body.innerHTML=h;
}
function renderCrewDetail(){
  const p=ST.pawns.find(q=>q.id===OV.crewFocus);
  if(!p){OV.crewFocus=null;renderCrewOverlay();return;}
  $("ov-title").textContent=p.name.toUpperCase();
  $("ov-tabs").style.display="none";$("ov-tabs").innerHTML="";
  const body=$("ov-body");
  let h="<div class='cd-back' id='cd-back'>◀ back to crew</div>";
  h+="<div class='sub' style='margin-bottom:8px'>"+p.tr.map(t=>t.n).join(" · ")+"</div>";
  h+=barHtml("HP",p.hp,"#39ff88");
  h+=barHtml("FOOD",p.needs.food,"#b8ff5e");
  h+=barHtml("REST",p.needs.rest,"#7aa2ff");
  h+=barHtml("HYGIENE",p.needs.hyg??80,"#4ec3ff");
  h+=barHtml("FUN",p.needs.fun??70,"#ffd84a");
  h+=barHtml("SOCIAL",p.needs.socN??70,"#8be0ff");
  h+=barHtml("MOOD",p.mood,p.mood<25?"#ff4757":"#ffd84a");
  h+="<div class='sub' style='margin-top:8px'>TASK: "+jobLabel(p)+"</div>";
  h+="<div class='sub'>CREDITS "+(p.credits|0)+(p.homeless?" · <span style='color:var(--rd)'>EVICTED</span>":"")+"</div>";
  {const wt=wealthTier(p);const wcol=wt.t>=3?"#39ff88":wt.t<=0?"#ff4757":"#ffd84a";
   h+="<div class='sub'>WEALTH — <b style='color:"+wcol+"'>"+wt.name+"</b> · net worth "+netWorth(p)+(p.home?" · <span style='color:#7aa2ff'>has home</span>":"")+(p.attach>30?" · settled in":"")+"</div>";}
  h+="<div class='sub'>STRESS "+(p.stress|0)+(p.addiction>0?" · ADDICTION "+(p.addiction|0):"")+(p.hasGear?" · <span style='color:#7aa2ff'>GEARED</span>":"")+"</div>";
  if(p.sick)h+="<div class='sub' style='color:var(--rd)'>INFECTED — needs a clinic</div>";
  {const g=pawnGang(p);if(g)h+="<div class='sub'>GANG — <b style='color:"+g.color+"'>"+g.name+"</b></div>";}
  {const c=cliqueOf(p);if(c)h+="<div class='sub'>CLIQUE — <b style='color:#c98bff'>"+c.name+"</b> <span style='opacity:.6'>("+c.members.length+" · loyalty "+(c.loyalty|0)+")</span></div>";}
  {const mentor=mentorFor(p);const appr=apprenticesOf(p);
   if(mentor)h+="<div class='sub'>APPRENTICE to <b style='color:#7aa2ff'>"+mentor.name+"</b> <span style='opacity:.6'>(learning faster)</span></div>";
   if(appr.length)h+="<div class='sub'>MENTORING <b style='color:#7aa2ff'>"+appr.map(a=>a.name).join(", ")+"</b></div>";}
  if(p.rep&&(p.rep.city||p.rep.gang)){
    const cR=p.rep.city|0,gR=p.rep.gang|0;
    h+="<div class='sub'>CITY REP "+(cR>0?"+":"")+cR+" · GANG "+(gR>0?"+":"")+gR+"</div>";}
  h+="<div class='sub'>SKILLS — SAL "+p.sk.sal+" · BLD "+p.sk.bld+" · COOK "+p.sk.cook+" · SHT "+p.sk.sht+"</div>";
  // ── CAREER ──
  if(p.career){const c=p.career,voc=vocationOf(p);
    const ws=p.assigned?ST.structs.get(p.assigned):null;
    const isSpec=ws&&c.specialist===K(ws.x,ws.y);
    const satCol=c.sat>=65?"#39ff88":c.sat>=35?"#ffd84a":"#ff4757";
    const ethicLbl=c.ethic>=70?"hard worker":c.ethic>=40?"steady":"slacker";
    const aspLbl=c.asp.met?"<span style='color:#39ff88'>achieved ✓</span>":
      c.asp.kind==="wealth"?"reach "+c.asp.target+"c":
      c.asp.kind==="craft"?"master "+voc.name+" (skill "+c.asp.target+")":"keep it easy";
    h+="<div class='ordsec'>CAREER</div>";
    h+="<div class='sub'>VOCATION — <b style='color:var(--cy)'>"+voc.name+"</b> <span style='opacity:.6'>("+voc.blurb+")</span>"+(isSpec?" · <span style='color:#ffd84a'>SPECIALIST</span>":"")+"</div>";
    h+="<div class='sub'>ASPIRATION — "+aspLbl+"</div>";
    h+="<div class='sub'>WORK ETHIC — "+ethicLbl+" ("+c.ethic+")</div>";
    h+=barHtml("JOB SATISFACTION",c.sat,satCol);
    if(c.gripe>=4)h+="<div class='sub' style='color:var(--or)'>⚠ Aggrieved — may petition for a raise or transfer</div>";
    // management controls
    h+="<div class='cmd-grid' style='margin-top:6px'>";
    if(ws&&fitsVocation(p,ws.type)&&!isSpec)
      h+="<button class='cmd-b' data-career='promote'><span class='ci'>★</span>Make Specialist</button>";
    if(isSpec)
      h+="<button class='cmd-b' data-career='unspec'><span class='ci'>☆</span>Remove Spec</button>";
    h+="<button class='cmd-b' data-career='raise'><span class='ci'>↑</span>Give Raise</button>";
    h+="<button class='cmd-b' data-career='transfer'><span class='ci'>⇄</span>To "+voc.name+"</button>";
    h+="</div>";
  }
  const rels=relsOf(p);
  if(rels.length){h+="<div class='ordsec'>TIES</div>";
    for(const tie of rels.slice(0,6)){const v=tie.v,col=v>0?"#39ff88":"#ff4757";
      const lbl=relType(p.id,tie.o.id);
      const star=relType(p.id,tie.o.id).includes("partner")?" ♥":"";
      h+="<div class='sub' style='display:flex;justify-content:space-between;gap:8px'><span style='color:"+tie.o.accent+"'>"+tie.o.name+star+"</span><span style='color:"+col+"'>"+lbl+" "+(v>0?"+":"")+(v|0)+"</span></div>"}}
  if(p.mem&&p.mem.length)h+="<div class='sub' style='font-style:italic;opacity:.78;margin-top:6px'>\u201c"+p.mem[p.mem.length-1].t+"\u201d</div>";
  // direct orders
  h+="<div class='ordsec'>DIRECT ORDERS</div><div class='cmd-grid'>";
  for(const c of CMD_LIST)h+="<button class='cmd-b' data-cdcmd='"+c.o+"'><span class='ci'>"+c.ci+"</span>"+c.l+"</button>";
  h+="</div>";
  // locate + talk
  h+="<button class='tb' id='cd-locate' style='margin-top:8px'>◎ LOCATE ON MAP</button>";
  h+="<button class='tb' id='cd-follow' style='margin-top:8px;margin-left:6px'>"+(cam.follow===p.id?"◉ FOLLOWING":"◎ FOLLOW")+"</button>";
  body.innerHTML=h;
}
function renderDistrictOverlay(){
  $("ov-title").textContent="DISTRICT";
  $("ov-tabs").style.display="none";$("ov-tabs").innerHTML="";
  $("ov-body").innerHTML=districtStatsHTML();
}
// collect live district alerts (things needing the overseer's attention)
function collectAlerts(){
  const alerts=[];
  // crisis state
  if(ST.crisis)alerts.push({sev:"crit",ic:"\u26a0",t:"District in crisis",s:"Income is negative — build revenue or cut losses fast."});
  // looming disaster warning
  if(ST.pendingDisaster){const dz=ST.pendingDisaster;
    const lbl={fire:"Fire risk",blackout:"Grid failing",raid:"Raid brewing"}[dz.kind]||"Disaster looming";
    const adv={fire:"An electrical fault could spark near production — a Watch Post nearby helps response.",
      blackout:"A blackout may halt production soon.",
      raid:"A gang raid may be coming — shore up security."}[dz.kind]||"Something's brewing.";
    alerts.push({sev:"crit",ic:"\u26a0",t:lbl,s:adv});}
  if(ST.blackoutUntil&&ST.tick<ST.blackoutUntil)
    alerts.push({sev:"warn",ic:"\u26a1",t:"Blackout in effect",s:"Production is halted until power is restored."});
  // trade caravan opportunity (guard each mode — "outsiders" has no cv.good, so the old else-branch crashed)
  if(ST.caravan){const cv=ST.caravan;
    if(cv.mode==="outsiders"){
      if(!cv.claimed)alerts.push({sev:"info",ic:"\u25C8",t:"Outsiders have arrived",s:"Send your operative to meet them — they carry intel, news, or maybe a defector. They won't wait forever."});}
    else if(cv.mode==="buy"&&cv.good){const have=ST.goods[cv.good]||0;
      alerts.push({sev:"info",ic:"\u25C8",t:"Caravan buying "+cv.good.toUpperCase(),s:"Pays "+cv.rate+"c/unit on departure. You have "+have+" in stock — produce more to cash in."});}
    else if(cv.mode==="sell"&&cv.good)alerts.push({sev:"info",ic:"\u25C8",t:"Caravan selling "+cv.good.toUpperCase(),s:"Cheap "+cv.good.toUpperCase()+" available while they're here."});}
  // GOVERNMENT ENVOY — surface the visit as a high-priority alert while it's active
  if(ST.envoy){const stg=ST.envoy.stage;
    if(stg==="arriving")alerts.push({sev:"warn",ic:"\u25C8",t:"Government envoy incoming",s:"A regime emissary is moving to confer with the Mayor. Decide how to respond before the meeting concludes."});
    else if(stg==="conferring")alerts.push({sev:"crit",ic:"\u25C8",t:"Envoy is meeting the Mayor",s:"The conference is underway — act now (surveil, disrupt the venue, or strike) or the regime cracks down."});}
  if(ST.debtDays)alerts.push({sev:"crit",ic:"\u26a0",t:"Debt: day "+ST.debtDays+"/6",s:"The district is condemned at day 6 of debt."});
  // active election — surface it so the player can watch + back a candidate
  if(ST.election&&!ST.election.resolved){const e=ST.election;
    const cnames=e.candidates.map(id=>{const p=ST.pawns.find(q=>q.id===id);return p?p.name.split(" ")[0]:"";}).filter(Boolean).join(", ");
    const daysLeft=Math.max(0,(e.voteAt-ST.tick)/TPD).toFixed(1);
    alerts.push({sev:"warn",ic:"\u2696",t:ROLES[e.role].title+" election underway",s:"The seat is empty. Candidates: "+cnames+". Vote in ~"+daysLeft+" days. Select a citizen to back them."+(e.playerPick?" (Backing: "+(ST.pawns.find(p=>p.id===e.playerPick)||{}).name+")":"")});}
  // gang recruitment risk — unaffiliated, desperate, disaffected citizens near a gang (AGGREGATED)
  if(ST.gangs&&ST.gangs.length){
    const atRiskPawns=[];
    for(const p of ST.pawns){
      if(pawnGang(p))continue;
      const atrisk=(p.pers.intg||50)<42&&((p.credits||0)<15||p.homeless||(p.career&&p.career.sat<25));
      if(!atrisk)continue;
      const nearGang=ST.gangs.some(g=>g.crewIds.some(id=>{const m=ST.pawns.find(x=>x.id===id);return m&&DIST(m.px,m.py,p.px,p.py)<10;}));
      if(nearGang)atRiskPawns.push(p);
    }
    if(atRiskPawns.length===1)alerts.push({sev:"warn",ic:"\u2620",t:atRiskPawns[0].name+" is drifting toward a crew",s:"Broke and disaffected near gang turf — a raise or better work could pull them back.",pid:atRiskPawns[0].id});
    else if(atRiskPawns.length>1)alerts.push({sev:"warn",ic:"\u2620",t:atRiskPawns.length+" citizens drifting toward gangs",s:"Several broke, disaffected people are near gang turf — improve pay and housing to starve recruitment."});
    // recent heist fallout
    for(const g of ST.gangs){
      if(g.lastHeist&&ST.tick-g.lastHeist<TPD){
        alerts.push({sev:"warn",ic:"\u2620",t:g.name+" pulled a heist",s:"A big score just went down — district heat is up. Watch for retaliation or a crackdown opportunity."});break;}
    }
    // a flush gang is overdue for a score
    const flush=ST.gangs.find(g=>(g.bank||0)>=120&&g.crewIds.length>=3&&!(g.heistCd&&ST.tick<g.heistCd));
    if(flush)alerts.push({sev:"info",ic:"\u25C8",t:flush.name+" is flush and restless",s:"They have the crew and the funds for a heist. Heavy policing or splitting them up could pre-empt it."});
    // contraband trade visibility
    const contra=ST.gangs.reduce((s,g)=>s+(g.contraband||0),0);
    if(contra>=80&&ST.contrabandPolicy!=="allow")
      alerts.push({sev:"info",ic:"\u25C8",t:"Contraband trade is growing",s:"Gangs are moving illicit goods. You can crack down, or tolerate it for a cut (District panel)."});
  }
  // citizens in trouble — AGGREGATED to avoid one-alert-per-pawn noise
  {const sick=ST.pawns.filter(p=>p.sick);
   const hurt=ST.pawns.filter(p=>!p.sick&&p.hp<35);
   if(sick.length===1)alerts.push({sev:"crit",ic:"\u2716",t:sick[0].name+" is infected",s:"Needs a clinic — build a Med Bay or Hospital nearby.",pid:sick[0].id});
   else if(sick.length>1)alerts.push({sev:"crit",ic:"\u2716",t:sick.length+" citizens infected",s:"An outbreak is spreading — get clinics running and improve hygiene."});
   if(hurt.length===1)alerts.push({sev:"crit",ic:"\u2665",t:hurt[0].name+" badly hurt",s:"HP critical — they may not recover on their own.",pid:hurt[0].id});
   else if(hurt.length>1)alerts.push({sev:"crit",ic:"\u2665",t:hurt.length+" citizens badly hurt",s:"Multiple people are in critical condition."});
  }
  {const evicted=ST.pawns.filter(p=>p.homeless);
   const broke=ST.pawns.filter(p=>!p.homeless&&(p.credits||0)<0);
   const low=ST.pawns.filter(p=>!p.homeless&&(p.credits||0)>=0&&(p.mood||50)<22);
   if(evicted.length===1)alerts.push({sev:"warn",ic:"\u2302",t:evicted[0].name+" is evicted",s:"Sleeping rough and stressing out — build housing.",pid:evicted[0].id});
   else if(evicted.length>1)alerts.push({sev:"warn",ic:"\u2302",t:evicted.length+" citizens evicted",s:"A housing shortage — build more homes or restore their income."});
   if(broke.length===1)alerts.push({sev:"warn",ic:"\u25c8",t:broke[0].name+" is broke",s:"In debt — can't afford food or rent.",pid:broke[0].id});
   else if(broke.length>1)alerts.push({sev:"warn",ic:"\u25c8",t:broke.length+" citizens in debt",s:"Wages aren't covering costs for several people."});
   if(low.length===1)alerts.push({sev:"warn",ic:"\u2767",t:low[0].name+" is miserable",s:"Very low mood — at risk of snapping.",pid:low[0].id});
   else if(low.length>1)alerts.push({sev:"warn",ic:"\u2767",t:low.length+" citizens miserable",s:"Morale is low across the block — address needs and comfort."});
  }
  // heat
  if((ST.heat||0)>60)alerts.push({sev:"warn",ic:"\u25b2",t:"District heat is high",s:"Crime is drawing attention. A crackdown may come."});
  // prioritize: crit first, then warn, then info — and cap so the panel never overwhelms.
  const rank={crit:0,warn:1,info:2};
  alerts.sort((a,b)=>(rank[a.sev]??3)-(rank[b.sev]??3));
  const crit=alerts.filter(a=>a.sev==="crit");
  // always show all criticals; fill the rest up to a sensible cap with warn/info
  const CAP=Math.max(6,crit.length+2);
  return alerts.slice(0,CAP);
}
function pendingRequests(){return ST.requests?ST.requests.filter(r=>r.status==="pending"):[];}
function taskCount(){return collectAlerts().length+pendingRequests().length;}
function renderTasksOverlay(){
  $("ov-title").textContent="TASKS";
  $("ov-tabs").style.display="none";$("ov-tabs").innerHTML="";
  const alerts=collectAlerts(),reqs=pendingRequests();
  let h="";
  if(reqs.length){
    h+="<div class='task-sec'>Petitions \u2014 awaiting your call</div>";
    const now=ST.tick;
    for(const r of reqs){
      const frac=(r.expires-now)/(r.expires-r.created);
      const sev=frac<0.25?"crit":frac<0.5?"warn":"info";
      const agent=ST.pawns.find(p=>p.id===r.agentId);
      const col=agent?agent.accent:"var(--cy)";
      h+="<div class='task-alert "+sev+"'>";
      h+="<div class='ta-ic'>\u270b</div><div class='ta-body'>";
      h+="<div class='ta-t' style='color:"+col+"'>"+r.agentName+"</div>";
      h+="<div class='ta-s'>"+r.text+"</div>";
      h+="<div class='rq-opts' style='margin-top:6px'>";
      r.options.forEach((opt,i)=>{h+="<button class='tb' data-trid='"+r.id+"' data-toi='"+i+"'>"+opt.label+"</button>";});
      h+="</div></div></div>";
    }
  }
  if(alerts.length){
    h+="<div class='task-sec'>Alerts \u2014 district status</div>";
    for(const a of alerts){
      h+="<div class='task-alert "+a.sev+"'"+(a.pid?" data-tpid='"+a.pid+"' style='cursor:pointer'":"")+">";
      h+="<div class='ta-ic'>"+a.ic+"</div><div class='ta-body'>";
      h+="<div class='ta-t'>"+a.t+"</div><div class='ta-s'>"+a.s+"</div>";
      h+="</div></div>";
    }
  }
  if(!h)h="<div style='color:var(--dim);font-size:12px;padding:16px;text-align:center'>All clear. No pending petitions or alerts \u2014 the district runs smooth.</div>";
  $("ov-body").innerHTML=h;
}
// refresh the HUD task badge
function refreshTaskBadge(){
  const n=taskCount(),b=$("task-badge");if(!b)return;
  if(n>0){b.style.display="flex";b.textContent=n>9?"9+":n;}else b.style.display="none";
  if(OV.view==="tasks")renderTasksOverlay();
}

// overlay event delegation
$("overlay").addEventListener("click",e=>{
  // EXPORT LOG — must be checked before the diary-tab handler (it's a sibling in the tab bar)
  if(e.target.closest("#diary-export")){exportLog();return;}
  // diary tab
  const dt=e.target.closest("[data-dcat]");
  if(dt){DIARY_FILTER=dt.dataset.dcat;SFX.ui();renderDiaryOverlay();return;}
  // crew card → focus
  const cc=e.target.closest("[data-cid]");
  if(cc){OV.crewFocus=+cc.dataset.cid;SFX.ui();renderCrewDetail();return;}
  // back from detail
  if(e.target.closest("#cd-back")){OV.crewFocus=null;SFX.ui();renderCrewOverlay();return;}
  // task petition answer
  const trb=e.target.closest("[data-trid]");
  if(trb){SFX.ui();applyRequest(trb.dataset.trid,+trb.dataset.toi);renderTasksOverlay();refreshTaskBadge();return;}
  // task alert → locate citizen
  const tpid=e.target.closest("[data-tpid]");
  if(tpid){const p=ST.pawns.find(q=>q.id===+tpid.dataset.tpid);
    if(p){SFX.ui();ST.sel=[p];cam.x=p.px*T-VW/cam.z/2;cam.y=p.py*T-VH/cam.z/2;clampCam();closeOverlay();renderInspect();}return;}
  // save slot actions
  const slotBtn=e.target.closest("[data-slotact]");
  if(slotBtn){const slot=slotBtn.dataset.slot==="auto"?"auto":+slotBtn.dataset.slot,act=slotBtn.dataset.slotact;SFX.ui();
    if(act==="save"){saveToSlot(slot);openSaveSlots();}
    else if(act==="load"){loadFromSlot(slot);}
    else if(act==="del"){try{localStorage.removeItem(slotKeyFor(slot));}catch(e){}
      OV.slotMode==="save"?openSaveSlots():openLoadSlots();}
    return;}
  // detail orders
  const cm=e.target.closest("[data-cdcmd]");
  if(cm){const p=ST.pawns.find(q=>q.id===OV.crewFocus);
    if(p){clearJob(p);p.job=null;p.cmd=cm.dataset.cdcmd;SFX.ui();}return;}
  // career management
  const cb=e.target.closest("[data-career]");
  if(cb){const p=ST.pawns.find(q=>q.id===OV.crewFocus);
    if(p&&p.career){SFX.ui();const act=cb.dataset.career,c=p.career;
      const ws=p.assigned?ST.structs.get(p.assigned):null;
      if(act==="promote"&&ws){c.specialist=K(ws.x,ws.y);c.sat=clamp(c.sat+30,0,100);c.gripe=0;
        addMod(p,"promo","Made specialist",20,TPD*3);p.rep.city=clamp((p.rep.city||0)+15,-100,100);
        log(p.name+" named specialist at their post.","good");}
      else if(act==="unspec"){c.specialist=null;c.sat=clamp(c.sat-12,0,100);
        log(p.name+" lost specialist status.","warn");}
      else if(act==="raise"){const base=ws?(DEF[ws.type].wage||10):10;
        const key=ws?K(ws.x,ws.y):(p.contract&&p.contract.fixtureKey);
        p.contract={fixtureKey:key,wage:Math.round(base*1.35)};c.sat=clamp(c.sat+25,0,100);c.gripe=0;c.lastRaiseDay=ST.tick;
        addMod(p,"raise","Got a raise",14,TPD*2);p.rep.city=clamp((p.rep.city||0)+10,-100,100);
        log(p.name+" got a raise.","good");}
      else if(act==="transfer"){const target=nearestStruct(p,s=>!s.bp&&fitsVocation(p,s.type));
        if(target){p.assigned=K(target.x,target.y);c.sat=clamp(c.sat+20,0,100);c.gripe=0;
          addMod(p,"transfer","Doing real work now",12,TPD*2);
          log(p.name+" reassigned to "+vocationOf(p).name+" work.","good");}
        else log("No "+vocationOf(p).name+" workplace available.","warn");}
      renderCrewDetail();}return;}
  // contraband policy toggle
  if(e.target.id==="d-contra"){SFX.ui();
    ST.contrabandPolicy=ST.contrabandPolicy==="allow"?"crackdown":"allow";
    if(ST.contrabandPolicy==="allow")log("You signal the gangs you'll look the other way — for a price.","warn");
    else{log("You order a crackdown on the contraband trade.","info");ST.lastCrackdown=ST.tick;}
    renderOverlay();return;}
  // locate
  if(e.target.id==="cd-locate"){const p=ST.pawns.find(q=>q.id===OV.crewFocus);
    if(p){ST.sel=[p];cam.x=p.px*T-VW/cam.z/2;cam.y=p.py*T-VH/cam.z/2;clampCam();closeOverlay();renderInspect();}return;}
  // follow — start tracking, then close the overlay so you can watch
  if(e.target.id==="cd-follow"){const p=ST.pawns.find(q=>q.id===OV.crewFocus);
    if(p){SFX.ui();ST.sel=[p];setFollow(p);closeOverlay();renderInspect();}return;}
});
$("ov-x").onclick=()=>{SFX.ui();closeOverlay();};
// click outside the box closes
$("overlay").addEventListener("mousedown",e=>{if(e.target.id==="overlay"){SFX.ui();closeOverlay();}});
let banT=0;
function banner(txt,cls){const b=$("banner");
  b.textContent=txt;b.className=cls||"";b.classList.add("show");
  clearTimeout(banT);banT=setTimeout(()=>b.classList.remove("show"),2400)}
function flashMsg(m){log(m,"warn")}

/* ---------- requests (phase 2) ---------- */
function renderRequests(){
  const el=$("requests");
  const pending=ST.requests?ST.requests.filter(r=>r.status==="pending"):[];
  if(!pending.length){el.style.display="none";if(typeof refreshTaskBadge==="function")refreshTaskBadge();return}
  el.style.display="block";
  const collapsed=!!window.REQ_COLLAPSED;
  let h='<div class="rq-hdr" id="rq-toggle" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">'
    +'<span>AGENT REQUESTS ('+pending.length+')</span><span style="opacity:.6">'+(collapsed?"\u25B8":"\u25BE")+'</span></div>';
  if(!collapsed){
    const now=ST.tick;
    for(const r of pending){
      const frac=(r.expires-now)/(r.expires-r.created);
      const cls=frac<0.25?"rq-urgent":frac<0.5?"rq-warn":"";
      const agent=ST.pawns.find(p=>p.id===r.agentId);
      const col=agent?agent.accent:"var(--cy)";
      h+="<div class='rq-card "+cls+"' data-rid='"+r.id+"'>";
      h+="<div class='rq-name' style='color:"+col+"'>"+r.agentName+"</div>";
      h+="<div class='rq-text'>"+r.text+"</div>";
      h+="<div class='rq-opts'>";
      r.options.forEach((opt,i)=>{
        h+="<button class='tb' data-rid='"+r.id+"' data-oi='"+i+"'>"+opt.label+"</button>"});
      h+="</div></div>"}
  }
  el.innerHTML=h;
  if(typeof refreshTaskBadge==="function")refreshTaskBadge();}

/* ---------- crime: organic robbery (Phase B.1) ---------- */
function firstName(p){return (p.name||"").split(" ")[0]}
function wantsToRob(p){
  return p.pers.intg<40 && ((p.credits||0)<12||p.homeless||p.needs.food<28||p.stress>58)}
function findRobTarget(p){let best=null,bv=-1e9;
  for(const q of ST.pawns){if(q.id===p.id||q.hp<=0)continue;
    if((q.credits||0)<(p.credits||0)+20)continue;        // not worth the risk
    if(relGet(p.id,q.id)>15)continue;                    // won't rob someone they like
    const score=(q.credits||0)-relGet(p.id,q.id);        // richer + more disliked = better mark
    if(score>bv){bv=score;best=q}}
  return best}
function startRobbery(perp,victim){
  if(!perp||!victim||perp===victim)return;
  clearJob(perp);
  perp.job={t:"rob",vid:victim.id,prog:0};
  remember(perp,"made up my mind to take "+victim.name+"'s creds")}

function applyRequest(rid,oi){
  const r=ST.requests.find(x=>x.id===rid);
  if(!r||r.status!=="pending")return;
  const agent=ST.pawns.find(p=>p.id===r.agentId);
  const opt=r.options[oi];
  if(r.kind==="clique"){
    const c=ST.cliques&&ST.cliques.find(x=>x.id===r.cliqueId);
    const mem=c?c.members.map(id=>ST.pawns.find(p=>p.id===id)).filter(Boolean):[];
    if(opt.act==="fund"){ST.income=Math.max(0,(ST.income||0)-120);
      for(const p of mem){addMod(p,"cliquefund","The block looks after us",18,TPD*3);p.rep.city=clamp((p.rep.city||0)+12,-100,100);}
      if(c){c.loyalty=clamp(c.loyalty+10,0,100);c.stance=clamp((c.stance||0)+22,-100,100);}
      log((c?c.name:"A clique")+" was funded — morale soared across the group.","good");
    }else if(opt.act==="token"){ST.income=Math.max(0,(ST.income||0)-40);
      for(const p of mem){addMod(p,"cliquetoken","A small gesture",7,TPD*1.5);}
      if(c)c.stance=clamp((c.stance||0)+6,-100,100);
      log((c?c.name:"A clique")+" got a token gesture.","info");
    }else{ // refuse
      for(const p of mem){addMod(p,"cliquesnub","The block stiffed us",-10,TPD*2);p.rep.city=clamp((p.rep.city||0)-8,-100,100);}
      if(c){c.loyalty=clamp(c.loyalty-6,0,100);c.stance=clamp((c.stance||0)-18,-100,100);}
      log((c?c.name:"A clique")+" was refused — the group is sore about it.","warn");
    }
    r.status="answered";renderRequests();refreshTaskBadge&&refreshTaskBadge();return}
  if(r.kind==="expand"){
    const p=agent;
    if(p&&p.home){
      if(opt.act==="deny"){
        if(p.career)p.career.sat=clamp((p.career.sat||60)-10,0,100);
        addMod(p,"expanddeny","Denied more space",-6,TPD*1.5);
        remember(p,"asked for a bigger place and got turned down");
        log(p.name+"'s expansion was denied.","warn");
      }else{
        const cost=opt.act==="split"?60:120;
        const playerShare=opt.act==="split"?60:120;
        if(opt.act==="split")p.credits=Math.max(0,(p.credits||0)-60);
        ST.income=Math.max(0,(ST.income||0)-playerShare);
        if(doExpand(p.home)){
          addMod(p,"expanded","More room to live",16,TPD*3);
          p.attach=clamp((p.attach||0)+10,0,100);
          remember(p,"got the place expanded — finally room to breathe");
          chronicle(p.name+" "+(p.surname||"")+" expanded their home.","⌂");
          log(p.name+"'s home was expanded.","good");banner("HOME EXPANDED","good");
        }else log("No room to expand "+p.name+"'s home.","warn");
      }
    }
    r.status="answered";renderRequests();if(typeof refreshTaskBadge==="function")refreshTaskBadge();return}
  if(r.kind==="work"){
    const c=agent&&agent.career;
    if(agent&&c){
      if(opt.act==="raise"){
        // bump their contract wage at their current workplace (or create one)
        const ws=agent.assigned?ST.structs.get(agent.assigned):null;
        const key=ws?K(ws.x,ws.y):(agent.contract&&agent.contract.fixtureKey);
        const base=ws?(DEF[ws.type].wage||10):10;
        agent.contract={fixtureKey:key,wage:Math.round(base*1.35)};
        c.sat=clamp(c.sat+30,0,100);c.gripe=0;c.lastRaiseDay=ST.tick;
        addMod(agent,"raise","Got a raise",14,TPD*2);agent.rep.city=clamp((agent.rep.city||0)+12,-100,100);
        remember(agent,"the operator gave me a raise — I'll remember that");
        log(agent.name+" got a raise and is back to work, motivated.","good");
      }else if(opt.act==="promote"){
        const ws=agent.assigned?ST.structs.get(agent.assigned):null;
        if(ws){c.specialist=K(ws.x,ws.y);
          c.sat=clamp(c.sat+35,0,100);c.gripe=0;c.lastRaiseDay=ST.tick;
          addMod(agent,"promo","Made specialist",20,TPD*3);agent.rep.city=clamp((agent.rep.city||0)+18,-100,100);
          remember(agent,"got named specialist — proud of that, this is my post now");
          log(agent.name+" was promoted to specialist — loyalty up, output up.","good");}
      }else if(opt.act==="transfer"){
        // assign them to the nearest fixture matching their vocation
        const target=nearestStruct(agent,s=>!s.bp&&fitsVocation(agent,s.type));
        if(target){agent.assigned=K(target.x,target.y);
          c.sat=clamp(c.sat+22,0,100);c.gripe=0;c.lastRaiseDay=ST.tick;
          addMod(agent,"transfer","Doing real work now",12,TPD*2);agent.rep.city=clamp((agent.rep.city||0)+8,-100,100);
          remember(agent,"finally moved to work I'm actually good at");
          log(agent.name+" transferred to "+vocationOf(agent).name+" work.","good");}
        else log("No suitable workplace to transfer "+agent.name+" to.","warn");
      }else{ // deny
        c.sat=clamp(c.sat-18,0,100);c.gripe=clamp(c.gripe-2,0,10);
        agent.stress=clamp((agent.stress||0)+12,0,100);agent.rep.city=clamp((agent.rep.city||0)+-14,-100,100);
        addMod(agent,"denied","Snubbed by the boss",-12,TPD*2);
        remember(agent,"asked for better and got told no — I won't forget it");
        log(agent.name+" was denied — resentment is building.","warn");
        // a denied, very ambitious pawn may quit (leave) or turn to crime
        if((agent.pers.amb||50)>72&&c.sat<18&&Math.random()<0.4){
          agent.pers.intg=clamp((agent.pers.intg||50)-15,0,100); // more willing to bend rules
          remember(agent,"if the straight path won't pay, maybe the crooked one will");}
      }
    }
    r.status="answered";renderRequests();refreshTaskBadge&&refreshTaskBadge();return}
  if(r.kind==="feud"){
    const rival=ST.pawns.find(q=>q.id===r.rivalId);
    if(opt.mediate&&agent&&rival){
      relAdj(agent.id,rival.id,20);relAdj(rival.id,agent.id,20);
      agent.stress=Math.max(0,(agent.stress||0)-15);rival.stress=Math.max(0,(rival.stress||0)-15);
      remember(agent,"the operator mediated between me and "+rival.name+" — things are cooler now");
      remember(rival,"the operator stepped in about the situation with "+agent.name);
      log(agent.name+" and "+rival.name+" reached a truce.","good")}
    else log("Feud between "+(agent?agent.name:"?")+(" and ")+(r.rivalId?"someone":"?")+" left to fester.","warn");
    r.status="answered";if(agent)log(agent.name+": "+opt.label,"info");renderRequests();return}
  if(r.kind==="epidemic"){
    if(opt.quarantine){ST.pawns.filter(q=>q.sick).forEach(q=>{q.quarantine=true;clearJob(q)});
      ST.stats.epidemicSurvived=true;
      log("Sick citizens quarantined to their homes.","good")}
    else log("Epidemic left to run its course.","warn");
    r.status="answered";if(agent)log(agent.name+": "+opt.label,"info");renderRequests();return}
  if(r.kind==="gang"){
    const crew=(r.crewIds||[]).map(id=>ST.pawns.find(q=>q.id===id)).filter(Boolean);
    const crewIds=crew.map(c=>c.id);
    if(opt.sanction){
      // pick a color for this gang based on first member's accent
      const col=crew[0]?crew[0].accent:"#ff2d95";
      // build initial turf around dealer den and where members currently are
      const initTurf=new Set();
      for(const m of crew){const mx=m.px|0,my=m.py|0;
        for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
          if(dx*dx+dy*dy>30)continue;
          const X=mx+dx,Y=my+dy;if(INB(X,Y)&&colCost(X,Y)>=0)initTurf.add(K(X,Y))}}
      // remove any existing gang these members belong to
      ST.gangs=ST.gangs.filter(g=>!g.crewIds.some(id=>crewIds.includes(id)));
      const gName=crew[0]?crew[0].name.split('"')[0].trim()+"'s Crew":"The Crew";
      ST.gangs.push({id:uid(),crewIds,color:col,turf:initTurf,name:gName,gangHeat:0});
      crew.forEach(c=>{c.rep.gang=clamp((c.rep.gang||0)+15,-100,100);c.stress=Math.max(0,(c.stress||0)-10);
        remember(c,"the district sanctioned our crew — we've got turf now")});
      log(gName+" sanctioned — territory established on the block.","good");
      float(crew[0].px,crew[0].py,"TURF","#ff2d95")}
    else{
      ST.gangs=ST.gangs.filter(g=>!g.crewIds.some(id=>crewIds.includes(id)));
      for(const c of crew)for(const o of crew){if(o!==c)relAdj(c.id,o.id,-15);c.stress=Math.min(100,(c.stress||0)+12)}
      log("Crew broken up — turf disbanded, bad feelings all around.","warn")}
    r.status="answered";if(agent)log(agent.name+": "+opt.label,"info");renderRequests();return}
  if(r.kind==="corp_recruit"){
    if(opt.leave&&agent){
      const bonus=r.options[0].bonus||60;
      agent.credits=(agent.credits||0)+bonus;
      const idx=ST.pawns.indexOf(agent);if(idx>=0)ST.pawns.splice(idx,1);
      log(agent.name+" took the corp offer and left the block (signing bonus: "+bonus+"c collected).","warn");
      banner("CITIZEN DEPARTED","warn");}
    else if(agent){agent.stress=Math.max(0,(agent.stress||0)-10);
      addMod(agent,"loyalty","Turned down the corp",8,TPD*1.5);
      ST.stats.corpRefused=true;
      remember(agent,"corp headhunter came sniffing — told them to get lost. this block is home");
      log(agent.name+" turned down the corp offer.","good");}
    r.status="answered";renderRequests();return}
  if(r.kind==="theft_report"){
    if(opt.compensate&&(ST.income||0)>=20){ST.income-=20;if(agent)agent.credits=(agent.credits||0)+20;
      if(agent){addMod(agent,"comp","Overseer made it right",6,TPD*.5);remember(agent,"the overseer actually made it right after I got robbed — respect")}
      log("Compensated "+(agent?agent.name:"?")+": 20c from district income.","good")}
    else{if(agent){addMod(agent,"ignored","Overseer ignored my complaint",-8,TPD*.6);remember(agent,"reported the theft and the overseer did nothing — noted")}}
    r.status="answered";if(agent)log(agent.name+": "+opt.label,"info");renderRequests();return}
  if(r.kind==="robbery"){
    const victim=ST.pawns.find(q=>q.id===r.victimId);
    if(opt.rob&&agent&&victim&&victim.hp>0)startRobbery(agent,victim);
    else if(agent){agent.stress=Math.min(100,(agent.stress||0)+8);applyDrift(agent,{intg:1});
      remember(agent,"was set to rob "+(victim?victim.name:"someone")+" but held off")}
    r.status="answered";if(agent)log(agent.name+": "+opt.label,"info");renderRequests();return}
  if(agent&&opt&&opt.apply){
    for(const[k,v]of Object.entries(opt.apply)){
      if(k in agent.bias)agent.bias[k]=clamp(agent.bias[k]+v,0.6,1.5);
      else if(k in agent.pers)agent.pers[k]=clamp(agent.pers[k]+v,0,100)}}
  r.status="answered";
  if(agent)log(agent.name+": "+opt.label,"info");
  renderRequests()}

$("requests").addEventListener("click",e=>{
  if(e.target.closest&&e.target.closest("#rq-toggle")){SFX.ui&&SFX.ui();window.REQ_COLLAPSED=!window.REQ_COLLAPSED;renderRequests();return;}
  const rid=e.target.dataset.rid;
  const oi=e.target.dataset.oi;
  if(rid&&oi!==undefined){SFX.ui();applyRequest(+rid,parseInt(oi))}});

function expireRequests(){
  if(!ST.requests)return;
  for(const r of ST.requests){
    if(r.status!=="pending"||ST.tick<r.expires)continue;
    r.status="expired";
    const agent=ST.pawns.find(p=>p.id===r.agentId);
    if(r.kind==="robbery"){const victim=ST.pawns.find(q=>q.id===r.victimId);
      if(agent&&victim&&victim.hp>0){startRobbery(agent,victim);
        log(agent.name+" didn't wait for the word — moving on "+victim.name+".","warn")}
      continue}
    if(agent)agent.pers.soc=clamp(agent.pers.soc-1,0,100);
    log((agent?agent.name:"Agent")+" got tired of waiting — acted on instinct.","warn")}
  // prune resolved/expired petitions so the list (and saves) don't grow unbounded — keep all pending + 8 most-recent resolved
  if(ST.requests.length>16){
    const keep=new Set(),resolved=[];
    for(const r of ST.requests){if(r.status==="pending")keep.add(r);else resolved.push(r);}
    for(const r of resolved.slice(-8))keep.add(r);
    ST.requests=ST.requests.filter(r=>keep.has(r));
  }}

function applyDrift(p,deltas){
  const today=Math.floor(ST.tick/2400);
  if(p.drift.day!==today){p.drift.day=today;p.drift.used=0}
  if(p.drift.used>=5)return;
  let changed=false;
  for(const[k,v]of Object.entries(deltas)){
    if(k in p.pers){p.pers[k]=clamp(p.pers[k]+v,0,100);changed=true}}
  if(changed)p.drift.used++}
function canGenRequest(p){
  return !ST.requests.some(r=>r.agentId===p.id&&r.status==="pending")}

function genRequests(){
  if(!REQUESTS_ENABLED)return;   // agent requests disabled for now
  if(ST.phase!=="run"||!ST.requests)return;
  // PACING: keep petitions occasional, not a flood. A global cooldown spaces them out, and a cap on
  // simultaneous pending requests prevents pile-up. (Routine flashpoints surface in the weekly council.)
  const pending=ST.requests.filter(r=>r.status==="pending").length;
  if(pending>=3)return;                                    // never more than 3 open at once
  if(ST.lastGlobalReqT&&ST.tick-ST.lastGlobalReqT<900)return;  // ~9h min between any two petitions
  const gap=2400;                                          // each wisp can petition at most ~once/day
  // gather eligible wisps, pick ONE at random so we don't spawn several at once
  const eligible=[];
  for(const p of ST.pawns){
    if(!canGenRequest(p))continue;
    if(p.lastReqT&&ST.tick-p.lastReqT<gap)continue;
    eligible.push(p);
  }
  if(!eligible.length)return;
  const p=eligible[Math.floor(Math.random()*eligible.length)];
  const r=tryBuildRequest(p);
  if(r){ST.requests.push(r);p.lastReqT=ST.tick;ST.lastGlobalReqT=ST.tick;renderRequests();}}

function tryBuildRequest(p){
  const id=uid();
  const exp=ST.tick+Math.floor(2400*0.4);
  const base={id,agentId:p.id,agentName:p.name,created:ST.tick,expires:exp,status:"pending"};
  if(wantsToRob(p)&&Math.random()<0.55){
    const tgt=findRobTarget(p);
    if(tgt)return{...base,kind:"robbery",victimId:tgt.id,
      text:p.name+" is desperate and circling "+tgt.name+" — ready to take their creds by force.",
      options:[{label:"Let it happen",rob:true},{label:"Hold "+firstName(p)+" back",rob:false}]};}
  const bps=[...new Map([...ST.structs.values()].filter(s=>s.bp).map(s=>[s.type,s])).values()];
  if(bps.length>=2&&p.pers.ind>55&&Math.random()<0.3)
    return{...base,kind:"build",text:p.name+" asks: raise the "+DEF[bps[0].type].name+" or the "+DEF[bps[1].type].name+" first?",
      options:[{label:DEF[bps[0].type].name,apply:{build:+0.2}},{label:DEF[bps[1].type].name,apply:{build:+0.1}}]};
  // feud: two pawns have rel < -55 — overseer can mediate or let it simmer
  if(p.pers.emp>45&&Math.random()<0.2){
    const rival=ST.pawns.find(q=>q!==p&&relGet(p.id,q.id)<-55);
    if(rival)return{...base,kind:"feud",rivalId:rival.id,
      text:p.name+" comes to you about the situation with "+rival.name+" — things are at a breaking point.",
      options:[{label:"Mediate",mediate:true},{label:"Stay out of it",mediate:false}]}}
  // epidemic: 2+ sick citizens — overseer can quarantine or ignore
  const sick=ST.pawns.filter(q=>q.sick);
  if(sick.length>=2&&p.sick&&Math.random()<0.4)
    return{...base,kind:"epidemic",
      text:sick.length+" people on the block are sick, including "+p.name+". It's spreading.",
      options:[{label:"Quarantine the sick",quarantine:true},{label:"Let it run its course",quarantine:false}]};
  // gang: 3+ citizens with strong mutual positive relationships — overseer can sanction or break up
  if(Math.random()<0.12){
    const crew=[p,...ST.pawns.filter(q=>q!==p&&relGet(p.id,q.id)>45)].slice(0,4);
    if(crew.length>=3)return{...base,kind:"gang",crewIds:crew.map(c=>c.id),
      text:crew.map(c=>c.name).join(", ")+" have formed a tight crew. They want recognition.",
      options:[{label:"Sanction the crew",sanction:true},{label:"Break it up",sanction:false}]}}
  // theft_report: victim of recent NPC theft surfaces it to overseer
  if(p.mem&&p.mem.slice(-5).some(m=>m.t.includes("caught")&&m.t.includes("lifting"))&&Math.random()<0.35)
    return{...base,kind:"theft_report",
      text:p.name+" reports being robbed by a neighbor. Wants something done about it.",
      options:[{label:"Compensate (−20c income)",compensate:true},{label:"Ignore it",compensate:false}]};
  return null}
function showModal(html){$("modal").innerHTML="<div class='mbox'>"+html+"</div>";
  $("modal").classList.add("open")}
function hideModal(){$("modal").classList.remove("open")}
$("modal").addEventListener("click",e=>{const id=e.target.id;
  if(id==="m-start"){SFX.ui();CC={bg:"fixer",spent:{},name:"",step:0,detail:null};showCharCreate();}
  else if(id==="m-restart"){SFX.wake();SFX.ambientStart();SFX.ui();newGame()}
  // ---- character creation ----
  else if(e.target.closest("[data-ccbg]")){SFX&&SFX.ui&&SFX.ui();
    CC.bg=e.target.closest("[data-ccbg]").dataset.ccbg;ccSyncName();showCharCreate();}
  else if(e.target.closest("[data-ccinc]")){const k=e.target.closest("[data-ccinc]").dataset.ccinc;
    if(ccRemaining()>0&&ccStats()[k]<10){SFX&&SFX.ui&&SFX.ui();CC.spent[k]=(CC.spent[k]||0)+1;ccSyncName();showCharCreate();}}
  else if(e.target.closest("[data-ccdec]")){const k=e.target.closest("[data-ccdec]").dataset.ccdec;
    if((CC.spent[k]||0)>0){SFX&&SFX.ui&&SFX.ui();CC.spent[k]--;ccSyncName();showCharCreate();}}
  else if(id==="cc-next"){SFX&&SFX.ui&&SFX.ui();ccSyncName();
    // step 1 (attributes) gates advancing until all points are spent
    if(CC.step===1&&ccRemaining()!==0){flashMsg&&flashMsg("Assign all "+OPS_POINT_BUDGET+" points first");return;}
    CC.step=Math.min(2,(CC.step||0)+1);CC.detail=null;showCharCreate();}
  else if(id==="cc-prev"){SFX&&SFX.ui&&SFX.ui();ccSyncName();CC.step=Math.max(0,(CC.step||0)-1);CC.detail=null;showCharCreate();}
  else if(id==="cc-back"){SFX&&SFX.ui&&SFX.ui();ccSyncName();CC.step=0;showStart();}
  else if(e.target.closest(".cc-attr-block")&&!e.target.closest("[data-ccinc]")&&!e.target.closest("[data-ccdec]")){
    // tap a stat block -> reveal its consequence line (toggle)
    const k=e.target.closest(".cc-attr-block").dataset.ccattr;
    CC.detail=(CC.detail===k)?null:k;showCharCreate();}
  else if(id==="cc-begin"){
    if(ccRemaining()!==0){flashMsg&&flashMsg("Assign all "+OPS_POINT_BUDGET+" points first");return;}
    ccSyncName();SFX.wake();SFX.ambientStart();SFX.ui();
    window.PENDING_AVATAR={name:(CC.name||"").trim()||"The Operative",bg:CC.bg,stats:ccStats()};
    newGame();}
  else if(id==="m-continue"){SFX.wake();SFX.ambientStart();SFX.ui();hideModal();openLoadSlots()}
  else if(id==="m-close"){SFX.ui();hideModal()}
  // ---- Operative screen tab switch ----
  else if(e.target.closest("[data-opstab]")){SFX&&SFX.ui&&SFX.ui();
    OPSTAB=e.target.closest("[data-opstab]").dataset.opstab;showOpsScreen();}
  // ---- HQ panel actions (stay on Base tab) ----
  else if(id==="hq-claim"){SFX&&SFX.ui&&SFX.ui();claimHQ();OPSTAB="base";showOpsScreen();}
  else if(e.target.closest("[data-hqbuild]")){SFX&&SFX.ui&&SFX.ui();
    const kind=e.target.closest("[data-hqbuild]").dataset.hqbuild;
    buildStation(kind);OPSTAB="base";showOpsScreen();}
  // ---- Outfitter panel actions (stay on Equipment tab) ----
  else if(e.target.closest("[data-gearbuy]")){SFX&&SFX.ui&&SFX.ui();
    buyGear(e.target.closest("[data-gearbuy]").dataset.gearbuy);OPSTAB="equipment";showOpsScreen();}
  else if(e.target.closest("[data-gearequip]")){SFX&&SFX.ui&&SFX.ui();
    equipGear(e.target.closest("[data-gearequip]").dataset.gearequip);OPSTAB="equipment";showOpsScreen();}
  else if(e.target.closest("[data-gearunequip]")){SFX&&SFX.ui&&SFX.ui();
    unequipGear(e.target.closest("[data-gearunequip]").dataset.gearunequip);OPSTAB="equipment";showOpsScreen();}});

let OP_DOCK_OPEN=false;
// collapse the operative command dock (used when targeting starts, so the menu gets out of the way and the
// player can see + click the target on the map).
function collapseOpDock(){OP_DOCK_OPEN=false;if(typeof renderOpDock==="function")renderOpDock();}
// the operative dock: a quiet status strip (always shows what your operative is doing) that expands into
// quick controls. Reactive — its content reflects live operative state (idle / walking / performing an op).
function opDockState(av){
  if(!av)return {glyph:"\u25c7",txt:"No operative",prog:null};
  if(av.activeOp){const opD=AVATAR_OPS[av.activeOp.opKey];const pct=Math.round(av.activeOp.prog/av.activeOp.duration*100);
    return {glyph:"\u25c6",txt:"<b>"+opD.name+"</b> \u2014 "+pct+"%",prog:pct,busy:true};}
  if(av.job&&av.job.t==="goto")return {glyph:"\u25c8",txt:"Moving to position\u2026",prog:null};
  if(av.job&&av.job.t)return {glyph:"\u25c7",txt:"<b>"+jobLabel(av).replace(/^.*?: ?/,"")+"</b>",prog:null};
  return {glyph:"\u25c7",txt:"Idle",prog:null};
}
// ═══ SHARED OPS UI — the avatar's operations toolkit, rendered identically in the inspect panel AND the
// operative dock so you can act from one always-reachable place (no need to hunt for + select your
// operative in the world first). renderOpsGrid() returns the categorized button HTML; dispatchOpButton()
// runs the click. Both surfaces use the same .i-op/data-op contract. ═══
function renderOpsGrid(opts){
  opts=opts||{};const compact=opts.compact;
  const av=theAvatar();const m=M();let h="";
  // in-flight: show progress instead of the grid
  if(av&&av.activeOp){const ao=av.activeOp;const opD=AVATAR_OPS[ao.opKey];const pct=Math.round(ao.prog/ao.duration*100);
    h+="<div class='sub' style='font-size:11px;color:#ffd24a;margin-top:4px;font-weight:600'>\u25b8 "+opD.name.toUpperCase()+" \u2014 performing\u2026 "+pct+"%</div>";
    h+="<div class='bar' style='margin-top:2px'><i style='width:"+pct+"%;background:#ffd24a'></i></div>";
    h+="<div class='sub' style='font-size:9px;opacity:.7'>Move your operative to abandon.</div>";
    return h;
  }
  const OP_LBL={intel:"GATHER INTEL",surveil:"SURVEIL",dissent:"SPREAD DISSENT",sabotage:"SABOTAGE",steal:"STEAL FUNDS",bribe:"BRIBE",frame:"FRAME ASSET",blackmail:"BLACKMAIL",assassinate:"ASSASSINATE",hackGrid:"HACK GRID",dataHeist:"DATA HEIST",corruptRecords:"CORRUPT RECORDS"};
  const RISK_COL={low:"",raised:"#ffd24a",high:"#ff9a52",extreme:"#ff5470"};
  const RISK_DOT={low:"",raised:"\u25c8",high:"\u25c8\u25c8",extreme:"\u26a0"};
  for(const cat of OP_CAT_ORDER){
    const opsInCat=Object.keys(AVATAR_OPS).filter(ok=>OP_CATEGORY[ok]===cat);
    if(!opsInCat.length)continue;
    h+="<div class='opcat'>"+cat+"</div>";
    h+="<div class='opsgrid' style='display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:3px 0 5px'>";
    for(const ok of opsInCat){const op=AVATAR_OPS[ok];const st=opState(ok);
      const lbl=(OP_LBL[ok]||op.name.toUpperCase())+(op.cost?" ("+op.cost+")":"");
      const armed=ST.opTargeting&&ST.opTargetingOp===ok;
      let bc,tc,suffix="",tip=op.desc;
      if(!st.ok){bc="rgba(120,140,160,.2)";tc="#5d6b7c";suffix=" \uD83D\uDD12";tip=op.desc+" \u2014 ["+st.label+"]";}
      else{const rc=RISK_COL[st.risk];
        bc=rc?("rgba("+(st.risk==="extreme"?"255,84,112":st.risk==="high"?"255,154,82":"255,210,74")+",.55)"):"rgba(34,221,255,.4)";
        tc=rc||"#bfe8ff";
        if(RISK_DOT[st.risk])suffix=" <span style='color:"+rc+"'>"+RISK_DOT[st.risk]+"</span>";
        if(st.targeted)tip=op.desc+" \u2014 [needs a target in range]";
        tip+=" \u00b7 diff "+st.diff+(st.gear<0?" ("+st.gear+" gear)":"");
        if(st.risk!=="low")tip+=" \u26a0 "+st.risk+" risk at current heat";}
      if(armed){bc="#ffd24a";tc="#ffd24a";}
      h+="<button class='tb i-op"+(armed?" armed":"")+(st.ok?"":" opdis")+"' data-op='"+ok+"' title='"+tip.replace(/'/g,"&#39;")+"' style='font-size:8.5px;padding:5px 3px;letter-spacing:.02em;border-color:"+bc+";color:"+tc+"'>"+lbl+suffix+"</button>";
    }
    h+="</div>";
  }
  h+="<button class='tb' id='i-lielow' style='font-size:9px;padding:4px;margin-top:2px;border-color:rgba(122,162,255,.4);color:#aebfff'>\u25ad LIE LOW \u2014 reduce exposure (12 intel)</button>";
  if(ST.opTargeting)h+="<div class='sub optargethint' style='font-size:10px;color:#ffd24a;margin-top:4px'>\u25c9 Select a "+(ST.opTargeting==='utility'?"power/water building":ST.opTargeting==='regime'?"regime asset":"wisp")+" to "+ST.opTargetingOp+" \u2014 walk into range, then tap it. (Tap the op again to cancel.)</div>";
  return h;
}
// shared dispatch for an op button (returns true if it handled the click). Used by inspect + dock.
function dispatchOpButton(opBtn){
  const opKey=opBtn.dataset.op;const op=AVATAR_OPS[opKey];if(!op)return false;
  SFX.ui&&SFX.ui();
  if(op.target){
    if(ST.opTargeting===op.target&&ST.opTargetingOp===opKey){ST.opTargeting=null;ST.opTargetingOp=null;}
    else{ST.opTargeting=op.target;ST.opTargetingOp=opKey;
      flashMsg&&flashMsg("Tap a "+(op.target==="utility"?"power/water building":op.target==="regime"?"regime asset":"wisp")+" \u2014 your operative will move in and act.");
      collapseOpDock();   // hide the menu so the player can see + tap the target on the map
    }
  }else{
    runAvatarOp(opKey,null);
  }
  renderInspect();renderOpDock();syncHUD();
  return true;
}
function renderOpDock(){
  const dock=document.getElementById("op-dock");if(!dock)return;
  if(ST.phase!=="run"){dock.style.display="none";return;}
  dock.style.display="flex";
  const av=theAvatar();const m=M();const st=opDockState(av);
  const isSel=ST.sel&&ST.sel[0]&&ST.sel[0].isAvatar;
  let h="";
  // expandable control panel (only when open)
  h+="<div class='od-panel'>";
  h+="<div class='od-stat'>Intel <b style='color:var(--cy)'>"+(m.intel|0)+"</b> \u00b7 Exposure <b style='color:"+((m.exposure|0)>40?"var(--rd)":"var(--dim)")+"'>"+(m.exposure|0)+"</b></div>";
  if(st.prog!=null)h+="<div class='od-prog'><i style='width:"+st.prog+"%'></i></div>";
  h+="<div class='od-row'>";
  h+="<button class='od-btn' id='od-jump'>\u25c9 SELECT</button>";
  h+="<button class='od-btn"+(cam.follow&&av&&cam.follow===av.id?" on":"")+"' id='od-follow'>\u25ce FOLLOW</button>";
  h+="</div>";
  h+="<div class='od-row'>";
  h+="<button class='od-btn"+(ST.avatarManual?" on":"")+"' id='od-mode' title='"+(ST.avatarManual?"Manual: your operative waits for your commands (still eats/sleeps to survive)":"Auto: your operative lives autonomously between your commands")+"'>"+(ST.avatarManual?"\u270b MANUAL":"\u27f3 AUTO")+"</button>";
  h+="</div>";
  // ── THE ACTIONS MENU — the full ops toolkit, right here in the dock so you can operate without first
  // hunting for + selecting your operative in the world. Same buttons/contract as the inspect panel.
  h+="<div class='od-ops' style='margin-top:8px;border-top:1px solid var(--bd);padding-top:6px'>";
  if(av&&av.jailed){
    // IMPRISONED — your operative is in the Holding Cells; ops are unavailable, bribe-out offered
    const j=av.jailed;
    h+="<div class='opcat' style='color:#ff6b6b;margin-bottom:3px'>\u26d3 IMPRISONED</div>";
    h+="<div class='sub' style='font-size:9.5px;color:#ffb0b0'>Held for "+(j.crime||"a crime")+(av.jailCount>1?" \u00b7 prior #"+av.jailCount:"")+".</div>";
    if(j.capital){
      h+="<div class='sub' style='font-size:9.5px;color:#ff4757;margin-top:3px'>Sentenced to death. No bribe will save you now.</div>";
    } else {
      const cost=Math.round(40*j.severity*(1+(av.jailCount||1)*0.3));
      h+="<button class='tb' id='od-bribeout' style='margin-top:5px;border-color:rgba(255,210,74,.5);color:#ffe08a'>\u25c8 BRIBE OUT ("+cost+"c \u00b7 8 intel)</button>";
      h+="<div class='sub' style='font-size:8.5px;opacity:.6;margin-top:3px'>Or wait out the sentence.</div>";
    }
  } else {
    h+="<div class='opcat' style='margin-bottom:2px'>OPERATIONS</div>";
    h+=renderOpsGrid({compact:true});
  }
  h+="</div>";
  h+="<div class='sub' style='font-size:8.5px;opacity:.6;margin-top:6px'>"+(isSel?"Click an empty tile to move \u00b7 click a target to operate":"Select your operative to command it")+"</div>";
  h+="</div>";
  // the always-visible strip
  h+="<div class='od-strip' id='od-strip'>";
  h+="<span class='od-glyph'>"+st.glyph+"</span>";
  h+="<span class='od-title'>OPERATIVE</span>";
  h+="<span class='od-state'>"+st.txt+"</span>";
  h+="<span class='od-chev'>\u25b2</span>";
  h+="</div>";
  dock.innerHTML=h;
  dock.classList.toggle("expanded",OP_DOCK_OPEN);
  // record the structural state this render reflects, so updateOpDockLive knows when a rebuild is needed
  const _av=theAvatar();dock._lastJailed=!!(_av&&_av.jailed);dock._lastBusy=!!(_av&&_av.activeOp);
}
// LIGHTWEIGHT live refresh — updates ONLY the progress bar + status text (no full innerHTML rebuild).
// Called every few ticks while an op runs / the avatar moves, so the dock stays live WITHOUT flickering
// or interrupting button interaction (the full rebuild was thrashing the DOM and eating clicks).
function updateOpDockLive(){
  const dock=document.getElementById("op-dock");if(!dock||!dock.querySelector)return;
  if(ST.phase!=="run"){if(dock.style.display!=="none")dock.style.display="none";return;}
  const av=theAvatar();const st=opDockState(av);
  // STRUCTURAL CHANGE DETECTION — the lightweight path only updates text/progress. If the dock's STRUCTURE
  // needs to change (never built yet, or the avatar's jailed-state flipped, or an op started/ended which
  // swaps the panel between the ops grid and the in-flight progress view), do a full rebuild instead.
  const jailedNow=!!(av&&av.jailed);
  const busyNow=!!(av&&av.activeOp);
  const strip=dock.querySelector(".od-strip");
  if(!strip || jailedNow!==dock._lastJailed || busyNow!==dock._lastBusy){
    dock._lastJailed=jailedNow;dock._lastBusy=busyNow;
    renderOpDock();
    return;
  }
  // progress bar (inside the open panel)
  const prog=dock.querySelector(".od-prog > i");
  if(prog&&st.prog!=null)prog.style.width=st.prog+"%";
  // status text + glyph in the always-visible strip
  const stateEl=dock.querySelector(".od-state");if(stateEl)stateEl.innerHTML=st.txt;
  const glyphEl=dock.querySelector(".od-glyph");if(glyphEl)glyphEl.textContent=st.glyph;
}
function syncHUD(){
  // FLICKER FIX — syncHUD runs frequently (every ~10 ticks + on every pawn job-completion). The full
  // renderOpDock() rebuild was tearing down + recreating the dock's innerHTML each time, causing visible
  // flicker and eating click interactions. The dock's STRUCTURE only changes on explicit user actions
  // (open/close, mode toggle, jail state) — those call sites call renderOpDock() directly. Here we only
  // need the lightweight in-place refresh of the live status text + progress bar.
  updateOpDockLive();
  $("h-pop").textContent=ST.pawns.length;
  $("h-cred").textContent=Math.round(ST.pawns.reduce((s,p)=>s+(p.credits||0),0));
  const inc=$("h-income");
  inc.textContent=(ST.crisis?"⚠ ":"")+Math.round(ST.income||0);
  inc.className="hud-val"+(ST.crisis?" danger":(ST.income||0)<0?" warn":"");
  $("h-home").textContent=ST.pawns.filter(p=>p.homeless).length;
  // INSURRECTION movement readout
  {const m=ST.mov||{},reg=ST.regime||{};
   const setM=(id,v)=>{const el=$(id);if(el)el.textContent=Math.round(v);};
   setM("m-support",m.support||0);setM("m-intel",m.intel||0);
   const ex=$("m-exposure");if(ex){ex.textContent=Math.round(m.exposure||0);
     ex.style.color=(m.exposure||0)>60?"#ff5470":(m.exposure||0)>30?"#ffd24a":"#8aa8c8";}
   setM("m-grip",reg.grip!=null?reg.grip:60);}
  // crisis HUD border
  const hudEl=$("hud");if(hudEl)hudEl.classList.toggle("crisis",!!ST.crisis);
  // goods pips — color when stocked
  const g=ST.goods||{};
  ["food","scrap","data","chem","parts","stims","gear"].forEach(k=>{
    const el=$("g-"+k);if(!el)return;
    const v=g[k]||0;
    el.textContent=v;
    el.style.color=v>0?"var(--tx)":"var(--dim)"});
  const h=hourN();
  const hh=String(Math.floor(h)).padStart(2,"0");
  const mm=String(Math.floor((h%1)*60)).padStart(2,"0");
  $("h-day").textContent="DAY "+dayN()+" · "+hh+":"+mm;
  // tier + prosperity
  const tier=currentTier(),prosp=prosperity();
  const tEl=$("h-tier");if(tEl){tEl.textContent="T"+tier.t;tEl.title=tier.name+" (Tier "+tier.t+")";}
  const pf=$("h-prosp-fill");if(pf)pf.style.width=prosp+"%";
  const pe=$("h-prosp");if(pe){pe.textContent=prosp;pe.title=prospRank(prosp);}
  refreshBuildAfford();}

// lightweight: update build-card affordability classes without rebuilding the menu
function refreshBuildAfford(){
  if(subCat!=="b")return;
  const sm=$("submenu");if(!sm||!sm.querySelectorAll)return;
  const credits=Math.round(ST.income||0);
  const w=sm.querySelector(".sm-wallet");
  if(w)w.innerHTML="<span class='coin'></span>"+credits;
  sm.querySelectorAll(".bcard[data-bt]").forEach(card=>{
    const t=card.dataset.bt,d=DEF[t];const cost=(d.cost&&d.cost.income)||0;
    const afford=cost<=credits;
    card.classList.toggle("afford",afford||cost===0);
    card.classList.toggle("broke",!afford&&cost>0);});}

function barHtml(lab,val,col){
  return "<div class='blab'><span>"+lab+"</span><span>"+Math.round(val)+"</span></div>"+
    "<div class='bar'><i style='width:"+clamp(val,0,100)+"%;background:"+col+"'></i></div>"}
function relsOf(p){const out=[];
  for(const k in ST.rel){const v=ST.rel[k];if(Math.abs(v)<8)continue;
    const ids=k.split("|");if(ids[0]!=p.id&&ids[1]!=p.id)continue;
    const oid=(ids[0]==p.id)?ids[1]:ids[0];
    const o=ST.pawns.find(q=>q.id==oid);if(!o)continue;
    out.push({o,v})}
  out.sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));return out}
function renderInspect(){renderInspectCore();if(subCat==="c")renderSub();}
function renderInspectCore(){const el=$("inspect");
  ST.sel=ST.sel.filter(e=>e.kind==="pawn"?ST.pawns.includes(e):
    false?false:structAt(e.x,e.y)===e);
  if(!ST.sel.length){el.style.display="none";return}
  el.style.display="block";
  // CLOSE BUTTON — always top-right, clears selection so the panel can be dismissed
  const closeBtn="<button id='insp-close' title='Close (Esc)' style='position:absolute;top:8px;right:8px;z-index:5;width:24px;height:24px;border:1px solid var(--bd);background:rgba(8,18,36,.9);color:var(--dim);border-radius:6px;font-size:14px;line-height:1;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center'>\u00d7</button>";
  if(ST.sel.length>1){
    el.innerHTML="<h3>"+ST.sel.length+" RUNNERS</h3><div class='sub'>squad selected</div>";return}
  const e=ST.sel[0];
  if(e.kind==="pawn"){
    const tab=INSPECT_TAB;
    let h="<h3 style='color:"+e.accent+"'>"+e.name+"</h3>";
    h+="<div class='sub'>"+e.tr.map(t=>t.n).join(" \u00b7 ")+"</div>";
    if(e.isAvatar){h+="<div class='sub' style='border-left:2px solid #22ddff;padding-left:6px;margin:3px 0;color:#22ddff;font-weight:600'>YOUR OPERATIVE</div>";}
    else if(e.role&&ROLES[e.role]){const R0=ROLES[e.role];
      const alignCol=R0.align==="regime"?"#ff5470":R0.align==="insurgent"?"#5cff9e":"#ffd84a";
      const alignLbl=R0.align==="regime"?"REGIME":R0.align==="insurgent"?"INSURGENT LEVER":"CIVIC";
      h+="<div class='sub' style='border-left:2px solid "+R0.accent+";padding-left:6px;margin:3px 0'><span style='color:"+R0.accent+";font-weight:600'>"+R0.title.toUpperCase()+"</span> \u00b7 <span style='color:"+alignCol+";font-size:10px'>"+alignLbl+"</span></div>";}
    const tabs=[["status","STATUS"],["person","PERSON"],["ties","TIES"],["mind","MIND"]];
    h+="<div style='display:flex;gap:2px;margin:6px 0 8px;border-bottom:1px solid rgba(120,160,200,.2)'>";
    for(const tt of tabs){const on=tab===tt[0];
      h+="<button class='tb' data-itab='"+tt[0]+"' style='flex:1;padding:4px 2px;font-size:9px;letter-spacing:.08em;border:none;border-bottom:2px solid "+(on?e.accent:"transparent")+";background:"+(on?"rgba(120,160,200,.08)":"transparent")+";color:"+(on?e.accent:"var(--dim)")+";border-radius:0'>"+tt[1]+"</button>";}
    h+="</div>";
    if(tab==="status"){
      h+=barHtml("HP",e.hp,"#39ff88");
      h+=barHtml("FOOD",e.needs.food,"#b8ff5e");
      h+=barHtml("REST",e.needs.rest,"#7aa2ff");
      h+=barHtml("HYGIENE",e.needs.hyg!=null?e.needs.hyg:60,"#5cffd0");
      h+=barHtml("MOOD",e.mood,e.mood<25?"#ff4757":"#ffd84a");
      if(e.mods&&e.mods.length){
        const active=e.mods.filter(md=>md.until>ST.tick&&md.l).slice().sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,3);
        if(active.length)h+="<div class='sub' style='font-size:10px;opacity:.85'>"+active.map(md=>"<span style='color:"+(md.v>=0?"#39ff88":"#ff6b6b")+"'>"+(md.v>=0?"+":"")+Math.round(md.v)+" "+md.l+"</span>").join(" \u00b7 ")+"</div>";
      }
      // ── compact 2-column status grid (was 4 stacked full-width rows) — reads as a unit, less vertical sprawl ──
      const kv=(k,v)=>"<div style='display:flex;justify-content:space-between;gap:6px;font-size:11px;padding:1px 0'><span style='color:var(--dim);letter-spacing:.04em'>"+k+"</span><span style='color:var(--tx);text-align:right'>"+v+"</span></div>";
      let homeVal="\u2014";
      if(e.homeless)homeVal="<span style='color:#ff8c42'>HOMELESS</span>";
      else if(!e.child){const hr=homeRoom(e);if(hr){const q=roomQuality(hr),qt=roomQTier(q);homeVal="<span style='color:"+qt.c+"'>"+qt.name+"</span> <span style='opacity:.55'>("+q+")</span>";}}
      h+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:0 14px;margin:6px 0 2px;padding:6px 8px;background:rgba(8,18,36,.4);border-radius:6px;border:1px solid rgba(120,160,200,.12)'>";
      h+=kv("TASK",jobLabel(e));
      h+=kv("CREDITS",(e.credits|0)+(e.homeless?" <span style='color:var(--rd)'>EVICTED</span>":""));
      h+=kv("STRESS",(e.stress|0)+(e.addiction>0?" \u00b7 ADD "+(e.addiction|0):""));
      h+=kv("HOME",homeVal);
      h+="</div>";
      if(e.sick)h+="<div class='sub' style='color:var(--rd);font-size:10px'>\u2622 INFECTED \u2014 needs a clinic</div>";
      if(e.hasGear)h+="<div class='sub' style='color:#7aa2ff;font-size:10px'>\u25c8 GEARED</div>";
      // ── AVATAR OPERATIVE STATUS — at-a-glance state. The full OPS TOOLKIT lives in the operative dock
      //    (bottom-left), so it's removed from here to keep the panel short and unscrolled. ──
      if(e.isAvatar){
        const m=M();const rep=avatarRep();
        const repLbl=rep>40?"BELOVED":rep>10?"RESPECTED":rep<-40?"FEARED":rep<-10?"RUTHLESS":"UNKNOWN";
        const repCol=rep>10?"#5cff9e":rep<-10?"#ff7a8c":"#8aa8c8";
        h+="<div class='ordsec' style='color:#22ddff;margin-top:10px'>OPERATIVE STATUS</div>";
        // ── intel / exposure / rep (+ doctrine) as distinct CHIPS ──
        const chip=(lbl,val,col)=>"<span style='display:inline-flex;align-items:center;gap:4px;padding:2px 7px;background:rgba(8,18,36,.6);border:1px solid "+col+"44;border-radius:10px;font-size:10px'><span style='color:var(--dim)'>"+lbl+"</span><span style='color:"+col+";font-weight:600'>"+val+"</span></span>";
        h+="<div style='display:flex;gap:5px;flex-wrap:wrap;margin:4px 0 2px'>"+chip("INTEL",(m.intel|0),"#22ddff")+chip("EXPOSURE",(m.exposure|0),"#ff5470")+chip("REP",repLbl,repCol)+(m.doctrine?chip("DOCTRINE",(DOCTRINE_DEF[m.doctrine]?DOCTRINE_DEF[m.doctrine].label:m.doctrine),"#c98bff"):"")+"</div>";
        if((m.exposure|0)>40)h+="<div class='sub' style='font-size:9px;color:#ff8c42'>\u26a0 High exposure \u2014 ops are riskier. Lie low to cool off.</div>";
        // IN-FLIGHT op: a compact progress readout (the abandon/control still lives in the dock)
        if(e.activeOp){const ao=e.activeOp;const opD=AVATAR_OPS[ao.opKey];const pct=Math.round(ao.prog/ao.duration*100);
          h+="<div class='sub' style='font-size:11px;color:#ffd24a;margin-top:6px;font-weight:600'>\u25b8 "+opD.name.toUpperCase()+" \u2014 "+pct+"%</div>";
          h+="<div class='bar' style='margin-top:2px'><i style='width:"+pct+"%;background:#ffd24a'></i></div>";
        } else {
          // pointer to the always-reachable ops toolkit in the dock (no duplicated button wall here)
          h+="<div class='sub' style='font-size:9px;opacity:.7;margin-top:5px'>\u25c9 Full operations toolkit is in the OPERATIVE dock (bottom-left \u2199)</div>";
        }
      }
    }
    else if(tab==="person"){
      if(e.child){const pn=(e.parents||[]).map(id=>{const pp=ST.pawns.find(x=>x.id===id);return pp?pp.name:null}).filter(Boolean);
        h+="<div class='sub' style='color:#ffd84a'>CHILD"+(e.surname?" \u00b7 "+e.surname:"")+(e.age!=null?" \u00b7 age "+e.age:"")+(pn.length?" \u00b7 child of "+pn.join(" & "):"")+"</div>";}
      if(e.isAvatar){
        const bg=OPS_BACKGROUNDS.find(b=>b.k===e.background);
        h+="<div class='ordsec' style='color:#22ddff'>OPERATIVE"+(bg?" \u00b7 "+bg.name:"")+"</div>";
        h+="<div class='sub' style='display:flex;flex-wrap:wrap;gap:3px 10px'>";
        for(const a of OPS_ATTRS){const v=ops(e,a.k);const col=v>=8?"#5cff9e":v>=5?"#7aa2ff":"#8aa8c8";
          h+="<span title='"+a.blurb+"'>"+a.name+" <span style='color:"+col+";font-weight:600'>"+v+"</span></span>";}
        h+="</div>";
        // POSTURE — how your operative carries himself when living on his own (auto mode). Lay Low keeps
        // his head down (skips risky work, minimizes exposure); Normal lives like anyone; Revolucionario
        // throws himself at the cause regardless of risk or his own needs.
        const post=ST.avatarPosture||"normal";
        h+="<div class='ordsec' style='color:#22ddff;margin-top:6px'>POSTURE</div>";
        h+="<div style='display:flex;gap:4px;margin:3px 0'>";
        const POSTURES=[["laylow","\u25ad LAY LOW","Skips work, lies low, minimizes exposure"],["normal","\u25cb NORMAL","Lives like any wisp"],["revolucionario","\u2691 REVOLUCIONARIO","Goes all out for the cause, ignores risk + needs"]];
        for(const[pk,pl,pt] of POSTURES){const on=post===pk;
          h+="<button class='tb i-posture' data-posture='"+pk+"' title='"+pt+"' style='flex:1;font-size:8px;padding:5px 2px;letter-spacing:.02em;"+(on?"border-color:#22ddff;color:#22ddff;background:rgba(34,221,255,.12)":"border-color:var(--bd);color:var(--dim)")+"'>"+pl+"</button>";}
        h+="</div>";
      }
      if(e.role&&ROLES[e.role])h+="<div class='sub' style='opacity:.8;font-style:italic'>"+ROLES[e.role].desc+"</div>";
      if(!e.child){const voc=vocationOf(e);
        h+="<div class='sub'>VOCATION: <span style='color:#7aa2ff'>"+fogVal(e,"voc",(voc&&voc.name?voc.name:"Laborer"))+"</span></div>";
        if(e.assigned){const as=ST.structs.get(e.assigned);
          h+="<div class='sub'>ASSIGNED TO: <span style='color:#ffd84a'>"+(as?DEF[as.type].name:"\u2014")+"</span> <button class='tb' id='i-unassign' style='font-size:9px;padding:2px 6px;margin-left:4px'>unassign</button></div>";}
        else h+="<div class='sub' style='opacity:.7'>ASSIGNED TO: <span style='opacity:.6'>nothing (works where needed)</span></div>";}
      h+="<div class='sub'>SKILLS: "+fogVal(e,"skills","SAL "+e.sk.sal+" \u00b7 BLD "+e.sk.bld+" \u00b7 COOK "+e.sk.cook+" \u00b7 SHT "+e.sk.sht)+"</div>";
      if(e.pers){const P=e.pers;const pBit=(lbl,key,v)=>lbl+" "+fogVal(e,key,"<span style='color:"+(v>60?"#5cff9e":v<40?"#ff8da3":"#8aa8c8")+"'>"+Math.round(v)+"</span>");
        h+="<div class='ordsec'>TEMPERAMENT</div><div class='sub' style='display:flex;flex-wrap:wrap;gap:3px 10px;font-size:10px'>"+pBit("Empathy","emp",P.emp||50)+" \u00b7 "+pBit("Integrity","intg",P.intg||50)+" \u00b7 "+pBit("Ambition","amb",P.amb||50)+" \u00b7 "+pBit("Caution","cau",P.cau||50)+" \u00b7 "+pBit("Social","soc",P.soc||50)+" \u00b7 "+pBit("Impulse","imp",P.imp||50)+"</div>";
        // intel progress hint — how much of this wisp you've uncovered (nudges the player to gather more)
        if(!e.isAvatar){const ip=Math.round(intelProgress(e)*100);
          h+="<div class='sub' style='font-size:8.5px;opacity:.55;margin-top:2px'>"+(ip>=100?"\u25c9 Fully profiled":"\u25cc Profile "+ip+"% \u2014 Gather Intel to reveal more")+"</div>";
          // ROUTINE dossier — what surveillance has mapped (home/work/schedule/vulnerable window)
          const rs=routineStage(e);
          if(rs>0){const r=e.routine;
            h+="<div class='ordsec' style='margin-top:5px'>DOSSIER</div><div class='sub' style='font-size:9.5px;line-height:1.5'>";
            if(r.home!==undefined)h+="<div>\u25b8 Home: "+(r.homeless?"<span style='color:#ff9a52'>homeless — sleeps rough</span>":(r.home?"<span style='color:#22ddff'>mapped \u2014 marked on map \u25ce</span>":"unknown"))+"</div>";
            if(r.work!==undefined)h+="<div>\u25b8 Work: "+(r.work?DEF[r.work.type]?DEF[r.work.type].name:"mapped":"<span style='opacity:.6'>no fixed work</span>")+"</div>";
            if(r.schedule)h+="<div>\u25b8 Routine: "+(r.schedule.works?"works days":"idle days")+", "+(r.schedule.nocturnal?"up late":"sleeps nights")+"</div>";
            if(r.vulnerable)h+="<div style='color:#ff8da3'>\u26a0 Vulnerable: "+r.vulnerable.desc+"</div>";
            h+="</div>";
            if(!routineComplete(e))h+="<div class='sub' style='font-size:8.5px;opacity:.55'>\u25cc Surveil again to map more</div>";
          }
        }}
    }
    else if(tab==="ties"){
      if(!isChild(e)){const al=e.allegiance||0;
        const alC=al>30?"#5cff9e":al<-30?"#ff5470":"var(--dim)";
        const alLbl=e.informant?"REGIME INFORMANT":e.recruited?("CELL "+(e.cellRole||"member").toUpperCase()):al>30?"sympathetic":al<-30?"loyalist":"undecided";
        h+="<div class='sub'>ALLEGIANCE <span style='color:"+alC+"'>"+alLbl+"</span> ("+(al>0?"+":"")+Math.round(al)+")</div>";}
      {const bits=[];const c=cliqueOf(e);if(c)bits.push("<span style='color:#c98bff'>"+c.name+"</span>");
       const g=pawnGang(e);if(g)bits.push("<span style='color:"+g.color+"'>"+g.name+"</span>");
       if(bits.length)h+="<div class='sub'>"+bits.join(" \u00b7 ")+"</div>";}
      if(e.rep&&(e.rep.city||e.rep.gang)){const cR=e.rep.city|0,gR=e.rep.gang|0;
        const cC=cR<-20?"var(--rd)":cR>20?"var(--gn)":"var(--dim)";const gC=gR>20?"var(--mg)":gR<-10?"var(--rd)":"var(--dim)";
        h+="<div class='sub'>CITY REP <span style='color:"+cC+"'>"+(cR>0?"+":"")+cR+"</span> \u00b7 GANG <span style='color:"+gC+"'>"+(gR>0?"+":"")+gR+"</span></div>";}
      {const rels=relsOf(e);
       if(rels.length){h+="<div class='ordsec'>TIES</div>";
         for(const tie of rels.slice(0,7)){const v=tie.v,col=v>0?"#39ff88":"#ff4757";
           const lbl=v>=50?"ally":v>=15?"warm":v<=-50?"hostile":v<=-15?"rival":"\u00b7";
           h+="<div class='sub' style='display:flex;justify-content:space-between;gap:8px'><span style='color:"+tie.o.accent+"'>"+tie.o.name+"</span><span style='color:"+col+"'>"+lbl+" "+(v>0?"+":"")+(v|0)+"</span></div>";}}
       else h+="<div class='sub' style='opacity:.6'>No notable relationships yet.</div>";}
    }
    else if(tab==="mind"){
      const thoughts=wispThoughts(e);
      if(thoughts.length){h+="<div class='ordsec'>ON THEIR MIND</div>";
        for(const t of thoughts)h+="<div class='sub' style='color:"+t.col+";font-style:italic'>\u201c"+t.txt+"\u201d</div>";}
      else h+="<div class='sub' style='opacity:.6'>Nothing pressing on their mind right now.</div>";
      if(e.mem&&e.mem.length){h+="<div class='ordsec'>MEMORIES</div>";
        for(const mm of e.mem.slice(-5).reverse())h+="<div class='sub' style='font-size:10px;opacity:.7'>\u00b7 "+mm.t+"</div>";}
    }
    if(!isChild(e)&&!e.recruited&&!e.informant){
      const pot=radicalPotential(e);const ch=Math.round(clamp(0.3+pot/120,0.05,0.92)*100);
      h+="<button class='tb' id='i-recruit' style='border-color:rgba(92,255,158,.4);color:#5cff9e;margin-top:6px'>\u270a RECRUIT (8 intel \u00b7 "+ch+"%)</button>";
    }
    // PATRONIZE — slip a struggling wisp credits. The desperate (homeless / in debt / broke) remember who
    // helped them when no one else did: it relieves their hardship AND wins real goodwill + a lean toward
    // your cause. Costs YOUR district income. A direct lever from the economy into the insurrection.
    if(!isChild(e)&&!e.isAvatar&&!e.informant){
      const struggling=e.homeless||(e.rentDebt||0)>0||(e.credits||0)<15||(e.desperate&&e.desperate>ST.tick);
      const cost=struggling?20:12;
      const can=(ST.income||0)>=cost;
      h+="<button class='tb' id='i-patron' style='border-color:rgba("+(struggling?"255,210,74,.5":"122,162,255,.4")+");color:"+(struggling?"#ffe08a":"#aebfff")+";margin-top:4px"+(can?"":";opacity:.55")+"'>\u25c8 PATRONIZE ("+cost+"c)"+(struggling?" \u2014 they're struggling":"")+"</button>";
    }
    if(e.refusedOrder){
      h+="<button class='tb' id='i-force' style='border-color:rgba(255,84,112,.5);color:#ff8da3;margin-top:4px'>\u26a1 FORCE COMPLIANCE (10 intel)</button>";
      h+="<div class='sub' style='font-size:9px;opacity:.6'>They refused. Forcing works but breeds resentment.</div>";
    }
    // ── ACT ON THIS WISP — the operative's options against this target, surfaced directly (no "pick op
    //    first, then click"). We are the avatar; clicking a wisp shows what we can do TO them, range-aware. ──
    if(!isChild(e)&&!e.isAvatar){
      const av=theAvatar();
      if(av&&!av.activeOp){
        const inRange=op=>{const o=AVATAR_OPS[op];return DIST(av.px,av.py,e.px,e.py)<=o.range;};
        const wispOps=["surveil","bribe","blackmail","frame","assassinate"].filter(ok=>{
          const o=AVATAR_OPS[ok];
          if(ok==="blackmail"&&!knownSecret(e))return false;          // need dirt
          if(ok==="frame"&&!(e.regimeForce||e.informant||(e.allegiance||0)<-20))return false;  // regime only
          if(ok==="assassinate"&&!(e.regimeForce||e.informant||(e.allegiance||0)<-20))return false;
          return true;
        });
        if(wispOps.length){
          h+="<div class='ordsec' style='color:#22ddff'>OPERATIONS</div>";
          h+="<div class='wisp-ops'>";
          const OP_ICON={surveil:"\u25c9",bribe:"\u25c8",blackmail:"\u2756",frame:"\u2624",assassinate:"\u2620"};
          for(const ok of wispOps){const o=AVATAR_OPS[ok];const m=M();
            const near=inRange(ok);const afford=(m.intel||0)>=o.cost;
            const ready=near&&afford;
            const why=!afford?"need "+o.cost+" intel":!near?"walk closer":o.desc;
            h+="<button class='tb wisp-op"+(ready?"":" dim")+"' data-wop='"+ok+"' title='"+why.replace(/'/g,"&#39;")+"' style='border-color:"+(ready?"rgba(34,221,255,.45)":"rgba(120,140,160,.2)")+";color:"+(ready?"#bfe8ff":"#6a7a8c")+"'>"+OP_ICON[ok]+" "+o.name.replace(/ a Wisp| a Regime Asset/,"").toUpperCase()+(o.cost?" ("+o.cost+")":"")+(near?"":" \u2192")+"</button>";
          }
          h+="</div>";
          if(!wispOps.some(inRange))h+="<div class='sub' style='font-size:9px;color:#ffd24a;opacity:.85'>\u25c9 Walk your operative closer to act (\u2192 = out of range)</div>";
        }
      }
    }
    // (DIRECT ORDERS grid removed from the character panel to free space — the bottom-left COMMAND menu
    //  issues the same orders to a selected citizen.)
    // AUTHORED CONVERSATION — the stat-gated dialogue system (works WITHOUT the AI; distinct from AI TALK).
    if(!e.isAvatar&&!isChild(e)&&!e.isEnvoy&&e.hp>0){
      h+="<button class='tb i-talk' id='i-converse' style='background:rgba(120,90,200,.16)!important;border-color:rgba(140,110,220,.45)!important'>\u25c8 TALK</button>";
    }
    // ELECTION: if a vote is underway and this wisp could hold the seat, let the player back them
    if(ST.election&&!ST.election.resolved&&!e.isAvatar&&!e.role&&!e.child&&e.hp>0){
      const backing=ST.election.playerPick===e.id;
      h+="<button class='tb' id='i-back' style='border-color:rgba(255,210,74,.6);color:#ffe066;margin-top:4px'>\u2696 "+(backing?"BACKING FOR "+ROLES[ST.election.role].title.toUpperCase():"BACK FOR "+ROLES[ST.election.role].title.toUpperCase())+"</button>";
    }
    h+="<button class='tb' id='i-follow'>"+(cam.follow===e.id?"\u25c9 FOLLOWING":"\u25ce FOLLOW")+"</button>";
    h+="<button class='tb' id='i-profile'>\u2630 FULL PROFILE</button>";
    el.innerHTML=closeBtn+h}
  else if(e.kind==="foe"){
    el.innerHTML="<h3 style='color:"+e.col+"'>"+e.name+"</h3>"+
      "<div class='sub'>hostile</div>"+barHtml("HP",e.hp/e.maxHp*100,"#ff4757")}
  else{const d=DEF[e.type];
    let h="<h3>"+d.name+"</h3>";
    if(e.bp)h+="<div class='sub'>BLUEPRINT — "+Math.floor(e.prog/e.need*100)+"% built</div>";
    else if(isFurniture(e)){
      // furniture: quality tier + condition as a detail line (no world life-bar)
      const q=qualOf(e);const cond=clamp(e.hp/e.maxHp*100,0,100);
      const condLbl=isBroken(e)?"<span style='color:#ff4757'>BROKEN</span>":cond>66?"good":cond>33?"worn":"<span style='color:#ffb454'>failing</span>";
      h+="<div class='sub'>QUALITY: <span style='color:"+q.col+"'>"+q.name.toUpperCase()+"</span> · CONDITION: "+condLbl+" ("+Math.round(cond)+"%)</div>";
      if(e.owner){const o=ST.pawns.find(p=>p.id===e.owner);if(o)h+="<div class='sub'>OWNER: "+o.name+"</div>";}
    }
    else if(d.hp>1)h+=barHtml("INTEGRITY",e.hp/e.maxHp*100,"#39ff88");
    if(e.type==="pod"&&e.owner){const o=ST.pawns.find(p=>p.id===e.owner);
      h+="<div class='sub'>Assigned: "+(o?o.name:"—")+"</div>"}
    // economy fixture info
    if(!e.bp&&(d.prod||d.refine||d.vendor)){
      const assignees=ST.pawns.filter(p=>p.assigned===K(e.x,e.y));
      if(e.idle&&!DEF[e.type].selfRun)h+="<div class='sub' style='color:#ffb454'>\u26A0 IDLE — needs a worker or robot to earn</div>";
      h+="<div class='sub'>WORKER: "+(e.roboStaffed?("<span style='color:#7aa2ff'>ROBOT"+(roboBroken(e)?" — <span style=\"color:#ff4757\">BROKEN</span>":" ("+(e.roboHp|0)+"%)")+"</span>"):(assignees.length?assignees.map(p=>p.name).join(", "):"unassigned"))+"</div>";
      if(d.prod)h+="<div class='sub'>PRODUCES: "+d.prod.toUpperCase()+" (stock: "+(ST.goods[d.prod]||0)+")</div>";
      if(d.refine)h+="<div class='sub'>REFINES: "+d.refine.in.map(k=>k.toUpperCase()).join("+")+
        " → "+d.refine.out.toUpperCase()+" (stock: "+(ST.goods[d.refine.out]||0)+")</div>";
      if(d.vendor){const gs=d.sells?[d.sells]:["gear","data"];
        h+="<div class='sub'>SELLS: "+gs.map(g=>g.toUpperCase()+" ("+(ST.goods[g]||0)+")").join(" · ")+"</div>";}
      if(d.cost&&d.cost.income)h+="<div class='sub' style='color:var(--or)'>COST: "+d.cost.income+"c district</div>";
      // assign selected pawn button
      const selPawn=ST.sel.length===1&&ST.sel[0].kind==="pawn"?null:
        ST.pawns.find(p=>ST.sel.includes(p));
      const anySelPawn=selPawns().length>0;
      if(anySelPawn)h+="<button class='tb' id='i-assign'>ASSIGN</button>";
      if(anySelPawn)h+="<button class='tb' id='i-hire'>HIRE (+12c/shift)</button>";
      if(assignees.length)h+="<button class='tb' id='i-unassign'>UNASSIGN ALL</button>";
      // robot automation controls (vendor stores only)
      if(canAutomate(e))h+="<button class='tb' id='i-automate'>AUTOMATE ("+ROBO_INSTALL+"c)</button>";
      else if(e.roboStaffed){
        if(roboBroken(e))h+="<button class='tb' id='i-roborepair'>REPAIR ROBOT ("+Math.round(ROBO_INSTALL*0.3)+"c)</button>";
        h+="<button class='tb' id='i-deautomate'>REMOVE ROBOT</button>";
      }
      const contracted=ST.pawns.filter(p=>p.contract&&p.contract.fixtureKey===K(e.x,e.y));
      if(contracted.length)h+="<div class='sub'>Contracted: "+contracted.map(p=>p.name).join(", ")+"</div>";
      if(contracted.length)h+="<button class='tb' id='i-fire'>FIRE CONTRACTED</button>";
    }
    if(d.desc)h+="<div class='sub'>"+d.desc+"</div>";
    if(e.type==="sporevat"&&!e.bp){const vt=vatTier(e),nx=VAT_TIERS[(e.tier||1)];
      h+="<div class='sub'>STAGE: <span style='color:"+vt.core+"'>"+vt.name.toUpperCase()+"</span> \u00b7 +"+vt.food+" food/cycle</div>";
      if(nx&&vt.up){const up=vt.up,parts=Object.entries(up).map(([k,v])=>v+(k==="income"?"c":" "+k)).join(" + ");
        const can=(ST.income||0)>=(up.income||0)&&Object.entries(up).every(([k,v])=>k==="income"||(ST.goods[k]||0)>=v);
        h+="<button class='tb' id='i-upgrade'"+(can?"":" style='opacity:.5'")+">UPGRADE \u2192 "+nx.name.toUpperCase()+" ("+parts+")</button>";}}
    if(e.type==="scrap"||e.type==="cache")
      h+="<button class='tb' id='i-salv'>"+(e.desig?"UNMARK":"SALVAGE")+"</button>";
    else if(e.type==="ruin"||d.cat==="b")
      h+="<button class='tb' id='i-decon'>"+(e.decon?"CANCEL DECON":"DECONSTRUCT")+"</button>";
    el.innerHTML=closeBtn+h}}
$("inspect").addEventListener("click",e=>{
  // CLOSE BUTTON — dismiss the panel
  if(e.target.closest&&e.target.closest("#insp-close")){SFX.ui&&SFX.ui();ST.sel=[];$("inspect").style.display="none";return;}
  // ACT-ON-WISP: an operation button on the selected target — run it directly (we are the avatar)
  const wopBtn=e.target.closest&&e.target.closest(".wisp-op");
  if(wopBtn){
    const ok=wopBtn.dataset.wop;const tgt=ST.sel[0];
    if(tgt&&tgt.kind==="pawn"){SFX.ui&&SFX.ui();tgt.kind="pawn";
      if(runAvatarOp(ok,tgt)){ST.sel=[theAvatar()].filter(Boolean);}
      renderInspect();syncHUD();}
    return;
  }
  // character-panel tab switch
  const tabBtn=e.target.closest&&e.target.closest("[data-itab]");
  if(tabBtn){SFX.ui&&SFX.ui();INSPECT_TAB=tabBtn.dataset.itab;renderInspect();return;}
  const ob=e.target.closest&&e.target.closest(".ob");
  if(ob){const s=ST.sel[0];if(s&&s.kind==="pawn"){SFX.ui();clearJob(s);s.job=null;s.cmd=ob.dataset.o;s.refusedOrder=false;renderInspect()}return}
  // AVATAR OPERATIONS: op button clicked
  const opBtn=e.target.closest&&e.target.closest(".i-op");
  if(opBtn){dispatchOpButton(opBtn);return;}
  // POSTURE button — set how the operative carries himself in auto mode
  const postBtn=e.target.closest&&e.target.closest(".i-posture");
  if(postBtn){ST.avatarPosture=postBtn.dataset.posture;SFX.ui&&SFX.ui();
    flashMsg&&flashMsg("Posture: "+(ST.avatarPosture==="laylow"?"Lay Low":ST.avatarPosture==="revolucionario"?"Revolucionario — all out":"Normal"));
    renderInspect();return;}
  const id=e.target.id;if(!id)return;
  const sel=ST.sel[0];SFX.ui();
  if(id==="i-force"&&sel&&sel.kind==="pawn"){
    // override a refused order at a cost: intel + resentment + allegiance pushback
    if((M().intel||0)<10){flashMsg&&flashMsg("Need 10 intel to force compliance");return;}
    M().intel-=10;sel.refusedOrder=false;
    if(sel.pendingForceCmd){clearJob(sel);sel.job=null;sel.cmd=sel.pendingForceCmd;sel.pendingForceCmd=null;}
    addMod(sel,"forced","Forced against my will",-12,TPD);
    sel.allegiance=clamp((sel.allegiance||0)-8,-100,100);   // resentment hardens them against you
    sel.stress=Math.min(100,(sel.stress||0)+10);
    log("You forced "+sel.name+" to comply — they resent it.","warn");
    renderInspect();syncHUD();return;
  }
  if(id==="i-converse"&&sel&&sel.kind==="pawn")startDialogue(sel);
  else if(id==="i-lielow"){if(goToGround()){SFX.ui&&SFX.ui();}renderInspect();syncHUD();}
  else if(id==="i-back"&&sel&&sel.kind==="pawn"){if(proposeCandidate(sel.id)){SFX.ui&&SFX.ui();}renderInspect();syncHUD();}
  else if(id==="i-recruit"&&sel&&sel.kind==="pawn"){if(recruitWisp(sel)){SFX.ui&&SFX.ui();}renderInspect();syncHUD();}
  else if(id==="i-patron"&&sel&&sel.kind==="pawn"){
    const struggling=sel.homeless||(sel.rentDebt||0)>0||(sel.credits||0)<15||(sel.desperate&&sel.desperate>ST.tick);
    const cost=struggling?20:12;
    if((ST.income||0)<cost){flashMsg&&flashMsg("Need "+cost+"c district income to patronize");return;}
    ST.income-=cost;
    // relieve the immediate hardship
    sel.credits=(sel.credits||0)+cost;
    if(sel.rentDebt){sel.rentDebt=Math.max(0,sel.rentDebt-1);}
    // the goodwill — bigger when they were genuinely struggling (you helped when it mattered)
    const goodwill=struggling?RI(12,20):RI(5,9);
    sel.allegiance=clamp((sel.allegiance||0)+goodwill,-100,100);
    if(sel.desperate&&sel.credits>15)sel.desperate=0;   // pulled back from the brink
    emotionalReact(sel,struggling?"relief":"joy",struggling?0.6:0.4,{memory:"someone slipped me credits when I was down — I won't forget it"});
    adjAvatarRep&&adjAvatarRep(struggling?4:2);          // word spreads that you look after people
    log("You patronized "+sel.name+" — "+(struggling?"a lifeline they'll remember.":"a gesture of goodwill."),"good");
    SFX.ui&&SFX.ui();renderInspect();syncHUD();
  }
  else if(id==="i-follow"&&sel&&sel.kind==="pawn"){
    if(cam.follow===sel.id)stopFollow();else setFollow(sel);
    renderInspect();}
  else if(id==="i-profile"&&sel&&sel.kind==="pawn"){OV.crewFocus=sel.id;openOverlay("crew");}
  else if(id==="i-hire"){
    const tgt=ST.sel.find(e=>e.kind!=="pawn");
    if(tgt){const fk=K(tgt.x,tgt.y);
      selPawns().forEach(p=>{p.assigned=fk;p.contract={fixtureKey:fk,wage:12};clearJob(p);
        remember(p,"got a contract at "+DEF[tgt.type].name+" — 12c a shift")});
      log(selPawns().length+" citizen(s) hired at "+DEF[tgt.type].name+".","good");
      renderInspect()}}
  else if(id==="i-fire"){
    const tgt=ST.sel.find(e=>e.kind!=="pawn");
    if(tgt){const fk=K(tgt.x,tgt.y);
      ST.pawns.filter(p=>p.contract&&p.contract.fixtureKey===fk).forEach(p=>{
        p.contract=null;p.assigned=null;
        remember(p,"contract at "+DEF[tgt.type].name+" got terminated");
        p.stress=Math.min(100,(p.stress||0)+10)});
      log("Contracts terminated at "+DEF[tgt.type].name+".","warn");
      renderInspect()}}
  else if(id==="i-assign"){
    const tgt=ST.sel.find(e=>e.kind!=="pawn");
    if(tgt){selPawns().forEach(p=>{p.assigned=K(tgt.x,tgt.y);clearJob(p)});renderInspect();syncHUD()}}
  else if(id==="i-unassign"){
    const selP=ST.sel.find(e=>e.kind==="pawn");
    if(selP){selP.assigned=null;if(selP.contract)selP.contract=null;clearJob(selP);renderInspect();syncHUD();}
    else{const tgt=ST.sel.find(e=>e.kind!=="pawn");
      if(tgt){ST.pawns.filter(p=>p.assigned===K(tgt.x,tgt.y)).forEach(p=>{p.assigned=null});renderInspect()}}}
  else if(id==="i-automate"){
    const tgt=ST.sel.find(e=>e.kind!=="pawn");
    if(tgt&&automateStore(tgt)){renderInspect();syncHUD()}}
  else if(id==="i-deautomate"){
    const tgt=ST.sel.find(e=>e.kind!=="pawn");
    if(tgt){deautomateStore(tgt);renderInspect();syncHUD()}}
  else if(id==="i-roborepair"){
    const tgt=ST.sel.find(e=>e.kind!=="pawn");
    if(tgt&&repairRobo(tgt)){renderInspect();syncHUD()}}
  else if(id==="i-salv"&&sel){sel.desig=!sel.desig;
    if(sel.desig)ST.flags.salv=true;renderInspect()}
  else if(id==="i-upgrade"&&sel&&sel.type==="sporevat"){
    const up=vatTier(sel).up;
    if(!up){return;}
    const can=(ST.income||0)>=(up.income||0)&&Object.entries(up).every(([k,v])=>k==="income"||(ST.goods[k]||0)>=v);
    if(!can){flashMsg&&flashMsg("Can't afford the upgrade");return;}
    if(up.income)ST.income-=up.income;
    for(const[k,v] of Object.entries(up))if(k!=="income")ST.goods[k]=(ST.goods[k]||0)-v;
    sel.tier=(sel.tier||1)+1;
    float(sel.x+.5,sel.y+.5,"UPGRADED","#39ff88");log(DEF.sporevat.name+" upgraded to "+vatTier(sel).name+".","good");
    renderInspect();syncHUD();return;}
  else if(id==="i-decon"&&sel){sel.decon=!sel.decon;renderInspect()}});

/* ---------- ambient musings (Haiku, background flavor) ---------- */
const AMBIENT={lastTick:-1e9,gapTicks:1200,enabled:true,inFlight:false};
// pick the most "interesting" citizen to muse — someone with a strong current state
function pickMuser(){
  const cands=ST.pawns.filter(p=>!p.sleeping);
  if(!cands.length)return null;
  // weight by how much is going on for them
  let best=null,bw=-1;
  for(const p of cands){
    let w=0;
    if(p.stress>60)w+=3;if((p.credits||0)<5)w+=2;if(p.homeless)w+=3;
    if(p.sick)w+=2;if((p.addiction||0)>40)w+=2;if(p.mood>70)w+=1;if(p.mood<25)w+=2;
    const rivals=ST.pawns.filter(q=>q!==p&&relGet(p.id,q.id)<-40).length;
    const allies=ST.pawns.filter(q=>q!==p&&relGet(p.id,q.id)>50).length;
    w+=rivals+allies;
    w+=Math.random()*2; // jitter so it's not always the same person
    if(w>bw){bw=w;best=p}}
  return best;}
function ambientPrompt(p){
  return "You ARE "+p.name+", scraping a life on a dead block in a neon megacity, 2087. "+
    "You come across as "+axTraits(p)+". Right now you are "+feltState(p)+". "+
    "It's day "+dayN()+", around "+(hourN()|0)+":00.\n\n"+
    "Write ONE short line of inner thought — something you'd mutter to yourself or jot down right now. "+
    "Street-worn, in the moment, under 16 words. No quotes, no name prefix, no stage directions. Just the raw thought.";}
async function tickAmbient(){
  if(!AMBIENT.enabled||AMBIENT.inFlight||!aiReady())return;
  if(ST.tick-AMBIENT.lastTick<AMBIENT.gapTicks)return;
  if(AI_CAP_USD>0&&aiCostUSD()>=AI_CAP_USD*0.9)return; // leave headroom for TALK
  const p=pickMuser();if(!p)return;
  AMBIENT.lastTick=ST.tick;AMBIENT.inFlight=true;
  try{
    const line=await aiChat(ambientPrompt(p),[{role:"user",content:"(muse)"}],AI_MODEL_AMBIENT);
    const clean=(line||"").replace(/^["']|["']$/g,"").replace(/\[.*?\]/g,"").trim();
    if(clean){
      // store as a memory and surface as a social diary entry
      remember(p,clean);
      log(p.name+": \u201c"+clean+"\u201d","info");}
  }catch(e){/* silent — ambient is best-effort */}
  AMBIENT.inFlight=false;}

/* ═══════════ NPC-TO-NPC AI CONVERSATION ═══════════
   When two wisps socialize side-by-side AND the player is actually watching them (on-screen, zoomed in
   enough to read faces), occasionally generate a short, in-character AI exchange between the two. Gated
   hard on "is the player looking" so API calls only happen for conversations the player can actually see —
   a handful per session, not hundreds. Uses the cheap ambient model + the shared budget guards. */
const NPCCONVO={lastTick:-1e9,gapTicks:600,inFlight:false,cooldownByPair:{}};
// is a world tile currently visible AND the camera zoomed in enough to read pawns?
function playerWatching(wx,wy){
  if(cam.z<1.15)return false;                       // zoomed too far out to read a conversation
  const sx=wx*T,sy=wy*T;
  const left=cam.x, top=cam.y, right=cam.x+VW/cam.z, bottom=cam.y+VH/cam.z;
  const pad=T*1.5;
  return sx>left+pad&&sx<right-pad&&sy>top+pad&&sy<bottom-pad;   // comfortably inside the viewport
}
// a speech line shown above a pawn for a few seconds (longer + wrapped vs a quick float)
function sayLine(p,txt){ if(!p||!txt)return;
  ST.says=ST.says||[];
  // remove any existing line from this speaker so they don't stack
  ST.says=ST.says.filter(s=>s.id!==p.id);
  ST.says.push({id:p.id,txt:txt.slice(0,90),ttl:240,t0:240});
  if(ST.says.length>4)ST.says.shift();
}
// ═══ AI REACTIONS — when something dramatic happens to a wisp the player is watching, have them SAY a
// line generated in the moment (richer than a canned string). Gated, throttled, and budget-aware so it
// stays a treat, not a flood. Ties into the emotional events built this session (robbery, blackout, etc.). ═══
let AIREACT={inFlight:false,lastT:0};
async function aiReactLine(p,event){
  if(!p||!aiReady()||!AMBIENT.enabled||AIREACT.inFlight)return;
  if(!playerWatching(p.px,p.py))return;               // only for wisps on screen
  if(ST.tick-(AIREACT.lastT||0)<120)return;           // throttle so it's occasional
  if(Math.random()<0.5)return;                         // not every time — keep it special
  AIREACT.inFlight=true;AIREACT.lastT=ST.tick;
  try{
    const sys="You ARE "+p.name+", a resident of a neon-noir megacity block, 2087. You come across as "+
      axTraits(p)+". Something just happened: "+event+". React in ONE short spoken line — raw, in the "+
      "moment, under 14 words. No quotes, no name prefix, no stage directions.";
    const line=await aiChat(sys,[{role:"user",content:"(react)"}],AI_MODEL_AMBIENT);
    if(line)sayLine(p,line);
  }catch(e){/* AI unreachable or budget — silently fall back to the emote/float already shown */}
  AIREACT.inFlight=false;
}
async function tickNpcConvo(){
  if(NPCCONVO.inFlight||!aiReady()||!AMBIENT.enabled)return;
  if(ST.tick-NPCCONVO.lastTick<NPCCONVO.gapTicks)return;
  if(AI_CAP_USD>0&&aiCostUSD()>=AI_CAP_USD*0.85)return;   // leave headroom for player TALK
  // find a socializing pair the player is watching
  let a=null,b=null;
  for(const p of ST.pawns){
    if(!p.socWith||isChild(p))continue;
    const o=ST.pawns.find(q=>q.id===p.socWith);
    if(!o||isChild(o))continue;
    if(!playerWatching((p.px+o.px)/2,(p.py+o.py)/2))continue;
    // pair cooldown so the same two don't chatter repeatedly
    const pk=[p.id,o.id].sort().join("_");
    if(ST.tick-(NPCCONVO.cooldownByPair[pk]||-1e9)<1800)continue;
    a=p;b=o;NPCCONVO.cooldownByPair[pk]=ST.tick;break;
  }
  if(!a||!b)return;
  NPCCONVO.lastTick=ST.tick;NPCCONVO.inFlight=true;
  try{
    const rel=relGet(a.id,b.id);
    const tone=rel>50?"warm, they're close":rel>15?"friendly enough":rel<-15?"tense, there's friction":"neutral, acquaintances";
    const sys="You write ONE short line of overheard dialogue between two residents of a cyberpunk slum district. "
      +"Keep it under 14 words, natural and in-character — like a snatch of conversation caught in passing. "
      +"No names, no quotes, no stage directions. Just the spoken line.";
    const ctxLine=a.name+" ("+axTraits(a)+", currently "+feltState(a)+") is talking with "
      +b.name+" ("+axTraits(b)+"). Their relationship: "+tone+". "
      +"Write what "+a.name+" says to "+b.name+" right now.";
    const line1=await aiChat(sys,[{role:"user",content:ctxLine}],AI_MODEL_AMBIENT);
    const c1=(line1||"").replace(/^[\s"'\u201c\u201d]+|[\s"'\u201c\u201d]+$/g,"").replace(/\[.*?\]/g,"").trim();
    if(c1&&a.socWith===b.id){
      sayLine(a,c1);remember(a,"talking with "+b.name+": \u201c"+c1+"\u201d");
      // a brief beat, then b replies (only if they're still together + still on screen)
      setTimeout(async()=>{
        if(a.socWith!==b.id&&b.socWith!==a.id)return;
        if(!playerWatching((a.px+b.px)/2,(a.py+b.py)/2))return;
        if(AI_CAP_USD>0&&aiCostUSD()>=AI_CAP_USD*0.85)return;
        try{
          const reply=await aiChat(sys,[{role:"user",content:b.name+" ("+axTraits(b)+") replies to: \u201c"+c1+"\u201d. One short line back."}],AI_MODEL_AMBIENT);
          const c2=(reply||"").replace(/^[\s"'\u201c\u201d]+|[\s"'\u201c\u201d]+$/g,"").replace(/\[.*?\]/g,"").trim();
          if(c2)sayLine(b,c2);
        }catch(e){}
      },1600);
    }
  }catch(e){/* best-effort */}
  NPCCONVO.inFlight=false;
}

/* ELECTION AI — candidates generate short campaign pitches and a couple of swing voters explain their
   reasoning, all via the cheap ambient model. Gated like the NPC convos (only spends when there's an
   active election) so an election feels like a real political moment without burning budget. */
const ELECTAI={inFlight:false,lastTick:-1e9};
async function tickElectionPitches(){
  const e=ST.election;if(!e||e.resolved)return;
  if(ELECTAI.inFlight||!aiReady()||!AMBIENT.enabled)return;
  if(ST.tick-ELECTAI.lastTick<90)return;
  if(AI_CAP_USD>0&&aiCostUSD()>=AI_CAP_USD*0.85)return;
  // find a candidate who hasn't pitched yet
  const need=e.candidates.find(cid=>!e.pitches[cid]);
  if(!need){
    // all pitched — occasionally have a swing voter voice their reasoning (color, not required)
    if(Math.random()<0.5)return;
    const voter=ST.pawns.find(p=>p.hp>0&&!isChild(p)&&!e.candidates.includes(p.id)&&playerWatching(p.px,p.py)&&!p._votedAloud);
    if(!voter)return;
    ELECTAI.lastTick=ST.tick;ELECTAI.inFlight=true;
    try{
      const lead=e.candidates.map(cid=>ST.pawns.find(p=>p.id===cid)).filter(Boolean);
      const names=lead.map(c=>c.name+" ("+axTraits(c)+")").join(" vs ");
      const sys="You write ONE short line of an ordinary slum resident saying who they'll vote for in a local election and why. Under 16 words, in-character, plainspoken. No quotes, no names of the speaker.";
      const line=await aiChat(sys,[{role:"user",content:voter.name+" ("+axTraits(voter)+") is deciding between: "+names+" for "+ROLES[e.role].title+". What do they mutter about their choice?"}],AI_MODEL_AMBIENT);
      const c=(line||"").replace(/^[\s"'\u201c\u201d]+|[\s"'\u201c\u201d]+$/g,"").replace(/\[.*?\]/g,"").trim();
      if(c){sayLine(voter,c);voter._votedAloud=true;}
    }catch(e2){}
    ELECTAI.inFlight=false;return;
  }
  const cand=ST.pawns.find(p=>p.id===need);if(!cand){e.pitches[need]="(withdrew)";return;}
  ELECTAI.lastTick=ST.tick;ELECTAI.inFlight=true;
  try{
    const fit=roleFit(cand,e.role);
    const angle=fit>0.66?"genuinely suited to it":(cand.pers.amb||50)>66?"hungry for the power more than the work":"a long shot making their case";
    const sys="You write ONE short campaign pitch line from a candidate for a local slum-district office. Under 16 words, in-character, revealing their personality. No quotes, no stage directions — just the spoken pitch.";
    const line=await aiChat(sys,[{role:"user",content:cand.name+" ("+axTraits(cand)+", "+angle+") is running for "+ROLES[e.role].title+" — "+ROLES[e.role].desc+". Their pitch to the block:"}],AI_MODEL_AMBIENT);
    const c=(line||"").replace(/^[\s"'\u201c\u201d]+|[\s"'\u201c\u201d]+$/g,"").replace(/\[.*?\]/g,"").trim();
    if(c){
      e.pitches[need]=c;
      log("\uD83D\uDDF3 "+cand.name+": \u201c"+c+"\u201d","info");
      if(playerWatching(cand.px,cand.py))sayLine(cand,c);
      remember(cand,"campaigned for "+ROLES[e.role].title+": "+c);
    } else {e.pitches[need]="(stayed quiet)";}
  }catch(e2){e.pitches[need]="(stayed quiet)";}
  ELECTAI.inFlight=false;
}

function axTraits(p){const a=p.pers,o=[];
  if(a.amb>65)o.push("driven");else if(a.amb<35)o.push("unambitious");
  if(a.ind>65)o.push("disciplined");else if(a.ind<35)o.push("flaky");
  if(a.imp>65)o.push("impulsive");else if(a.cau>65)o.push("cautious and guarded");
  if(a.soc>65)o.push("outgoing");else if(a.soc<35)o.push("withdrawn");
  if(a.emp>65)o.push("warm");else if(a.emp<35)o.push("cold");
  if(a.cur>65)o.push("restless and curious");
  if(a.intg>65)o.push("principled");else if(a.intg<35)o.push("plays loose with the rules");
  return o.join(", ")||"hard to read";}
function feltState(p){const s=[],n=p.needs;
  if(n.food<25)s.push("starving");else if(n.food<45)s.push("hungry");
  if(n.rest<25)s.push("exhausted");else if(n.rest<45)s.push("tired");
  if(n.hyg<30)s.push("filthy");
  if(n.fun<30)s.push("bored and restless");
  if(n.socN<30)s.push("lonely");
  if((p.credits|0)<0)s.push("broke and behind on rent");else if((p.credits|0)<10)s.push("nearly broke");
  if(p.homeless)s.push("evicted, sleeping rough");
  if(p.sick)s.push("sick and needing a clinic");
  if(p.addiction>40)s.push("strung out, craving a hit");
  if(p.stress>70)s.push("on edge, badly stressed");else if(p.stress>45)s.push("stressed");
  if(p.mood<25)s.push("low and bleak");else if(p.mood>70)s.push("in decent spirits");
  return s.length?s.join(", "):"holding steady for now";}

/* toolbar */
let subCat=null;
function refreshCats(){
  $("t-build").classList.toggle("on",subCat==="b");
  $("t-zone").classList.toggle("on",subCat==="z");
  $("t-command").classList.toggle("on",subCat==="c");}
function closeSub(){subCat=null;$("submenu").classList.remove("open");refreshCats()}
function refreshToolBtns(){const sm=$("submenu");
  if(!sm||!sm.querySelectorAll)return;
  sm.querySelectorAll("[data-tool]").forEach(b=>{const dt=b.dataset.tool;let on=false;
    if(TOOL&&dt){if(TOOL.k==="build")on=dt==="build:"+TOOL.type;else on=dt===TOOL.k}
    b.classList.toggle("on",on)})}

// district credits header (the one number that matters for building)
function smHeader(title){
  const credits=Math.round(ST.income||0);
  return "<div class='sm-head'><span class='sm-title'>"+title+"</span>"+
    "<span class='sm-wallet'><span class='coin'></span>"+credits+"</span></div>";}

function buildCardHTML(t){
  const d=DEF[t];const ic=BUILD_ICON[t]||"▪";
  const credits=Math.round(ST.income||0);
  const cost=(d.cost&&d.cost.income)||0;
  const afford=cost<=credits;
  const cls=cost===0?"afford":(afford?"afford":"broke");
  const priceHTML=cost===0
    ?"<span class='pr free'>FREE</span>"
    :"<span class='pr'><span class='coin'></span>"+cost+"</span>";
  return "<button class='bcard "+cls+"' data-tool='build:"+t+"' data-bt='"+t+"' title='"+(d.desc||"")+"'>"+
    "<span class='ic'>"+ic+"</span><span class='nm'>"+d.name+"</span>"+priceHTML+"</button>";}

function renderBuildMenu(){
  let h=smHeader("BUILD");
  for(const cat of BUILD_CATS){
    if(cat.gate&&!cat.gate())continue;
    h+="<div class='bcat'>"+cat.name+"</div><div class='bgrid'>";
    for(const t of cat.items)h+=buildCardHTML(t);
    h+="</div>";}
  return h;}

function renderZoneMenu(){
  let h=smHeader("ZONE");
  h+="<div class='bcat'>Designate</div><div class='bgrid'>";
  h+="<button class='bcard afford' data-tool='decon' title='Drag over structures to tear them down'>"+
     "<span class='ic'>⊗</span><span class='nm'>Deconstruct</span></button>";
  h+="<button class='bcard afford' data-tool='cancel' title='Drag to cancel blueprints'>"+
     "<span class='ic'>✕</span><span class='nm'>Cancel</span></button>";
  h+="<button class='bcard afford' data-tool='salv' title='Mark scrap/caches to salvage'>"+
     "<span class='ic'>♺</span><span class='nm'>Salvage</span></button>";
  h+="</div>";
  return h;}

const CMD_LIST=[
  {o:"work",     ci:"⚒", l:"Work"},
  {o:"sleep",    ci:"☾", l:"Rest"},
  {o:"eat",      ci:"⊕", l:"Feed"},
  {o:"hygiene",  ci:"≈", l:"Cleanse"},
  {o:"recreate", ci:"◈", l:"Unwind"},
  {o:"socialize",ci:"⚇", l:"Commune"},
];
function renderCommandMenu(){
  const sel=ST.sel.filter(e=>e.kind==="pawn");
  let h="<div class='sm-head'><span class='sm-title'>COMMAND</span>"+
    "<button class='tb' id='cmd-all' style='padding:3px 8px;font-size:9px'>SELECT ALL</button></div>";
  // ── THE MOVEMENT — always shown: status + cause-level actions ──
  {const m=ST.mov||{},reg=ST.regime||{};
   const recruited=ST.pawns.filter(p=>p.recruited&&!isChild(p)).length;
   h+="<div class='ordsec' style='margin-top:2px'>THE MOVEMENT</div>";
   h+="<div class='cmd-sel' style='line-height:1.7'>"+
      "<span style='color:#5cff9e'>✊ Support "+Math.round(m.support||0)+"%</span> · "+
      "<span style='color:#22ddff'>◆ Intel "+Math.round(m.intel||0)+"</span><br>"+
      "<span style='color:"+((m.exposure||0)>50?"#ff5470":"#ffd24a")+"'>◎ Exposure "+Math.round(m.exposure||0)+"%</span> · "+
      "<span style='color:var(--dim)'>⛓ Regime grip "+Math.round(reg.grip!=null?reg.grip:60)+"%</span><br>"+
      "<span style='opacity:.8'>Cells: "+(m.cells||0)+" · Recruited: "+recruited+" · Posture: "+(m.stance||"hidden")+"</span></div>";
   // adaptive guidance — tells the player what their situation means + what to do next
   {const sup=m.support||0,exp=m.exposure||0,grip=reg.grip!=null?reg.grip:60,intel=m.intel||0;
    let tip="",tipCol="#8aa8c8";
    if(exp>65){tip="⚠ Exposure is high — the regime is closing in. Go to Ground or lie low until it cools.";tipCol="#ff5470";}
    else if(recruited===0&&intel<8){tip="Build intel (it accrues over time), then RECRUIT a sympathizer to grow the network.";}
    else if(recruited===0){tip="You have intel — select a discontented wisp and RECRUIT them to start your first cell.";tipCol="#5cff9e";}
    else if(sup<40){tip="Support is low — the regime holds. Recruit more and solve cases to win the district over.";}
    else if(grip>50){tip="Support is growing. Keep recruiting and investigating — grip falls as your cause spreads.";tipCol="#5cff9e";}
    else if(grip>25){tip="The regime is cracking. Press the advantage — more support and cells erode their grip faster.";tipCol="#5cff9e";}
    else{tip="The regime's grip is failing. You're close to breaking their hold on the district.";tipCol="#ffd24a";}
    h+="<div class='cmd-sel' style='font-size:10px;font-style:italic;color:"+tipCol+";opacity:.9;margin-top:-2px'>"+tip+"</div>";}
   h+="<div class='cmd-grid'>";
   h+="<button class='cmd-b' id='mv-ground'><span class='ci'>◎</span>Go to Ground<br><span style='font-size:8px;opacity:.7'>−exposure · 12 intel</span></button>";
   h+="<button class='cmd-b' id='mv-stance'><span class='ci'>"+((m.stance==="open")?"⚑":"◑")+"</span>"+((m.stance==="open")?"Go Quiet":"Go Loud")+"<br><span style='font-size:8px;opacity:.7'>"+((m.stance==="open")?"hide the network":"open insurrection")+"</span></button>";
   h+="</div>";
  }
  // ── INVESTIGATIONS — open cases, revealed clues, and actions ──
  {const cases=openCases();
   if(cases.length){
     h+="<div class='ordsec' style='margin-top:6px'>INVESTIGATIONS</div>";
     for(const c of cases){
       const title=c.type==="murder"?("Murder of "+c.victimName):c.type==="informant"?"Regime informant hunt":"Conspiracy";
       h+="<div class='cmd-sel' style='border-left:2px solid #ff5470;padding-left:6px;margin-bottom:4px'>";
       h+="<div style='color:#ff8da3;font-weight:600'>\u2622 "+title+"</div>";
       h+="<div style='opacity:.75;font-size:10px'>Opened day "+c.openedDay+" · "+c.found.length+"/"+c.clues.length+" leads · "+c.suspects.length+" suspects</div>";
       // revealed clues
       if(c.found.length){h+="<div style='margin-top:3px'>";
         for(const cl of c.found){const col=cl.w<0?"#5cff9e":cl.k==="redherring"?"#ffd24a":"#cfe3ff";
           h+="<div style='font-size:10px;color:"+col+";line-height:1.4'>• "+cl.t+"</div>";}
         h+="</div>";}
       else h+="<div style='font-size:10px;opacity:.6;font-style:italic'>No leads yet — investigate to uncover clues.</div>";
       // actions: investigate (reveal next clue) + per-suspect accuse
       const moreLeads=c.clues.length>c.found.length;
       h+="<div style='display:flex;gap:4px;flex-wrap:wrap;margin-top:4px'>";
       if(moreLeads)h+="<button class='tb' data-investigate='"+c.id+"' style='font-size:10px;padding:4px 8px;border-color:rgba(34,221,255,.4);color:#22ddff'>\u25C8 Investigate (6 intel)</button>";
       h+="</div>";
       // accuse — list suspects (only show once at least one lead is found)
       if(c.found.length){
         h+="<div style='margin-top:4px;font-size:9px;opacity:.7;letter-spacing:.1em'>ACCUSE:</div><div style='display:flex;gap:4px;flex-wrap:wrap;margin-top:2px'>";
         for(const sid of c.suspects){const sp=ST.pawns.find(p=>p.id===sid);if(!sp)continue;
           h+="<button class='tb' data-accuse='"+c.id+":"+sid+"' style='font-size:10px;padding:3px 7px;border-color:rgba(255,84,112,.35)'>"+sp.name+"</button>";}
         h+="</div>";
       }
       h+="</div>";
     }
   }
  }
  if(!sel.length){
    h+="<div class='cmd-sel'>No citizens selected. Tap a wisp on the map, marquee-drag to select several, or hit <b>SELECT ALL</b>.</div>";
    return h;}
  h+="<div class='cmd-sel'>Ordering <b>"+(sel.length===1?sel[0].name:sel.length+" citizens")+"</b></div>";
  h+="<div class='cmd-grid'>";
  for(const c of CMD_LIST)
    h+="<button class='cmd-b' data-cmd='"+c.o+"'><span class='ci'>"+c.ci+"</span>"+c.l+"</button>";
  h+="</div>";
  return h;}

function renderSub(){
  const sm=$("submenu");
  if(subCat==="b")sm.innerHTML=renderBuildMenu();
  else if(subCat==="z")sm.innerHTML=renderZoneMenu();
  else if(subCat==="c")sm.innerHTML=renderCommandMenu();
  refreshToolBtns();}

function openSub(cat){if(subCat===cat){closeSub();return}
  subCat=cat;renderSub();$("submenu").classList.add("open");refreshCats();}

// delegated clicks inside the submenu
$("submenu").addEventListener("click",e=>{
  const card=e.target.closest("[data-tool]");
  if(card){SFX.ui();
    const dt=card.dataset.tool;
    if(dt.startsWith("build:")){setTool({k:"build",type:dt.slice(6)});closeSub();}  // dismiss menu so you can see/place
    else setTool({k:dt});
    refreshToolBtns();return;}
  const cmd=e.target.closest("[data-cmd]");
  if(cmd){SFX.ui();const o=cmd.dataset.cmd;
    const sel=ST.sel.filter(x=>x.kind==="pawn");
    for(const p of sel){clearJob(p);p.job=null;p.cmd=o}
    renderInspect();return;}
  if(e.target.id==="cmd-all"){SFX.ui();ST.sel=ST.pawns.slice();renderInspect();syncHUD();renderSub();return;}
  if(e.target.closest("#mv-ground")){SFX.ui();goToGround();renderSub();syncHUD();return;}
  {const inv=e.target.closest("[data-investigate]");
   if(inv){SFX.ui();investigateCase(+inv.dataset.investigate);renderSub();syncHUD();return;}
   const acc=e.target.closest("[data-accuse]");
   if(acc){SFX.ui();const[cid,sid]=acc.dataset.accuse.split(":").map(Number);
     accuseSuspect(cid,sid);renderSub();syncHUD();return;}}
  if(e.target.closest("#mv-stance")){SFX.ui();const m=ST.mov;m.stance=m.stance==="open"?"hidden":"open";
    log(m.stance==="open"?"The movement goes LOUD — open insurrection. Exposure will climb fast.":"The movement goes quiet — back to the shadows.",m.stance==="open"?"warn":"info");
    renderSub();syncHUD();return;}
});

$("t-build").onclick=()=>{SFX.ui();openSub("b")};
$("t-zone").onclick=()=>{SFX.ui();openSub("z")};
$("t-command").onclick=()=>{SFX.ui();openSub("c")};
// OPERATIVE DOCK interactions
$("op-dock").addEventListener("click",e=>{
  const strip=e.target.closest("#od-strip");
  if(strip&&!e.target.closest(".od-btn")){OP_DOCK_OPEN=!OP_DOCK_OPEN;SFX.ui&&SFX.ui();renderOpDock();return;}
  // op buttons inside the dock — shared dispatch with the inspect panel
  const opBtn=e.target.closest&&e.target.closest(".i-op");
  if(opBtn){dispatchOpButton(opBtn);return;}
  if(e.target.id==="od-bribeout"){if(bribeOutOfJail()){renderOpDock();syncHUD();}return;}
  if(e.target.id==="i-lielow"){if(goToGround()){SFX.ui&&SFX.ui();}renderInspect();renderOpDock();syncHUD();return;}
  const av=theAvatar();if(!av)return;
  if(e.target.closest("#od-jump")){ // jump camera to + select the operative
    SFX.ui&&SFX.ui();ST.sel=[av];setFollow(av);
    cam.x=av.px*T-VW/cam.z/2;cam.y=av.py*T-VH/cam.z/2;if(typeof clampCam==="function")clampCam();
    renderInspect();syncHUD();return;
  }
  if(e.target.closest("#od-follow")){ // toggle camera follow
    SFX.ui&&SFX.ui();
    if(cam.follow===av.id){stopFollow();}else{setFollow(av);}
    renderOpDock();return;
  }
  if(e.target.closest("#od-mode")){ // toggle auto/manual control
    SFX.ui&&SFX.ui();
    ST.avatarManual=!ST.avatarManual;
    if(ST.avatarManual&&av.job&&av.job.t!=="goto")av.job=null;   // drop autonomous busywork on switch
    flashMsg&&flashMsg(ST.avatarManual?"Manual control — your operative awaits orders":"Auto — your operative acts on its own");
    renderOpDock();return;
  }
});
$("b-fs").onclick=()=>{SFX.ui();
  const el=document.documentElement;
  if(!document.fullscreenElement&&!document.webkitFullscreenElement){
    (el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen||function(){}).call(el);
  }else{
    (document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen||document.msExitFullscreen||function(){}).call(document);
  }
};
// (b-load / b-weather / b-mute / b-help buttons removed from the HUD — now in the Esc menu + Settings.)
// WEATHER toggle state sync (used by the Settings panel now)
function syncWeatherMenu(){
  const rs=$("wx-rain-state"),ss=$("wx-storm-state");
  if(rs){rs.textContent=ATMO.on?"on":"off";rs.style.color=ATMO.on?"#22ddff":"var(--dim)";}
  if(ss){ss.textContent=STORM.on?"on":"off";ss.style.color=STORM.on?"#ffe066":"var(--dim)";}
}
$("wx-rain").onclick=()=>{SFX.ui();ATMO.on=!ATMO.on;ATMO.fog=0;syncWeatherMenu();};
$("wx-storm").onclick=()=>{SFX.ui();STORM.on=!STORM.on;STORM.flash=0;STORM.nextAt=0;syncWeatherMenu();};

// ═══════════════════ SYSTEM MENU (Esc) + SETTINGS PANEL ═══════════════════
function openSysMenu(){const sm=$("sys-menu");if(sm)sm.style.display="flex";}
function closeSysMenu(){const sm=$("sys-menu");if(sm)sm.style.display="none";}
function sysMenuOpen(){const sm=$("sys-menu");return sm&&sm.style.display!=="none";}
function openSettings(){const s=$("settings-menu");if(s){syncSettings();s.style.display="flex";}}
function closeSettings(){const s=$("settings-menu");if(s)s.style.display="none";}
function settingsOpen(){const s=$("settings-menu");return s&&s.style.display!=="none";}
// keep the Settings panel's controls in sync with current state
function syncSettings(){
  // read the MASTER mute state from SFX (it governs both the synth ambience and the mp3 music); fall back
  // to MUSIC's own flag if SFX doesn't expose it.
  const muted=(SFX&&SFX.isMuted)?SFX.isMuted():(MUSIC&&MUSIC.isMuted&&MUSIC.isMuted());
  const ms=$("set-mute-state");if(ms){ms.textContent=muted?"off":"on";ms.style.color=muted?"var(--dim)":"#22ddff";}
  const vol=MUSIC&&MUSIC.getVolume?Math.round(MUSIC.getVolume()*100):34;
  const vs=$("set-vol");if(vs)vs.value=vol;
  const vv=$("set-vol-val");if(vv)vv.textContent=vol;
  const rs=$("set-rain-state");if(rs){rs.textContent=ATMO.on?"on":"off";rs.style.color=ATMO.on?"#22ddff":"var(--dim)";}
  const ss=$("set-storm-state");if(ss){ss.textContent=STORM.on?"on":"off";ss.style.color=STORM.on?"#ffe066":"var(--dim)";}
}
// HUD menu button + system-menu actions
const bMenu=$("b-menu");if(bMenu)bMenu.onclick=()=>{SFX.ui();sysMenuOpen()?closeSysMenu():openSysMenu();};
const sR=$("sys-resume");if(sR)sR.onclick=()=>{SFX.ui();closeSysMenu();};
const sSet=$("sys-settings");if(sSet)sSet.onclick=()=>{SFX.ui();closeSysMenu();openSettings();};
const sSave=$("sys-save");if(sSave)sSave.onclick=()=>{SFX.ui();closeSysMenu();openSaveSlots();};
const sLoad=$("sys-load");if(sLoad)sLoad.onclick=()=>{SFX.ui();closeSysMenu();openLoadSlots();};
const sHelp=$("sys-help");if(sHelp)sHelp.onclick=()=>{SFX.ui();closeSysMenu();showHelp();};
const sNew=$("sys-newgame");if(sNew)sNew.onclick=()=>{SFX.ui();if(confirm("Start a new game? Unsaved progress will be lost.")){closeSysMenu();newGame();}};
// clicking the dim backdrop (outside the inner box) closes the system menu
const sysM=$("sys-menu");if(sysM)sysM.onclick=(e)=>{if(e.target===sysM)closeSysMenu();};
// SETTINGS controls
const setX=$("settings-x");if(setX)setX.onclick=()=>{SFX.ui();closeSettings();};
const setMenuEl=$("settings-menu");if(setMenuEl)setMenuEl.onclick=(e)=>{if(e.target===setMenuEl)closeSettings();};
const setMute=$("set-mute");if(setMute)setMute.onclick=()=>{SFX.ui();
  // FIX — the mute button must silence BOTH audio systems: the synth ambience drone (SFX) AND the mp3 music
  // bed (MUSIC). Previously it called MUSIC.setMuted alone, so the synth drone kept playing and "mute did
  // nothing." SFX.toggleMute handles both (it flips its own ambience gain and forwards to MUSIC.setMuted).
  if(SFX&&SFX.toggleMute)SFX.toggleMute();
  else if(MUSIC&&MUSIC.setMuted){const nm=!(MUSIC.isMuted&&MUSIC.isMuted());MUSIC.setMuted(nm);}
  syncSettings();};
const setVol=$("set-vol");if(setVol)setVol.oninput=function(){const v=(+this.value)/100;
  // scale BOTH audio systems: the mp3 music bed AND the synth ambience drone (the latter is what plays when
  // no mp3 files are present, so the slider must govern it too or "volume does nothing").
  if(MUSIC&&MUSIC.setVolume)MUSIC.setVolume(v);
  if(SFX&&SFX.setAmbVolume)SFX.setAmbVolume(v);
  const vv=$("set-vol-val");if(vv)vv.textContent=this.value;};
const setSkip=$("set-skip");if(setSkip)setSkip.onclick=()=>{SFX.ui();if(MUSIC&&MUSIC.skip)MUSIC.skip();};
const setRain=$("set-rain");if(setRain)setRain.onclick=()=>{SFX.ui();ATMO.on=!ATMO.on;ATMO.fog=0;syncSettings();};
const setStorm=$("set-storm");if(setStorm)setStorm.onclick=()=>{SFX.ui();STORM.on=!STORM.on;STORM.flash=0;STORM.nextAt=0;syncSettings();};
// click outside closes the weather menu
document.addEventListener("click",(e)=>{const mn=$("weather-menu");if(mn&&mn.style.display!=="none"&&!e.target.closest("#weather-menu")&&!e.target.closest("#b-weather"))mn.style.display="none";});
$("b-diary").onclick=()=>{SFX.ui();openOverlay("diary")};
$("b-crew").onclick=()=>{SFX.ui();openOverlay("crew")};
$("b-tasks").onclick=()=>{SFX.ui();openOverlay("tasks")};
$("b-stats").onclick=()=>{SFX.ui();openOverlay("district")};
const bOps=$("b-ops");if(bOps)bOps.onclick=()=>{if(ST.phase!=="run")return;SFX.ui();OPSTAB="stats";showOpsScreen();};
function districtStatsHTML(){
  const pawns=ST.pawns;
  let h="";
  // tier + prosperity headline
  const tier=currentTier(),prosp=prosperity();
  const next=TIERS.find(T=>T.t===tier.t+1);
  h+="<div style='display:flex;align-items:center;gap:10px;margin-bottom:10px'>"+
     "<span class='hud-tier' style='font-size:14px'>T"+tier.t+"</span>"+
     "<div><div style='font-family:var(--disp);font-size:13px;color:var(--cy)'>"+tier.name+"</div>"+
     "<div style='font-size:10px;color:var(--dim)'>Prosperity "+prosp+" · "+prospRank(prosp)+"</div></div></div>";
  h+="<div class='prosp-wrap' style='width:100%;height:9px;display:block'><span class='prosp-fill' style='width:"+prosp+"%'></span></div>";
  if(next)h+="<div style='font-size:10px;color:var(--dim);margin:5px 0 4px'>Next: "+next.name+" — needs "+next.pop+" pop · "+next.income+"c · "+next.prosp+" prosperity</div>";
  else h+="<div style='font-size:10px;color:var(--gn);margin:5px 0 4px'>Maximum tier reached — the sprawl is yours.</div>";
  // economy
  h+="<h4>Economy</h4>";
  const g=ST.goods||{};
  h+=["food","scrap","data","chem","parts","stims","gear"].map(k=>
    "<div class='srow'><span>"+k.toUpperCase()+"</span><b class='"+(g[k]>0?"sgood":"")+"'>"+(g[k]||0)+"</b></div>").join("");
  h+="<div class='srow'><span>Income</span><b class='"+(ST.income<0?"sbad":ST.crisis?"sbad":"sgood")+"'>"+(ST.crisis?"⚠ ":"")+Math.round(ST.income||0)+"c</b></div>";
  if(ST.debtDays)h+="<div class='srow'><span>Debt days</span><b class='sbad'>"+ST.debtDays+"/6</b></div>";
  // citizens
  h+="<h4>Citizens</h4>";
  const sorted=[...pawns].sort((a,b)=>(b.credits||0)-(a.credits||0));
  for(const c of sorted){
    const flags=[];
    if(c.sick)flags.push("<span class='sbad'>SICK</span>");
    if(c.homeless)flags.push("<span class='sbad'>EVICTED</span>");
    if(c.hasGear)flags.push("<span style='color:#7aa2ff'>GEARED</span>");
    if((c.addiction||0)>30)flags.push("<span style='color:#c98bff'>HOOKED</span>");
    if(c.assigned){const s=ST.structs.get(c.assigned);if(s)flags.push("<span style='color:#ffd84a'>→"+DEF[s.type].name+"</span>")}
    h+="<div class='srow'><b style='color:"+c.accent+"'>"+c.name+"</b><span>"+(c.credits|0)+"c "+(flags.join(" "))+"</span></div>"}
  // relationships — show worst feuds and strongest alliances
  const rels=[];for(const k in ST.rel){const v=ST.rel[k];if(Math.abs(v)<30)continue;
    const ids=k.split("|");const a=pawns.find(x=>x.id===ids[0]),b=pawns.find(x=>x.id===ids[1]);
    if(a&&b)rels.push({a,b,v})}
  rels.sort((x,y)=>x.v-y.v);
  if(rels.length){h+="<h4>Relationships</h4>";
    for(const r of rels.slice(0,6)){const col=r.v>0?"#39ff88":"#ff4757";
      const lbl=r.v>=50?"allies":r.v>=20?"warm":r.v<=-60?"enemies":"rivals";
      h+="<div class='srow'><span style='color:"+col+"'>"+r.a.name+" & "+r.b.name+"</span><b style='color:"+col+"'>"+lbl+" "+(r.v>0?"+":"")+Math.round(r.v)+"</b></div>"}}
  // sickness
  const sick=pawns.filter(c=>c.sick);
  if(sick.length){h+="<h4>Health Alert</h4>";
    sick.forEach(c=>{const src=c.sickSource?pawns.find(x=>x.id===c.sickSource):null;
      h+="<div class='srow'><span class='sbad'>"+c.name+"</span><span>"+(src?"from "+src.name:"origin unknown")+"</span></div>"})}
  // gangs
  if(ST.gangs.length){h+="<h4>Gangs</h4>";
    for(const g of ST.gangs){const members=g.crewIds.map(id=>pawns.find(p=>p.id===id)).filter(Boolean);
      const heatCol=(g.gangHeat||0)>60?"var(--rd)":(g.gangHeat||0)>30?"var(--or)":"var(--gn)";
      h+="<div class='srow'><b style='color:"+g.color+"'>"+g.name+"</b><span>"+members.map(m=>m.name).join(", ")+"</span></div>";
      h+="<div class='srow'><span>Turf tiles</span><b>"+g.turf.size+"</b></div>";
      h+="<div class='srow'><span>Gang heat</span><b style='color:"+heatCol+"'>"+(g.gangHeat|0)+"</b></div>";}}
  // cliques
  if(ST.cliques&&ST.cliques.length){h+="<h4>Cliques</h4>";
    for(const c of ST.cliques){const mem=c.members.map(id=>pawns.find(p=>p.id===id)).filter(Boolean);
      if(!mem.length)continue;
      const rival=c.rival&&ST.cliques.find(x=>x.id===c.rival);
      h+="<div class='srow'><b style='color:#c98bff'>"+c.name+"</b><span>"+mem.map(m=>m.name).join(", ")+"</span></div>";
      {const st=c.stance||0;const stLbl=st>=55?"<span style='color:#39ff88'>backs you</span>":st<=-55?"<span style='color:#ff4757'>opposes you</span>":"<span style='opacity:.6'>neutral</span>";
       h+="<div class='srow'><span>Loyalty"+(rival?" · rivals "+rival.name:"")+"</span><b>"+(c.loyalty|0)+" · "+stLbl+"</b></div>";}}}
  // MARKET — current dynamic prices reflect supply/demand
  {const BASE={stims:22,gear:16,data:8,chem:6,parts:6,scrap:7,food:5};
   const px=(g)=>{const base=BASE[g];const stock=ST.goods[g]||0;const mult=clamp(1.6-(stock/12),0.55,1.6);return Math.max(1,Math.round(base*mult));};
   h+="<h4>Market</h4>";
   for(const g of ["stims","gear","scrap","data","chem","parts","food"]){
     const stock=ST.goods[g]||0;const p=px(g);const base=BASE[g];
     const trend=p>base?"<span style='color:#39ff88'>▲</span>":p<base?"<span style='color:#ff6b6b'>▼</span>":"·";
     h+="<div class='srow'><span>"+g+" <span style='opacity:.5'>(stock "+stock+")</span></span><b>"+p+"c "+trend+"</b></div>";}}
  // CONTRABAND POLICY — the player's risk/reward lever over the gang economy
  if(ST.gangs&&ST.gangs.length){
    const totalContra=ST.gangs.reduce((s,g)=>s+(g.contraband||0),0);
    const totalBank=ST.gangs.reduce((s,g)=>s+(g.bank||0),0);
    const allow=ST.contrabandPolicy==="allow";
    h+="<h4>Underworld</h4>";
    h+="<div class='srow'><span>Gang banks (combined)</span><b>"+(totalBank|0)+"c</b></div>";
    h+="<div class='srow'><span>Contraband in circulation</span><b>"+(totalContra|0)+"</b></div>";
    h+="<div class='srow'><span>Policy</span><b style='color:"+(allow?"#c98bff":"#39ff88")+"'>"+(allow?"TOLERATED":"CRACKDOWN")+"</b></div>";
    h+="<div style='font-size:9.5px;color:var(--dim);margin:2px 0 6px'>"+(allow
      ?"You take a cut of the contraband trade (+income) but it raises district heat."
      :"You suppress the trade — no income from it, and dealers risk being reported.")+"</div>";
    h+="<button class='tb' id='d-contra' style='width:100%'>"+(allow?"◉ Switch to CRACKDOWN":"◎ TOLERATE the trade (take a cut)")+"</button>";
  }
  // milestones
  if(ST.milestones&&ST.milestones.length){h+="<h4>Milestones ("+ST.milestones.length+"/"+MILESTONES.length+")</h4>";
    for(const id of ST.milestones){const m=MILESTONES.find(x=>x.id===id);if(m)
      h+="<div class='srow'><span style='color:var(--gn)'>✓ "+m.label+"</span></div>";}
    const pending=MILESTONES.filter(m=>!ST.milestones.includes(m.id));
    if(pending.length)h+="<div class='srow' style='opacity:.4'><span>Next: "+pending[0].label+"</span></div>";}
  return h}
$("cancelTool").onclick=()=>{SFX.ui();setTool(null)};
function setSpeed(s){ST.speed=s;ST.paused=false;refreshSpd()}
function togglePause(){ST.paused=!ST.paused;refreshSpd()}
function refreshSpd(){$("sp-p").classList.toggle("on",ST.paused);
  $("sp-1").classList.toggle("on",!ST.paused&&ST.speed===1);
  $("sp-2").classList.toggle("on",!ST.paused&&ST.speed===2);
  $("sp-3").classList.toggle("on",!ST.paused&&ST.speed===3)}
$("sp-p").onclick=()=>{SFX.ui();togglePause()};
$("sp-1").onclick=()=>{SFX.ui();setSpeed(1)};
$("sp-2").onclick=()=>{SFX.ui();setSpeed(2)};
$("sp-3").onclick=()=>{SFX.ui();setSpeed(3)};

function showHelp(){if(ST.phase==="run"){ST.paused=true;refreshSpd()}showModal(
  "<h1 style='font-size:20px;letter-spacing:.2em'>OPERATOR MANUAL</h1><div class='mh-sub'>NEON SPRAWL · CITY SIM</div>"+
  "<p style='color:var(--dim)'>You are the overseer of a dead block in 2087 — part city manager, part warlord, part social worker. Citizens think and act on their own. Your job is to shape the conditions they live in.</p>"+
  "<table>"+
  "<tr><td style='color:var(--cy)'>Citizens</td><td>Each has needs: food, rest, hygiene, fun, and social. When needs go unmet, stress rises. High stress → snapping, fights, crime. Faces show their emotional state — watch them.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Economy</td><td>Production fixtures (Workstation, Chemlab, Workshop) generate goods. Vendors sell goods for district income. District income pays rent (34c/day per citizen). Income below zero for 3 days triggers Crisis — 5 days means collapse.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Goods chain</td><td>DATA (workstation) + CHEM (chemlab) + PARTS (workshop) → STIMS (stimlab) or GEAR (gearshop). Stims reduce stress. Gear cuts damage taken and boosts crime success.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Resources</td><td>The outskirts ring the core: FARMLAND (NW) grows Food that feeds the block cheaply, the SALVAGE SECTOR (NE) yields Scrap stripped from dead sectors, and the DATA SLUMS (SW) run grey-market hacks for Data. Farms grow on their own; assign citizens to salvage/data work to boost output. Scrap and Data sell through vendors for district income.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Civic (SE)</td><td>PARK — free recreation and strong stress relief. ARCADE — premium fun, small fee feeds income. HOSPITAL — faster, cheaper, stronger treatment than a Med Bay. LEARNING HUB — citizens study here in their spare time, raising their work skills over a few visits.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Population</td><td>New citizens arrive only if you have open housing. Build a Housing Unit (150c) to add one home slot. Citizens pay 34c rent per day — evicted citizens sleep rough and get stressed.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Petitions</td><td>Citizens surface flashpoints — feuds, epidemics, gang formations, thefts — in the REQUESTS panel. Your choice shapes the outcome. Daily reports summarize each day.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Gangs</td><td>When a crew of 3+ citizens forms, you can sanction them — they claim territory (colored tint on the map). Gangs reduce crime heat on their turf but create tension with other gangs. Overlapping turf escalates to gang war.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Hire / Fire</td><td>Select a citizen + a production fixture → HIRE to give them a contract (priority work, 12c/shift wage). FIRE removes the contract. Assigned workers show up first in the fixture inspect panel.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Heat</td><td>Crime, illegal goods, and gang activity raise district Heat. Above 60, corp enforcers crackdown on your highest-rep criminals. Heat decays naturally over time.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Camera</td><td>WASD / arrows / drag to pan. Scroll or pinch to zoom. Tap a citizen to select and inspect. Citizens prefer roads when travelling.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Build</td><td>BUILD menu → categorized cards. Affordable items glow; ones you can't afford dim red. Credits are charged when you place a blueprint, refunded if cancelled. Walls drag-paint. ZONE handles deconstruct/cancel/salvage. COMMAND issues orders to selected citizens.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Speed</td><td>⏸ pauses. 1×/2×/3× sets speed.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Windows</td><td>The 📖 DIARY, 👥 CREW, 📋 TASKS, and 📊 DISTRICT icons open full-screen windows you can scroll and close (✕ or Esc). Hotkeys: J diary · K crew · L district. CREW lists everyone — tap a citizen for full profile and direct orders.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Tasks</td><td>📋 TASKS gathers every pending petition plus live alerts — sick, evicted, broke, or miserable citizens and district crises. A red badge on the icon counts what needs you; tap an alert to jump to that citizen.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Follow</td><td>Select a wisp and hit ◎ FOLLOW (in the inspect panel or their crew profile) and the camera smoothly tracks them around the block. Pan or press Esc to release.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Careers</td><td>Every citizen has a VOCATION (Fabricator, Techie, Grower, Laborer, Trader) matching their best skill — they seek out matching work and improve at it. Ambitious ones chase ASPIRATIONS (wealth or mastery) and, when underpaid or stuck in ill-suited work, file disputes asking for a raise, a specialist promotion, or a transfer. Manage them from the crew profile: grant raises, name specialists (higher pay + output), or reassign. They remember how you treat them — loyalty or resentment follows.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Wealth</td><td>Citizens own their home, pod, and savings, and stratify into wealth classes (Destitute → Kingpin) by net worth. They grow attached to property over time, so eviction and theft hit hard. When someone dies, their estate and property pass to their closest bond — or revert to the district if they had no one.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Relationships</td><td>Bonds have TYPES that evolve: acquaintance → friend → close friend, or rival → enemy, plus partners. Partners pair up, share a home, and grieve hard if lost. Reputation spreads by gossip — witness a robbery or an act of kindness and opinions shift across the block. Friends take sides in fights.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Cliques</td><td>Tight friend-clusters form into named CLIQUES (3+ mutual friends). Members get a belonging mood boost, prefer to work and socialize together, and grieve as a group when one is lost. A large, loyal clique may petition the district for investment; cliques can also fall into rivalries with each other. See them in the DISTRICT window and crew profiles.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Mentorship</td><td>A skilled veteran will take on a nearby novice of the same vocation as an apprentice. Apprentices gain skill noticeably faster, both grow closer, and the mentor gets satisfaction from teaching — a fast way to level up new arrivals. Shown in the crew profile.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Crime</td><td>Gangs recruit broke, disaffected citizens (watch TASKS for at-risk warnings — a raise can pull them back), run protection rackets that skim vendor income, and war over turf. Witnesses may snitch, raising heat on the culprit, and victims hold grudges that fuel revenge. Keep people housed, paid, and content to keep crime down.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Heists & Contraband</td><td>A flush, motivated gang (full bank, 3+ crew) will plan a HEIST — a big coordinated score that pays out but spikes district heat, and someone may get hurt. Gangs also cook CONTRABAND. In the District panel you set policy: CRACKDOWN (suppress it, dealers risk being reported) or TOLERATE it (the district takes a cut of the trade for extra income, but heat climbs). A real risk/reward lever.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Atmosphere</td><td>The district has a living soundscape — an ambient hum that shifts day to night, with a music bed that adds layers as things get busier or more dangerous. Toggle audio with the mute button.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Progression</td><td>The district ranks up through Tiers (Squat → Settlement → District → Neon Sprawl) as population, income, and prosperity rise. The HUD shows your tier badge and a live PROSPERITY bar (red→green) blending economy, wellbeing, safety, and growth — push it as high as you can.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Saves</td><td>💾 SAVE / 📂 LOAD use three slots plus a daily autosave. Each slot shows day, population, tier, and income so you can manage multiple runs.</td></tr>"+
  "<tr><td style='color:var(--cy)'>Diary</td><td>Day-grouped, timestamped event log. Filter tabs: ALL / CRIME / ECO / SOCIAL / HEALTH / DISTRICT.</td></tr>"+
  "</table><button class='tb big' id='m-close'>CLOSE</button>")}
/* ---------- CHARACTER CREATION — build your operative before the city starts ---------- */
let CC={bg:"fixer",spent:{},name:""};   // working state for the creation screen
function ccStats(){
  // base spread from the chosen background + any points the player has allocated
  const base=Object.assign({},(OPS_BACKGROUNDS.find(b=>b.k===CC.bg)||OPS_BACKGROUNDS[1]).stats);
  for(const k in CC.spent)base[k]=clamp((base[k]||0)+(CC.spent[k]||0),0,10);
  return base;
}
function ccPointsUsed(){let n=0;for(const k in CC.spent)n+=CC.spent[k]||0;return n;}
function ccRemaining(){return OPS_POINT_BUDGET-ccPointsUsed();}
function ccSyncName(){const el=document.getElementById("cc-name");if(el)CC.name=el.value;}
// what each attribute concretely DOES in-game — shown on the creation screen so the stats aren't abstract.
// Grounded in the real systems: dialogue gates, recruitment, surveil detection, op-failure resistance.
const ATTR_EFFECT={
  guile:"Deception & bribery \u2014 unlocks manipulative dialogue, stronger bribes, smoother recruitment pitches.",
  insight:"Reading people \u2014 unlocks perceptive dialogue, uncovers secrets & lies, sees through cover.",
  nerve:"Composure \u2014 unlocks bold dialogue & intimidation, holds steady under regime pressure.",
  presence:"Charisma \u2014 the recruitment lever: persuasive dialogue, inspiring loyalty, even turning officials.",
  tradecraft:"Fieldcraft \u2014 better surveillance, harder to spot while tailing, cleaner operations.",
  resolve:"Willpower \u2014 resists regime pressure: blown ops leak less, and your people refuse to break.",
};
// ── OPERATIVE STATS TAB ───────────────────────────────────────────────────────
function opsStatsHTML(){
  const av=theAvatar();
  if(!av)return "<div style='color:var(--dim);font-size:11px;padding:12px'>No operative found.</div>";
  const bg=OPS_BACKGROUNDS.find(b=>b.k===av.background)||{name:"Unknown",desc:""};
  let h="";
  // identity header
  h+="<div style='padding:10px 12px;background:rgba(34,221,255,.07);border:1px solid rgba(34,221,255,.18);border-radius:8px;margin-bottom:14px'>";
  h+="<div style='font-size:15px;font-weight:700;color:var(--cy);letter-spacing:.06em;margin-bottom:2px'>"+av.name+"</div>";
  h+="<div style='font-size:10px;color:var(--dim);letter-spacing:.07em;margin-bottom:6px;text-transform:uppercase'>"+bg.name+"</div>";
  h+="<div style='font-size:10px;color:var(--tx);line-height:1.55'>"+bg.desc+"</div>";
  h+="</div>";
  // attribute rows
  h+="<div style='font-size:10px;color:var(--dim);letter-spacing:.08em;margin-bottom:8px'>OPERATIVE ATTRIBUTES</div>";
  h+="<div style='display:flex;flex-direction:column;gap:7px'>";
  for(const a of OPS_ATTRS){
    const v=ops(av,a.k);
    const col=v>=8?"#5cff9e":v>=5?"#7aa2ff":"#8aa8c8";
    h+="<div style='display:flex;align-items:center;gap:9px'>";
    // name + value
    h+="<div style='flex:0 0 82px;font-size:11px;font-weight:600;color:"+col+"'>"+a.name+" <span style='font-size:13px'>"+v+"</span></div>";
    // bar track
    h+="<div style='flex:1 1 auto;height:5px;background:rgba(120,160,200,.15);border-radius:3px;overflow:hidden'>";
    h+="<div style='height:100%;width:"+(v/10*100)+"%25;background:"+col+";border-radius:3px;transition:width .2s'></div>";
    h+="</div>";
    // blurb
    h+="<div style='flex:0 0 auto;font-size:9px;color:var(--dim);max-width:120px;text-align:right;line-height:1.3'>"+a.blurb+"</div>";
    h+="</div>";
  }
  h+="</div>";
  return h;
}
// ── THOUGHTS TAB ─────────────────────────────────────────────────────────────
function opsThoughtsHTML(){
  const av=theAvatar();
  if(!av)return "<div style='color:var(--dim);font-size:11px;padding:12px'>No operative found.</div>";
  const nd=av.needs||{};
  const food=nd.food!=null?nd.food:100, rest=nd.rest!=null?nd.rest:100;
  const hyg=nd.hyg!=null?nd.hyg:100, fun=nd.fun!=null?nd.fun:100, socN=nd.socN!=null?nd.socN:100;
  const mood=av.mood||50, stress=av.stress||0, hp=av.hp!=null?av.hp:100;
  const addiction=av.addiction||0;
  const exposure=ST.mov?ST.mov.exposure||0:0;
  const posture=ST.avatarPosture||"normal";
  let h="";

  // ── 1. THOUGHTS ──
  const thoughts=wispThoughts(av);
  if(thoughts.length){
    h+="<div style='display:flex;flex-direction:column;gap:5px;margin-bottom:14px;padding:10px 12px;background:rgba(8,18,36,.5);border:1px solid rgba(120,160,200,.15);border-radius:8px'>";
    for(const th of thoughts)
      h+="<div style='font-size:11px;line-height:1.5;font-style:italic;color:"+th.col+"'>“"+th.txt+"”</div>";
    h+="</div>";
  }

  // ── 2. STATE block ──
  h+="<div style='font-size:10px;color:var(--dim);letter-spacing:.08em;margin-bottom:6px'>STATE</div>";
  h+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;margin-bottom:12px;padding:8px 10px;background:rgba(8,18,36,.4);border:1px solid rgba(120,160,200,.12);border-radius:7px'>";
  // mood
  const moodCol=mood>65?"#5cff9e":mood>35?"#7aa2ff":"#ff6b6b";
  h+="<div style='font-size:10px'><span style='color:var(--dim)'>Mood </span><span style='color:"+moodCol+";font-weight:600'>"+Math.round(mood)+"</span></div>";
  // stress
  const stressCol=stress>70?"#ff6b6b":stress>40?"#ffb454":"#8aa8c8";
  h+="<div style='font-size:10px'><span style='color:var(--dim)'>Stress </span><span style='color:"+stressCol+";font-weight:600'>"+Math.round(stress)+"</span></div>";
  // hp
  const hpCol=hp>60?"#5cff9e":hp>30?"#ffb454":"#ff6b6b";
  h+="<div style='font-size:10px'><span style='color:var(--dim)'>HP </span><span style='color:"+hpCol+";font-weight:600'>"+Math.round(hp)+"</span></div>";
  // exposure / personal heat
  const expCol=exposure>60?"#ff5470":exposure>30?"#ffb454":"#8aa8c8";
  h+="<div style='font-size:10px'><span style='color:var(--dim)'>Heat </span><span style='color:"+expCol+";font-weight:600'>"+Math.round(exposure)+"</span></div>";
  // addiction (only if > 0)
  if(addiction>0){const adCol=addiction>50?"#c98bff":addiction>25?"#ff8da3":"#8aa8c8";
    h+="<div style='font-size:10px'><span style='color:var(--dim)'>Addiction </span><span style='color:"+adCol+";font-weight:600'>"+Math.round(addiction)+"</span></div>";}
  // posture
  const postLabel={laylow:"▭ Lay Low",normal:"○ Normal",revolucionario:"⚑ Revolucionario"}[posture]||posture;
  const postCol=posture==="revolucionario"?"#ff8da3":posture==="laylow"?"#7aa2ff":"#8aa8c8";
  h+="<div style='font-size:10px'><span style='color:var(--dim)'>Posture </span><span style='color:"+postCol+";font-weight:600'>"+postLabel+"</span></div>";
  // active op or idle
  const ao=av.activeOp;
  if(ao){const pct=ao.duration>0?Math.round(ao.prog/ao.duration*100):0;
    h+="<div style='font-size:10px;grid-column:1/-1'><span style='color:var(--dim)'>Op </span><span style='color:#ffd84a;font-weight:600'>"+ao.opKey+" "+pct+"%</span></div>";}
  else h+="<div style='font-size:10px'><span style='color:var(--dim)'>Op </span><span style='color:var(--dim)'>idle</span></div>";
  // flags
  const flags=[];
  if(av.jailed)flags.push({t:"JAILED",c:"#ff5470"});
  if(av.sick)flags.push({t:"SICK",c:"#ff6b6b"});
  if(av.homeless)flags.push({t:"HOMELESS",c:"#ff8c42"});
  if(flags.length){
    h+="<div style='font-size:10px;grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap'>";
    for(const f of flags)h+="<span style='color:"+f.c+";font-weight:700;letter-spacing:.06em'>"+f.t+"</span>";
    h+="</div>";}
  h+="</div>";

  // ── 3. NEEDS strip ──
  h+="<div style='font-size:10px;color:var(--dim);letter-spacing:.08em;margin-bottom:6px'>NEEDS</div>";
  h+="<div style='display:flex;gap:6px;margin-bottom:14px'>";
  const NEED_DEFS=[
    {k:"food",label:"Food",v:food,crit:15,low:30},
    {k:"rest",label:"Rest",v:rest,crit:15,low:30},
    {k:"hyg",label:"Hygiene",v:hyg,crit:20,low:40},
    {k:"fun",label:"Fun",v:fun,crit:20,low:40},
    {k:"soc",label:"Social",v:socN,crit:20,low:40},
  ];
  for(const nd2 of NEED_DEFS){
    const col=nd2.v<nd2.crit?"#ff6b6b":nd2.v<nd2.low?"#ffb454":"#5cff9e";
    h+="<div style='flex:1;display:flex;flex-direction:column;align-items:center;gap:3px'>";
    h+="<div style='font-size:8px;color:var(--dim);letter-spacing:.05em'>"+nd2.label.toUpperCase()+"</div>";
    h+="<div style='width:100%;height:4px;background:rgba(120,160,200,.15);border-radius:2px'>";
    h+="<div style='height:100%;width:"+(nd2.v)+"%25;background:"+col+";border-radius:2px'></div>";
    h+="</div>";
    h+="<div style='font-size:9px;color:"+col+";font-weight:600'>"+Math.round(nd2.v)+"</div>";
    h+="</div>";
  }
  h+="</div>";

  // ── 4. RECENT memories ──
  const mem=(av.mem||[]);
  if(mem.length){
    h+="<div style='font-size:10px;color:var(--dim);letter-spacing:.08em;margin-bottom:6px'>RECENT</div>";
    h+="<div style='display:flex;flex-direction:column;gap:3px'>";
    const recent=mem.slice(-4).reverse();
    for(const m of recent)
      h+="<div style='font-size:10px;color:var(--tx);line-height:1.4;padding:4px 8px;background:rgba(8,18,36,.4);border-left:2px solid rgba(120,160,200,.25);border-radius:0 4px 4px 0'>"
        +"<span style='font-size:9px;color:var(--dim)'>day "+m.d+" h"+m.h+" </span>"+m.t+"</div>";
    h+="</div>";
  }
  return h;
}
// ── RELATIONSHIPS TAB ─────────────────────────────────────────────────────────
function opsRelationsHTML(){
  const av=theAvatar();
  if(!av)return "<div style='color:var(--dim);font-size:11px;padding:12px'>No operative found.</div>";
  const rep=avatarRep(), tier=legendTier();
  const doctrine=(ST.mov&&ST.mov.doctrine)||null;
  const ALLY_TYPES=new Set(["partner","estranged partner","mentor","close friend","friend","warm"]);
  const THREAT_TYPES=new Set(["enemy","rival"]);
  let h="";

  // ── 1. STANDING header ──
  const tierCol=tier==="feared"?"#ff5470":tier==="beloved"?"#5cff9e":"#7aa2ff";
  const tierLabel=tier==="feared"?"◈ FEARED":tier==="beloved"?"◈ BELOVED":"◈ UNKNOWN";
  h+="<div style='padding:10px 12px;background:rgba(34,221,255,.07);border:1px solid rgba(34,221,255,.18);border-radius:8px;margin-bottom:14px;display:flex;align-items:center;gap:12px'>";
  h+="<div><div style='font-size:12px;font-weight:700;color:"+tierCol+";letter-spacing:.08em'>"+tierLabel+"</div>";
  h+="<div style='font-size:10px;color:var(--dim);margin-top:2px'>district rep <span style='color:"+tierCol+";font-weight:600'>"+(rep>=0?"+":"")+Math.round(rep)+"</span></div></div>";
  h+="<div style='margin-left:auto;text-align:right'><div style='font-size:9px;color:var(--dim);letter-spacing:.06em'>DOCTRINE</div>";
  h+="<div style='font-size:11px;color:#c98bff;font-weight:600'>"+(doctrine||"—")+"</div></div>";
  h+="</div>";

  // ── 2. ALLIES ──
  const allyMap=new Map();
  for(const q of ST.pawns){
    if(!q.hp||q.hp<=0||q.id===av.id||isChild(q))continue;
    const rt=relType(av.id,q.id);
    if(ALLY_TYPES.has(rt)&&!allyMap.has(q.id))allyMap.set(q.id,{pawn:q,rt,flags:[]});
  }
  for(const q of ST.pawns){
    if(q.recruited&&!isChild(q)&&q.id!==av.id&&q.hp>0){
      const en=allyMap.get(q.id);
      if(en)en.flags.push("recruited");
      else allyMap.set(q.id,{pawn:q,rt:relType(av.id,q.id)||"contact",flags:["recruited"]});
    }
  }
  for(const q of ST.pawns){
    if(q.bribed&&q.id!==av.id&&q.hp>0){
      const en=allyMap.get(q.id);
      if(en)en.flags.push("bribed");
      else allyMap.set(q.id,{pawn:q,rt:relType(av.id,q.id)||"contact",flags:["bribed"]});
    }
  }
  h+="<div style='font-size:10px;color:var(--dim);letter-spacing:.08em;margin-bottom:6px'>ALLIES <span style='font-size:9px'>("+allyMap.size+")</span></div>";
  if(allyMap.size===0){
    h+="<div style='font-size:11px;color:var(--dim);font-style:italic;margin-bottom:14px;padding:8px 10px;background:rgba(8,18,36,.4);border-radius:6px'>No known allies.</div>";
  }else{
    h+="<div style='display:flex;flex-direction:column;gap:3px;margin-bottom:14px'>";
    for(const[,en]of allyMap){
      const q=en.pawn;
      const rtCol=en.rt==="partner"||en.rt==="close friend"?"#5cff9e":en.rt==="mentor"?"#c98bff":en.rt==="friend"?"#7aa2ff":"#8aa8c8";
      h+="<div style='display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(8,18,36,.4);border-left:2px solid "+rtCol+";border-radius:0 4px 4px 0'>";
      h+="<div style='flex:1;min-width:0'><span style='font-size:11px;font-weight:600;color:var(--tx)'>"+q.name+"</span>";
      if(q.role)h+=" <span style='font-size:9px;color:var(--dim)'>"+q.role+"</span>";
      h+="</div>";
      h+="<span style='font-size:9px;color:"+rtCol+";text-transform:uppercase;letter-spacing:.05em'>"+en.rt+"</span>";
      for(const f of en.flags)h+="<span style='font-size:8px;background:rgba(92,255,158,.12);color:#5cff9e;padding:1px 4px;border-radius:3px;letter-spacing:.04em'>"+f+"</span>";
      h+="</div>";
    }
    h+="</div>";
  }

  // ── 3. THREATS ──
  const threatMap=new Map();
  for(const q of ST.pawns){
    if(!q.hp||q.hp<=0||q.id===av.id||isChild(q))continue;
    const rt=relType(av.id,q.id);
    if(THREAT_TYPES.has(rt)&&!threatMap.has(q.id))threatMap.set(q.id,{pawn:q,reasons:[rt]});
  }
  for(const q of ST.pawns){
    if(q.informant&&q.id!==av.id&&q.hp>0){
      const en=threatMap.get(q.id);
      if(en)en.reasons.push("informant");
      else threatMap.set(q.id,{pawn:q,reasons:["informant"]});
    }
  }
  for(const q of ST.pawns){
    if(q.grudgeTarget===av.id&&q.hp>0&&q.id!==av.id){
      const en=threatMap.get(q.id);
      if(en)en.reasons.push("hunting you");
      else threatMap.set(q.id,{pawn:q,reasons:["hunting you"]});
    }
  }
  h+="<div style='font-size:10px;color:var(--dim);letter-spacing:.08em;margin-bottom:6px'>THREATS <span style='font-size:9px'>("+threatMap.size+")</span></div>";
  if(threatMap.size===0){
    h+="<div style='font-size:11px;color:var(--dim);font-style:italic;padding:8px 10px;background:rgba(8,18,36,.4);border-radius:6px'>No active threats.</div>";
  }else{
    h+="<div style='display:flex;flex-direction:column;gap:3px'>";
    for(const[,en]of threatMap){
      const q=en.pawn;
      const threatCol=en.reasons[0]==="hunting you"?"#ff5470":en.reasons[0]==="informant"?"#ff8da3":"#ffb454";
      h+="<div style='display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(8,18,36,.4);border-left:2px solid "+threatCol+";border-radius:0 4px 4px 0'>";
      h+="<div style='flex:1;min-width:0'><span style='font-size:11px;font-weight:600;color:var(--tx)'>"+q.name+"</span>";
      if(q.role)h+=" <span style='font-size:9px;color:var(--dim)'>"+q.role+"</span>";
      h+="</div>";
      for(const r of en.reasons)h+="<span style='font-size:9px;color:"+threatCol+";text-transform:uppercase;letter-spacing:.05em'>"+r+"</span>";
      h+="</div>";
    }
    h+="</div>";
  }

  // ── 4. MARKS ──
  const dossierIds=new Set((av.dossier||[]).map(e=>e.id));
  const marksMap=new Map();
  for(const q of ST.pawns){
    if(q.hp<=0||q.id===av.id||isChild(q))continue;
    const isMark=routineStage(q)>0||intelProgress(q)>0||knownSecret(q)||q.extorted||dossierIds.has(q.id);
    if(isMark&&!marksMap.has(q.id))marksMap.set(q.id,q);
  }
  h+="<div style='font-size:10px;color:var(--dim);letter-spacing:.08em;margin-top:14px;margin-bottom:6px'>MARKS <span style='font-size:9px'>("+marksMap.size+")</span></div>";
  if(marksMap.size===0){
    h+="<div style='font-size:11px;color:var(--dim);font-style:italic;padding:8px 10px;background:rgba(8,18,36,.4);border-radius:6px'>No marks under surveillance.</div>";
  }else{
    h+="<div style='display:flex;flex-direction:column;gap:3px'>";
    for(const[,q]of marksMap){
      h+="<div style='padding:5px 8px;background:rgba(8,18,36,.4);border-left:2px solid #ffd84a;border-radius:0 4px 4px 0'>";
      h+="<div style='display:flex;align-items:center;gap:6px;flex-wrap:wrap'>";
      h+="<span style='font-size:11px;font-weight:600;color:var(--tx)'>"+q.name+"</span>";
      if(q.role)h+="<span style='font-size:9px;color:var(--dim)'>"+q.role+"</span>";
      const rs=routineStage(q);
      if(rs>0)h+="<span style='font-size:9px;color:#ffd84a;letter-spacing:.04em'>surveil "+rs+"/4</span>";
      const ip=intelProgress(q);
      if(ip>0)h+="<span style='font-size:9px;color:#7aa2ff;letter-spacing:.04em'>intel "+Math.round(ip*100)+"%</span>";
      const sec=knownSecret(q);
      if(sec)h+="<span style='font-size:8px;background:rgba(201,139,255,.15);color:#c98bff;padding:1px 4px;border-radius:3px;letter-spacing:.04em'>secret: "+sec.kind+"</span>";
      if(q.extorted){
        const daysLeft=Math.max(0,Math.round((q.extorted.nextPay-ST.tick)/TPD));
        h+="<span style='font-size:8px;background:rgba(255,84,112,.15);color:#ff5470;padding:1px 4px;border-radius:3px;letter-spacing:.04em'>extorted"+(daysLeft>0?" · pay day "+(dayN()+daysLeft):" · overdue")+"</span>";
      }
      h+="</div></div>";
    }
    h+="</div>";
  }
  return h;
}
// ── BASE OF OPERATIONS PANEL ──────────────────────────────────────────────────
// Renders into the shared modal. Re-calls itself after claim/build so state
// updates live without a separate refresh mechanism.
function hqPanelHTML(){
  const hq=ST.hq||{claimed:false,stations:{},room:null};
  const income=ST.income||0;
  const PILLAR_COL={core:"#7aa2ff",spy:"#22ddff",monitor:"#ffd84a",hack:"#ff5470",defend:"#5cff9e",general:"#c0c8d8"};

  let h="<div style='font-size:11px;color:var(--dim);margin-bottom:10px'>the fixer's back room — your permanent base</div>";

  // ── income readout ──
  h+="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:6px 10px;background:rgba(8,18,36,.5);border:1px solid rgba(120,160,200,.15);border-radius:7px'>";
  h+="<span style='font-size:10px;color:var(--dim);letter-spacing:.08em'>DISTRICT INCOME</span>";
  h+="<span style='font-size:14px;font-weight:700;color:#ffd84a'>"+income+"c</span>";
  h+="</div>";

  if(!hq.claimed){
    h+="<div style='text-align:left;padding:12px;background:rgba(34,221,255,.05);border:1px solid rgba(34,221,255,.15);border-radius:8px;margin-bottom:14px'>";
    h+="<div style='font-size:11px;color:var(--tx);line-height:1.6;margin-bottom:10px'>You've been working out of the fixer's back room since you arrived — borrowed space, not yours. Claiming it makes it your permanent base. Build stations here to unlock the espionage infrastructure you'll need.</div>";
    h+="<button class='tb' id='hq-claim' style='width:100%;padding:11px;font-size:12px;letter-spacing:.14em;border-color:var(--cy);color:var(--cy)'>CLAIM THIS ROOM AS YOUR BASE</button>";
    h+="</div>";
  } else {
    const built=hqStationCount();
    h+="<div style='font-size:10px;color:var(--dim);letter-spacing:.08em;margin-bottom:8px'>STATIONS — "+built+"/"+Object.keys(HQ_STATIONS).length+" built</div>";
    h+="<div style='display:flex;flex-direction:column;gap:6px'>";
    for(const [kind,def] of Object.entries(HQ_STATIONS)){
      const isBuilt=hasStation(kind);
      const canAfford=income>=def.cost;
      const pcol=PILLAR_COL[def.pillar]||"#8aa8c8";
      h+="<div style='display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(8,18,36,"+(isBuilt?"0.6":"0.4")+");border:1px solid "+(isBuilt?"rgba(92,255,158,.25)":"rgba(120,160,200,.12)")+"'>";
      h+="<div style='flex:0 0 28px;text-align:center;font-size:18px;opacity:"+(isBuilt?"1":"0.6")+"'>"+def.icon+"</div>";
      h+="<div style='flex:1 1 auto;min-width:0'>";
      h+="<div style='font-size:12px;font-weight:700;color:"+(isBuilt?"var(--tx)":"var(--dim)")+"'>"+def.name+"</div>";
      h+="<div style='font-size:9px;color:"+pcol+";letter-spacing:.07em;margin-bottom:2px'>"+def.pillar.toUpperCase()+" · "+def.blurb+"</div>";
      if(!isBuilt)h+="<div style='font-size:9px;color:var(--dim)'>"+def.desc+"</div>";
      h+="</div>";
      if(isBuilt){
        h+="<div style='flex:0 0 auto;font-size:10px;color:#5cff9e;letter-spacing:.06em'>✓ BUILT</div>";
      } else {
        h+="<div style='flex:0 0 auto;text-align:right'>";
        h+="<div style='font-size:10px;color:"+(canAfford?"#ffd84a":"var(--rd)")+"'>"+def.cost+"c</div>";
        h+="<button class='tb' data-hqbuild='"+kind+"' style='margin-top:3px;padding:3px 10px;font-size:10px;letter-spacing:.08em;"+(canAfford?"border-color:var(--cy);color:var(--cy)":"opacity:.4;pointer-events:none")+"'>BUILD</button>";
        h+="</div>";
      }
      h+="</div>";
    }
    h+="</div>";
  }
  return h;
}
function showHQPanel(){showModal("<h1 style='font-size:18px;letter-spacing:.14em;margin-bottom:2px'>▤ BASE OF OPERATIONS</h1>"+hqPanelHTML()+"<div style='margin-top:14px'><button class='tb' id='m-close' style='width:100%;padding:10px;font-size:11px;letter-spacing:.1em'>CLOSE</button></div>");}
// ──────────────────────────────────────────────────────────────────────────────
// ── OUTFITTER PANEL ──────────────────────────────────────────────────────────
function outfitterHTML(){
  const unlocked=hqUnlocks("gear");
  const av=theAvatar()||{gearOwned:[],equipped:[]};
  const owned=Array.isArray(av.gearOwned)?av.gearOwned:[];
  const equipped=Array.isArray(av.equipped)?av.equipped:[];
  const income=ST.income||0;
  const PILLAR_COL={spy:"#22ddff",general:"#c0c8d8",monitor:"#ffd84a",hack:"#ff5470",defend:"#5cff9e"};
  let h="<div style='font-size:11px;color:var(--dim);margin-bottom:10px'>operative gear &amp; loadout</div>";
  h+="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:6px 10px;background:rgba(8,18,36,.5);border:1px solid rgba(120,160,200,.15);border-radius:7px'>";
  h+="<span style='font-size:10px;color:var(--dim);letter-spacing:.08em'>INCOME <span style='color:#ffd84a;font-weight:700'>"+income+"c</span></span>";
  h+="<span style='font-size:10px;color:var(--dim);letter-spacing:.08em'>LOADOUT <span style='color:"+(equipped.length>=GEAR_SLOTS?"var(--rd)":"var(--cy)")+"'>"+equipped.length+"/"+GEAR_SLOTS+"</span></span>";
  h+="</div>";
  if(!unlocked){
    h+="<div style='padding:16px;background:rgba(255,84,112,.05);border:1px solid rgba(255,84,112,.2);border-radius:8px;margin-bottom:14px;text-align:center'>";
    h+="<div style='font-size:22px;margin-bottom:6px'>🔒</div>";
    h+="<div style='font-size:11px;color:var(--tx);line-height:1.6;margin-bottom:4px'>Gear requires a <strong style='color:var(--cy)'>Workbench</strong> at your base.</div>";
    h+="<div style='font-size:10px;color:var(--dim)'>Switch to the <strong>Base</strong> tab to claim your base and build one.</div>";
    h+="</div>";
  } else {
    h+="<div style='display:flex;flex-direction:column;gap:6px'>";
    for(const [id,g] of Object.entries(GEAR)){
      const isOwned=owned.includes(id);
      const isEquipped=equipped.includes(id);
      const canAfford=income>=g.cost;
      const slotsFull=equipped.length>=GEAR_SLOTS;
      const pcol=PILLAR_COL[g.pillar]||"#8aa8c8";
      const opsLabel=g.effect.ops.map(o=>o.charAt(0).toUpperCase()+o.slice(1)).join(", ");
      const sign=g.effect.amount<0?"−":"+";
      const effectLine=sign+Math.abs(g.effect.amount)+" "+g.effect.field+" on: "+opsLabel;
      h+="<div style='display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:8px;background:rgba(8,18,36,"+(isEquipped?"0.7":isOwned?"0.55":"0.4")+");border:1px solid "+(isEquipped?"rgba(34,221,255,.3)":isOwned?"rgba(92,255,158,.2)":"rgba(120,160,200,.12)")+"'>";
      h+="<div style='flex:1 1 auto;min-width:0'>";
      h+="<div style='font-size:12px;font-weight:700;color:var(--tx);margin-bottom:1px'>"+g.name+"</div>";
      h+="<div style='font-size:9px;color:"+pcol+";letter-spacing:.07em;margin-bottom:3px'>"+g.pillar.toUpperCase()+" · "+effectLine+"</div>";
      h+="<div style='font-size:9px;color:var(--dim);line-height:1.4'>"+g.desc+"</div>";
      h+="</div>";
      h+="<div style='flex:0 0 auto;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px'>";
      if(!isOwned){
        h+="<div style='font-size:10px;color:"+(canAfford?"#ffd84a":"var(--rd)")+"'>"+g.cost+"c</div>";
        h+="<button class='tb' data-gearbuy='"+id+"' style='padding:3px 10px;font-size:10px;letter-spacing:.08em;"+(canAfford?"border-color:var(--cy);color:var(--cy)":"opacity:.4;pointer-events:none")+"'>BUY</button>";
      } else if(isEquipped){
        h+="<div style='font-size:9px;color:var(--cy);letter-spacing:.06em;margin-bottom:2px'>✓ EQUIPPED</div>";
        h+="<button class='tb' data-gearunequip='"+id+"' style='padding:3px 10px;font-size:10px;letter-spacing:.08em;border-color:var(--dim);color:var(--dim)'>UNEQUIP</button>";
      } else {
        h+="<div style='font-size:9px;color:#5cff9e;letter-spacing:.06em;margin-bottom:2px'>OWNED</div>";
        h+="<button class='tb' data-gearequip='"+id+"' style='padding:3px 10px;font-size:10px;letter-spacing:.08em;"+(slotsFull?"opacity:.4;pointer-events:none":"border-color:var(--cy);color:var(--cy)")+"'>EQUIP"+(slotsFull?" (full)":"")+"</button>";
      }
      h+="</div>";
      h+="</div>";
    }
    h+="</div>";
  }
  return h;
}
function showOutfitter(){showModal("<h1 style='font-size:18px;letter-spacing:.14em;margin-bottom:2px'>⚙ OUTFITTER</h1>"+outfitterHTML()+"<div style='margin-top:14px'><button class='tb' id='m-close' style='width:100%;padding:10px;font-size:11px;letter-spacing:.1em'>CLOSE</button></div>");}
// ──────────────────────────────────────────────────────────────────────────────
// ── OPERATIVE SCREEN (tabbed host) ───────────────────────────────────────────
let OPSTAB="stats";
function showOpsScreen(){
  const TABS=[{k:"stats",label:"Stats"},{k:"thoughts",label:"Thoughts"},{k:"relations",label:"Relations"},{k:"base",label:"Base"},{k:"equipment",label:"Equipment"}];
  // ── tab bar ──
  let h="<h1 style='font-size:16px;letter-spacing:.14em;margin-bottom:10px'>◈ OPERATIVE</h1>";
  h+="<div style='display:flex;gap:3px;margin-bottom:14px;border-bottom:1px solid rgba(120,160,200,.18);padding-bottom:8px'>";
  for(const t of TABS){
    const active=OPSTAB===t.k;
    h+="<button data-opstab='"+t.k+"' style='flex:1;padding:5px 4px;font-size:10px;letter-spacing:.09em;font-family:var(--disp);background:transparent;border:1px solid "+(active?"var(--cy)":"rgba(120,160,200,.25)")+";border-radius:4px;color:"+(active?"var(--cy)":"var(--dim)")+";cursor:pointer;transition:color .15s,border-color .15s'>"+t.label+"</button>";
  }
  h+="</div>";
  // ── active tab body ──
  if(OPSTAB==="stats")h+=opsStatsHTML();
  else if(OPSTAB==="thoughts")h+=opsThoughtsHTML();
  else if(OPSTAB==="relations")h+=opsRelationsHTML();
  else if(OPSTAB==="base")h+=hqPanelHTML();
  else if(OPSTAB==="equipment")h+=outfitterHTML();
  h+="<div style='margin-top:14px'><button class='tb' id='m-close' style='width:100%;padding:10px;font-size:11px;letter-spacing:.1em'>CLOSE</button></div>";
  showModal(h);
}
// ──────────────────────────────────────────────────────────────────────────────

function showCharCreate(){
  if(typeof CC.step!=="number")CC.step=0;            // 0=background, 1=attributes, 2=codename
  if(typeof CC.detail==="undefined")CC.detail=null;  // which item's detail is revealed (hover/tap)
  const stats=ccStats(),rem=ccRemaining();
  const bg=OPS_BACKGROUNDS.find(b=>b.k===CC.bg)||OPS_BACKGROUNDS[1];
  const STEPS=["BACKGROUND","ATTRIBUTES","CODENAME"];
  let h="<h1 style='font-size:21px;letter-spacing:.16em;margin-bottom:2px'>YOUR OPERATIVE</h1>";
  h+="<div class='mh-sub' style='margin-bottom:14px'>the hidden architect of the coming insurrection</div>";
  // ── STEP INDICATOR — three dots/labels showing progress ──
  h+="<div style='display:flex;gap:6px;justify-content:center;margin-bottom:16px'>";
  for(let i=0;i<3;i++){const done=i<CC.step,cur=i===CC.step;
    h+="<div style='display:flex;align-items:center;gap:6px'>";
    h+="<div style='width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:var(--disp);border:1.5px solid "+(cur?"var(--cy)":done?"var(--gn)":"rgba(120,160,200,.3)")+";background:"+(cur?"rgba(34,221,255,.15)":done?"rgba(92,255,158,.12)":"transparent")+";color:"+(cur?"var(--cy)":done?"var(--gn)":"var(--dim)")+"'>"+(done?"\u2713":(i+1))+"</div>";
    h+="<span style='font-size:9px;letter-spacing:.1em;color:"+(cur?"var(--cy)":"var(--dim)")+"'>"+STEPS[i]+"</span>";
    if(i<2)h+="<span style='color:rgba(120,160,200,.3);margin:0 2px'>\u2192</span>";
    h+="</div>";}
  h+="</div>";

  // ════════ STEP 0 — BACKGROUND ════════
  if(CC.step===0){
    h+="<div style='text-align:left;margin-bottom:8px;font-size:11px;color:var(--dim)'>Choose your origin. It shapes your starting attributes and playstyle.</div>";
    h+="<div style='display:flex;flex-direction:column;gap:6px'>";
    for(const b of OPS_BACKGROUNDS){const on=b.k===CC.bg;
      // big tappable card; the description shows only for the SELECTED one (reveal-on-interaction)
      h+="<button class='tb cc-bg' data-ccbg='"+b.k+"' style='width:100%;box-sizing:border-box;text-align:left;padding:11px 13px;white-space:normal;overflow-wrap:break-word;border-width:1.5px;border-color:"+(on?"var(--cy)":"rgba(120,160,200,.22)")+";background:"+(on?"rgba(34,221,255,.1)":"rgba(8,18,36,.5)")+"'>";
      h+="<div style='display:flex;align-items:center;justify-content:space-between'>";
      h+="<span style='font-weight:700;font-size:13px;color:"+(on?"var(--cy)":"var(--tx)")+"'>"+b.name+"</span>";
      if(on)h+="<span style='font-size:9px;color:var(--cy);letter-spacing:.1em'>\u25c9 SELECTED</span>";
      h+="</div>";
      // description + stat preview ONLY for the selected card
      if(on){
        h+="<div style='font-size:10.5px;opacity:.8;margin-top:5px;line-height:1.5;white-space:normal;overflow-wrap:break-word'>"+b.desc+"</div>";
        // the stat spread this background gives — a compact preview
        h+="<div style='display:flex;flex-wrap:wrap;gap:5px;margin-top:8px'>";
        for(const a of OPS_ATTRS){const sv=b.stats[a.k]||5;const sc=sv>=8?"#5cff9e":sv>=6?"#7aa2ff":"#8aa8c8";
          h+="<span style='font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(8,18,36,.7);color:"+sc+"'>"+a.name.slice(0,3).toUpperCase()+" "+sv+"</span>";}
        h+="</div>";
      }
      h+="</button>";}
    h+="</div>";
    // nav
    h+="<div style='display:flex;gap:8px;margin-top:16px'>";
    h+="<button class='tb' id='cc-back' style='flex:0 0 auto;padding:12px 18px;font-size:12px;letter-spacing:.12em'>BACK</button>";
    h+="<button class='tb' id='cc-next' style='flex:1;padding:12px 18px;font-size:13px;letter-spacing:.18em;border-color:var(--cy);color:var(--cy)'>NEXT \u2192</button>";
    h+="</div>";
  }

  // ════════ STEP 1 — ATTRIBUTES ════════
  else if(CC.step===1){
    h+="<div style='display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px'>";
    h+="<span style='font-size:11px;color:var(--dim)'>Tap a stat to see what it does.</span>";
    h+="<span style='font-size:12px;font-weight:700;color:"+(rem>0?"#ffd84a":"#5cff9e")+"'>"+rem+" pts left</span></div>";
    // FIXED DESCRIPTION SLOT — description swaps here when a stat is tapped; min-height keeps rows from shifting.
    const effectText=CC.detail?(ATTR_EFFECT[CC.detail]||""):"";
    const effectLabel=CC.detail?(OPS_ATTRS.find(a=>a.k===CC.detail)||{name:""}).name:"";
    h+="<div style='min-height:40px;margin-bottom:6px;padding:6px 9px;border-radius:6px;box-sizing:border-box;background:"+(CC.detail?"rgba(34,221,255,.07)":"transparent")+";border:1px solid "+(CC.detail?"rgba(34,221,255,.2)":"transparent")+"'>";
    if(CC.detail)h+="<span style='font-size:9px;letter-spacing:.1em;color:var(--cy);font-weight:700'>"+effectLabel.toUpperCase()+" — </span><span style='font-size:10px;color:#9fc0e8;line-height:1.5'>"+effectText+"</span>";
    h+="</div>";
    h+="<div style='display:flex;flex-direction:column;gap:4px'>";
    for(const a of OPS_ATTRS){const v=stats[a.k],spent=CC.spent[a.k]||0;
      const col=v>=8?"#5cff9e":v>=5?"#7aa2ff":"#8aa8c8";
      const revealed=CC.detail===a.k;
      h+="<div class='cc-attr-block"+(revealed?" revealed":"")+"' data-ccattr='"+a.k+"' style='cursor:pointer;padding:6px 8px;border-radius:7px;border:1px solid transparent'>";
      h+="<div style='display:flex;align-items:center;gap:8px'>";
      h+="<div style='flex:0 0 84px;min-width:84px;text-align:left;font-size:12px;font-weight:600'>"+a.name+"</div>";
      h+="<button class='tb cc-dec' data-ccdec='"+a.k+"' style='flex:0 0 auto;padding:2px 9px;font-size:13px;"+(spent<=0?"opacity:.3":"")+"'>\u2212</button>";
      h+="<div style='flex:0 0 22px;width:22px;text-align:center;font-weight:700;color:"+col+";font-size:14px'>"+v+"</div>";
      h+="<button class='tb cc-inc' data-ccinc='"+a.k+"' style='flex:0 0 auto;padding:2px 9px;font-size:13px;"+((rem<=0||v>=10)?"opacity:.3":"")+"'>+</button>";
      h+="<div style='flex:1 1 auto;min-width:24px;height:6px;background:rgba(120,160,200,.15);border-radius:3px;overflow:hidden'><div style='width:"+(v*10)+"%;height:100%;background:"+col+";transition:width .2s'></div></div>";
      h+="</div>";
      h+="</div>";}
    h+="</div>";
    // nav
    h+="<div style='display:flex;gap:8px;margin-top:16px'>";
    h+="<button class='tb' id='cc-prev' style='flex:0 0 auto;padding:12px 18px;font-size:12px;letter-spacing:.12em'>\u2190 BACK</button>";
    h+="<button class='tb' id='cc-next' style='flex:1;padding:12px 18px;font-size:13px;letter-spacing:.18em;border-color:"+(rem===0?"var(--cy)":"rgba(120,160,200,.3)")+";color:"+(rem===0?"var(--cy)":"var(--dim)")+"' title='"+(rem>0?"assign all points first":"")+"'>NEXT \u2192</button>";
    h+="</div>";
    if(rem>0)h+="<p style='color:var(--dim);font-size:9.5px;margin-top:8px'>Assign all "+OPS_POINT_BUDGET+" points to continue.</p>";
  }

  // ════════ STEP 2 — CODENAME + SUMMARY ════════
  else {
    h+="<div style='text-align:left;margin-bottom:6px;font-size:11px;color:var(--dim)'>Name your operative and review.</div>";
    h+="<input id='cc-name' type='text' maxlength='18' placeholder='The Operative' value='"+(CC.name||"").replace(/\"/g,"&quot;")+"' style='width:100%;box-sizing:border-box;background:rgba(2,8,22,.8);border:1.5px solid rgba(34,221,255,.4);color:var(--tx);padding:11px 13px;border-radius:7px;font-family:var(--disp);font-size:15px;letter-spacing:.05em;margin-bottom:14px'>";
    // OPERATIVE SUMMARY CARD — the dossier you've built
    h+="<div style='text-align:left;background:rgba(8,18,36,.6);border:1px solid rgba(34,221,255,.2);border-radius:9px;padding:12px 14px;margin-bottom:14px'>";
    h+="<div style='font-size:9px;letter-spacing:.15em;color:var(--dim);margin-bottom:6px'>OPERATIVE DOSSIER</div>";
    h+="<div style='font-family:var(--disp);font-weight:700;font-size:15px;color:var(--cy);margin-bottom:2px'>"+((CC.name||"").trim()||"The Operative")+"</div>";
    h+="<div style='font-size:11px;color:var(--tx);margin-bottom:8px'>"+bg.name+"</div>";
    // final stat bars
    h+="<div style='display:flex;flex-direction:column;gap:3px'>";
    for(const a of OPS_ATTRS){const v=stats[a.k];const col=v>=8?"#5cff9e":v>=5?"#7aa2ff":"#8aa8c8";
      h+="<div style='display:flex;align-items:center;gap:8px'>";
      h+="<span style='flex:0 0 78px;font-size:10px;color:var(--dim)'>"+a.name+"</span>";
      h+="<div style='flex:1;height:5px;background:rgba(120,160,200,.15);border-radius:3px;overflow:hidden'><div style='width:"+(v*10)+"%;height:100%;background:"+col+"'></div></div>";
      h+="<span style='flex:0 0 18px;text-align:right;font-size:11px;font-weight:700;color:"+col+"'>"+v+"</span>";
      h+="</div>";}
    h+="</div></div>";
    // nav
    h+="<div style='display:flex;gap:8px'>";
    h+="<button class='tb' id='cc-prev' style='flex:0 0 auto;padding:12px 18px;font-size:12px;letter-spacing:.12em'>\u2190 BACK</button>";
    h+="<button class='tb' id='cc-begin' style='flex:1;padding:12px 18px;font-size:14px;letter-spacing:.2em;border-color:var(--gn);color:var(--gn);background:rgba(92,255,158,.08)'>BEGIN \u25b8</button>";
    h+="</div>";
  }
  showModal(h);
}
function showStart(){showModal(
  "<div id='hero-art' style='display:none;width:100%;max-width:420px;margin:0 auto 10px;border-radius:8px;overflow:hidden;border:1px solid rgba(168,89,255,.3)'></div>"+
  "<h1>NEON SPRAWL</h1><div class='mh-sub'>COLONY PROTOCOL</div>"+
  "<p>2087. Two citizens — Vex and Static — just squatted a dead block on the edge of the megacity. The concrete is cracked, mushrooms glow through the fissures, and the corp enforcers haven't noticed you yet.</p>"+
  "<p>Build a district. Grow a community. Keep the lights on and the rent paid. Watch your citizens live, fight, steal, fall sick, and form bonds — or not.</p>"+
  "<p>The sprawl doesn't care about you. Make it care.</p>"+
  (hasSave()?"<button class='tb big' id='m-continue'>CONTINUE</button>":"")+
  "<button class='tb big' id='m-start'>NEW DISTRICT</button>"+
  "<p style='color:var(--dim);font-size:10px;margin-top:14px'>Press ? for the operator manual · v0.2</p>");
  // optional painted hero image — shows only if sprites/title.png exists (no broken-img if absent)
  const heroSlot=$("hero-art");
  if(heroSlot&&typeof Image!=="undefined"){const hi=new Image();
    hi.onload=()=>{heroSlot.innerHTML="";heroSlot.appendChild(hi);hi.style.width="100%";hi.style.display="block";heroSlot.style.display="block";};
    hi.onerror=()=>{};   // absent → title stays text-only, no broken image
    hi.src="sprites/title.png";}
}

/* ---------- save / load ---------- */
const SAVE_KEY="neonSprawlSave_v1";       // legacy single-slot (auto-migrated)
const SLOT_KEY=n=>"neonSprawlSlot_"+n;     // n = 1,2,3
const AUTO_KEY="neonSprawlSlot_auto";
const SLOTS=[1,2,3];
function slotKeyFor(slot){return slot==="auto"?AUTO_KEY:SLOT_KEY(slot);}
function slotMeta(slot){
  try{const raw=localStorage.getItem(slotKeyFor(slot));if(!raw)return null;
    const d=JSON.parse(raw);
    return{day:Math.floor((d.tick||0)/TPD)+1,pop:(d.pawns||[]).length,
      tier:d.tierReached||1,income:Math.round(d.income||0),
      saved:d.savedAt||null};}
  catch(e){return null}}
function hasSave(){
  // true if ANY slot (or legacy) has data
  try{if(localStorage.getItem(SAVE_KEY))return true;
    if(localStorage.getItem(AUTO_KEY))return true;
    for(const n of SLOTS)if(localStorage.getItem(SLOT_KEY(n)))return true;
  }catch(e){}
  return false}
function snapPawn(p){return Object.assign({},p,{job:null,path:null,carry:null,order:null,dz:null,activeOp:null,gather:null,_pendingTalk:null,_pendingOp:null,unre:undefined,pi:0,pTx:-1,pTy:-1,claim:0,_gridFix:null})}
function snapStruct(s){return Object.assign({},s,{res:0})}
function serializeState(){
  return{v:2,tick:ST.tick,grp:ST.grp,rel:ST.rel,relMeta:ST.relMeta||{},cliques:ST.cliques||[],nextEv:ST.nextEv,lastCrackdown:ST.lastCrackdown,
    goods:ST.goods,income:ST.income,debtDays:ST.debtDays||0,crisis:ST.crisis||false,
    savedAt:Date.now(),
    gangs:(ST.gangs||[]).map(g=>({...g,turf:[...g.turf]})),
    stats:ST.stats,flags:ST.flags,milestones:ST.milestones||[],tierReached:ST.tierReached||1,contrabandPolicy:ST.contrabandPolicy||"crackdown",hintsSeen:ST.hintsSeen||{},pendingDisaster:ST.pendingDisaster||null,blackoutUntil:ST.blackoutUntil||0,avatarManual:ST.avatarManual||false,avatarPosture:ST.avatarPosture||"normal",sabotages:ST.sabotages||[],caravan:ST.caravan||null,election:ST.election||null,electionQueue:ST.electionQueue||[],chronicle:CHRONICLE.slice(0,80),
    mov:ST.mov,regime:ST.regime,cases:ST.cases||[],caseSeq:ST.caseSeq||0,director:ST.director||null,
    ter:Array.from(ST.ter),
    structs:[...ST.structs.values()].map(snapStruct),
    pawns:ST.pawns.map(snapPawn),
    heat:ST.heat||0,heatWarn:ST.heatWarn||false,
    requests:ST.requests||[],lastGlobalReqT:ST.lastGlobalReqT||0,lastUpkeep:ST.lastUpkeep||0,
    zones:ST.zones||null,cityHomes:ST.cityHomes||[],
    hq:ST.hq||null,
    rooms:ST.rooms}}
function applyState(d){
  ST.tick=d.tick||0;
  ST.grp=d.grp||{};ST.rel=d.rel||{};ST.relMeta=d.relMeta||{};ST.cliques=d.cliques||[];ST.nextEv=(d.nextEv==null?1e9:d.nextEv);ST.lastCrackdown=d.lastCrackdown||0;
  ST.goods=d.goods||{data:0,chem:0,parts:0,stims:0,gear:0,food:0,scrap:0};ST.income=d.income||0;
  ST.debtDays=d.debtDays||0;ST.crisis=d.crisis||false;
  ST.gangs=(d.gangs||[]).map(g=>({...g,turf:new Set(g.turf||[])}));
  ST.stats=d.stats||{built:0,deaths:0};ST.flags=d.flags||{};ST.milestones=d.milestones||[];ST.tierReached=d.tierReached||1;ST.contrabandPolicy=d.contrabandPolicy||"crackdown";ST.hintsSeen=d.hintsSeen||{};ST.pendingDisaster=d.pendingDisaster||null;ST.blackoutUntil=d.blackoutUntil||0;ST.avatarManual=d.avatarManual||false;ST.avatarPosture=d.avatarPosture||"normal";ST.sabotages=d.sabotages||[];ST.caravan=d.caravan||null;ST.election=d.election||null;ST.electionQueue=d.electionQueue||[];CHRONICLE.length=0;if(Array.isArray(d.chronicle))for(const e of d.chronicle)CHRONICLE.push(e);
  ST.mov=d.mov||{support:5,exposure:0,intel:0,cells:0,stance:"hidden",doctrine:null,foundedTick:0};
  ST.cases=d.cases||[];ST.caseSeq=d.caseSeq||0;
  ST.regime=d.regime||{grip:60,awareness:0,lastSweep:0,informants:[]};
  ST.director=d.director||null;   // (§3) Brain B director state (re-inits on first tick if null)
  ST.ter=new Uint8Array(d.ter||[]);
  ST.structs=new Map((d.structs||[]).map(s=>[K(s.x,s.y),s]));
  for(const s of ST.structs.values())if(DEF[s.type]&&DEF[s.type].furn&&s.qual===undefined)s.qual=1; // backfill furniture quality
  ST.pawns=(d.pawns||[]).map(p=>Object.assign({},p,{job:null,path:null,carry:null,order:null,dz:null,gather:null,unre:new Map()}));
  ST.pendingReacts=[];   // transient wave-reaction queue — never persisted
  // backfill insurrection fields for pawns from pre-insurrection saves
  for(const p of ST.pawns){
    if(typeof p.allegiance!=="number")p.allegiance=0;
    if(p.recruited===undefined)p.recruited=false;
    if(p.informant===undefined)p.informant=false;
    if(p.cellRole===undefined)p.cellRole=null;
  }
  for(const p of ST.pawns)if(!p.career)p.career=initCareer(p.sk||{},p.pers||{}); // backfill for pre-career saves
  // backfill gear arrays for pre-gear saves (avatar only; non-avatars never have gear)
  for(const p of ST.pawns){if(p.isAvatar){if(!Array.isArray(p.gearOwned))p.gearOwned=[];if(!Array.isArray(p.equipped))p.equipped=[];}}
  for(const p of ST.pawns){ // backfill dynasty fields for pre-dynasty saves
    if(p.age===undefined)p.age=RI(19,46);
    if(p.birthDay===undefined)p.birthDay=null;
    if(p.surname===undefined)p.surname=CH(NL);
    if(p.child===undefined)p.child=false;
    if(p.parents===undefined)p.parents=null;}
  ST.heat=d.heat||0;ST.heatWarn=d.heatWarn||false;
  ST.requests=Array.isArray(d.requests)?d.requests:[];
  ST.lastGlobalReqT=d.lastGlobalReqT||0;ST.lastUpkeep=d.lastUpkeep||0;
  if(d.zones)ST.zones=d.zones;
  if(Array.isArray(d.cityHomes)&&d.cityHomes.length){   // restore home registry + re-link by-value pawn homes back to shared entries
    ST.cityHomes=d.cityHomes;
    for(const p of ST.pawns){
      if(p.home&&p.home.bed){
        const h=ST.cityHomes.find(H=>H.bed&&H.bed.x===p.home.bed.x&&H.bed.y===p.home.bed.y);
        if(h)p.home=h;
      }
    }
  }
  // restore the HQ (base of operations) — re-link its room to the live fixerHome reference
  ST.hq=d.hq||{claimed:false,room:ST.fixerHome||null,stations:{},foundedTick:0};
  if(ST.hq&&!ST.hq.room)ST.hq.room=ST.fixerHome||null;
  if(ST.hq&&!ST.hq.stations)ST.hq.stations={};
  ST.beams=[];ST.floats=[];ST.emotes=[];ST.tombs=[];ST.says=[];ST.sel=[];ST.rooms=d.rooms||[];
  ST.phase="run";ST.paused=false;ST.speed=1;}
function saveToSlot(slot){
  if(ST.phase!=="run"){flashMsg("Nothing to save yet");return false}
  try{localStorage.setItem(slotKeyFor(slot),JSON.stringify(serializeState()));
    if(slot!=="auto"){flashMsg("Saved to slot "+slot+" — day "+dayN());banner("SAVED · SLOT "+slot,"good");}
    return true}
  catch(e){flashMsg("Save failed: "+(e&&e.message||"storage error"));return false}}
function loadFromSlot(slot){
  let raw;try{raw=localStorage.getItem(slotKeyFor(slot))}catch(e){flashMsg("Storage unavailable");return false}
  if(!raw){flashMsg("Slot "+slot+" is empty");return false}
  let d;try{d=JSON.parse(raw)}catch(e){flashMsg("Save file corrupt");return false}
  applyState(d);
  drawTerrain();MOTES=null;BLOBS=null;
  if(ST.pawns[0]){cam.x=ST.pawns[0].px*T-VW/cam.z/2;cam.y=ST.pawns[0].py*T-VH/cam.z/2;clampCam()}
  hideModal();closeOverlay();refreshSpd();syncHUD();renderRoster();renderInspect();
  flashMsg("Loaded "+(slot==="auto"?"autosave":"slot "+slot)+" — day "+dayN());banner("RUN LOADED","good");return true}
function autosave(){saveToSlot("auto");}
// functional round-trip helpers (also used by the smoke harness):
// saveGame writes to slot 1; loadGame loads the most recently saved slot.
function saveGame(){return saveToSlot(1);}
function mostRecentSlot(){
  let best=null,bt=-1;
  for(const slot of ["auto",1,2,3]){const m=slotMeta(slot);
    if(m&&m.saved&&m.saved>bt){bt=m.saved;best=slot;}}
  // legacy fallback
  if(best===null){try{if(localStorage.getItem(SAVE_KEY))return"legacy";}catch(e){}}
  return best;
}
function loadGame(){
  const slot=mostRecentSlot();
  if(slot==="legacy"){
    try{const d=JSON.parse(localStorage.getItem(SAVE_KEY));applyState(d);
      drawTerrain();MOTES=null;BLOBS=null;
      if(ST.pawns[0]){cam.x=ST.pawns[0].px*T-VW/cam.z/2;cam.y=ST.pawns[0].py*T-VH/cam.z/2;clampCam()}
      hideModal();refreshSpd();syncHUD();renderRoster();renderInspect();
      flashMsg("Run loaded — day "+dayN());banner("RUN LOADED","good");return true;}
    catch(e){return false;}
  }
  if(slot===null){flashMsg("No save found");return false;}
  return loadFromSlot(slot);
}
// slot picker overlays
function slotRowHTML(slot,mode){
  const meta=slotMeta(slot);
  const label=slot==="auto"?"AUTOSAVE":"SLOT "+slot;
  let info;
  if(meta){
    const when=meta.saved?new Date(meta.saved).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"";
    info="Day "+meta.day+" · Pop "+meta.pop+" · T"+meta.tier+" · "+meta.income+"c"+(when?" · "+when:"");
  }else info="<span style='opacity:.5'>empty</span>";
  const canAct=mode==="save"?(slot!=="auto"):!!meta;
  const act=mode==="save"?"save":"load";
  return "<div class='slot-row "+(meta?"filled":"")+"'>"+
    "<div class='slot-meta'><div class='slot-name'>"+label+"</div><div class='slot-info'>"+info+"</div></div>"+
    (canAct?"<button class='tb' data-slot='"+slot+"' data-slotact='"+act+"'>"+(mode==="save"?"SAVE":"LOAD")+"</button>":"")+
    (meta&&slot!=="auto"?"<button class='tb warnb' data-slot='"+slot+"' data-slotact='del'>✕</button>":"")+
    "</div>";
}
function openSaveSlots(){
  OV.view="slots";OV.slotMode="save";
  $("overlay").classList.add("open");
  $("ov-title").textContent="SAVE GAME";
  $("ov-tabs").style.display="none";$("ov-tabs").innerHTML="";
  let h="<div class='slot-list'>";
  for(const n of SLOTS)h+=slotRowHTML(n,"save");
  h+=slotRowHTML("auto","load"); // autosave is load-only here
  h+="</div>";
  $("ov-body").innerHTML=h;
}
function openLoadSlots(){
  OV.view="slots";OV.slotMode="load";
  $("overlay").classList.add("open");
  $("ov-title").textContent="LOAD GAME";
  $("ov-tabs").style.display="none";$("ov-tabs").innerHTML="";
  let h="<div class='slot-list'>";
  for(const n of SLOTS)h+=slotRowHTML(n,"load");
  h+=slotRowHTML("auto","load");
  h+="</div>";
  $("ov-body").innerHTML=h;
}

/* ============================================================
   GAME START / MAIN LOOP
   ============================================================ */
function newGame(){
  ST.phase="run";ST.tick=0;ST.speed=1;ST.paused=false;
  ST.pawns.length=0;ST.beams.length=0;ST.floats.length=0;ST.says=[];ST.election=null;ST.electionQueue=[];
  ST.grp={};ST.sel=[];ST.goods={data:0,chem:0,parts:0,stims:0,gear:0,food:0,scrap:0};ST.income=200;ST.debtDays=0;ST.crisis=false;ST.gangs=[];
  ST.stats={built:0,deaths:0};ST.milestones=[];ST.tierReached=1;
  ST.mov={support:5,exposure:0,intel:0,cells:0,stance:"hidden",doctrine:null,foundedTick:0};
  ST.regime={grip:60,awareness:0,lastSweep:0,informants:[]};
  ST.director={tension:0.2,phase:"buildup",phaseSince:0,peakCount:0,lastEvent:0};   // (§3) Brain B director
  ST.cases=[];ST.caseSeq=0;
  setTimeout(showTutorialHints,500); // show after render
  ST.flags={};setTool(null);closeSub();
  genMap();drawTerrain();
  const cx=64,cy=50;  // core center
  const vex=mkPawn(58,46,"sal");  // plaza area
  vex.name="Vex";Object.assign(vex.pers,{ind:40,cau:30,soc:60,cur:80,amb:55,emp:55,imp:70,intg:35});vex.accent=tempCols(vex.pers)[0];vex.sched=mkSched(vex.pers,vex.tr);
  vex.mem=[{d:0,h:6,t:"carved out a place in this sprawl alongside Static"},{d:0,h:6,t:"I move fast and don't sweat the rules — it's what's kept me breathing"}];
  ST.pawns.push(vex);
  const sta=mkPawn(68,46,"bld");  // plaza area
  sta.name="Static";Object.assign(sta.pers,{ind:80,cau:65,soc:45,cur:25,amb:60,emp:50,imp:25,intg:75});sta.accent=tempCols(sta.pers)[0];sta.sched=mkSched(sta.pers,sta.tr);
  sta.mem=[{d:0,h:6,t:"settled into this block with Vex — somebody's got to keep it running straight"},{d:0,h:6,t:"I grind steady and careful; Vex thinks I'm too slow about it"}];
  ST.pawns.push(sta);
  // populace — scatter procedural agents near the core (not across the whole 140x100 map)
  // NAMED ROLE-WISPS — the district's power structure & civic pillars, present from turn one.
  {const roleKeys=["doctor","shopkeeper","enforcer","mayor","informant","fixer"];
   for(const rk of roleKeys){const R0=ROLES[rk];
     // find this role's workplace building (if any) so we can post them there
     let workS=null;
     if(R0.workType){for(const s of ST.structs.values()){if(s.type===R0.workType&&!s.bp){workS=s;break;}}}
     // spawn near the workplace if found, else anywhere walkable in the core
     let placed=false,tries=0;
     while(tries<2000&&!placed){tries++;
       let x,y;
       if(workS){x=clamp(workS.x+RI(-2,2),1,MW-2);y=clamp(workS.y+RI(-2,2),1,MH-2);}
       else{x=RI(44,92);y=RI(30,74);}
       if(colCost(x,y)<0)continue;
       if(ST.pawns.some(q=>(q.px|0)===x&&(q.py|0)===y))continue;
       const rp=mkRoleWisp(x,y,rk);
       // ASSIGN them to their post so the job system keeps them working there (the panel + interaction)
       if(workS)rp.assigned=K(workS.x,workS.y);
       ST.pawns.push(rp);placed=true;}}}
  // fill the rest of the starting population with procedural citizens
  {let tries=0;while(ST.pawns.length<POP&&tries<4000){tries++;
    const x=RI(40,96),y=RI(28,78);  // within the built-up core region
    if(colCost(x,y)<0)continue;
    if(ST.pawns.some(q=>(q.px|0)===x&&(q.py|0)===y))continue;
    ST.pawns.push(mkPawn(x,y))}}
  {let hi=0;const regularHomes=ST.cityHomes.filter(h=>!h.fixerRoom);for(const p of ST.pawns){const home=regularHomes[hi%regularHomes.length];hi++;claimHome(p,home);p.attach=RI(3,12);}}
  // THE AVATAR — your operative. Starts crashing in the FIXER'S BACK ROOM (the motel-room beginning):
  // a borrowed pod in the fixer's quarters while you scrape together money and work your way up.
  {const av=mkAvatar(51,71,window.PENDING_AVATAR||null);   // spawn AT the fixer-room pod
   ST.pawns.push(av);
   const ah=ST.fixerHome||ST.cityHomes[0];if(ah){claimHome(av,ah);av.attach=2;}  // low attach — it's borrowed, not owned
   av.startedAtFixer=true;
   // ── BASE OF OPERATIONS — the fixer's borrowed room is the SEED of your HQ. You develop it over time by
   //    building STATIONS (Planning Table, Workbench, Surveillance Hub, Server Room, Safe Room) that each
   //    unlock a piece of the espionage economy. ST.hq tracks the base + which stations are built. It starts
   //    UNCLAIMED (still the fixer's); claiming it (a small story beat / first investment) makes it yours.
   ST.hq={claimed:false, room:ST.fixerHome||null, stations:{}, foundedTick:0};
   ST.sel=[av];  // start with your operative selected
  }
  cam.z=1.4;  // start zoomed into the core on the bigger map
  cam.x=64*T-VW/cam.z/2;cam.y=50*T-VH/cam.z/2;clampCam();
  ST.lastCrackdown=0;ST.nextEv=Math.floor(TPD*1.25);ST.requests=[];ST.rel={};ST.relMeta={};ST.cliques=[];ST.contrabandPolicy="crackdown";ST.hintsSeen={};ST.pendingDisaster=null;ST.blackoutUntil=0;ST.caravan=null;relAdj(vex.id,sta.id,25);ST.sabotages=[];ST.heat=0;ST.heatWarn=false;
  $("log").innerHTML="";DIARY_ENTRIES.length=0;CHRONICLE.length=0;renderDiary();renderRoster();
  log("The sprawl wakes — citizens drifting to homes, jobs, and the night's vices.","info");
  log("You watch over the district. Build it out, steer who you can, and keep the block from tearing itself apart.","info");
  syncHUD();renderInspect();refreshSpd();hideModal();
  banner("DAY 1 — THE SPRAWL","good")}

// ── PERF HUD (press P) — self-contained DOM overlay; measures real frame rate in-browser, incl. fullscreen ──
let PERF_HUD=false,_fpsT=0,_fpsN=0,_fps=0;
// PERF PROFILING — accumulate per-frame time spent in tick() (simulation) vs render() (canvas draw),
// averaged over the same window as FPS. This is what turns "feels heavy" into a measured bottleneck:
// you can SEE whether the cost is simulation or rendering, which determines what to optimize.
let _tickMs=0,_renderMs=0,_tickN=0,_tickPeak=0,_renderPeak=0;
let _perfPawnAcc=0,_perfSepAcc=0,_perfTickCount=0,_perfBreakdown="";   // subsystem timing (pawnTick loop, separatePawns)
const PERF=(typeof performance!=="undefined"&&performance.now)?performance:{now:()=>Date.now()};
const perfEl=(typeof document!=="undefined")?document.createElement("div"):null;
if(perfEl){perfEl.id="perfhud";
  perfEl.style.cssText="position:fixed;top:6px;right:8px;z-index:99999;font:11px ui-monospace,Menlo,monospace;color:#39ff88;background:rgba(0,0,0,.55);padding:3px 7px;border:1px solid #1c3a2a;border-radius:3px;pointer-events:none;display:none;white-space:nowrap";
  if(document.body)document.body.appendChild(perfEl);}
function togglePerfHUD(){PERF_HUD=!PERF_HUD;if(perfEl)perfEl.style.display=PERF_HUD?"block":"none";}
let lastT=0,acc=0;
function loop(ts){requestAnimationFrame(loop);
  const dt=Math.min(60,lastT?ts-lastT:16);lastT=ts;
  if(ST.phase==="run"&&!ST.paused){
    acc+=dt;const step=100/ST.speed;let n=0;
    const _t0=PERF_HUD?PERF.now():0;
    while(acc>=step&&n<10){tick();acc-=step;n++;if(ST.phase!=="run")break}
    if(PERF_HUD&&n>0){const _td=PERF.now()-_t0;_tickMs+=_td;_tickN+=n;if(_td/n>_tickPeak)_tickPeak=_td/n;}
    if(n>=10)acc=0}
  if(ST.phase==="run"){let dx=0,dy=0;const sp=.95*dt/cam.z;
    if(KEYS.w||KEYS.arrowup)dy-=sp;
    if(KEYS.s||KEYS.arrowdown)dy+=sp;
    if(KEYS.a||KEYS.arrowleft)dx-=sp;
    if(KEYS.d||KEYS.arrowright)dx+=sp;
    if(dx||dy){cam.x+=dx;cam.y+=dy;clampCam();if(cam.follow)stopFollow();}}
  tickFollow();
  updateCamPan();   // ease the camera toward any pending event location
  // keep the operative dock's live progress fresh while an op is performing — lightweight update only
  // (touches the progress bar + status text, NOT the whole DOM, so the buttons don't flicker)
  if(ST.phase==="run"&&!ST.paused){const av=theAvatar();if(av&&(av.activeOp||(av.job&&av.job.t==="goto"))&&ST.tick%3===0)updateOpDockLive();}
  const _r0=PERF_HUD?PERF.now():0;
  render();
  if(PERF_HUD){const _rd=PERF.now()-_r0;_renderMs+=_rd;if(_rd>_renderPeak)_renderPeak=_rd;}
  // ── PERF HUD readout — refresh once per ~500ms window with averaged tick/render cost ──
  if(PERF_HUD){_fpsN++;_fpsT+=dt;if(_fpsT>=500){_fps=Math.round(_fpsN*1000/_fpsT);
    const avgTick=_tickN?(_tickMs/_tickN):0;          // ms per single tick() call
    const avgRender=_fpsN?(_renderMs/_fpsN):0;         // ms per rendered frame
    if(perfEl)perfEl.innerHTML="FPS <b>"+_fps+"</b> · pawns "+(ST.pawns?ST.pawns.length:0)+" · spd "+ST.speed
      +"<br>tick <b>"+avgTick.toFixed(2)+"</b>ms (pk "+_tickPeak.toFixed(1)+") · render <b>"+avgRender.toFixed(2)+"</b>ms (pk "+_renderPeak.toFixed(1)+")"
      +(ST.paused?"<br>PAUSED":(_perfBreakdown?"<br>"+_perfBreakdown:""));
    _fpsN=0;_fpsT=0;_tickMs=0;_renderMs=0;_tickN=0;_tickPeak=0;_renderPeak=0;
    // subsystem breakdown — avg ms per tick spent in the pawn-AI loop vs the O(N²) separation pass
    if(_perfTickCount>0){const ap=_perfPawnAcc/_perfTickCount,as=_perfSepAcc/_perfTickCount;
      _perfBreakdown="pawnAI <b>"+ap.toFixed(2)+"</b>ms · sep <b>"+as.toFixed(2)+"</b>ms";}
    _perfPawnAcc=0;_perfSepAcc=0;_perfTickCount=0;}}
}

window.addEventListener("resize",resize);
resize();showStart();
requestAnimationFrame(loop);


newGame(); ST.nextEv=1e9;
const realPawn=ST.pawns.find(p=>!p.isAvatar);
if(realPawn){
  realPawn.intelSeen=realPawn.intelSeen||{};
  realPawn.intelSeen.intg=true;
  realPawn.pers.intg=90;
  realPawn.kind='pawn';
  ST.sel=[realPawn];
  const prev=opState('bribe');
  console.log('opState result:', JSON.stringify(prev));
}
