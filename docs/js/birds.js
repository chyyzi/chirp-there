/* 鸟类状态机：idle/look/call → alert → flee/hidden；食物 → approach/eat/return。
 * 终点三只：idle/call → receive/eat → idle，可反复投喂；不参与警觉与路线任务计数。
 */
'use strict';
AFRAME.registerComponent('chirp-birds',{
  init(){
    this.birds=[];this.ready=false;this.clock=0;this.raycaster=new AFRAME.THREE.Raycaster();
    this.worldReady=()=>this.build();window.addEventListener('chirp-world-ready',this.worldReady);
  },
  async build(){
    const T=AFRAME.THREE;this.world=document.getElementById('forest-world').components['chirp-world'];this.nav=new ChirpNavigation(this.world);
    const jobs=[];
    for(const fixed of [false,true])for(const spec of CHIRP_CONFIG.birds.species){
      const pos=fixed?CHIRP_CONFIG.endingPerches.find(p=>p.id===spec.id):spec;
      const root=new T.Group();root.name=(fixed?'ending-':'route-')+spec.id;
      let y=pos.y;if(y==null)y=this.world.floorAt(pos.x,pos.z,100,true)??0;
      root.position.set(pos.x,y+.025,pos.z);root.rotation.y=pos.yaw||0;
      if(!fixed&&!spec.perch){
        const safe=this.nav.point(pos.x,pos.z);
        if(safe)root.position.copy(safe);
        else {for(let r=.4;r<5;r+=.4){let found=false;for(let a=0;a<Math.PI*2;a+=.5){const p=this.nav.point(pos.x+Math.cos(a)*r,pos.z+Math.sin(a)*r);if(p){root.position.copy(p);found=true;break;}}if(found)break;}}
      }
      const label=this.label(spec.name),indicator=this.label('!',true);label.position.y=spec.modelHeight+.35;indicator.position.y=spec.modelHeight+.7;indicator.visible=false;
      const markers=new T.Group();markers.add(label,indicator);markers.visible=!window.ChirpApp?.interfaceHidden;root.add(markers);
      const bird={spec,root,label,indicator,fixed,home:root.position.clone(),homeYaw:root.rotation.y,state:'idle',stateTime:0,alert:0,calmTime:0,callTimer:8+this.birds.length*5,foodTimer:1,walkTimer:5+this.birds.length,lookCooldown:0,friendlyCooldown:0,materials:[],path:null,food:null,opacity:1};
      bird.markers=markers;this.el.object3D.add(root);root.visible=false;this.birds.push(bird);jobs.push(this.loadModel(bird));
    }
    const loaded=await Promise.allSettled(jobs);this.ready=true;
    this.setEndingVisible(window.ChirpApp?.session?.mode==='observe');
    const failures=loaded.filter(x=>x.status==='rejected');
    if(failures.length)window.dispatchEvent(new CustomEvent('chirp-error',{detail:'部分鸟类模型加载失败，请检查 assets/model/birds，刷新重试。'}));
    window.dispatchEvent(new CustomEvent('chirp-birds-ready',{detail:{ok:!failures.length,count:this.birds.length}}));
  },
  label(text,alert=false){
    const T=AFRAME.THREE,c=document.createElement('canvas');c.width=256;c.height=alert?256:80;
    const ctx=c.getContext('2d');ctx.fillStyle=alert?'#fff1dce8':'#263e32c0';ctx.beginPath();ctx.roundRect(8,8,240,c.height-16,alert?100:20);ctx.fill();ctx.font=alert?'bold 150px sans-serif':'30px "Microsoft YaHei",sans-serif';ctx.fillStyle=alert?'#9e633d':'#fffbe9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,c.height/2);
    const sprite=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),transparent:true,depthTest:true}));sprite.scale.set(alert?.4:1.45,alert?.4:.45,1);return sprite;
  },
  loadModel(b){return new Promise((resolve,reject)=>{
    const el=document.createElement('a-entity');this.el.appendChild(el);
    el.addEventListener('model-loaded',e=>{
      const model=el.getObject3D('mesh'),animations=model.animations||e.detail.model.animations||[];
      el.removeObject3D('mesh');el.remove();
      const T=AFRAME.THREE;model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model),scale=b.spec.modelHeight/(box.max.y-box.min.y);
      model.scale.setScalar(scale);model.position.y=-box.min.y*scale+(b.spec.id==='dove'?.055:b.spec.id==='bulbul'?.015:0);
      model.traverse(m=>{if(!m.isMesh)return;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;
        const mats=(Array.isArray(m.material)?m.material:[m.material]).map(mat=>{const c=mat.clone();c.transparent=false;c.opacity=1;c.alphaHash=false;b.materials.push(c);return c;});m.material=Array.isArray(m.material)?mats:mats[0];});
      b.root.add(model);b.model=model;b.animator=new ChirpAnimator(model,animations,b.spec);b.animator.reset();b.root.visible=!b.fixed;resolve(b);
    },{once:true});
    el.addEventListener('model-error',e=>{el.remove();reject(e);},{once:true});el.setAttribute('gltf-model',b.spec.model);
  });},
  setState(b,state,force=false){
    if(b.state===state&&!force)return;
    b.state=state;b.stateTime=0;
    const clipState=['approach','return'].includes(state)?'walk':state==='receive'?'look':
      b.fixed&&b.spec.id==='bulbul'&&state==='eat'?'call':state;
    b.actionDuration=b.animator?.play(clipState,{restart:force,speed:state==='flee'?1.6:1})||2;
    if(state==='call')this.call(b);
    this.el.emit('bird-state',{id:b.spec.id,state,alert:b.alert,fixed:b.fixed},false);
  },
  call(b){
    const app=window.ChirpApp;if(!app?.player)return;
    const T=AFRAME.THREE,eye=app.camera.getWorldPosition(new T.Vector3()),v=b.root.position.clone().sub(eye),d=v.length();
    if(d<28){const right=new T.Vector3(1,0,0).applyQuaternion(app.camera.getWorldQuaternion(new T.Quaternion()));app.audio?.bird(b.spec.call,b.spec.id,ChirpCore.clamp(v.normalize().dot(right),-1,1),Math.max(.05,1-d/28));}
    this.el.emit('bird-call',{id:b.spec.id,file:b.spec.call},false);
  },
  opacity(b,value){
    value=ChirpCore.clamp(value,0,1);b.opacity=value;
    for(const m of b.materials){const hashed=value<.999;if(m.alphaHash!==hashed){m.alphaHash=hashed;m.needsUpdate=true;}m.opacity=value;}
  },
  center(b){return b.root.position.clone().add(new AFRAME.THREE.Vector3(0,b.spec.modelHeight*.55,0));},
  lineOfSight(from,to){
    const T=AFRAME.THREE,dir=new T.Vector3().subVectors(to,from),d=dir.length();if(d<.1)return true;
    const ray=new T.Ray(from.clone(),dir.normalize());
    for(const tree of [this.world.obstacleTree,this.world.floorTree]){const hit=tree.rayIntersect(ray);if(hit&&hit.distance>0.08&&hit.distance<d-.12)return false;}return true;
  },
  targets(camera){
    if(!this.ready)return [];
    const T=AFRAME.THREE,eye=camera.getWorldPosition(new T.Vector3());camera.updateMatrixWorld();
    return this.birds.filter(b=>{if(!b.model||!b.root.visible||b.opacity<.9||['flee','hidden'].includes(b.state))return false;const p=this.center(b),screen=p.clone().project(camera);return Math.abs(screen.x)<.88&&Math.abs(screen.y)<.84&&screen.z>-1&&screen.z<1&&p.distanceTo(eye)<CHIRP_CONFIG.birds.photoDistance&&this.lineOfSight(eye,p);});
  },
  face(b,target,dt){
    const angle=Math.atan2(target.x-b.root.position.x,target.z-b.root.position.z),d=Math.atan2(Math.sin(angle-b.root.rotation.y),Math.cos(angle-b.root.rotation.y));b.root.rotation.y+=d*(1-Math.exp(-dt*5));
  },
  movePath(b,dt,speed=CHIRP_CONFIG.inventory.birdSpeed){
    if(!b.path?.length)return true;
    const p=b.root.position,target=b.path[0],distance=p.distanceTo(target);this.face(b,target,dt);
    if(distance<speed*dt+.025){p.copy(target);b.path.shift();}else p.addScaledVector(target.clone().sub(p).normalize(),speed*dt);
    return !b.path.length;
  },
  releaseFood(b){if(b.food?.claimed===b)b.food.claimed=null;b.food=null;},
  goHome(b){
    this.releaseFood(b);b.path=this.nav.path(b.root.position,b.home);
    if(b.path?.length)this.setState(b,'return');else this.setState(b,'idle');
  },
  flee(b,player){
    if(b.fixed||['flee','hidden','reappear'].includes(b.state))return;
    this.releaseFood(b);b.path=null;
    if(!b.spec.perch){const T=AFRAME.THREE,d=b.root.position.clone().sub(player);d.y=0;if(d.lengthSq()<.01)d.set(1,0,0);d.normalize();
      for(const angle of [0,.7,-.7,1.4,-1.4]){const v=d.clone().applyAxisAngle(new T.Vector3(0,1,0),angle);const end=this.nav.point(b.root.position.x+v.x*3,b.root.position.z+v.z*3,b.root.position.y+.5);if(end){b.path=this.nav.path(b.root.position,end);if(b.path)break;}}
    }
    b.escapeSerial=(b.escapeSerial||0)+1;
    this.setState(b,'flee');this.call(b);window.ChirpApp?.session?.recordDisturbance(b);window.ChirpApp?.toast(b.spec.name+'受惊躲开了。放轻脚步，稍后再来。');
  },
  setEndingVisible(visible){
    this.endingVisible=visible;
    if(!visible)window.ChirpApp?.inventory?.cancelOffering();
    for(const b of this.birds)if(b.fixed){
      b.root.visible=visible&&!!b.model;
      if(!visible){this.releaseFood(b);this.setState(b,'idle');b.indicator.visible=false;}
    }
  },
  canAcceptOffering(b){
    return !!(b?.fixed&&b.model&&b.root.visible&&!b.food&&b.foodTimer<=0&&['idle','call','look','friendly'].includes(b.state));
  },
  acceptOffering(b,food){
    if(!this.canAcceptOffering(b))return false;
    this.releaseFood(b);b.food=food;food.claimed=b;b.ate=false;b.path=null;
    this.setState(b,'receive');return true;
  },
  tickEndingBird(b,dt,player,app){
    // 固定鸟始终留在树枝 / 树桩 / 地面原位；冲刺、站立和反复靠近都不积累警觉。
    b.alert=0;b.indicator.visible=false;b.label.visible=b.root.visible&&b.root.position.distanceTo(player)<17;
    if(!b.root.visible)return;
    b.callTimer-=dt;b.foodTimer=Math.max(0,b.foodTimer-dt);
    if(b.food&&!b.food.active&&!b.ate){this.releaseFood(b);this.setState(b,'idle');}
    if(b.state==='receive'){
      if(!b.food){this.setState(b,'idle');return;}
      if(b.food.arrived)this.setState(b,'eat');
      return;
    }
    if(b.state==='eat'){
      if(!b.ate&&b.stateTime>=b.actionDuration*.55){
        if(!app.inventory?.consume(b.food,b)){app.inventory?.cancelOffering();this.releaseFood(b);this.setState(b,'idle');return;}
        b.ate=true;
        // 终点互动不回写路线投喂计数，也不改已经完成的结局。
        app.toast(b.spec.name+'接受了浆果，安静地留在你身边。',2400);
      }
      if(b.stateTime>=b.actionDuration+.25){this.releaseFood(b);b.ate=false;b.foodTimer=CHIRP_CONFIG.inventory.endingFeedCooldown;this.setState(b,'idle');}
      return;
    }
    if(b.state==='call'&&b.stateTime>b.actionDuration)this.setState(b,'idle');
    if(b.state==='idle'&&b.callTimer<0){this.setState(b,'call');b.callTimer=24+Math.random()*15;}
  },
  reset(){
    window.ChirpApp?.inventory?.cancelOffering();
    for(const b of this.birds){this.releaseFood(b);b.path=null;b.root.position.copy(b.home);b.root.rotation.y=b.homeYaw;b.alert=0;b.calmTime=0;b.state='idle';b.stateTime=0;b.callTimer=8+Math.random()*18;b.foodTimer=1;b.lookCooldown=0;b.friendlyCooldown=0;b.walkTimer=7;this.opacity(b,1);b.animator?.reset();b.indicator.visible=false;b.root.visible=!!b.model&&(!b.fixed||this.endingVisible);}
  },
  tick(time,delta){
    if(!this.ready||!window.ChirpApp?.hasControl())return;
    const dt=Math.min((delta||0)/1000,.06),app=ChirpApp,cfg=CHIRP_CONFIG.birds,T=AFRAME.THREE;this.clock+=dt;
    app.inventory?.tick(dt);app.session?.tick(dt);
    const player=app.player.el.object3D.position,eye=app.camera.getWorldPosition(new T.Vector3());
    for(const b of this.birds){
      if(!b.model)continue;b.stateTime+=dt;b.animator.update(dt);
      if(b.fixed){
        this.tickEndingBird(b,dt,player,app);continue;
      }
      const distance=Math.hypot(b.root.position.x-player.x,b.root.position.z-player.z);
      if(b.state==='hidden'){
        if(b.stateTime>cfg.returnAfterSeconds&&distance>6){b.root.position.copy(b.home);b.root.visible=true;this.opacity(b,0);b.alert=0;b.calmTime=0;this.setState(b,'reappear');}continue;
      }
      if(b.state==='reappear'){this.opacity(b,b.stateTime/1.2);if(b.stateTime>=1.2)this.setState(b,'idle');continue;}
      if(b.state==='flee'){
        this.movePath(b,dt,1.5);this.opacity(b,1-Math.max(0,(b.stateTime-1)/1.4));b.label.visible=false;b.indicator.visible=b.stateTime<.5;
        if(b.stateTime>=cfg.escapeSeconds){b.root.visible=false;this.setState(b,'hidden');}continue;
      }
      if(this.clock-(b.lastSense??-1)>.2){b.lastSense=this.clock;b.seesPlayer=distance<cfg.noticeDistance&&this.lineOfSight(eye,this.center(b));}
      b.alert=ChirpCore.alertAfterStep(b.alert,{distance,mode:app.player.mode,moving:app.player.moving,visible:b.seesPlayer,dt},cfg);
      b.indicator.visible=b.alert>=cfg.alertThreshold;b.label.visible=distance<18;
      if(b.alert>=cfg.fleeThreshold){this.flee(b,player);continue;}
      if(b.alert>=cfg.alertThreshold){this.releaseFood(b);b.path=null;this.setState(b,'alert');this.face(b,player,dt);continue;}
      if(b.state==='alert')this.setState(b,'idle');
      b.lookCooldown-=dt;b.friendlyCooldown-=dt;b.callTimer-=dt;b.foodTimer-=dt;b.walkTimer-=dt;
      if(b.food&&!b.food.active&&!b.ate){this.goHome(b);continue;}
      if(b.state==='approach'){
        if(this.movePath(b,dt)){this.setState(b,'eat');b.ate=false;}continue;
      }
      if(b.state==='eat'){
        if(!b.ate&&b.stateTime>b.actionDuration*.55){
          b.ate=true;if(app.inventory.consume(b.food,b)){app.session.recordFeeding(b,b.food);app.toast(b.spec.name+'接受了你的食物。',2200);}
        }
        if(b.stateTime>=b.actionDuration+.2){this.goHome(b);b.foodTimer=5;}continue;
      }
      if(b.state==='return'){if(this.movePath(b,dt))this.setState(b,'idle');continue;}
      if(b.state==='walk'){if(this.movePath(b,dt))this.setState(b,'idle');continue;}
      if(b.foodTimer<=0&&!b.spec.perch&&cfg.groundFeedSpecies.includes(b.spec.id)&&app.inventory){
        b.foodTimer=1.2;
        for(const food of app.inventory.availableFood(b)){
          const stop=food.position.clone(),away=b.root.position.clone().sub(stop);away.y=0;if(away.lengthSq()>.001)stop.addScaledVector(away.normalize(),.28);
          const path=this.nav.path(b.root.position,stop);if(!path)continue;
          food.claimed=b;b.food=food;b.ate=false;b.path=path;this.setState(b,'approach');break;
        }if(b.food)continue;
      }
      if(['look','friendly','call'].includes(b.state)){
        if(b.state!=='call')this.face(b,player,dt);
        if(b.stateTime>=b.actionDuration+.35)this.setState(b,'idle');else continue;
      }
      if(b.seesPlayer&&distance<cfg.noticeDistance&&(!app.player.moving||app.player.mode==='crouch'))b.calmTime+=dt;else b.calmTime=Math.max(0,b.calmTime-dt);
      if(b.calmTime>=cfg.friendlySeconds&&b.friendlyCooldown<=0){this.setState(b,'friendly');b.friendlyCooldown=12;continue;}
      if(b.seesPlayer&&b.lookCooldown<=0){this.setState(b,'look');b.lookCooldown=8;continue;}
      if(b.callTimer<=0){this.setState(b,'call');b.callTimer=18+Math.random()*14;continue;}
      if(b.walkTimer<=0&&!b.spec.perch){
        b.walkTimer=9+Math.random()*8;const angle=Math.random()*Math.PI*2,p=this.nav.point(b.home.x+Math.cos(angle)*.6,b.home.z+Math.sin(angle)*.6,b.home.y+.5);
        if(p){b.path=this.nav.path(b.root.position,p);if(b.path)this.setState(b,'walk');}
      }
    }
  },
  remove(){window.removeEventListener('chirp-world-ready',this.worldReady);for(const b of this.birds)b.animator?.mixer.stopAllAction();}
});
