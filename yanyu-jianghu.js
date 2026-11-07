/* 烟雨江湖 · 江南旧梦 / THE MISTY JIANGHU
   数据原则（硬性）：原有 vocab-* 键原样沿用，绝不 clear / reset；所有写入都是追加或合并。
   本文件沿用 wuxia.js 的完整数据层与判题/复习规则，只替换呈现层与主题。
   升级前真实浏览器记录见 data/progress-seed.js 与 _upgrade-backup-* 。 */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const $$ = (sel,root) => Array.from((root||document).querySelectorAll(sel));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jparse = (s,fb) => { try { const v=JSON.parse(s); return v==null?fb:v; } catch(e){ return fb; } };

/* ── 安全的 localStorage 包装（隐私模式下退化为内存，不抛错） ── */
const LS = (()=>{
  try { const t=window.localStorage; t.getItem('__probe__'); return t; }
  catch(e){ const m=new Map(); return {
    getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(String(k),String(v)),
    removeItem:k=>m.delete(k), key:i=>Array.from(m.keys())[i], get length(){return m.size;} }; }
})();
const get = (k,fb) => LS.getItem(k)===null?fb:LS.getItem(k);
const set = (k,v) => { try { LS.setItem(k,String(v)); } catch(e){ toast('保存失败：浏览器存储可能已满'); } };
const getArr = (k) => { const v=jparse(get(k,'[]'),[]); return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]; };
const getAny = (k) => { const v=jparse(get(k,'[]'),[]); return Array.isArray(v)?v:[]; };
const asArr = v => Array.isArray(v)?v:jparse((typeof v==='string'&&v)?v:'[]',[]);
const getObj = (k) => { const v=jparse(get(k,'{}'),{}); return (v&&typeof v==='object'&&!Array.isArray(v))?v:{}; };
const setArr = (k,a) => set(k,JSON.stringify(a));
const setObj = (k,o) => set(k,JSON.stringify(o));

const BANK = Array.isArray(window.WORD_BANK)?window.WORD_BANK:[];
const SEED = window.PROGRESS_SEED || {sources:{},primary:''};
const INTERVALS = [0,1,3,7,15,30];           // 当天 / 1 / 3 / 7 / 15 / 30 天

/* ── 全局状态 ───────────────────────────────────────── */
let words = [];
let channelWord = [], channelPos = [];   // 卷位 ↔ 词条索引：固定种子的散列，使已学信号铺满整个频段
let mastered, review, favorites, wrong, recent, reviewArchive, practicedWrong;
let srs, daily, settings;
let index = 0, reveal = false, currentView='home';
let quiz = null, lastUtterance = '', audioEl = null;
let casePage = 0, caseState='all', caseList='all', caseQuery='';
let specGeom=null, tuneGeom=null, vuTimer=null, dragMode=null;

/* ── 载入与持久化（与上一版完全一致） ───────────────── */
function loadAll(){
  words = BANK.concat(getAny('vocab-custom-words').filter(x=>x&&typeof x==='object').map(x=>({
    word:x.word||'', phonetic:x.phonetic||'', definition:x.definition||'',
    memory:x.memory||'', example:x.example||'', list:x.list||'我添加的词', custom:true
  })));
  /* 每个单词分配一个固定的「频率位」。用固定种子散列原词库顺序，
     让已掌握/待温的词散布在 87.5—108.0 全频段，而不是按字母顺序挤在左端。
     自建词追加在末尾，新增自建词不会改变原有词的频率位。 */
  const base=Array.from({length:BANK.length},(_,i)=>i);
  let s=20261107;
  const rnd=()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; };
  for(let i=base.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=base[i];base[i]=base[j];base[j]=t; }
  channelWord=base.concat(Array.from({length:Math.max(0,words.length-BANK.length)},(_,k)=>BANK.length+k));
  channelPos=new Array(words.length);
  channelWord.forEach((wi,p)=>{ channelPos[wi]=p; });
  mastered = new Set(getArr('vocab-mastered'));
  review = new Set(getArr('vocab-review'));
  favorites = new Set(getArr('vocab-favorites'));
  wrong = new Set(getArr('vocab-dict-missed'));
  recent = getArr('vocab-recent').slice(0,10);
  reviewArchive = new Set(getArr('vocab-review-archive'));
  practicedWrong = new Set(getArr('vocab-wrong-practiced'));
  srs = getObj('vocab-srs');
  daily = getObj('vocab-daily-log');
  settings = getObj('vocab-settings');
  index = Math.max(0, Math.min(words.length-1, parseInt(get('vocab-pos','0'),10)||0));
}
function persist(){
  setArr('vocab-mastered',Array.from(mastered));
  setArr('vocab-review',Array.from(review));
  setArr('vocab-recent',recent);
  setArr('vocab-favorites',Array.from(favorites));
  setArr('vocab-dict-missed',Array.from(wrong));
  setArr('vocab-review-archive',Array.from(reviewArchive));
  setArr('vocab-wrong-practiced',Array.from(practicedWrong));
  setObj('vocab-srs',srs);
  setObj('vocab-daily-log',daily);
  setObj('vocab-settings',settings);
  set('vocab-pos',String(index));
}

/* ── 日期工具 ───────────────────────────────────────── */
const pad = n => String(n).padStart(2,'0');
function dayKey(d){ d=d||new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function addDays(n){ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return dayKey(d); }
const TODAY = () => dayKey();
function prettyDate(k){ if(!k) return '—'; const p=k.split('-'); return p[1]+'/'+p[2]; }

/* ── 迁移：把升级前浏览器里的真实练功记录带到新站点 ────── */
function snapshotOrigin(){
  if(LS.getItem('vocab-v2-local-snapshot')) return;
  const snap={};
  for(let i=0;i<LS.length;i++){
    const k=LS.key(i);
    if(k&&k.indexOf('vocab-')===0&&k.indexOf('vocab-v2-')!==0) snap[k]=LS.getItem(k);
  }
  setObj('vocab-v2-local-snapshot',snap);
}
function sourceStats(src){
  const m=asArr(src['vocab-mastered']), r=asArr(src['vocab-review']);
  return {mastered:Array.isArray(m)?m.length:0, review:Array.isArray(r)?r.length:0,
          pos:src['vocab-pos']||'0', keys:Object.keys(src).length};
}
function applySource(name,src,silent){
  /* 只做「并集」合并，保证任何来源的记录都不会被覆盖丢失；标量键取所选来源 */
  const merge = key => {
    const cur=new Set(getArr(key));
    const add=asArr(src[key]);
    add.forEach(x=>{ if(typeof x==='string') cur.add(x); });
    setArr(key,Array.from(cur));
  };
  ['vocab-mastered','vocab-review','vocab-recent','vocab-dict-missed','vocab-sent-mastered','vocab-sent-review'].forEach(merge);
  Object.keys(src).forEach(k=>{
    if(k===THEME_KEY) return;
    if(['vocab-mastered','vocab-review','vocab-recent','vocab-dict-missed','vocab-sent-mastered','vocab-sent-review'].indexOf(k)>=0) return;
    if(k.indexOf('vocab-')===0) set(k,typeof src[k]==='string'?src[k]:JSON.stringify(src[k]));
  });
  set('vocab-v2-migrated','1');
  set('vocab-v2-migrated-from',name);
  loadAll(); seedSrs(); persist();
  if(!silent) toast('已恢复数据源：'+name+'（与现有记录合并，未删除任何记录）');
}
function ensureMigration(){
  if(LS.getItem('vocab-v2-migrated')==='1') return;
  snapshotOrigin();
  const has=LS.getItem('vocab-mastered')!==null;
  const cur=getArr('vocab-mastered');
  const primary=SEED.primary;
  if((!has||cur.length===0) && SEED.sources[primary]) applySource(primary,SEED.sources[primary],true);
  else { set('vocab-v2-migrated','1'); set('vocab-v2-migrated-from','当前站点原有记录'); }
}
/* 把旧状态映射到信号格：只补空缺，不覆盖任何已有复习记录 */
function seedSrs(){
  let changed=false;
  const ensure=(w,obj)=>{ if(!w) return; if(!srs[w]){ srs[w]=obj; changed=true; } };
  review.forEach(w=>ensure(w,{level:1,due:TODAY(),times:1,wrong:0,seed:1}));
  wrong.forEach(w=>ensure(w,{level:0,due:TODAY(),times:0,wrong:Math.max(1,(srs[w]||{}).wrong||0),seed:1}));
  mastered.forEach(w=>{
    if(!srs[w]){ srs[w]={level:6,due:addDays(30),times:6,wrong:0,seed:1}; changed=true; }
    else if(srs[w].seed && srs[w].level<6){ srs[w].level=6; srs[w].due=addDays(30); changed=true; }
  });
  reviewArchive = new Set(Array.from(reviewArchive).concat(Array.from(review)));
  if(changed) setObj('vocab-srs',srs);
}
function levelOf(w){
  if(srs[w]&&typeof srs[w].level==='number') return srs[w].level;
  return mastered.has(w)?6:0;
}
function dueOf(w){
  if(review.has(w)) return TODAY();
  return (srs[w]&&srs[w].due)||'';
}
function dueList(){
  const out=[], seen=new Set();
  Object.keys(srs).forEach(w=>{
    const st=srs[w];
    if(!st||!st.due||st.due>TODAY()) return;
    if(levelOf(w)>0||(st.wrong||0)>0||review.has(w)){ out.push(w); seen.add(w); }
  });
  review.forEach(w=>{ if(!seen.has(w)&&!srs[w]) out.push(w); });
  return Array.from(new Set(out));
}
function inkedCount(){
  let n=0; for(let i=0;i<BANK.length;i++){ const w=BANK[i].word; if(levelOf(w)>0||mastered.has(w)||review.has(w)||wrong.has(w)) n++; }
  return n;
}
function streakDays(){
  let n=0; const d=new Date(); d.setHours(12,0,0,0);
  for(let i=0;i<400;i++){
    const k=dayKey(d);
    if(daily[k] && (daily[k].new&&daily[k].new.length || daily[k].reviewed&&daily[k].reviewed.length || daily[k].q)) n++;
    else if(i>0) break;
    d.setDate(d.getDate()-1);
  }
  return n;
}
function logDay(kind,w){
  const k=TODAY(); if(!daily[k]) daily[k]={new:[],reviewed:[],q:0,correct:0};
  const d=daily[k];
  if(kind==='new' && d.new.indexOf(w)<0) d.new.push(w);
  if(kind==='review' && d.reviewed.indexOf(w)<0) d.reviewed.push(w);
  if(kind==='q') d.q++;
  if(kind==='correct') d.correct++;
  setObj('vocab-daily-log',daily);
}
function pushRecent(w){
  recent=[w].concat(recent.filter(x=>x!==w)).slice(0,10);
  setArr('vocab-recent',recent);
}

/* ── 频道编号 / 频率换算 ─────────────────────────────── */
function freqAtPos(p){ return wordAtPos(p)+1; }
function freqPosText(p){ return String(freqAtPos(p)).padStart(4,'0'); }
function freqText(i){ return String(i+1).padStart(4,'0'); }
function chText(i){ return String(i+1).padStart(4,'0'); }
function posOfWord(i){ return channelPos[i]||0; }
function wordAtPos(p){ return channelWord[p]==null?p:channelWord[p]; }

/* ── 提示与反馈 ─────────────────────────────────────── */
let toastTimer=null;
function toast(msg){
  const t=$('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
}
function signalFx(text){
  const el=$('signalFx'); if(!el) return;
  el.textContent=text; el.classList.remove('go');
  void el.offsetWidth; el.classList.add('go');
}

/* ── VU 电平表：只在朗读期间短暂运行 ────────────────── */
function vuStart(){
  vuStop();
  const rows=[$('vuRow'),$('shadowVu')].filter(Boolean);
  rows.forEach(r=>{ if(!r.children.length) for(let i=0;i<14;i++) r.appendChild(document.createElement('i')); });
  vuTimer=setInterval(()=>{
    const amp=4+Math.floor(Math.random()*13);
    rows.forEach(r=>$$('i',r).forEach((b,i)=>{
      const h=4+Math.max(0,amp-Math.abs(i-6)*1.5)*(0.55+Math.random()*0.6);
      b.classList.add('live'); b.style.height=Math.min(26,h)+'px';
    }));
  },110);
}
function vuStop(){
  if(vuTimer){ clearInterval(vuTimer); vuTimer=null; }
  [$('vuRow'),$('shadowVu')].forEach(r=>{ if(r) $$('i',r).forEach(b=>{ b.classList.remove('live'); b.style.height=''; }); });
}

/* ── 发音 ───────────────────────────────────────────── */
function audioRate(){ return parseFloat(get('vocab-rate','0.8'))||0.8; }
function audioSource(){ return settings.audioSource||get('vocab-audio-source','browser')||'browser'; }
function playOnline(text,isSentence,tryBrowser){
  if(audioEl){ try{audioEl.pause();}catch(e){} }
  const url=isSentence
    ? 'https://fanyi.baidu.com/gettts?lan=en&text='+encodeURIComponent(text)+'&spd=3&source=web'
    : 'https://dict.youdao.com/dictvoice?audio='+encodeURIComponent(text)+'&type=2';
  const a=new Audio(url); audioEl=a;
  a.playbackRate=Math.max(0.5,Math.min(2,audioRate()*1.25));
  a.onended=vuStop;
  a.onerror=()=>{
    vuStop();
    if(tryBrowser && 'speechSynthesis' in window){
      const u=new SpeechSynthesisUtterance(text); u.lang='en-US'; u.rate=audioRate();
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } else toast('在线发音不可用，请在工坊中切换为浏览器朗读');
  };
  a.play().catch(()=>a.onerror&&a.onerror());
}
function speak(text,force){
  if(!text) return;
  text=String(text).trim();
  lastUtterance=text;
  const isSentence=/\s/.test(text)||text.length>30;
  const src=audioSource();
  vuStart();
  if(force==='online'||src==='online'){ playOnline(text,isSentence,true); setTimeout(vuStop,6000); return; }
  if('speechSynthesis' in window){
    try{
      const u=new SpeechSynthesisUtterance(text);
      u.lang='en-US'; u.rate=audioRate(); u.pitch=1;
      const vs=window.speechSynthesis.getVoices()||[];
      const v=vs.find(x=>/en[-_]US/i.test(x.lang))||vs.find(x=>/^en/i.test(x.lang));
      if(v) u.voice=v;
      u.onend=vuStop;
      u.onerror=()=>{ vuStop(); playOnline(text,isSentence,false); };
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
      setTimeout(vuStop,8000);
      return;
    }catch(e){}
  }
  playOnline(text,isSentence,false);
  setTimeout(vuStop,6000);
}
function repeatAudio(){ if(lastUtterance) speak(lastUtterance); else toast('先播放一次，才能重复'); }

/* ── 词条解析（只从原词库派生，不编造资料） ──────────── */
function posOf(def){
  const m=String(def||'').match(/^\s*(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux|pl|abbr)\s*\./i);
  return m?m[1]+'.':'';
}
function exampleParts(raw){
  if(!raw) return null;
  const first=String(raw).split('//')[0].trim();
  let i=-1;
  for(let k=0;k<first.length;k++){ if(/[\u4e00-\u9fff]/.test(first[k])){ i=k; break; } }
  if(i<=0) return {en:first,cn:''};
  return {en:first.slice(0,i).trim(),cn:first.slice(i).trim()};
}
function phraseOf(memory){
  const m=String(memory||'').match(/(?:【搭】|搭配[:：])([^；;【】]+)/);
  return m?m[1].trim():'';
}
function shortDef(w,n){ return String(w.definition||'').replace(/\s+/g,' ').slice(0,n||34); }
function wordByName(w){ for(let i=0;i<words.length;i++) if(words[i].word===w) return words[i]; return null; }
function idxByName(w){ for(let i=0;i<words.length;i++) if(words[i].word===w) return i; return -1; }
function barsHTML(lv,cls){
  return Array.from({length:6},(_,k)=>'<i class="'+(lv>=6?'done':(k<lv?'on':''))+'"></i>').join('');
}

/* ── Canvas：谱页全图 / 调谐刻度 / 波形 ───────────────── */
function fitCanvas(c,h){
  if(!c) return null;
  const W=Math.max(120,c.clientWidth||300), H=h||c.clientHeight||100;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  c.width=Math.round(W*dpr); c.height=Math.round(H*dpr);
  const ctx=c.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  return {ctx,W,H};
}
function renderSpectrum(){
  const c=$('spectrumCanvas'); if(!c) return;
  const g=fitCanvas(c); if(!g) return;
  const {ctx,W,H}=g;
  specGeom={W,H,n:words.length};
  ctx.fillStyle=TH.paper; ctx.fillRect(0,0,W,H);
  const sweep=(y,amp,alpha)=>{
    ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=TH.ink2;
    ctx.beginPath(); ctx.moveTo(0,y);
    ctx.bezierCurveTo(W*.18,y-amp,W*.34,y+amp*.7,W*.52,y-amp*.35);
    ctx.bezierCurveTo(W*.70,y-amp*.9,W*.84,y+amp*.5,W,y-amp*.25);
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  sweep(H*.52,26,.07); sweep(H*.62,18,.10);
  ctx.save(); ctx.globalAlpha=.92; ctx.fillStyle=TH.ink;
  ctx.beginPath(); ctx.moveTo(0,H*.46);
  ctx.bezierCurveTo(W*.20,H*.34,W*.40,H*.56,W*.60,H*.40);
  ctx.bezierCurveTo(W*.78,H*.26,W*.90,H*.42,W,H*.35);
  ctx.lineTo(W,H*.43);
  ctx.bezierCurveTo(W*.88,H*.50,W*.76,H*.36,W*.60,H*.49);
  ctx.bezierCurveTo(W*.40,H*.65,W*.20,H*.43,0,H*.55);
  ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha=.5; ctx.strokeStyle=TH.paper; ctx.lineWidth=1;
  [[.10,.45,.26,.44],[.34,.50,.50,.46],[.64,.40,.82,.40]].forEach(s=>{
    ctx.beginPath(); ctx.moveTo(W*s[0],H*s[1]); ctx.lineTo(W*s[2],H*s[3]); ctx.stroke();
  }); ctx.restore();
  const lists=[], map={};
  words.forEach(o=>{
    const L=o.list||'其他';
    if(!map[L]){ map[L]={n:0,d:0}; lists.push(L); }
    map[L].n++; if(levelOf(o.word)>0) map[L].d++;
  });
  const dueLists=new Set(); dueList().forEach(w=>{ const o=wordByName(w); if(o) dueLists.add(o.list); });
  const rows=2, cols=16, pad=12, gapX=3, gapY=7;
  const cw=(W-pad*2-gapX*(cols-1))/cols;
  const ch=(H-pad*2-26-gapY*(rows-1))/rows;
  for(let i=0;i<32;i++){
    const L=lists[i]||'', m=map[L]||{n:1,d:0};
    const x=pad+(i%cols)*(cw+gapX), y=pad+22+Math.floor(i/cols)*(ch+gapY);
    ctx.strokeStyle=TH.line; ctx.lineWidth=.8; ctx.strokeRect(x+.5,y+.5,cw-1,ch-1);
    const ratio=Math.min(1,m.d/Math.max(1,m.n));
    if(ratio>0){ ctx.fillStyle=TH.ink; ctx.globalAlpha=.30+ratio*.65;
      ctx.fillRect(x+1,y+ch-2-(ch-4)*ratio,cw-2,(ch-4)*ratio); ctx.globalAlpha=1; }
    if(dueLists.has(L)){ ctx.fillStyle=TH.seal; ctx.fillRect(x+1,y+1,cw-2,3); }
    ctx.fillStyle=TH.ink2; ctx.font='9px Consolas, monospace';
    ctx.fillText(String(i+1).padStart(2,'0'),x+3,y+11);
  }
  ctx.fillStyle=TH.ink2; ctx.font='10px '+TH.fontFamily;
  ctx.fillText('词 谱 01—32　·　墨色深浅即各词熟稔',pad,14);
  ctx.textAlign='right'; ctx.fillText('已补 '+inkedCount()+' 词 / '+words.length, W-pad,14); ctx.textAlign='left';
  $('spectrumCount').textContent=inkedCount()+' / '+words.length+' 词已习';
}
function renderTuneCanvas(){
  const c=$('tuneCanvas'); if(!c) return;
  const g=fitCanvas(c); if(!g) return;
  const {ctx,W,H}=g;
  tuneGeom={W,H,n:words.length};
  ctx.fillStyle=TH.paper; ctx.fillRect(0,0,W,H);
  for(let t=0;t<=32;t++){
    const x=Math.round(t/32*W)+.5, major=t%8===0;
    ctx.strokeStyle=major?TH.ink3:TH.line; ctx.lineWidth=major?1:.6;
    ctx.beginPath(); ctx.moveTo(x,major?5:14); ctx.lineTo(x,H-13); ctx.stroke();
  }
  const shades=[TH.mist,TH.mist,TH.ink3,TH.ink2,TH.ink2,TH.ink], seg=W/6;
  for(let i=0;i<6;i++){
    ctx.globalAlpha=i<2?.65:(i<4?.85:1); ctx.fillStyle=shades[i];
    ctx.fillRect(i*seg+1,H-11,seg-2,9);
  }
  ctx.globalAlpha=1;
  ctx.strokeStyle=TH.line; ctx.beginPath(); ctx.moveTo(0,H-.5); ctx.lineTo(W,H-.5); ctx.stroke();
}
function renderHeadWave(){
  const c=$('headWave'); if(!c) return;
  const g=fitCanvas(c); if(!g) return;
  const {ctx,W,H}=g;
  ctx.strokeStyle=TH.ink; ctx.lineWidth=1.4; ctx.beginPath();
  for(let x=0;x<=W;x+=2){
    const t=x/W;
    const y=H/2+Math.sin(t*21)*H*.19+Math.sin(t*47+1.2)*H*.11+Math.sin(t*8)*H*.14;
    x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.stroke();
}
function renderWordWave(){
  const c=$('wordWave'); if(!c) return;
  const g=fitCanvas(c); if(!g) return;
  const {ctx,W,H}=g;
  const w=(words[index]||{}).word||'';
  let seed=0; for(let i=0;i<w.length;i++) seed=(seed*31+w.charCodeAt(i))>>>0;
  const rnd=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  ctx.strokeStyle=TH.ink2; ctx.lineWidth=1.2; ctx.beginPath();
  for(let x=0;x<=W;x+=3){
    const t=x/W, env=Math.sin(Math.PI*t);
    const y=H*.55+env*(Math.sin(t*18+seed%7)*H*.13+(rnd()-.5)*H*.09);
    x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.strokeStyle=TH.seal; ctx.lineWidth=1; ctx.beginPath();
  for(let x=0;x<=W;x+=3){
    const t=x/W, y=H*.55+Math.sin(Math.PI*t)*Math.sin(t*11+2)*H*.10;
    x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.stroke();
}
function renderLogWave(){
  const c=$('logWave'); if(!c) return;
  const g=fitCanvas(c); if(!g) return;
  const {ctx,W,H}=g;
  ctx.fillStyle=TH.paper; ctx.fillRect(0,0,W,H);
  for(let i=0;i<=6;i++){
    const y=Math.round(i/6*(H-20))+10.5;
    ctx.strokeStyle=TH.line; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  const days=[]; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push(dayKey(d)); }
  const vals=days.map(k=>{ const x=daily[k]||{}; return (x.new||[]).length+(x.reviewed||[]).length+(x.q||0); });
  if(vals.every(v=>!v)){
    ctx.strokeStyle='rgba(224,164,92,.45)'; ctx.lineWidth=1.2; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(15,H-18); ctx.lineTo(W-15,H-18); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(201,214,210,.6)'; ctx.font='12px sans-serif'; ctx.textAlign='center';
    ctx.fillText('尚无修习记录 · 今天开始学习后，这里会出现你的波形',W/2,H/2-4);
    ctx.font='9px Consolas, monospace'; ctx.fillStyle='rgba(140,175,170,.45)';
    ctx.fillText('NO PRACTICE YET',W/2,H/2+16);
    ctx.textAlign='left';
    return;
  }
  const mx=Math.max(1,...vals), bw=(W-30)/14;
  vals.forEach((v,i)=>{
    const h=v/mx*(H-42), x=15+i*bw+bw*.18, y=H-18-h;
    ctx.fillStyle=i===13?TH.seal:TH.ink2;
    ctx.fillRect(x,y,bw*.64,Math.max(2,h));
    ctx.fillStyle=TH.ink2; ctx.font='9px Consolas, monospace';
    ctx.textAlign='center'; ctx.fillText(String(v||''),x+bw*.32,y-5);
    ctx.fillStyle=TH.ink3; ctx.fillText(days[i].slice(8),x+bw*.32,H-5);
  });
  ctx.textAlign='left';
}
function needlePct(i){ return posPct(posOfWord(i)); }
function posPct(p){ return (p/Math.max(1,words.length-1)*100).toFixed(3)+'%'; }

/* ── 首页 / ON AIR ──────────────────────────────────── */
function renderHome(){
  const d=new Date();
  $('homeDate').textContent=pad(d.getMonth()+1)+'.'+pad(d.getDate());
  $('homeWeekday').textContent=['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()]+' / TODAY';
  const due=dueList();
  const td=daily[TODAY()]||{new:[],reviewed:[]};
  const goal=parseInt(settings.dailyGoal||'12',10)||12;
  $('stNew').textContent=(td.new||[]).length;
  $('stDue').textContent=due.length;
  $('stMastered').textContent=mastered.size;
  $('stStreak').textContent=streakDays();
  const pct=Math.round(inkedCount()/Math.max(1,words.length)*100);
  $('stProgress').textContent=pct+'%';
  $('covFill').style.width=Math.max(2,pct)+'%';
  $('covNote').textContent='已习 '+inkedCount()+' / '+words.length+' 词 · 已掌握 '+mastered.size+' 词';
  $('homeFreq').textContent=freqText(index);
  $('homeCh').textContent=chText(index);
  $('homeNeedle').style.left=needlePct(index);
  // KV 主视觉数据
  const kvCount=$('kvCount'); if(kvCount) kvCount.textContent=inkedCount();
  const kvNote=$('kvNote'); if(kvNote) kvNote.innerHTML='已习 <b>'+inkedCount()+'</b> / '+words.length+' 词 · 已掌握 <b>'+mastered.size+'</b> 词';

  // 今日词笺：先温习，再新学
  const fresh=[];
  for(let i=0;i<words.length&&fresh.length<goal;i++){
    const w=words[i].word;
    if(levelOf(w)===0&&!review.has(w)&&!wrong.has(w)&&fresh.indexOf(w)<0) fresh.push(w);
  }
  const all=due.slice(0,8).concat(fresh.filter(w=>due.indexOf(w)<0)).slice(0,14);
  $('presetMeta').textContent='回访 '+due.length+' 枚 · 新频 '+fresh.length+' 枚 · 目标 '+goal+' 枚';
  $('presetStrip').innerHTML=all.length?all.map((w,i)=>{
    const o=wordByName(w), ix=idxByName(w), lv=levelOf(w);
    return '<button class="preset'+(i<Math.min(8,due.length)?' due':'')+'" data-word="'+esc(w)+'">'+
      '<span class="pf"><span>第 '+freqText(ix<0?0:ix)+'</span><i>'+(i<Math.min(8,due.length)?'待温':'新补')+'</i></span>'+
      '<b>'+esc(w)+'</b><small>'+esc(o?shortDef(o,18):'—')+'</small>'+
      '<span class="pb">'+Array.from({length:6},(_,k)=>'<i class="'+(k<lv?'on':'')+'"></i>').join('')+'</span></button>';
  }).join(''):'<div class="empty-line">全部词汇已习清，今天只需温习。</div>';
  $$('.preset',$('presetStrip')).forEach(b=>b.onclick=()=>jumpTo(b.dataset.word));

  // 不辍功 14 天
  let dw='';
  for(let i=13;i>=0;i--){
    const dd=new Date(); dd.setDate(dd.getDate()-i); const k=dayKey(dd);
    const x=daily[k]||{}, n=(x.new||[]).length+(x.reviewed||[]).length+(x.q||0);
    dw+='<div class="dw'+(n?' on':'')+(i===0?' today':'')+'" title="'+k+' · '+n+' 次"><span>'+(n||'')+'</span><i style="height:'+(n?Math.max(8,Math.min(88,n*11)):3)+'%"></i></div>';
  }
  $('dayWave').innerHTML=dw;
  $('recentTape').innerHTML=recent.length?recent.map((w,i)=>{
    const o=wordByName(w);
    return '<div class="tape-row" data-word="'+esc(w)+'"><time>'+String(i+1).padStart(2,'0')+':00</time>'+
      '<span><b>'+esc(w)+'</b> · '+esc(o?shortDef(o,26):'')+'</span><em>'+(mastered.has(w)?'稳定':(review.has(w)?'待回访':'已收'))+'</em></div>';
  }).join(''):'<div class="empty-line">还没有修习记录，去词谱全图里挑一个词吧。</div>';
  $$('.tape-row',$('recentTape')).forEach(r=>r.onclick=()=>openDetail(r.dataset.word));
  renderSpectrum();
}

/* ── 收词 / RECEIVE ─────────────────────────────────── */
function poolIndices(){
  const scope=$('studyScope').value;
  const out=[];
  for(let i=0;i<words.length;i++){
    const w=words[i].word;
    let ok=true;
    if(scope==='unmastered') ok=!mastered.has(w);
    else if(scope==='review') ok=review.has(w)||dueList().indexOf(w)>=0;
    else if(scope==='favorites') ok=favorites.has(w);
    else if(scope==='wrong') ok=wrong.has(w);
    else if(scope==='list') ok=words[i].list===(words[index]||{}).list;
    if(ok) out.push(i);
  }
  return out.length?out:[index];
}
function step(dir,random){
  const pool=poolIndices();
  if(random){ index=pool[Math.floor(Math.random()*pool.length)]; }
  else {
    let p=pool.indexOf(index);
    if(p<0) p=0;
    index=pool[(p+dir+pool.length)%pool.length];
  }
  reveal=false;
  set('vocab-pos',String(index));
  pushRecent(words[index].word);
  renderStudy(true);
  if(settings.autoSpeak) speak(words[index].word);
}
function tuneTo(i){
  index=Math.max(0,Math.min(words.length-1,i));
  reveal=false; set('vocab-pos',String(index)); pushRecent(words[index].word);
  renderStudy(true);
}
function jumpTo(w){
  const i=idxByName(w); if(i<0) return;
  index=i; $('studyScope').value='all';
  reveal=false; set('vocab-pos',String(index)); pushRecent(w);
  closeOverlays(); switchView('study'); renderStudy(true);
}
function renderStudy(feed){
  if(!words.length){ $('tbWord').textContent='词库未载入'; return; }
  index=Math.max(0,Math.min(words.length-1,index));
  const w=words[index], lv=levelOf(w.word), st=srs[w.word]||{};
  $('studyNo').textContent='卷 '+chText(index);
  $('studyList').textContent='卷 '+String(w.list||'—').replace('Word List ','');
  $('twTag').textContent='第 '+freqText(index)+' 词';
  $('tuneReadout').textContent=freqText(index)+' 词';
  $('twBars').innerHTML=Array.from({length:6},(_,k)=>'<i class="'+(k<lv?'on':'')+'"></i>').join('');
  $('tbWord').textContent=w.word;
  $('tbWord').classList.toggle('long',w.word.length>12);
  $('tbPhonetic').textContent=w.phonetic||'';
  const p=posOf(w.definition);
  $('tbPos').hidden=!p; $('tbPos').textContent=p;
  $('tbDef').textContent=w.definition||'—';
  const ex=exampleParts(w.example);
  $('tbExampleRow').hidden=!ex;
  if(ex){ $('tbExampleEn').textContent=ex.en; $('tbExampleCn').textContent=ex.cn; }
  $('btnSpeakExample').hidden=!ex || !ex.en;
  const ph=phraseOf(w.memory);
  $('tbPhraseRow').hidden=!ph; $('tbPhrase').textContent=ph;
  $('tbMemoryRow').hidden=!w.memory; $('tbMemory').textContent=w.memory||'';
  $('btnFav').classList.toggle('on',favorites.has(w.word));
  $('btnFav').innerHTML='<span>'+(favorites.has(w.word)?'★':'☆')+'</span> '+(favorites.has(w.word)?'已收藏':'收藏');
  $('tbAnswer').hidden=!reveal;
  $('btnReveal').querySelector('span').textContent=reveal?'收起释义':'起笔释义';
  $('btnReveal').classList.toggle('open',reveal);
  $('levelRuler').innerHTML=Array.from({length:6},(_,k)=>'<i class="'+(lv>=6?'mastered':(k<lv?'on':''))+'">'+(k+1)+'</i>').join('');
  $('metaDue').textContent=dueOf(w.word)?prettyDate(dueOf(w.word)):'—';
  $('metaTimes').textContent=st.times||lv||0;
  $('metaWrong').textContent=st.wrong||(wrong.has(w.word)?1:0);
  $('metaList').textContent='卷 '+String(w.list||'—').replace('Word List ','');
  const lamp=$('scLamp');
  lamp.className='sc-lamp'+(lv>=6?' high':(lv>0?' mid':''));
  $('scStatus').textContent=lv>=6?'已掌握':(lv>0?'修习中 · 第 '+lv+' 重':'未入谱');
  $('studyHint').textContent='范围 '+poolIndices().length+' 枚';
  $('tuneNeedle').style.left=needlePct(index);
  renderWordWave(); renderTuneCanvas();
  if(feed){
    const b=$('tuningWindow'); b.classList.remove('feed'); void b.offsetWidth; b.classList.add('feed');
    const dl=$('decodeLine'); dl.classList.remove('scan'); void dl.offsetWidth; dl.classList.add('scan');
  }
}
function markGrade(grade){
  if(!words.length) return;
  const w=words[index].word, st=srs[w]||{level:0,times:0,wrong:0,due:''};
  const wasNew=!mastered.has(w)&&!review.has(w)&&!srs[w];
  st.times=(st.times||0)+1; delete st.seed;
  if(grade==='known'){
    st.level=Math.min(6,(st.level||0)+2);
    st.due=addDays(INTERVALS[Math.min(st.level,5)]);
    if(st.level>=6){ mastered.add(w); review.delete(w); }
    else { review.add(w); reviewArchive.add(w); }
  } else if(grade==='fuzzy'){
    st.level=Math.min(5,Math.max(1,(st.level||0)));
    st.due=addDays(1); review.add(w); reviewArchive.add(w);
  } else {
    st.level=0; st.due=TODAY(); st.wrong=(st.wrong||0)+1;
    review.add(w); reviewArchive.add(w); wrong.add(w);
  }
  srs[w]=st;
  logDay(wasNew?'new':'review',w);
  persist();
  signalFx(grade==='known'?'+1':(grade==='fuzzy'?'~':'!'));
  renderHome();
  setTimeout(()=>step(1),grade==='unknown'?260:180);
}

/* ── 校频 / 训练 ────────────────────────────────────── */
let drillMode='en2cn';
function pickOptions(right,mode){
  const correct=(mode==='en2cn')?shortDef(right,26):right.word;
  const pool=words.filter(x=>x.word!==right.word && x.definition);
  const opts=[correct];
  const seen=new Set([right.word]);
  const textSeen=new Set([correct]);
  let guard=0;
  while(opts.length<4&&guard++<300&&pool.length){
    const c=pool[Math.floor(Math.random()*pool.length)];
    const t=(mode==='en2cn')?shortDef(c,26):c.word;
    if(seen.has(c.word)||textSeen.has(t)) continue;
    seen.add(c.word); textSeen.add(t); opts.push(t);
  }
  for(let i=opts.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=opts[i];opts[i]=opts[j];opts[j]=t; }
  return opts;
}
function drillPool(){
  const scope=$('drillScope').value;
  let arr=words.filter(x=>{
    if(scope==='unmastered') return !mastered.has(x.word);
    if(scope==='review') return review.has(x.word);
    if(scope==='wrong') return wrong.has(x.word);
    if(scope==='favorites') return favorites.has(x.word);
    return true;
  });
  if(drillMode==='listen'||drillMode==='spell') arr=arr.filter(x=>x.word&&x.word.length>1);
  if(!arr.length) arr=words.slice();
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=arr[i];arr[i]=arr[j];arr[j]=t; }
  return arr.slice(0,parseInt($('drillCount').value,10)||10);
}
function startQuiz(){
  const list=drillPool();
  if(!list.length){ toast('取台范围为空'); return; }
  quiz={mode:drillMode,list,i:0,right:0,wrongWords:[],answered:false};
  renderQuiz();
}
function renderQuiz(){
  const box=$('drillBody');
  if(quiz.i>=quiz.list.length){ finishQuiz(); return; }
  const q=quiz.list[quiz.i], mode=quiz.mode;
  const label={en2cn:'辨义',cn2en:'寻词',listen:'听音',spell:'默写',quick:'速温'}[mode];
  const prog='<div class="quiz-progress"><span>第 '+(quiz.i+1)+' / '+quiz.list.length+' 词</span><span>'+label+' · 第 '+freqText(idxByName(q.word)<0?0:idxByName(q.word))+'</span></div>';
  if(mode==='quick'){
    box.innerHTML='<div class="quiz-card">'+prog+
      '<div class="quiz-q">'+esc(q.word)+'</div><div class="quiz-sub">'+esc(q.phonetic||'')+'　·　'+esc(q.list||'')+'</div>'+
      '<div class="quiz-sub">先回想释义，再解码。想不起来就点「起笔释义」。</div>'+
      '<div class="quick-actions"><button class="a-key" id="qReveal">起笔释义</button>'+
      '<button class="a-key" data-q="unknown">失联</button><button class="a-key" data-q="fuzzy">杂音</button>'+
      '<button class="a-key on" data-q="known">清晰</button></div><div id="qFeedback"></div></div>';
    $('qReveal').onclick=()=>{ const f=$('qFeedback'); f.innerHTML='<div class="quiz-feedback">'+esc(q.definition)+'</div>'; };
    $$('[data-q]',box).forEach(b=>b.onclick=()=>{
      const g=b.dataset.q;
      const st=srs[q.word]||{level:0,times:0,wrong:0}; st.times=(st.times||0)+1; delete st.seed;
      if(g==='known'){ st.level=Math.min(6,(st.level||0)+1); st.due=addDays(INTERVALS[Math.min(st.level,5)]); if(st.level>=6){mastered.add(q.word);review.delete(q.word);} else {review.add(q.word);reviewArchive.add(q.word);} quiz.right++; }
      else if(g==='fuzzy'){ review.add(q.word); reviewArchive.add(q.word); st.level=Math.max(1,st.level||1); st.due=addDays(1); }
      else { st.level=0; st.due=TODAY(); st.wrong=(st.wrong||0)+1; review.add(q.word); reviewArchive.add(q.word); wrong.add(q.word); quiz.wrongWords.push(q.word); }
      srs[q.word]=st; logDay('review',q.word); persist();
      quiz.i++; renderQuiz();
    });
    return;
  }
  let head='', opts=null;
  if(mode==='en2cn'){
    head='<div class="quiz-q" id="quizQ">'+esc(q.word)+'</div><div class="quiz-sub">'+esc(q.phonetic||'')+'　选出正确释义</div>';
    opts=pickOptions(q,'en2cn');
  } else if(mode==='cn2en'){
    head='<div class="quiz-q" id="quizQ" style="font-size:clamp(21px,3vw,30px);letter-spacing:0">'+esc(q.definition)+'</div><div class="quiz-sub">选出对应的英文单词</div>';
    opts=pickOptions(q,'cn2en');
  } else if(mode==='listen'){
    head='<div class="quiz-q" id="quizQ" style="font-size:clamp(24px,4vw,38px)">◖ 听 音 ◗</div><div class="quiz-sub">点下方按钮播放发音，再选出听到的词</div>'+
      '<button class="a-key" id="qPlay" style="display:block;margin:0 auto 18px">▶ 播放单词（可重复）</button>';
    opts=pickOptions(q,'listen');
  } else {
    head='<div class="quiz-q" id="quizQ" style="font-size:clamp(21px,3vw,30px);letter-spacing:0">'+esc(q.definition)+'</div><div class="quiz-sub">'+esc(q.phonetic||'')+'　·　把单词拼出来</div>';
  }
  let body='';
  if(mode==='spell'){
    body='<input class="spell-input" id="spellInput" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入英文单词">'+
      '<div style="margin-top:10px"><button class="a-key on" id="spellGo">校 对</button></div><div id="qFeedback"></div>';
  } else {
    body='<div class="quiz-options">'+opts.map((o,i)=>'<button class="quiz-opt" data-opt="'+esc(o)+'"><i>'+'ABCD'[i]+'</i><span>'+esc(o)+'</span></button>').join('')+'</div><div id="qFeedback"></div>';
  }
  box.innerHTML='<div class="quiz-card">'+prog+head+body+'</div>';
  if(mode==='listen'){
    const play=()=>speak(q.word);
    $('qPlay').onclick=play; setTimeout(play,220);
  }
  if(mode==='spell'){
    const go=()=>{
      const v=$('spellInput').value.trim().toLowerCase();
      const ok=v===q.word.toLowerCase();
      answerQuiz(ok,q.word,ok?'拼写正确':'正确拼写是 '+q.word,$('spellInput').value);
    };
    $('spellGo').onclick=go;
    $('spellInput').onkeydown=e=>{ if(e.key==='Enter') go(); };
    $('spellInput').focus();
  } else {
    $$('.quiz-opt',box).forEach(b=>b.onclick=()=>{
      if(quiz.answered) return;
      const right=(mode==='en2cn'?shortDef(q,26):q.word);
      const ok=b.dataset.opt===right;
      answerQuiz(ok,q.word,ok?'回答正确':'正解是 '+right,b.dataset.opt);
      $$('.quiz-opt',box).forEach(x=>{
        x.classList.add('disabled');
        if(x.dataset.opt===right) x.classList.add('right');
      });
      if(!ok) b.classList.add('wrong');
      const qq=$('quizQ'); if(qq){ qq.classList.remove('flash-ok','flash-no'); void qq.offsetWidth; qq.classList.add(ok?'flash-ok':'flash-no'); }
    });
  }
}
function answerQuiz(ok,word,msg,chosen){
  quiz.answered=true;
  logDay('q',word);
  if(ok){ quiz.right++; logDay('correct',word); }
  else {
    quiz.wrongWords.push(word); wrong.add(word);
    const st=srs[word]||{level:0,times:0,wrong:0};
    st.level=0; st.due=TODAY(); st.wrong=(st.wrong||0)+1; delete st.seed;
    srs[word]=st; review.add(word); reviewArchive.add(word);
  }
  persist();
  const f=$('qFeedback');
  if(f) f.innerHTML='<div class="quiz-feedback'+(ok?'':' bad')+'">'+(ok?'✓ ':'✕ ')+esc(msg)+'</div>'+
    '<button class="a-key" id="qNext" style="margin-top:10px">'+(quiz.i+1>=quiz.list.length?'查看报告':'下一词 →')+'</button>';
  const n=$('qNext'); if(n) n.onclick=()=>{ quiz.i++; quiz.answered=false; renderQuiz(); };
}
function finishQuiz(){
  const total=quiz.list.length, right=quiz.right, pct=Math.round(right/total*100);
  quiz.wrongWords.forEach(w=>logDay('review',w)); persist();
  $('drillBody').innerHTML='<div class="result-sheet"><div class="cap">校 招 报 告 ／ FORM REPORT</div>'+
    '<div class="big">'+pct+'<span style="font-size:24px">%</span></div>'+
    '<div class="result-grid"><div><b>'+total+'</b><span>试剑总数</span></div><div><b>'+right+'</b><span>回答正确</span></div>'+
    '<div><b>'+(total-right)+'</b><span>答错之词</span></div></div>'+
    (quiz.wrongWords.length?'<div class="cap" style="margin-top:20px">答 错 之 词 ／ 已记入错词</div><div class="wrong-chips">'+quiz.wrongWords.map(w=>'<span>'+esc(w)+'</span>').join('')+'</div>':'<p class="shop-note">全部回答正确，没有答错之词。</p>')+
    '<div class="shop-actions" style="justify-content:center"><button class="key-key small" id="qAgain"><span>再来一轮</span><b>→</b></button>'+
    (quiz.wrongWords.length?'<button class="outline-key" id="qWrong">错词重练</button>':'')+
    '<button class="outline-key" id="qBack">回到总览</button></div></div>';
  $('qAgain').onclick=startQuiz;
  $('qBack').onclick=()=>switchView('home');
  if($('qWrong')) $('qWrong').onclick=()=>{ $('drillScope').value='wrong'; startQuiz(); };
}

/* ── 回访 / REVISIT ─────────────────────────────────── */
function reviewRow(w,overdue){
  const o=wordByName(w)||{definition:'',list:''};
  const lv=levelOf(w), st=srs[w]||{};
  return '<div class="st-row"><span class="w">'+esc(w)+'</span><span class="sg">'+barsHTML(lv)+'</span>'+
    '<span class="d">'+esc(shortDef(o,32))+'</span>'+
    '<span class="dt">'+(overdue?prettyDate(st.due||TODAY()):'今日')+'</span>'+
    '<span class="row-actions"><button class="ok" data-g="known" data-w="'+esc(w)+'">记得</button>'+
    '<button data-g="fuzzy" data-w="'+esc(w)+'">模糊</button>'+
    '<button data-g="unknown" data-w="'+esc(w)+'">忘了</button></span></div>';
}
function renderReview(){
  const due=dueList();
  const today=[], overdue=[];
  due.forEach(w=>{ const d=(srs[w]||{}).due||TODAY(); (d<TODAY()?overdue:today).push(w); });
  $('dueCount').textContent=today.length+' 枚';
  $('overdueCount').textContent=overdue.length+' 枚';
  $('dueRows').innerHTML=today.length?today.slice(0,80).map(w=>reviewRow(w,false)).join(''):'<div class="empty-line">今天没有待温习的词。</div>';
  $('overdueRows').innerHTML=overdue.length?overdue.slice(0,80).map(w=>reviewRow(w,true)).join(''):'<div class="empty-line">没有逾期未温习的词。</div>';
  const wl=Array.from(wrong);
  $('wrongCount').textContent=wl.length+' 枚';
  $('wrongRows').innerHTML=wl.length?wl.slice(0,60).map(w=>{
    const o=wordByName(w)||{definition:''};
    return '<div class="st-row"><span class="w">'+esc(w)+'</span><span class="sg">'+barsHTML(levelOf(w))+'</span>'+
      '<span class="d">'+esc(shortDef(o,32))+'</span><span class="dt">'+(practicedWrong.has(w)?'已重练':'待重练')+'</span>'+
      '<span class="row-actions"><button data-detail="'+esc(w)+'">看档案</button>'+
      '<button class="ok" data-practice="'+esc(w)+'">标记已重练</button></span></div>';
  }).join(''):'<div class="empty-line">还没有错词。</div>';
  $$('[data-g]',$('view-review')).forEach(b=>b.onclick=()=>reviewGrade(b.dataset.w,b.dataset.g));
  $$('[data-detail]',$('view-review')).forEach(b=>b.onclick=()=>openDetail(b.dataset.detail));
  $$('[data-practice]',$('view-review')).forEach(b=>b.onclick=()=>{ practicedWrong.add(b.dataset.practice); persist(); renderReview(); toast('已标记重练，错词记录本身保留'); });
}
function reviewGrade(w,g){
  const st=srs[w]||{level:0,times:0,wrong:0}; st.times=(st.times||0)+1; delete st.seed;
  if(g==='known'){
    st.level=Math.min(6,(st.level||0)+1);
    st.due=addDays(INTERVALS[Math.min(st.level,5)]);
    if(st.level>=6){ mastered.add(w); review.delete(w); }
    else { review.add(w); reviewArchive.add(w); }
  } else if(g==='fuzzy'){
    st.level=Math.max(1,Math.min(4,st.level||1)); st.due=addDays(1);
    review.add(w); reviewArchive.add(w);
  } else {
    st.level=0; st.due=TODAY(); st.wrong=(st.wrong||0)+1;
    review.add(w); reviewArchive.add(w); wrong.add(w);
  }
  srs[w]=st; logDay('review',w); persist();
  signalFx(g==='known'?'+1':(g==='fuzzy'?'~':'!'));
  renderReview(); renderHome();
}

/* ── 谱页 / STATION INDEX ─────────────────────────── */
const PAGE_SIZE=60;
function renderListFilters(){
  const lists=Array.from(new Set(words.map(w=>w.list)));
  $('listFilters').innerHTML='<button class="'+(caseList==='all'?'on':'')+'" data-list="all">ALL</button>'+
    lists.map(l=>'<button class="'+(caseList===l?'on':'')+'" data-list="'+esc(l)+'">'+esc(String(l).replace('Word List ','')||'—')+'</button>').join('');
  $$('[data-list]',$('listFilters')).forEach(b=>b.onclick=()=>{ caseList=b.dataset.list; casePage=0; renderCase(); });
  const sel=$('nwList');
  if(sel&&!sel.options.length) sel.innerHTML=lists.map(l=>'<option>'+esc(l)+'</option>').join('')+'<option>我添加的词</option>';
}
function caseResults(){
  const q=caseQuery.trim().toLowerCase();
  return words.filter(w=>{
    if(caseList!=='all'&&w.list!==caseList) return false;
    if(caseState==='unmastered'&&mastered.has(w.word)) return false;
    if(caseState==='mastered'&&!mastered.has(w.word)) return false;
    if(caseState==='review'&&!review.has(w.word)) return false;
    if(caseState==='favorites'&&!favorites.has(w.word)) return false;
    if(caseState==='wrong'&&!wrong.has(w.word)) return false;
    if(caseState==='custom'&&!w.custom) return false;
    if(q && (w.word+' '+w.definition+' '+(w.memory||'')).toLowerCase().indexOf(q)<0) return false;
    return true;
  });
}
function renderCase(){
  renderListFilters();
  $$('#stateFilters button').forEach(b=>b.classList.toggle('on',b.dataset.state===caseState));
  const res=caseResults();
  $('caseCount').textContent=res.length+' 枚';
  const pages=Math.max(1,Math.ceil(res.length/PAGE_SIZE));
  casePage=Math.min(casePage,pages-1);
  const slice=res.slice(casePage*PAGE_SIZE,(casePage+1)*PAGE_SIZE);
  const dueSet=new Set(dueList());
  $('caseGrid').innerHTML=slice.length?slice.map(w=>{
    const ix=idxByName(w.word);
    const cls=(mastered.has(w.word)?' mastered':'')+(dueSet.has(w.word)?' due':'');
    const corner=favorites.has(w.word)?'★':(w.custom?'自':'');
    return '<button class="station'+cls+'" data-word="'+esc(w.word)+'">'+
      '<span class="sf"><span>第 '+freqText(ix<0?0:ix)+'</span><span>'+esc(String(w.list||'').replace('Word List ','卷 '))+'</span></span>'+
      '<b>'+esc(w.word)+'</b><small>'+esc(shortDef(w,26))+'</small>'+
      (corner?'<span class="corner">'+corner+'</span>':'')+'</button>';
  }).join(''):'<div class="empty-line">没有匹配的词，换个条件试试。</div>';
  $$('.station',$('caseGrid')).forEach(b=>b.onclick=()=>openDetail(b.dataset.word));
  $('casePager').innerHTML='<button id="pgPrev" '+(casePage===0?'disabled':'')+'>← 上一版</button><span>'+(casePage+1)+' / '+pages+'</span><button id="pgNext" '+(casePage>=pages-1?'disabled':'')+'>下一版 →</button>';
  $('pgPrev').onclick=()=>{ if(casePage>0){casePage--;renderCase();} };
  $('pgNext').onclick=()=>{ casePage++;renderCase(); };
}

/* ── 词条档案抽屉 ───────────────────────────────────── */
function openDetail(w){
  const o=wordByName(w); if(!o) return;
  const ex=exampleParts(o.example), ph=phraseOf(o.memory), lv=levelOf(w), ix=idxByName(w);
  $('detailContent').innerHTML=
    '<div class="kicker">WORD FILE ／ 词条档案</div>'+
    '<div class="detail-word">'+esc(o.word)+'</div>'+
    '<div class="detail-ph">第 '+freqText(ix<0?0:ix)+' 词　'+esc(o.phonetic||'（原词库未提供音标）')+'</div>'+
    '<div class="detail-section"><h3>中文释义</h3><div class="detail-def">'+esc(o.definition||'—')+'</div></div>'+
    (ex?'<div class="detail-section"><h3>英文例句 ／ 中文翻译</h3><p>'+esc(ex.en)+'</p>'+(ex.cn?'<p style="color:var(--ink-2)">'+esc(ex.cn)+'</p>':'')+
      '<button class="a-key" id="dtSpeakEx" style="margin-top:8px">▶ 例句朗读</button></div>':'')+
    (ph?'<div class="detail-section"><h3>常见词组（原词条）</h3><p>'+esc(ph)+'</p></div>':'')+
    (o.memory?'<div class="detail-section"><h3>记忆提示 ／ 词条笔记</h3><p style="white-space:pre-wrap;font-size:11.5px;max-height:180px;overflow:auto">'+esc(o.memory)+'</p></div>':'')+
    '<div class="detail-section"><h3>修 习 档 案</h3><p>卷：'+esc(o.list||'—')+'　·　掌握：'+lv+'/6　·　下次温习：'+esc(dueOf(w)?prettyDate(dueOf(w)):'—')+'　·　错词记录：'+((srs[w]||{}).wrong||0)+' 次</p></div>'+
    '<div class="detail-actions"><button class="a-key" id="dtSpeak">▶ 朗读单词</button>'+
    '<button class="a-key'+(favorites.has(w)?' on':'')+'" id="dtFav">'+(favorites.has(w)?'取消收藏':'加入收藏')+'</button>'+
    '<button class="a-key" id="dtReview">'+(review.has(w)?'移出回访':'加入回访')+'</button>'+
    '<button class="a-key" id="dtGo">去收词 →</button></div>';
  $('detailOverlay').hidden=false;
  $('dtSpeak').onclick=()=>speak(o.word);
  if($('dtSpeakEx')) $('dtSpeakEx').onclick=()=>speak(ex.en);
  $('dtFav').onclick=()=>{ toggleFav(w); openDetail(w); };
  $('dtReview').onclick=()=>{
    if(review.has(w)) review.delete(w); else { review.add(w); reviewArchive.add(w); }
    persist(); renderHome(); openDetail(w);
  };
  $('dtGo').onclick=()=>jumpTo(w);
}
function toggleFav(w){
  if(favorites.has(w)) favorites.delete(w); else favorites.add(w);
  persist(); renderHome();
  if(currentView==='study') renderStudy();
  toast(favorites.has(w)?'已收藏这个词':'已取消收藏');
}

/* ── 播志 / BROADCAST LOG ───────────────────────────── */
function renderRecords(){
  $('recMastered').textContent=mastered.size;
  $('recReview').textContent=review.size;
  $('recDays').textContent=Object.keys(daily).length;
  $('recWrong').textContent=wrong.size;
  const days=[]; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push(dayKey(d)); }
  const mx=Math.max(1,...days.map(k=>{const x=daily[k]||{};return (x.new||[]).length+(x.reviewed||[]).length+(x.q||0);}));
  $('dailyLedger').innerHTML=days.map(k=>{
    const x=daily[k]||{}, n=(x.new||[]).length+(x.reviewed||[]).length+(x.q||0);
    return '<div class="daily-row"><time>'+k.slice(5)+'</time><div class="bar"><i style="width:'+Math.round(n/mx*100)+'%"></i></div>'+
      '<span class="num">新 '+(x.new||[]).length+' · 复 '+(x.reviewed||[]).length+' · 校 '+(x.q||0)+'</span></div>';
  }).join('');
  const wl=Array.from(wrong);
  $('recWrongMeta').textContent=wl.length+' 枚（记录永久保留）';
  $('wrongLedger').innerHTML=wl.length?wl.slice(0,40).map((w,i)=>{
    const o=wordByName(w)||{definition:''};
    return '<div class="tape-row"><time>'+String(i+1).padStart(2,'0')+'</time><span><b>'+esc(w)+'</b> · '+esc(shortDef(o,30))+'</span><em>'+(practicedWrong.has(w)?'已重练':'待重练')+'</em></div>';
  }).join(''):'<div class="empty-line">暂无错词。</div>';
  renderLogWave();
}

/* ── 工坊 / 导出 / 导入 ─────────────────────────────── */
function allLegacy(){
  const o={}; for(let i=0;i<LS.length;i++){ const k=LS.key(i); if(k&&k.indexOf('vocab-')===0) o[k]=LS.getItem(k); }
  return o;
}
function renderSettings(){
  const from=get('vocab-v2-migrated-from','（未迁移）');
  const m=getArr('vocab-mastered').length, r=getArr('vocab-review').length;
  $('migrateStatus').innerHTML='当前词谱已接续升级前记录：<b>'+esc(from)+'</b><br>已掌握 <b>'+m+'</b> 词 · 待温习 <b>'+r+'</b> 词 · 词库 <b>'+BANK.length+'</b> 词。原有 <code>vocab-*</code> 键全部保留。';
  const sources=Object.assign({},SEED.sources||{});
  const snap=jparse(get('vocab-v2-local-snapshot','{}'),{});
  if(Object.keys(snap).length) sources['当前站点升级前记录']=snap;
  $('sourceList').innerHTML=Object.keys(sources).map(k=>{
    const s=sourceStats(sources[k]);
    return '<div class="source-item'+(k===from?' active':'')+'"><span class="src-name">'+esc(k)+'</span>'+
      '<span class="src-stat">已掌握 '+s.mastered+' · 待温 '+s.review+' · 位置 '+esc(s.pos)+' · '+s.keys+' 键</span>'+
      '<button data-src="'+esc(k)+'">恢复此来源</button></div>';
  }).join('');
  $$('[data-src]',$('sourceList')).forEach(b=>b.onclick=()=>{
    const k=b.dataset.src;
    if(!confirm('恢复「'+k+'」？\n为保护练功记录，已掌握/待温/收藏/错词会与现有记录合并（取并集），不会删除任何一条。')) return;
    applySource(k,sources[k]);
    renderAll();
  });
  $('audioSource').value=settings.audioSource||'browser';
  $('audioRate').value=String(settings.rate||get('vocab-rate','0.8'));
  $('autoSpeak').checked=!!settings.autoSpeak;
  $('dailyGoal').value=String(settings.dailyGoal||12);
  const tts='speechSynthesis' in window;
  const sr=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
  $('audioCapability').textContent='本机能力：浏览器朗读 '+(tts?'可用':'不可用（自动切到在线发音）')+'；语音识别 '+(sr?'可用':'不可用（跟读自动切换为自评模式）')+'。在线发音使用免费公开接口，需联网。';
  $('shadowCap').textContent=sr?'点击「开始跟读」后对着麦克风读出单词，系统会自动比对。':'当前浏览器不支持语音识别，跟读提供「自评打卡」替代，不会留下无效按钮。';
  $('dataHealth').innerHTML='词库 '+BANK.length+' 枚（原有）+ '+getAny('vocab-custom-words').length+' 枚（自建）／已掌握 '+mastered.size+
    '／待温 '+review.size+'／错词 '+wrong.size+'／收藏 '+favorites.size+'／复习档案 '+Object.keys(srs).length+' 条／每日记录 '+Object.keys(daily).length+' 天。';
}
function exportData(){
  const payload={app:'烟雨江湖 · 江南旧梦',version:3,exportedAt:new Date().toISOString(),
    wordBankCount:BANK.length,wordListCount:new Set(BANK.map(x=>x.list)).size,
    legacy:allLegacy(),customWords:getAny('vocab-custom-words'),sources:SEED.sources||{}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='烟雨江湖-修习数据备份-'+TODAY()+'.json';
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
  toast('已导出 JSON 备份（含全部原始 vocab-* 键）');
}
function importData(file){
  const fr=new FileReader();
  fr.onload=()=>{
    let d; try{ d=JSON.parse(fr.result); }catch(e){ toast('文件不是有效的 JSON'); return; }
    const legacy=d.legacy||d;
    if(!legacy||typeof legacy!=='object'){ toast('备份格式不正确'); return; }
    if(!confirm('导入将与现有记录合并，不会删除已掌握或待温习的单词。继续？')) return;
    ['vocab-mastered','vocab-review','vocab-recent','vocab-dict-missed','vocab-favorites','vocab-review-archive'].forEach(k=>{
      const cur=new Set(getArr(k)); const add=asArr(legacy[k]);
      add.forEach(x=>{if(typeof x==='string')cur.add(x);});
      setArr(k,Array.from(cur));
    });
    Object.keys(legacy).forEach(k=>{
      if(k===THEME_KEY) return;
      if(k.indexOf('vocab-')!==0) return;
      if(['vocab-mastered','vocab-review','vocab-recent','vocab-dict-missed','vocab-favorites','vocab-review-archive'].indexOf(k)>=0) return;
      set(k,typeof legacy[k]==='string'?legacy[k]:JSON.stringify(legacy[k]));
    });
    if(Array.isArray(d.customWords)){
      const cur=getAny('vocab-custom-words'), seen=new Set(cur.map(x=>String(x.word||'').toLowerCase()));
      d.customWords.forEach(x=>{ if(x&&x.word&&!seen.has(String(x.word).toLowerCase())){cur.push(x);seen.add(String(x.word).toLowerCase());} });
      setArr('vocab-custom-words',cur);
    }
    loadAll(); seedSrs(); persist(); renderAll();
    toast('导入完成，已与现有记录合并');
  };
  fr.readAsText(file,'utf-8');
}

/* ── 跟读 ───────────────────────────────────────────── */
let recognition=null, shadowSelfMode=false;
function openShadow(){
  const w=words[index]||{word:'',phonetic:''};
  $('shadowWord').textContent=w.word; $('shadowPh').textContent=w.phonetic||'';
  $('shadowResult').className='shadow-result'; $('shadowResult').textContent='先听一遍，再跟着读出来。';
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  shadowSelfMode=!SR;
  $('btnShadowRec').textContent=SR?'开始跟读':'我已跟读（自评）';
  $('shadowCap').textContent=SR?'点击后对着麦克风读出单词，系统会自动比对。':'当前浏览器不支持语音识别，已切换为自评打卡模式。';
  $('shadowOverlay').hidden=false;
}
function startShadow(){
  const w=words[index]||{word:''};
  const res=$('shadowResult');
  if(shadowSelfMode){
    logDay('review',w.word); persist();
    res.className='shadow-result good'; res.textContent='已记录一次自评跟读。你的浏览器不支持语音识别，可继续用「播放示范 + 自评」练习。';
    return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(recognition){ try{recognition.abort();}catch(e){} }
  recognition=new SR(); recognition.lang='en-US'; recognition.interimResults=false; recognition.maxAlternatives=1;
  res.className='shadow-result'; res.textContent='正在听… 请读出 '+w.word;
  recognition.onresult=e=>{
    const said=(e.results[0][0].transcript||'').trim().toLowerCase().replace(/[^a-z'\-\/ ]/g,'');
    const target=w.word.toLowerCase().replace(/[^a-z'\-\/ ]/g,'');
    const ok=said===target||said.indexOf(target)>=0;
    res.className='shadow-result '+(ok?'good':'bad');
    res.textContent=ok?'跟读准确 ✓　听到：'+said:'再来一次：听到「'+said+'」，目标「'+w.word+'」';
    logDay('review',w.word); persist();
  };
  recognition.onerror=e=>{
    res.className='shadow-result bad';
    res.textContent='麦克风不可用（'+e.error+'）。已切换为自评模式，可直接点按钮打卡。';
    shadowSelfMode=true; $('btnShadowRec').textContent='我已跟读（自评）';
  };
  try{ recognition.start(); }catch(e){ shadowSelfMode=true; $('btnShadowRec').textContent='我已跟读（自评）'; }
}

/* ── 视图切换 ───────────────────────────────────────── */
function switchView(name){
  currentView=name;
  $$('.view').forEach(v=>v.classList.toggle('on',v.id==='view-'+name));
  $$('.band').forEach(b=>b.classList.toggle('on',b.dataset.view===name));
  $$('.mobile-tabs button').forEach(b=>b.classList.toggle('on',b.dataset.view===name));
  window.scrollTo(0,0);
  renderAll();
}
function closeOverlays(){ ['detailOverlay','shadowOverlay','addOverlay'].forEach(id=>$(id).hidden=true); vuStop(); }
function renderAll(){
  if(currentView==='home') renderHome();
  else if(currentView==='study') renderStudy();
  else if(currentView==='review') renderReview();
  else if(currentView==='case') renderCase();
  else if(currentView==='records') renderRecords();
  else if(currentView==='settings'){ renderSettings(); renderThemePanel(); }
  if(currentView==='home'){ renderHeadWave(); }
}

/* ── 频谱与调谐的指针交互 ───────────────────────────── */
function posFromEvent(canvas,ev,geom){
  if(!geom||!canvas) return 0;
  const r=canvas.getBoundingClientRect();
  const x=Math.max(0,Math.min(r.width,ev.clientX-r.left));
  return Math.max(0,Math.min(words.length-1,Math.floor(x/geom.W*words.length)));
}
function bindSpectrum(){
  const wrap=$('spectrumWrap'), c=$('spectrumCanvas'), tip=$('spectrumTip');
  let startX=0, moved=false, cur=0;
  const showTip=(p,ev)=>{
    const i=wordAtPos(p), w=words[i]; if(!w) return;
    const r=c.getBoundingClientRect();
    const lv=levelOf(w.word);
    tip.innerHTML='<b>'+esc(w.word)+'</b><span>第 '+freqPosText(p)+' · 卷 '+chText(i)+'</span><br>'+
      esc(shortDef(w,24))+'<br>'+(lv>=6?'已掌握':(lv>0?'第 '+lv+' 格':'尚未修习'));
    tip.style.left=Math.min(r.width-160,Math.max(0,ev.clientX-r.left+12))+'px';
    tip.style.top=Math.max(0,Math.min(r.height-70,ev.clientY-r.top+14))+'px';
    tip.hidden=false;
  };
  const preview=(p,e)=>{
    cur=p;
    $('homeNeedle').style.left=posPct(p);
    $('homeFreq').textContent=freqPosText(p);
    $('homeCh').textContent=chText(wordAtPos(p));
    showTip(p,e);
  };
  wrap.addEventListener('pointerdown',e=>{
    startX=e.clientX; moved=false; dragMode='spec';
    try{ wrap.setPointerCapture(e.pointerId); }catch(err){}
    preview(posFromEvent(c,e,specGeom),e);
  });
  wrap.addEventListener('pointermove',e=>{
    if(dragMode!=='spec') return;
    if(Math.abs(e.clientX-startX)>6) moved=true;
    preview(posFromEvent(c,e,specGeom),e);
  });
  wrap.addEventListener('pointerup',e=>{
    if(dragMode!=='spec') return;
    dragMode=null; tip.hidden=true;
    const w=words[wordAtPos(cur)]; if(!w) return;
    if(moved) jumpTo(w.word); else openDetail(w.word);
  });
  wrap.addEventListener('pointercancel',()=>{ dragMode=null; tip.hidden=true; });
  wrap.addEventListener('pointerleave',()=>{ if(dragMode!=='spec') tip.hidden=true; });
}
function bindTune(){
  const track=$('tuneTrack'), c=$('tuneCanvas'), bubble=$('tuneBubble');
  let cur=posOfWord(index), startX=0, moved=false, active=false;
  const preview=(p)=>{
    cur=Math.max(0,Math.min(words.length-1,p));
    const wi=wordAtPos(cur);
    $('tuneNeedle').style.left=posPct(cur);
    $('tuneReadout').textContent=freqPosText(cur)+' 词';
    bubble.style.left=posPct(cur);
    bubble.textContent=freqPosText(cur)+' · '+((words[wi]||{}).word||'');
    bubble.hidden=false;
  };
  track.addEventListener('pointerdown',e=>{
    active=true; moved=false; startX=e.clientX;
    try{ track.setPointerCapture(e.pointerId); }catch(err){}
    preview(posFromEvent(c,e,tuneGeom));
  });
  track.addEventListener('pointermove',e=>{
    if(!active) return;
    if(Math.abs(e.clientX-startX)>5) moved=true;
    preview(posFromEvent(c,e,tuneGeom));
  });
  track.addEventListener('pointerup',()=>{
    if(!active) return;
    active=false; bubble.hidden=true;
    const wi=wordAtPos(cur);
    if(wi!==index||moved) tuneTo(wi);
  });
  track.addEventListener('pointercancel',()=>{ active=false; bubble.hidden=true; });
}

/* ── 事件绑定 ───────────────────────────────────────── */
function bind(){
  bindTheme();
  $$('.band').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $$('.mobile-tabs button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $('btnRecords').onclick=()=>switchView('records');
  $('btnSettings').onclick=()=>switchView('settings');
  $('btnStartToday').onclick=()=>{
    const due=dueList();
    if(due.length) jumpTo(due[0]);
    else {
      const next=words.findIndex(w=>levelOf(w.word)===0&&!mastered.has(w.word));
      jumpTo((next>=0?words[next]:words[0]).word);
    }
  };
  const kvStart=$('kvStart');
  if(kvStart) kvStart.onclick=()=>{
    const due=dueList();
    if(due.length) jumpTo(due[0]);
    else {
      const next=words.findIndex(w=>levelOf(w.word)===0&&!mastered.has(w.word));
      jumpTo((next>=0?words[next]:words[0]).word);
    }
  };
  const kvSwitch=$('kvSwitch');
  if(kvSwitch) kvSwitch.onclick=()=>switchKv(1);
  const kvDots=$('kvDots');
  if(kvDots) kvDots.addEventListener('click',e=>{
    const dot=e.target.closest('i'); if(!dot) return;
    const arr=Array.from(kvDots.children);
    const i=arr.indexOf(dot);
    if(i>=0&&i!==currentKvIndex()){ kvIndex=i; set(KV_KEY,String(i)); applyKv(); }
  });
  $('btnPrev').onclick=()=>step(-1);
  $('btnNext').onclick=()=>step(1);
  $('btnRandom').onclick=()=>step(1,true);
  $('studyScope').onchange=()=>{ step(0); };
  $('btnReveal').onclick=()=>{ reveal=!reveal; renderStudy(); };
  $('btnSpeakWord').onclick=()=>speak(words[index].word);
  $('btnSpeakExample').onclick=()=>{ const ex=exampleParts(words[index].example); if(ex&&ex.en) speak(ex.en); else toast('原词库没有提供这个词的例句'); };
  $('btnRepeatAudio').onclick=repeatAudio;
  $('btnFav').onclick=()=>toggleFav(words[index].word);
  $('btnOpenDetail').onclick=()=>openDetail(words[index].word);
  $$('.grade').forEach(b=>b.onclick=()=>markGrade(b.dataset.grade));
  $('rateSeg').onclick=e=>{ const b=e.target.closest('[data-rate]'); if(!b)return;
    set('vocab-rate',b.dataset.rate); settings.rate=parseFloat(b.dataset.rate); setObj('vocab-settings',settings);
    $$('#rateSeg button').forEach(x=>x.classList.toggle('on',x===b)); repeatAudio(); };
  $$('#rateSeg button').forEach(b=>b.classList.toggle('on',b.dataset.rate===String(settings.rate||get('vocab-rate','0.8'))));
  $('btnCloseDetail').onclick=closeOverlays;
  $('btnCloseShadow').onclick=closeOverlays;
  $('btnCloseAdd').onclick=closeOverlays;
  $$('.overlay').forEach(o=>o.onclick=e=>{ if(e.target===o) closeOverlays(); });
  $('btnShadow').onclick=openShadow;
  $('btnShadowSettings').onclick=openShadow;
  $('btnShadowPlay').onclick=()=>speak((words[index]||{}).word||'');
  $('btnShadowRec').onclick=startShadow;

  $$('#drillModes button').forEach(b=>b.onclick=()=>{ drillMode=b.dataset.mode;
    $$('#drillModes button').forEach(x=>x.classList.toggle('on',x===b)); });
  $('btnDrillStart').onclick=startQuiz;

  $$('#stateFilters button').forEach(b=>b.onclick=()=>{ caseState=b.dataset.state; casePage=0; renderCase(); });
  let searchTimer=null;
  $('caseSearch').oninput=e=>{ clearTimeout(searchTimer); caseQuery=e.target.value;
    searchTimer=setTimeout(()=>{casePage=0;renderCase();},160); };
  $('btnAddWord').onclick=()=>{ renderListFilters(); $('addOverlay').hidden=false; };
  $('btnSaveWord').onclick=()=>{
    const w=$('nwWord').value.trim(), def=$('nwDef').value.trim();
    if(!w||!def){ toast('英文单词和中文释义必填'); return; }
    const custom=getAny('vocab-custom-words').filter(x=>x&&typeof x==='object');
    if(custom.some(x=>x.word.toLowerCase()===w.toLowerCase())){ toast('这个词已经在词谱里了'); return; }
    custom.push({word:w,phonetic:$('nwPh').value.trim(),definition:def,example:$('nwEx').value.trim(),
      memory:'',list:$('nwList').value||'我添加的词'});
    setArr('vocab-custom-words',custom);
    loadAll(); closeOverlays(); renderCase(); toast('已写入词谱');
  };
  $('btnExport').onclick=exportData;
  $('btnImport').onclick=()=>$('importFile').click();
  $('importFile').onchange=e=>{ if(e.target.files[0]) importData(e.target.files[0]); e.target.value=''; };
  $('audioSource').onchange=e=>{ settings.audioSource=e.target.value; setObj('vocab-settings',settings); set('vocab-audio-source',e.target.value); toast('发音方式已切换'); };
  $('audioRate').onchange=e=>{ settings.rate=parseFloat(e.target.value); setObj('vocab-settings',settings); set('vocab-rate',e.target.value); };
  $('autoSpeak').onchange=e=>{ settings.autoSpeak=e.target.checked; setObj('vocab-settings',settings); };
  $('dailyGoal').onchange=e=>{ settings.dailyGoal=parseInt(e.target.value,10); setObj('vocab-settings',settings); renderHome(); };
  $('btnTestAudio').onclick=()=>speak('ability');

  bindSpectrum(); bindTune();
  window.addEventListener('resize',()=>{
    if(currentView==='home') { renderSpectrum(); renderHeadWave(); }
    if(currentView==='study') { renderWordWave(); renderTuneCanvas(); }
    if(currentView==='records') renderLogWave();
  });
  document.addEventListener('keydown',e=>{
    if(!$('detailOverlay').hidden||!$('shadowOverlay').hidden||!$('addOverlay').hidden){ if(e.key==='Escape') closeOverlays(); return; }
    const tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='select'||tag==='textarea') return;
    if(currentView!=='study') return;
    if(e.key==='ArrowLeft'){ e.preventDefault(); step(-1); }
    else if(e.key==='ArrowRight'){ e.preventDefault(); step(1); }
    else if(e.key===' '){ e.preventDefault(); reveal=!reveal; renderStudy(); }
    else if(e.key.toLowerCase()==='r'){ step(1,true); }
    else if(e.key==='1') markGrade('unknown');
    else if(e.key==='2') markGrade('fuzzy');
    else if(e.key==='3') markGrade('known');
  });
}


/* ═════════ 主题 KV 轮换：按日期一天一张，七张周而复始；可手动换 ═════════ */
const KV_LIST=[
  {img:'kv-1.png', sub:'江 南 旧 梦 · 初中英语词汇', verse:'一蓑烟雨，词入江湖。', seal:'烟\n雨'},
  {img:'kv-2.png', sub:'夜 雨 剑 影 · 初中英语词汇', verse:'夜雨江湖，剑气未收。', seal:'夜\n雨'},
  {img:'kv-3.png', sub:'墨 影 独 行 · 初中英语词汇', verse:'一骑绝尘，墨色苍茫。', seal:'墨\n影'},
  {img:'kv-4.png', sub:'残 明 余 晖 · 初中英语词汇', verse:'残阳如血，江湖路远。', seal:'残\n明'},
  {img:'kv-5.png', sub:'晴 竹 听 风 · 初中英语词汇', verse:'竹影摇风，字句成章。', seal:'晴\n竹'},
  {img:'kv-6.png', sub:'月 下 孤 影 · 初中英语词汇', verse:'冷月孤悬，词心可鉴。', seal:'月\n下'},
  {img:'kv-7.png', sub:'初 雪 寒 江 · 初中英语词汇', verse:'寒江初雪，温故知新。', seal:'初\n雪'}
];
const KV_KEY='vocab-kv-index';  // 手动选择的 KV 序号（独立键，不碰学习数据）
let kvIndex=null;
function kvIndexOfToday(){
  const d=new Date();
  const start=new Date(d.getFullYear(),0,0);
  const doy=Math.floor((d-start)/86400000);
  return doy % KV_LIST.length;
}
function currentKvIndex(){
  if(kvIndex===null){
    const saved=parseInt(get(KV_KEY,''),10);
    if(!isNaN(saved)&&saved>=0&&saved<KV_LIST.length) kvIndex=saved;
    else kvIndex=kvIndexOfToday();
  }
  return kvIndex;
}
function applyKv(){
  const k=KV_LIST[currentKvIndex()];
  const scene=$('kvScene'); if(scene) scene.style.backgroundImage="url('"+k.img+"')";
  const sub=$('kvSub'); if(sub) sub.textContent=k.sub;
  const verse=$('kvVerse'); if(verse) verse.textContent=k.verse;
  const seal=$('kvSeal'); if(seal) seal.innerHTML=k.seal.replace('\n','<br>');
  // 更新圆点指示器
  const dots=$('kvDots'); if(dots){
    dots.innerHTML=KV_LIST.map((_,i)=>'<i class="'+(i===currentKvIndex()?'on':'')+'"></i>').join('');
  }
}
function switchKv(dir){
  kvIndex=(currentKvIndex()+dir+KV_LIST.length)%KV_LIST.length;
  set(KV_KEY,String(kvIndex));
  applyKv();
}

/* ═════════ 主题定制：独立键 vocab-wuxia-theme，绝不触碰学习数据 ═════════ */
const THEME_KEY='vocab-yanyu-theme';
const CLIMATES={
 yanyu:{p:'#0B1418',i:['#C9D6D2','#EDE7DA','#FFFFFF'],i2:'#8CA5A2',i3:'#5F7A78',s:'#C1503F',m:'#3A5058',l:'#2A3E44',r:1,c:1,f:'kai',label:'烟雨 · 江南旧梦'},
 yeyu:{p:'#0A1216',i:['#C9D6D2','#EDE7DA','#FFFFFF'],i2:'#8CA5A2',i3:'#5F7A78',s:'#A33A2B',m:'#3A5058',l:'#2A3E44',r:1,c:1,f:'kai',label:'夜雨 · 影之刃零'},
 moying:{p:'#101214',i:['#C9CFCD','#EDE7DA','#FFFFFF'],i2:'#8C9491',i3:'#5F6663',s:'#A8322A',m:'#3A3E40',l:'#2A2E30',r:1,c:1,f:'song',label:'墨影 · 暗黑水墨'},
 canming:{p:'#100F0D',i:['#CBBFA8','#EDE7DA','#FFFFFF'],i2:'#8C8270',i3:'#5F5849',s:'#9C452C',m:'#3A342A',l:'#2A261E',r:0,c:1,f:'kai',label:'残明 · 渊虚之羽'},
 qingzhu:{p:'#0C1514',i:['#C0CFC8','#E7EFEA','#FFFFFF'],i2:'#7E9A90',i3:'#55695F',s:'#9B3A2B',m:'#33433E',l:'#26332F',r:0,c:1,f:'song',label:'晴竹 · 卧虎藏龙'}
};
const FONTS={
 song:"'Songti SC','SimSun',serif",
 kai:"'LXGW WenKai','KaiTi','STKaiti',serif",
 fang:"'FangSong','STFangsong','LXGW WenKai',serif",
 hei:'system-ui,-apple-system,"Microsoft YaHei",sans-serif'
};
const FONTS_BODY={
 song:"'Songti SC','SimSun',serif",
 kai:"'LXGW WenKai','FangSong','STFangsong',serif",
 fang:"'FangSong','STFangsong',serif",
 hei:'system-ui,-apple-system,"Microsoft YaHei",sans-serif'
};
let theme={c:'yanyu',ink:1,seal:2,font:'kai',rain:1,col:1};
const TH={paper:'#0B1418',ink:'#EDE7DA',ink2:'#8CA5A2',ink3:'#5F7A78',seal:'#C1503F',mist:'#3A5058',line:'#2A3E44',fontFamily:"'LXGW WenKai','KaiTi',serif"};
function loadTheme(){
  const raw=get(THEME_KEY,null);
  if(raw===null){ saveTheme(); return; }
  const v=jparse(raw,null);
  if(v&&typeof v==='object'&&CLIMATES[v.c]) theme=Object.assign({},theme,v);
}
function applyTheme(){
  const t=CLIMATES[theme.c]||CLIMATES.moying;
  TH.paper=t.p; TH.ink=t.i[theme.ink]||t.i[1]; TH.ink2=t.i2; TH.ink3=t.i3;
  TH.seal=t.s; TH.mist=t.m; TH.line=t.l; TH.fontFamily=FONTS[theme.font]||FONTS.kai;
  const r=document.documentElement;
  r.setAttribute('data-climate',theme.c);
  r.setAttribute('data-ink',String(theme.ink));
  r.setAttribute('data-seal',String(theme.seal));
  r.setAttribute('data-font',theme.font);
  r.setAttribute('data-rain',String(theme.rain));
  r.setAttribute('data-col',String(theme.col));
  r.style.setProperty('--wx-ink',TH.ink);
  r.style.setProperty('--wx-font',TH.fontFamily);
  r.style.setProperty('--wx-font-body',FONTS_BODY[theme.font]||FONTS_BODY.kai);
  const sealEl=document.querySelector('.seal-mark');
  if(sealEl){ sealEl.style.display=theme.seal===0?'none':''; sealEl.style.opacity=theme.seal===1?'.5':''; }
  const rainEl=document.querySelector('.scene-rain');
  if(rainEl) rainEl.style.display=theme.rain?'block':'none';
  const colEl=document.querySelector('.colophon');
  if(colEl) colEl.style.display=theme.col?'':'none';
}
function saveTheme(){ set(THEME_KEY,JSON.stringify(theme)); }
function themeBtns(k,arr,cur){
  return arr.map(x=>'<button class="theme-btn'+(String(cur)===String(x[0])?' on':'')+'" data-tk="'+k+'" data-tv="'+x[0]+'">'+x[1]+'</button>').join('');
}
function renderThemePanel(){
  const el=$('themePanel'); if(!el) return;
  const t=CLIMATES[theme.c]||CLIMATES.moying;
  el.innerHTML='<h2>江湖气候 <small>THEME CUSTOMISER</small></h2>'+
    '<p class="theme-note">五套水墨气候，默认烟雨江南；参数只写入新键 <code>vocab-yanyu-theme</code>，不改动任何学习记录。书体「文楷」为本地内置的霞鹜文楷（SIL OFL 开源字体），离线可用。</p>'+
    '<div class="theme-pair"><div class="theme-col">'+
      '<p class="theme-lab">气 候</p><div class="theme-btns">'+themeBtns('c',[['yanyu','烟雨'],['qingzhu','晴竹'],['moying','墨影'],['yeyu','夜雨'],['canming','残明']],theme.c)+'</div>'+
      '<p class="theme-lab">墨 色</p><div class="theme-btns">'+themeBtns('ink',[[0,'淡墨'],[1,'中墨'],[2,'焦墨']],theme.ink)+'</div>'+
      '<p class="theme-lab">朱 砂</p><div class="theme-btns">'+themeBtns('seal',[[0,'不用'],[1,'批点'],[2,'钤印']],theme.seal)+'</div>'+
      '<p class="theme-lab">书 体</p><div class="theme-btns">'+themeBtns('font',[['kai','文楷'],['fang','仿宋'],['song','宋'],['hei','黑']],theme.font)+'</div>'+
      '<p class="theme-lab">气 候 细 节</p><div class="theme-btns">'+themeBtns('rain',[[0,'无雨'],[1,'雨丝']],theme.rain)+themeBtns('col',[[0,'无题跋'],[1,'竖排题跋']],theme.col)+'</div>'+
    '</div><div class="theme-col">'+
      '<p class="theme-lab">实 时 预 览 · 词 笺</p>'+
      '<div class="theme-preview"><div class="tp-k">词 汇 修 习 ／ 第一百五十八词</div><div class="tp-w">biology</div>'+
      '<div class="tp-s"></div><div class="tp-d">n. 生物学</div><div class="tp-n">批：bio- 生命，-logy 学问</div>'+
      '<div class="tp-seal"><div>烟</div><div>雨</div></div></div>'+
      '<p class="theme-note">当前：'+esc(t.label)+' · '+['淡墨','中墨','焦墨'][theme.ink]+' · '+['不用朱砂','朱砂批点','朱砂钤印'][theme.seal]+' · '+({song:'宋体刻本',kai:'霞鹜文楷',fang:'仿宋',hei:'黑体'})[theme.font]+'。<br>选择气候会带上该片场推荐的雨丝、题跋与书体，之后可继续单独调整。</p>'+
    '</div></div>';
}
function bindTheme(){
  const el=$('themePanel'); if(!el) return;
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-tk]'); if(!b) return;
    const k=b.getAttribute('data-tk'), v=b.getAttribute('data-tv');
    if(k==='c'){ theme.c=v; const t=CLIMATES[v]; if(t){ theme.rain=t.r; theme.col=t.c; theme.font=t.f; } }
    else if(k==='font'){ theme.font=v; }
    else { theme[k]=parseInt(v,10)||0; }
    applyTheme(); saveTheme(); renderThemePanel(); renderAll();
    toast('已换片场：'+(CLIMATES[theme.c]||{}).label);
  });
}

/* ── 启动 ───────────────────────────────────────────── */
function clock(){
  const d=new Date();
  const el=$('hdrClock'); if(el) el.textContent=pad(d.getHours())+':'+pad(d.getMinutes());
}
function init(){
  loadTheme(); applyTheme();
  applyKv();
  ensureMigration();
  loadAll();
  seedSrs();
  persist();
  if('speechSynthesis' in window){ try{ window.speechSynthesis.getVoices(); }catch(e){} }
  bind();
  renderAll();
  clock(); setInterval(clock,30000);
  if(get('vocab-v2-migrated-from','')&&get('vocab-v2-migrated-from','')!=='当前站点原有记录'){
    setTimeout(()=>toast('已接续原有进度 · '+mastered.size+' 已掌握 / '+review.size+' 待温'),700);
  }
}
try { init(); }
catch(err){
  console.error(err);
  const b=document.createElement('div');
  b.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:999;background:#E4572E;color:#fff;padding:12px;font:13px sans-serif';
  b.textContent='页面初始化出错：'+(err&&err.message?err.message:err)+'（原版界面仍保留在 index.print.html / index.legacy.html）';
  document.body.appendChild(b);
}
})();
