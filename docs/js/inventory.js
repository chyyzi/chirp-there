'use strict';
class ChirpInventory {
  constructor(app){
    this.app=app;this.world=app.world;this.nav=new ChirpNavigation(this.world);this.selected=0;this.berries=0;
    this.pickups=[];this.foods=[];this.hand=null;this.offering=null;this.clock=0;this.lastAction=-10;this.serial=0;
    const T=AFRAME.THREE;this.root=new T.Group();this.root.name='berry-items';app.scene.object3D.add(this.root);
    this.berryGeometry=new T.IcosahedronGeometry(.075,0);this.leafGeometry=new T.ConeGeometry(.045,.12,3);
    this.red=new T.MeshStandardMaterial({color:'#ad495f',roughness:.95});this.green=new T.MeshStandardMaterial({color:'#6b8847',roughness:1});
    this.held=this.model();this.held.position.set(.29,-.29,-.66);this.held.scale.setScalar(1.2);app.camera.add(this.held);
    const skin=new T.MeshStandardMaterial({color:'#d6b18d',roughness:1}),sleeveMat=new T.MeshStandardMaterial({color:'#64745b',roughness:1});
    const palm=new T.Mesh(new T.BoxGeometry(.19,.055,.19),skin);palm.position.set(0,.015,.025);this.held.add(palm);
    const sleeve=new T.Mesh(new T.CylinderGeometry(.07,.09,.32,6),sleeveMat);sleeve.rotation.x=Math.PI/2;sleeve.position.set(.015,-.025,.23);this.held.add(sleeve);
    document.querySelectorAll('[data-slot]').forEach(b=>b.addEventListener('click',()=>this.select(Number(b.dataset.slot))));
    this.reset();
  }
  model(){
    const T=AFRAME.THREE,g=new T.Group();
    for(const [x,y,z] of [[-.065,.075,0],[.065,.075,0],[0,.12,-.07],[0,.16,.06]]){
      const m=new T.Mesh(this.berryGeometry,this.red);m.position.set(x,y,z);m.castShadow=true;g.add(m);
    }
    for(let i=0;i<2;i++){const leaf=new T.Mesh(this.leafGeometry,this.green);leaf.position.set((i-.5)*.06,.24,0);leaf.rotation.z=(i-.5)*1.5;g.add(leaf);}return g;
  }
  reset(){
    this.cancelOffering(false);
    this.cancelHand();this.berries=CHIRP_CONFIG.inventory.initialBerries;this.selected=0;
    for(const item of [...this.pickups,...this.foods]){item.active=false;this.root.remove(item.mesh);}this.pickups=[];this.foods=[];
    const anchors=[CHIRP_CONFIG.player.spawn,...CHIRP_CONFIG.birds.species,CHIRP_CONFIG.story.final];
    for(let n=0;n<CHIRP_CONFIG.inventory.spawnCount;n++){
      for(let i=0;i<90;i++){
        const a=anchors[n%anchors.length],x=a.x+(Math.random()-.5)*15,z=a.z+(Math.random()-.5)*15,p=this.nav.point(x,z);
        if(!p||this.pickups.some(b=>b.position.distanceTo(p)<1.3))continue;
        const mesh=this.model();mesh.position.copy(p);mesh.rotation.y=Math.random()*Math.PI*2;this.root.add(mesh);
        this.pickups.push({id:'berry-'+n,position:p,mesh});break;
      }
    }this.render();
  }
  select(slot){
    if(!Number.isInteger(slot)||slot<0||slot>3)return;
    this.cancelHand();this.selected=slot;
    if(slot!==0&&this.app.cameraMode)this.app.setCameraMode(false);
    this.render();
  }
  render(){
    document.querySelectorAll('[data-slot]').forEach(b=>{const active=Number(b.dataset.slot)===this.selected;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    document.getElementById('berry-count').textContent=this.berries;
    if(this.hand){this.app.camera.updateMatrixWorld(true);const height=this.hand.claimed?.spec.id==='heron'?.5:.31;this.held.position.copy(this.app.camera.worldToLocal(this.hand.position.clone().add(new AFRAME.THREE.Vector3(0,height,0))));}else this.held.position.set(.29,-.29,-.66);
    this.held.visible=this.selected===1&&this.berries>0&&!this.app.cameraMode&&!this.app.modal&&!this.app.interfaceHidden;
  }
  aim(){
    const T=AFRAME.THREE,camera=this.app.camera;camera.updateMatrixWorld(true);
    const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(0,0),camera);ray.far=CHIRP_CONFIG.inventory.pickupDistance;
    // 近处浆果优先拾取，避免后方终点鸟抢走点击；相机拍照走独立入口。
    const candidates=[...this.pickups,...this.foods.filter(x=>x.active)];
    this.root.updateMatrixWorld(true);
    const hits=ray.intersectObjects(candidates.map(x=>x.mesh),true);
    if(hits.length){let o=hits[0].object;while(o.parent&&o.parent!==this.root)o=o.parent;const item=candidates.find(x=>x.mesh===o);if(item&&this.app.birdSystem.lineOfSight(ray.ray.origin,item.position.clone().add(new T.Vector3(0,.15,0))))return {kind:'pickup',item};}
    if(this.selected===1){const bird=this.endingTarget(ray.ray);if(bird)return {kind:'ending-bird',bird};}
    return {kind:'empty',ray:ray.ray};
  }
  endingTarget(ray){
    const system=this.app.birdSystem,cfg=CHIRP_CONFIG.inventory;if(!system?.ready)return null;
    let target=null,best=Math.cos(cfg.endingFeedAimAngle);
    for(const b of system.birds){
      if(!b.fixed||!b.model||!b.root.visible||b.opacity<.9)continue;
      const center=system.center(b),v=center.clone().sub(ray.origin),distance=v.length();
      if(distance<.1||distance>cfg.endingFeedDistance)continue;
      const alignment=v.normalize().dot(ray.direction);
      if(alignment>best&&system.lineOfSight(ray.origin,center)){target=b;best=alignment;}
    }return target;
  }
  offeringPoint(food,t,out){
    const q=1-t;return out.copy(food.start).multiplyScalar(q*q).addScaledVector(food.control,2*q*t).addScaledVector(food.end,t*t);
  }
  offeringPathClear(food){
    const T=AFRAME.THREE,previous=food.start.clone(),point=new T.Vector3();
    for(let i=1;i<=16;i++){
      this.offeringPoint(food,i/16,point);const direction=point.clone().sub(previous),distance=direction.length();
      if(distance>.001){
        const ray=new T.Ray(previous.clone(),direction.normalize());
        for(const tree of [this.world.obstacleTree,this.world.floorTree]){
          const hit=tree.rayIntersect(ray);if(hit&&hit.distance<distance-.015)return false;
        }
      }previous.copy(point);
    }return true;
  }
  offerTo(bird){
    if(this.offering){this.app.toast('上一份浆果还在投喂中，请稍等。');return false;}
    if(!this.berries){this.app.toast('没有浆果了，先收集一些。');return false;}
    if(!this.app.birdSystem.canAcceptOffering(bird)){this.app.toast(bird.spec.name+'正在回应你，稍等片刻再喂。');return false;}
    const T=AFRAME.THREE;this.app.camera.updateMatrixWorld(true);bird.root.updateMatrixWorld(true);
    // 从画面里的手边抛出，目标在鸟喙前；不让高处的鸟穿过树干落到地面。
    const start=this.app.camera.localToWorld(new T.Vector3(.22,-.22,-.48));
    const end=bird.root.localToWorld(new T.Vector3(0,bird.spec.modelHeight*.6,bird.spec.modelHeight*.26));
    const control=start.clone().lerp(end,.5);
    const food={id:'offering-'+(++this.serial),kind:'offering',start,end,control,position:end.clone(),age:0,
      duration:CHIRP_CONFIG.inventory.endingFeedFlightSeconds,claimed:null,active:true,arrived:false,consumed:false};
    let clear=false;
    for(const lift of [.65,.25,0]){control.copy(start).lerp(end,.5);control.y+=lift;if(this.offeringPathClear(food)){clear=true;break;}}
    if(!clear){this.app.toast('浆果前方有树枝或石头挡住，请侧移一点再投喂。');return false;}
    if(!this.app.birdSystem.acceptOffering(bird,food))return false;
    this.cancelHand();food.mesh=this.model();food.mesh.scale.setScalar(.55);food.mesh.position.copy(start);this.root.add(food.mesh);
    this.offering=food;this.berries--;this.render();this.app.toast('向'+bird.spec.name+'送出一份浆果。',1800);return true;
  }
  cancelOffering(refund=true){
    const food=this.offering;if(!food)return;
    this.offering=null;food.active=false;this.root.remove(food.mesh);
    const bird=food.claimed;food.claimed=null;
    if(bird?.food===food){bird.food=null;bird.ate=false;this.app.birdSystem?.setState(bird,'idle');}
    if(refund&&!food.consumed)this.berries=Math.min(CHIRP_CONFIG.inventory.maxBerries,this.berries+1);
    this.render();
  }
  recover(item){
    // 已吃掉、过期或已拾取的对象不可再次兑换物品。
    if(!item||item.active===false||(!this.pickups.includes(item)&&!this.foods.includes(item)))return false;
    if(this.berries>=CHIRP_CONFIG.inventory.maxBerries){this.app.toast('浆果袋已经满了。');return false;}
    item.active=false;
    const bird=item.claimed;
    if(bird?.food===item)this.app.birdSystem.goHome(bird);
    item.claimed=null;
    this.root.remove(item.mesh);
    this.pickups=this.pickups.filter(x=>x!==item);this.foods=this.foods.filter(x=>x!==item);
    this.berries++;this.render();this.app.toast(item.kind==='ground'?'收回浆果 +1':'拾取浆果 +1',1400);return true;
  }
  primary(){
    if(this.clock-this.lastAction<.3)return;this.lastAction=this.clock;
    const target=this.aim();
    if(target.kind==='pickup'){
      this.recover(target.item);return;
    }
    if(this.selected!==1)return;
    if(target.kind==='ending-bird'){this.offerTo(target.bird);return;}
    if(this.hand){this.cancelHand();this.app.toast('已收回手中的浆果。');return;}
    if(!this.berries){this.app.toast('没有浆果了，沿路寻找地上的红色果实。');return;}
    if(this.foods.length>=CHIRP_CONFIG.inventory.maxGroundFood){this.app.toast('地面已有足够食物，先等鸟吃完。');return;}
    const ray=target.ray,hit=this.world.floorTree.rayIntersect(ray);
    if(!hit||hit.distance>CHIRP_CONFIG.inventory.placeDistance){this.app.toast('低头对准前方近处地面，再按左键放置。');return;}
    const point=this.nav.point(hit.position.x,hit.position.z,hit.position.y+.3),player=this.app.player.el.object3D.position;
    if(!point||Math.hypot(point.x-player.x,point.z-player.z)<.55||!this.nav.segment(player,point)){this.app.toast('这里不便靠近，请在小路旁的空地放置。');return;}
    const mesh=this.model();mesh.position.copy(point);this.root.add(mesh);
    this.foods.push({id:'food-'+(++this.serial),kind:'ground',position:point,mesh,age:0,claimed:null,active:true});
    this.berries--;this.render();this.app.toast('放下一份浆果。退开一点，安静等待。');
  }
  toggleHand(){
    if(this.selected!==1){this.app.toast('按 2 选中浆果，再按 E 伸手等待。');return;}
    if(this.hand){this.cancelHand();return;}
    if(!this.berries){this.app.toast('先收集一些浆果。');return;}
    if(!this.app.player.crouching){this.app.toast('先轻按 Ctrl 或 X 蹲下，再按 E 伸手，方便鸟类靠近。');return;}
    const T=AFRAME.THREE,p=this.app.player.el.object3D.position,yaw=this.app.cameraEl.object3D.rotation.y;
    const target=this.nav.point(p.x-Math.sin(yaw)*.9,p.z-Math.cos(yaw)*.9,p.y+.4);
    if(!target||!this.nav.segment(p,target)){this.app.toast('面前有障碍，请换一块空地再伸手。');return;}
    this.app.player.clear();this.hand={id:'hand',kind:'hand',position:target,origin:p.clone(),wait:0,active:true,claimed:null};
    this.app.toast('静止等待 '+CHIRP_CONFIG.inventory.handWaitSeconds+' 秒，移动或切换物品可取消。',4500);
  }
  cancelHand(){if(this.hand)this.hand.active=false;this.hand=null;}
  availableFood(bird){
    const cfg=CHIRP_CONFIG.inventory,candidates=[...this.foods];
    if(this.hand&&this.hand.wait>=cfg.handWaitSeconds&&this.berries>0)candidates.push(this.hand);
    return candidates.filter(f=>f.active&&!f.claimed&&f.position.distanceTo(bird.root.position)<cfg.feedDistance)
      .sort((a,b)=>a.position.distanceTo(bird.root.position)-b.position.distanceTo(bird.root.position));
  }
  consume(food,bird){
    if(!food?.active||food.claimed!==bird)return false;
    if(food.kind==='offering'){
      if(food!==this.offering||!food.arrived||!bird.fixed||!bird.root.visible)return false;
      // 抛出时已扣除一份，接食时不重复扣；取消且未吃到才退回。
      food.active=false;food.consumed=true;this.root.remove(food.mesh);this.offering=null;
    }else if(food.kind==='hand'){
      if(food!==this.hand||this.berries<=0||food.wait<CHIRP_CONFIG.inventory.handWaitSeconds)return false;
      this.berries--;this.cancelHand();
    }else{this.root.remove(food.mesh);this.foods=this.foods.filter(f=>f!==food);food.active=false;}
    this.render();return true;
  }
  tick(dt){
    this.clock+=dt;
    if(this.offering){
      const food=this.offering,bird=food.claimed;
      if(!food.active||!bird?.root.visible||bird.food!==food){this.cancelOffering();}
      else{
        food.age+=dt;
        const t=Math.min(1,food.age/food.duration);this.offeringPoint(food,t,food.mesh.position);
        food.mesh.rotation.y+=dt*3;food.arrived=t===1;
        if(food.age>food.duration+Math.max(8,(bird.actionDuration||0)+3))this.cancelOffering();
      }
    }
    if(this.hand){
      const p=this.app.player;
      if(p.moving||!p.grounded||!p.crouching||p.el.object3D.position.distanceTo(this.hand.origin)>.08||this.selected!==1)this.cancelHand();
      else this.hand.wait+=dt;
    }
    for(const f of [...this.foods]){f.age+=dt;if(f.age>CHIRP_CONFIG.inventory.foodLifetime&&!f.claimed){f.active=false;this.root.remove(f.mesh);this.foods=this.foods.filter(x=>x!==f);}}
    this.render();
  }
  hint(){
    const wait=CHIRP_CONFIG.inventory.handWaitSeconds;
    if(this.offering)return '正在向'+this.offering.claimed.spec.name+'投喂 · 等待接食';
    if(this.hand)return this.hand.wait<wait?'安静等待 '+Math.max(0,wait-this.hand.wait).toFixed(1)+' 秒 · 移动取消':'正在等待鸟类靠近 · 移动取消';
    const aim=this.aim();
    if(aim.kind==='ending-bird')return this.app.birdSystem.canAcceptOffering(aim.bird)?'左键 · 投喂终点的'+aim.bird.spec.name:'它正在回应你 · 稍后可再次投喂';
    if(aim.kind==='pickup')return aim.item.kind==='ground'?'左键 · 收回浆果':'左键 · 拾取浆果';
    return this.selected===1?'左键 放到近处地面 · E 蹲下伸手等待':this.selected===0?'C 举起相机 · 左键拾取浆果':'左键拾取浆果 · 1–4 切换物品';
  }
}
window.ChirpInventory=ChirpInventory;
