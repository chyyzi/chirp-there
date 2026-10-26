/* 故事与收藏。惊扰按真正逃离计数；投喂按实际吃掉一份计数，同一只鸟可重复贡献。
 * 优先级：惊扰>=2 → bad；观察齐全+零惊扰+投喂>=2 → dream；否则观察齐全 → dusk。
 * 惊扰1次归普通结局；所有结局在终点确认。
 */
'use strict';
class ChirpSession {
  constructor(app){
    this.app=app;this.endingNames={dusk:'结局 1 · 林间向晚',bad:'结局 2 · 无声的林地',dream:'结局 3 · 群鸟之约'};
    const mode=ChirpStore.readJSON('chirp-mode','observe');this.mode=['observe','story'].includes(mode)?mode:'observe';
    const saved=ChirpStore.readJSON('chirp-endings-v1',[]);
    this.unlockedEndings=new Set((Array.isArray(saved)?saved:[]).filter(id=>Object.hasOwn(this.endingNames,id)));
    const environment=ChirpStore.readJSON('chirp-observation-environment','normal');
    this.observationEnvironment=['normal','dusk','bad','dream'].includes(environment)?environment:'normal';
    this.observed=new Set();this.feedCount=0;this.disturbanceCount=0;
    this.consumedFoods=new WeakSet();this.escapeEvents=new WeakMap();
    this.watch={};this.ending=null;this.timer=0;this.generation=0;
    document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>this.chooseMode(b.dataset.mode)));
    document.querySelectorAll('[data-ending]').forEach(b=>b.addEventListener('click',()=>this.finish(b.dataset.ending)));
    document.querySelectorAll('[data-observation-scene]').forEach(b=>b.addEventListener('click',()=>this.chooseObservationEnvironment(b.dataset.observationScene)));
    app.$('close-ending').addEventListener('click',()=>app.closeModal());
    app.$('stay-ending').addEventListener('click',()=>app.closeModal());
    app.$('replay-story').addEventListener('click',()=>{this.chooseMode('story',true);app.closeModal();});
    app.$('ending-observe').addEventListener('click',()=>{this.chooseMode('observe',true);app.closeModal();});
    app.$('restart-round').addEventListener('click',()=>{this.reset();app.toast('新一轮已开始。');});
    app.$('book-ending').addEventListener('click',()=>this.openEnding());this.updateUI();
  }
  allEndingsUnlocked(){return Object.keys(this.endingNames).every(id=>this.unlockedEndings.has(id));}
  chooseMode(mode,force=false){
    if(!['observe','story'].includes(mode)||(!force&&this.mode===mode))return;
    this.mode=mode;ChirpStore.writeJSON('chirp-mode',mode);
    if(this.app.world?.ready)this.reset();this.updateUI();
    if(this.app.started)this.app.toast((mode==='observe'?'观察模式：沿着小路自由探索。':'故事开始：寻找沿路的三只鸟。'),4500);
  }
  chooseObservationEnvironment(name){
    if(this.mode!=='observe'||!this.allEndingsUnlocked()||this.transitioning||!this.app.world?.ready||!['normal','dusk','bad','dream'].includes(name))return false;
    this.observationEnvironment=name;
    const saved=ChirpStore.writeJSON('chirp-observation-environment',name);
    this.app.world.applyEnvironment(name);this.app.birdSystem?.setEndingVisible(true);this.updateUI();
    this.app.toast(saved?'场景已切换。':'场景已切换。本次设置未保存，下次进入需重新选择。');return true;
  }
  reset(){
    this.transitioning=false;this.generation++;clearTimeout(this.transitionTimer);this.app.$('environment-veil').classList.remove('active');
    this.observed.clear();this.feedCount=0;this.disturbanceCount=0;this.consumedFoods=new WeakSet();this.escapeEvents=new WeakMap();
    this.watch={};this.ending=null;this.timer=0;
    this.app.inventory?.reset();this.app.birdSystem?.reset();this.app.birdSystem?.setEndingVisible(this.mode==='observe');
    const environment=this.mode==='observe'&&this.allEndingsUnlocked()?this.observationEnvironment:'normal';
    this.app.world?.applyEnvironment(environment);this.app.player?.reset();this.app.setCameraMode(false);this.updateUI();
  }
  isRouteBird(b){return !!b&&!b.fixed&&CHIRP_CONFIG.birds.species.some(spec=>spec.id===b.spec?.id);}
  recording(){return this.mode==='story'&&!this.ending;}
  record(birds){
    if(!this.recording())return;
    for(const b of birds)if(this.isRouteBird(b)&&!this.observed.has(b.spec.id)){this.observed.add(b.spec.id);this.app.toast('本轮观察完成：'+b.spec.name+'（'+this.observed.size+'/3）',2400);}
    this.updateUI();
  }
  recordDisturbance(b){
    if(!this.recording()||!this.isRouteBird(b)||b.state!=='flee'||!b.escapeSerial||this.escapeEvents.get(b)===b.escapeSerial)return false;
    this.escapeEvents.set(b,b.escapeSerial);this.disturbanceCount++;this.updateUI();return true;
  }
  recordFeeding(b,food){
    // consume 成功后 active=false，同一份食物重复回调也只计一次。
    if(!this.recording()||!this.isRouteBird(b)||!food||food.active!==false||this.consumedFoods.has(food))return false;
    this.consumedFoods.add(food);this.feedCount++;this.updateUI();return true;
  }
  eligibleEnding(){
    if(this.mode!=='story')return null;
    if(this.disturbanceCount>=CHIRP_CONFIG.story.badDisturbances)return 'bad';
    if(this.observed.size!==CHIRP_CONFIG.birds.species.length)return null;
    if(this.disturbanceCount===0&&this.feedCount>=CHIRP_CONFIG.story.dreamFeedings)return 'dream';
    return 'dusk';
  }
  distance(){const p=this.app.player?.el.object3D.position,f=CHIRP_CONFIG.story.final;return p?Math.hypot(p.x-f.x,p.z-f.z):Infinity;}
  canEnd(){return !!this.eligibleEnding()&&this.distance()<CHIRP_CONFIG.story.finalRadius;}
  openEnding(){
    if(this.mode!=='story'){this.app.toast('切换到故事模式可体验结局。');return;}
    if(!this.ending&&!this.canEnd()){this.app.toast(this.eligibleEnding()?'请走到北侧大树下，再按 G 确认本轮结局。':'先安静观察沿路三只鸟，再到北侧大树下按 G。');return;}
    this.app.openModal('ending');this.updateUI();
  }
  finish(name){
    if(name!==this.eligibleEnding()||!this.canEnd()||this.ending)return false;
    this.transitioning=true;this.app.inventory?.cancelHand();this.ending=name;const generation=++this.generation;
    this.app.$('environment-veil').classList.add('active');
    this.transitionTimer=setTimeout(()=>{
      if(generation!==this.generation)return;
      this.transitioning=false;this.app.world.applyEnvironment(name);this.app.birdSystem.setEndingVisible(name!=='bad');
      this.app.$('environment-veil').classList.remove('active');
      // 转场完成才收藏；仅打开窗口、取消或过期回调不会解锁。
      const newlyUnlocked=!this.unlockedEndings.has(name);this.unlockedEndings.add(name);
      const saved=ChirpStore.writeJSON('chirp-endings-v1',[...this.unlockedEndings]);this.updateUI();
      if(!saved)this.app.toast('本次结局未能保存，请检查浏览器存储设置。',6000);
      else if(newlyUnlocked)this.app.toast(this.allEndingsUnlocked()?'三个结局已集齐！观察模式的场景切换已解锁。':'已收藏 '+this.endingNames[name]+'（'+this.unlockedEndings.size+'/3）',5500);
    },CHIRP_CONFIG.story.transitionSeconds*500);
    this.updateUI();return true;
  }
  updateUI(){
    const app=this.app,eligible=this.eligibleEnding(),allUnlocked=this.allEndingsUnlocked();
    document.querySelectorAll('[data-mode]').forEach(b=>{const selected=b.dataset.mode===this.mode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
    for(const id of ['stay-ending','replay-story','ending-observe','close-ending'])app.$(id).disabled=!!this.transitioning;
    const tally='观察 '+this.observed.size+'/3 · 惊扰 '+this.disturbanceCount+' 次 · 投喂 '+this.feedCount+' 次';
    const text=this.mode==='observe'?'观察模式 · 六只鸟，自由探索':this.ending?this.endingNames[this.ending]:'故事模式 · '+tally;
    app.$('mode-status').textContent=text;app.$('round-status').textContent=text;
    app.$('round-tally').hidden=this.mode!=='story';app.$('round-tally').textContent=tally;
    const reason=eligible==='bad'?'惊扰已达 '+CHIRP_CONFIG.story.badDisturbances+' 次，本轮通向坏结局。':eligible==='dream'?'三鸟观察完成，零惊扰，成功投喂至少 '+CHIRP_CONFIG.story.dreamFeedings+' 次。':eligible==='dusk'?(this.disturbanceCount===1?'三鸟观察完成；本轮惊扰 1 次，归入普通结局。':'三鸟观察完成，零惊扰；成功投喂尚未达到 '+CHIRP_CONFIG.story.dreamFeedings+' 次。'):'安静地观察路线三只鸟，各停留 '+CHIRP_CONFIG.story.observeSeconds+' 秒，或拍照记录。';
    app.$('story-task').textContent=this.mode==='observe'?'自由观察、拍照，寻找散落的浆果。':this.ending?'故事已结束。可以留在此刻拍照，或开始新一轮。':reason+(eligible?' 到北侧大树下按 G，确认本轮结局。':'');
    app.$('book-ending').hidden=this.mode!=='story';app.$('book-ending').disabled=!this.ending&&!this.canEnd();
    app.$('ending-title').textContent=this.ending?'已收入故事收藏':'大树下的尾声';
    app.$('ending-reason').textContent=reason;
    app.$('ending-choices').hidden=!!this.ending;app.$('ending-result').hidden=!this.ending;
    document.querySelectorAll('[data-ending]').forEach(b=>{b.hidden=b.dataset.ending!==eligible;b.disabled=!!this.ending||!this.canEnd()||b.hidden;});
    if(this.ending){app.$('ending-result-title').textContent=this.endingNames[this.ending];app.$('ending-result-text').textContent=this.transitioning?'风景正在慢慢变换…':{dusk:'暮色落在树梢，三位小小邻居安静地留在这里。',bad:'树下没有等候的身影。停下来，下一次也许可以更温柔地靠近。',dream:'微光浮在林间，三只鸟在大树下与你再次相遇。'}[this.ending];}
    app.$('ending-collection-count').textContent=this.unlockedEndings.size+' / 3';
    document.querySelectorAll('[data-ending-stamp]').forEach(el=>{const id=el.dataset.endingStamp,unlocked=this.unlockedEndings.has(id);el.classList.toggle('unlocked',unlocked);el.textContent=this.endingNames[id]+' · '+(unlocked?'已收藏':'未解锁');});
    app.$('observation-scene-help').textContent=!allUnlocked?'集齐三个故事结局后，可在观察模式切换四种场景。':this.mode!=='observe'?'场景切换已解锁。进入观察模式后即可选择。':'选择喜欢的光线与色调，继续探索。';
    document.querySelectorAll('[data-observation-scene]').forEach(b=>{
      const selected=this.mode==='observe'&&b.dataset.observationScene===(allUnlocked?this.observationEnvironment:'normal');
      b.disabled=this.mode!=='observe'||!allUnlocked||!!this.transitioning;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));
    });
    app.$('final-prompt').hidden=!this.canEnd()||!!this.ending;
    app.$('final-prompt-name').textContent=eligible?this.endingNames[eligible]:'';
  }
  tick(dt){
    this.timer+=dt;if(this.timer<.2)return;const elapsed=this.timer;this.timer=0;
    if(this.recording()){
      const watching=(!this.app.player.moving||this.app.player.mode==='crouch')?this.app.birdSystem.targets(this.app.camera).filter(b=>!b.fixed&&b.alert<CHIRP_CONFIG.birds.alertThreshold):[];
      const ids=new Set(watching.map(b=>b.spec.id));
      for(const spec of CHIRP_CONFIG.birds.species)this.watch[spec.id]=ids.has(spec.id)?(this.watch[spec.id]||0)+elapsed:0;
      this.record(watching.filter(b=>this.watch[b.spec.id]>=CHIRP_CONFIG.story.observeSeconds));
    }
    this.updateUI();
  }
}
window.ChirpSession=ChirpSession;
