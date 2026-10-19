/* 动画控制只负责姿态；位置变化由 birds.js 负责。
 * 手动归一化混合权重：即使淡入过程中再次受惊切换，也不会突然回到绑定姿态。
 */
'use strict';
class ChirpAnimator {
  constructor(model,clips,spec){
    this.mixer=new AFRAME.THREE.AnimationMixer(model);this.spec=spec;this.actions={};this.current=null;this.blend=null;
    for(const clip of clips)this.actions[clip.name]=this.mixer.clipAction(clip).setEffectiveWeight(0);
  }
  play(state,{restart=false,speed=1}={}){
    const next=this.actions[this.spec.clips[state]]||this.actions[this.spec.clips.idle];
    if(!next)return 0;
    if(next===this.current&&!restart)return next.getClip().duration/speed;
    const T=AFRAME.THREE,from=new Map();let total=0;
    for(const a of Object.values(this.actions)){const weight=a.isScheduled()?a.getEffectiveWeight():0;from.set(a,weight);total+=weight;}
    next.stopFading().stopWarping().reset().setEffectiveTimeScale(speed);
    const once=['look','alert','friendly','eat','call'].includes(state)&&next!==this.actions[this.spec.clips.idle];
    next.setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.play();
    if(total>.0001){for(const [a,w] of from)from.set(a,w/total);this.blend={from,to:next,elapsed:0};next.setEffectiveWeight(from.get(next)||0);}
    else {next.setEffectiveWeight(1);this.blend=null;}
    this.current=next;return next.getClip().duration/speed;
  }
  update(dt){
    if(this.blend){
      const b=this.blend;b.elapsed+=dt;const t=Math.min(1,b.elapsed/CHIRP_CONFIG.birds.crossFade);
      for(const a of Object.values(this.actions)){
        const w=(b.from.get(a)||0)*(1-t)+(a===b.to?t:0);a.setEffectiveWeight(w);
        if(t===1&&a!==b.to){a.stop();a.setEffectiveWeight(0);}
      }
      if(t===1)this.blend=null;
    }
    this.mixer.update(dt);
  }
  reset(){this.mixer.stopAllAction();for(const a of Object.values(this.actions))a.setEffectiveWeight(0);this.current=null;this.blend=null;this.play('idle');this.mixer.update(0);}
}
window.ChirpAnimator=ChirpAnimator;
