/* ==========================================================================
   THE NORTHERN LEXICON · 设计层脚本
   用真实词库/进度驱动：铁剑锻造、四十处遗迹、今日符文、章节题铭、火漆反馈。
   不改动任何既有学习逻辑与数据。
   ========================================================================== */
(function () {
  'use strict';

  var DATA = window.__VOCAB_INLINE__ || {};
  var WORDS = Array.isArray(DATA.words) ? DATA.words : [];
  var SENTS = Array.isArray(DATA.sents) ? DATA.sents : [];
  var $ = function (id) { return document.getElementById(id); };

  var CH = {
    home:      { no:'00', init:'C', la:'SYLVA BOREALIS',   zh:'扉页' },
    study:     { no:'01', init:'V', la:'VERBA',              zh:'词条' },
    sent:      { no:'02', init:'S', la:'SENTENTIAE',         zh:'短句' },
    grammar:   { no:'03', init:'G', la:'GRAMMATICA',         zh:'语法' },
    phonetics: { no:'04', init:'P', la:'PHONETICA',          zh:'音标' },
    list:      { no:'05', init:'I', la:'INDEX VERBORUM',     zh:'词库检索' },
    review:    { no:'06', init:'R', la:'REVISENDA',          zh:'待复习' },
    mastered:  { no:'07', init:'M', la:'MEMORIA',            zh:'已掌握' },
    quiz:      { no:'08', init:'T', la:'TENTAMEN',           zh:'小测验' },
    listen:    { no:'09', init:'A', la:'AUDITUS',            zh:'听力测试' },
    speak:     { no:'10', init:'O', la:'VOX',                zh:'口语跟读' },
    dict:      { no:'11', init:'D', la:'SCRIPTIO',           zh:'默写练习' },
    paper:     { no:'12', init:'E', la:'PROBATIO',           zh:'测试卷' },
    gramq:     { no:'13', init:'X', la:'EXAMEN GRAMMATICAE', zh:'语法测试' }
  };

  function todaySeed() { var d = new Date(); return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(); }
  function dateLabel() { var d = new Date(), p = function(n){return String(n).padStart(2,'0');}; return d.getFullYear()+'.'+p(d.getMonth()+1)+'.'+p(d.getDate()); }
  function esc(s) { return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function masteredSet() {
    try { var raw = window.localStorage.getItem('hs-vocab-mastered'); var a = raw?JSON.parse(raw):[]; return new Set(Array.isArray(a)?a:[]); }
    catch(e){ return new Set(); }
  }
  function listNo(l) { var n = parseInt(String(l||'').split(' ').pop(),10); return (n>=1&&n<=40)?n:0; }
  function go(id) { var t = document.querySelector('.tab[data-view="'+id+'"]'); if(t) t.click(); }
  function goWord(w) {
    try { if(typeof window.showWord==='function'){ var i=WORDS.indexOf(w); if(i>=0) window.showWord(i); } } catch(e){}
    go('study');
  }

  /* ---------------- 页眉：泥金首字母 / 拉丁题铭 / 页码 ---------------- */
  function syncHeader() {
    var v = document.querySelector('.view:not(.hidden)');
    var c = CH[v ? v.id : 'home'] || CH.home;
    var set = function(id,txt){ var e=$(id); if(e) e.textContent=txt; };
    set('illumInit', c.init);
    set('folioLa', 'CHAPTER ' + c.no + ' · ' + c.la);
    set('folioZh', c.zh);
    set('folioDate', dateLabel());
    set('folioNum', c.no + ' / 13');
    set('mgFolio', 'FOLIO ' + c.no);
    var learned = parseInt((($('learned')||{}).textContent||'0').replace(/[^\d]/g,''),10) || 0;
    var total = WORDS.length || 3559;
    if($('folioProgress')) $('folioProgress').innerHTML = '<b>'+learned+'</b> / '+total.toLocaleString('en-US')+' runes';
    if($('rampartCount')) $('rampartCount').textContent = learned.toLocaleString('en-US');
    renderPath();
  }

  /* ---------------- 铁剑：真实掌握率把暗铁锻成亮银 ---------------- */
  function forgeData() {
    var m = masteredSet(), cells = [];
    for(var i=1;i<=40;i++) cells.push({no:i,list:'Word List '+i,total:0,done:0});
    WORDS.forEach(function(w){
      var n = listNo(w.list);
      if(n){ cells[n-1].total++; if(m.has(w.word)) cells[n-1].done++; }
    });
    return cells;
  }
  function renderForge() {
    var cells = forgeData(), sum=0, tot=0;
    cells.forEach(function(c){ sum+=c.done; tot+=c.total; });
    var pct = tot ? sum/tot*100 : 0;
    var main = $('bladeLit'); if(main) main.setAttribute('width', (532*Math.min(100,pct)/100).toFixed(1));
    var small = $('mgBladeLit'); if(small) small.setAttribute('width', (532*Math.min(100,pct)/100).toFixed(1));
    var set=function(id,t){ var e=$(id); if(e) e.textContent=t; };
    set('bladePct', pct.toFixed(1)+'%');
    set('bladeNum', sum+' / '+tot.toLocaleString('en-US')+' 枚符文');
    set('mgPct', pct.toFixed(1));
    set('casePct', pct.toFixed(1)+'% · '+sum+' / '+tot);
    var litSites = cells.filter(function(c){ return c.total && c.done/c.total>=.6; }).length;
    var q = [
      ['hot','主线 · 拾起第一枚符文', sum ? 'IN PROGRESS' : 'UNBEGUN'],
      ['','今日委托 / 三枚待刻', 'III'],
      ['hot','已点亮遗迹', litSites+' / XL'],
      ['','铁剑锻造进度', pct.toFixed(1)+'%']
    ];
    if($('questList')) $('questList').innerHTML = q.map(function(x){
      return '<li><span class="diamond'+(x[0]?' hot':'')+'"></span><b>'+x[1]+'</b><em>'+x[2]+'</em></li>';
    }).join('');
    return {cells:cells, pct:pct, sum:sum, tot:tot};
  }

  /* ---------------- 四十处遗迹 ---------------- */
  function renderSites(f) {
    var g = $('siteGrid'); if(!g) return;
    if(g.children.length !== 40) {
      var h=''; for(var n=1;n<=40;n++) h += '<div class="site" data-no="'+n+'">'+String(n).padStart(2,'0')+'</div>';
      g.innerHTML = h;
      Array.prototype.forEach.call(g.children, function(el){
        var no = +el.dataset.no;
        el.addEventListener('mouseenter', function(){
          var c=f.cells[no-1]; $('siteTip').textContent='遗迹 '+String(no).padStart(2,'0')+' · Word List '+no+' — 已刻 '+c.done+' / '+c.total+' 枚符文（点击开卷）';
        });
        el.addEventListener('mouseleave', function(){ $('siteTip').textContent='每一格是一处遗迹，对应一个 Word List；着墨越深，这一处的词记得越牢。'; });
        el.addEventListener('click', function(){
          var sel=$('listStudy'); if(sel){ sel.value='Word List '+no; try{ if(typeof sel.onchange==='function') sel.onchange(); }catch(e){} }
          go('study');
        });
      });
    }
    Array.prototype.forEach.call(g.children, function(el,i){
      var c=f.cells[i], r=c.total?c.done/c.total:0;
      el.style.background = r>0 ? 'rgba(141,47,36,'+(0.10+0.86*Math.min(1,r)).toFixed(2)+')' : '';
      el.classList.toggle('lit', r>0.55);
    });
  }

  /* ---------------- 今日三枚符文 ---------------- */
  function renderRunes() {
    var box=$('runeRow'); if(!box||!WORDS.length) return;
    var m=masteredSet(), seed=todaySeed();
    var pool = WORDS.filter(function(w){ return w.hot===1 && !m.has(w.word) && w.definition; });
    if(pool.length<3) pool = WORDS.filter(function(w){ return !m.has(w.word) && w.definition; });
    if(pool.length<3) pool = WORDS.filter(function(w){ return w.definition; });
    var picks=[0,1,2].map(function(k){ return pool[Math.abs(seed*7+k*911+137)%pool.length]; });
    box.innerHTML = picks.map(function(w,i){
      return '<div class="rune" data-word="'+esc(w.word)+'"><div class="no">SORT 0'+(i+1)+' · '+esc(w.list||'')+'</div>'+
        '<div class="w">'+esc(w.word)+'</div><div class="ph">'+esc(w.phonetic||'')+'</div>'+
        '<div class="df">'+esc(w.definition||'')+'</div><div class="go">拾起这枚符文 →</div></div>';
    }).join('');
    Array.prototype.forEach.call(box.children, function(el){
      el.addEventListener('click', function(){
        var name=el.dataset.word, w=null;
        for(var i=0;i<WORDS.length;i++) if(WORDS[i].word===name){ w=WORDS[i]; break; }
        if(w) goWord(w);
      });
    });
  }

  /* ---------------- 页边批注（真实短句） ---------------- */
  function renderMarginalia() {
    var box=$('mgNote'); if(!box||!SENTS.length) return;
    var short=SENTS.filter(function(s){ return (s.en||'').length<96 && (s.zh||'').length<38 && (s.en||'').length>12; });
    var pool = short.length>30 ? short : SENTS;
    var s = pool[Math.abs(todaySeed()*13)%pool.length];
    box.innerHTML = '<div class="lbl">Marginalia · 今日批注</div><div class="en">'+esc(s.en||'')+'</div><div class="zh">'+esc((s.zh||'').slice(0,46))+'</div>';
  }

  /* ---------------- 版本记 ---------------- */
  function renderColophon() {
    var set=function(id,t){ var e=$(id); if(e) e.textContent=t; };
    set('coloWords', WORDS.length.toLocaleString('en-US'));
    set('coloSents', SENTS.length.toLocaleString('en-US'));
    set('heroWords', WORDS.length.toLocaleString('en-US'));
  }

  /* ---------------- 词条铭牌：当前词的真实元数据 ---------------- */
  function spCell(label, value, on) {
    return '<div class="sp-cell"><span>'+label+'</span><b class="'+(on?'on':'')+'">'+esc(value)+'</b></div>';
  }
  function renderSpecimen() {
    var card = document.querySelector('#study .word-card'); if(!card) return;
    var s = $('entrySpecimen');
    if(!s){ s=document.createElement('div'); s.className='specimen'; s.id='entrySpecimen'; card.appendChild(s); }
    var w = null;
    try { if(typeof window.activeWord==='function') w=window.activeWord(); } catch(e){}
    if(!w || !w.word){
      var t=($('word')||{}).textContent||'';
      for(var i=0;i<WORDS.length;i++) if(WORDS[i].word===t){ w=WORDS[i]; break; }
    }
    if(!w || !w.word) return;
    var pos=WORDS.indexOf(w)+1, pad=function(n,k){ return String(n).padStart(k,'0'); };
    var hot=w.hot===1;
    s.innerHTML = '<div class="sp-head"><span>Type specimen · 词条铭牌</span><b>No. '+pad(pos,4)+'</b></div>'+
      '<div class="sp-grid">'+
      spCell('Situs / 字屉', w.list||'—', false)+
      spCell('Ordo / 分级', w.tier||'—', false)+
      spCell('Frequentia', hot?'高考高频':'常规', hot)+
      spCell('XX dies', w.day?('Day '+pad(w.day,2)):'—', false)+
      spCell('Positio', pad(pos,4)+' / '+WORDS.length, false)+
      spCell('Examen', w.exam?'有真题例句':'—', !!w.exam)+
      '</div>';
  }

  /* ---------------- 页边技艺刻度：当前走到第几章 ---------------- */
  function renderPath() {
    var box=$('mgPath'); if(!box) return;
    var v=document.querySelector('.view:not(.hidden)');
    var cur=parseInt((CH[v?v.id:'home']||CH.home).no,10);
    var h=''; for(var i=1;i<=13;i++) h+='<i class="'+(i===cur?'on':(i<cur?'past':''))+'"></i>';
    box.innerHTML=h;
  }

  function refreshAll() {
    var f = renderForge();
    renderSites(f); renderRunes(); renderMarginalia(); renderColophon(); renderSpecimen(); syncHeader();
  }

  /* ---------------- 卷首场景：同一世界的时间轮换 ---------------- */
  var SCENES = [
    { file:'assets/scene-01.jpg', la:'BOREALIS', zh:'北境黎明' },
    { file:'assets/scene-02.jpg', la:'PRUINA',   zh:'霜华清晨' },
    { file:'assets/scene-03.jpg', la:'SILVA',    zh:'寒松密林' },
    { file:'assets/scene-04.jpg', la:'PORTA',    zh:'雪堡之门' },
    { file:'assets/scene-05.jpg', la:'ATRIUM',   zh:'冷石内庭' }
  ];
  var CYCLES = { daily:1, weekly:1, monthly:1, hour:1, visit:1, fixed:1 };
  var CYCLE_KEY = 'hs-vale-cycle', SCENE_KEY = 'hs-vale-scene', VISIT_KEY = 'hs-vale-visit';
  function storeGet(k,d){ try{ var v=window.localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } }
  function storeSet(k,v){ try{ window.localStorage.setItem(k,String(v)); }catch(e){} }
  function dayNumber(){
    var d=new Date();
    return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);
  }
  function weekNumber(){
    var d=new Date(), t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    var day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day);
    var y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));
    return Math.ceil((((t-y0)/86400000)+1)/7);
  }
  function autoIndex(cycle){
    var d=new Date();
    if(cycle==='daily')   return dayNumber()%SCENES.length;
    if(cycle==='weekly')  return weekNumber()%SCENES.length;
    if(cycle==='monthly') return (d.getFullYear()*12+d.getMonth())%SCENES.length;
    if(cycle==='hour'){
      var h=d.getHours();
      if(h>=5&&h<9) return 2;
      if(h>=9&&h<16) return 0;
      if(h>=16&&h<20) return 1;
      return 4;
    }
    if(cycle==='visit'){
      var v=null; try{ v=window.sessionStorage.getItem(VISIT_KEY); }catch(e){}
      if(v==null){
        v=String(Math.abs((Date.now()/1000)|0)%SCENES.length);
        try{ window.sessionStorage.setItem(VISIT_KEY,v); }catch(e){}
      }
      return (parseInt(v,10)||0)%SCENES.length;
    }
    var s=parseInt(storeGet(SCENE_KEY,'0'),10);
    return isNaN(s)?0:s%SCENES.length;
  }
  function applyScene(i, animate){
    var s=SCENES[i], img=$('heroImg');
    if(!img||!s) return;
    var pre=new Image();
    pre.onload=function(){ img.src=s.file; img.alt=s.zh+' · '+s.la; img.style.opacity='1'; };
    pre.onerror=function(){ img.style.opacity='1'; };
    pre.src=s.file;
    if(animate) img.style.opacity='0';
    var la=$('sceneLa'), zh=$('sceneZh');
    if(la){ la.textContent=s.la; la.classList.remove('flip'); void la.offsetWidth; la.classList.add('flip'); }
    if(zh) zh.textContent=s.zh;
    storeSet(SCENE_KEY,String(i));
  }
  function initScenes(){
    var sel=$('sceneCycle'); if(!sel) return;
    var cycle=storeGet(CYCLE_KEY,'daily');
    if(!CYCLES[cycle]) cycle='daily';
    sel.value=cycle;
    applyScene(autoIndex(cycle), false);
    sel.addEventListener('change',function(){
      var c=sel.value; storeSet(CYCLE_KEY,c);
      applyScene(autoIndex(c), true);
    });
    var next=$('sceneNext');
    if(next) next.addEventListener('click',function(){
      var cur=parseInt(storeGet(SCENE_KEY,'0'),10)||0;
      storeSet(CYCLE_KEY,'fixed'); sel.value='fixed';
      applyScene((cur+1)%SCENES.length, true);
    });
    /* 页面一直开着也会按时间自动换，不必刷新 */
    var lastDay=dayNumber(), lastHour=new Date().getHours();
    setInterval(function(){
      var c=storeGet(CYCLE_KEY,'daily');
      if(c==='fixed'||c==='visit') return;
      var nd=dayNumber(), nh=new Date().getHours();
      if(nd!==lastDay){ lastDay=nd; applyScene(autoIndex(c), true); }
      else if(c==='hour' && nh!==lastHour){ lastHour=nh; applyScene(autoIndex('hour'), true); }
    },60000);
    /* 空闲时预载其余场景，切换不等待 */
    setTimeout(function(){ SCENES.forEach(function(s){ var im=new Image(); im.src=s.file; }); },1600);
  }

  /* ---------------- 火漆封印反馈 ---------------- */
  function wax() {
    var s=$('waxSeal'); if(!s) return;
    s.classList.remove('go'); void s.offsetWidth; s.classList.add('go');
  }
  ['master','sMaster'].forEach(function(id){
    var b=$(id); if(!b) return;
    b.addEventListener('click', function(){
      var before=b.textContent||'';
      setTimeout(function(){
        var after=b.textContent||'';
        if(after.indexOf('已掌握')===0 && before.indexOf('已掌握')!==0) wax();
        refreshAll();
      },0);
    });
  });

  /* ---------------- 移动端目次抽屉 ---------------- */
  function bindDrawer() {
    var toc=$('toc'), mask=$('navMask'), btn=$('menuBtn'), close=$('navClose');
    function open(){ if(toc) toc.classList.add('open'); if(mask) mask.classList.add('show'); }
    function shut(){ if(toc) toc.classList.remove('open'); if(mask) mask.classList.remove('show'); }
    if(btn) btn.addEventListener('click',open);
    if(mask) mask.addEventListener('click',shut);
    if(close) close.addEventListener('click',shut);
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') shut(); });
    document.querySelectorAll('.tab').forEach(function(t){
      t.addEventListener('click',function(){ setTimeout(shut,60); });
    });
  }
  function bindEntries() {
    document.querySelectorAll('[data-go]').forEach(function(b){
      b.addEventListener('click',function(){ go(b.dataset.go); });
    });
  }

  function init() {
    bindDrawer(); bindEntries(); initScenes();
    if($('folioDate')) $('folioDate').textContent = dateLabel();
    refreshAll();
    var learned=$('learned');
    if(learned && window.MutationObserver){
      var mo=new MutationObserver(function(){ refreshAll(); });
      mo.observe(learned,{childList:true,characterData:true,subtree:true});
    }
    var wEl=$('word');
    if(wEl && window.MutationObserver){
      var wm=new MutationObserver(function(){ renderSpecimen(); });
      wm.observe(wEl,{childList:true,characterData:true,subtree:true});
    }
    if(window.MutationObserver){
      var vm=new MutationObserver(function(){ syncHeader(); });
      document.querySelectorAll('.view').forEach(function(v){ vm.observe(v,{attributes:true,attributeFilter:['class']}); });
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
