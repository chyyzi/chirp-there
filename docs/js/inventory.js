'use strict';
class ChirpInventory {
  constructor(app){
    this.app=app;this.world=app.world;this.nav=new ChirpNavigation(this.world);this.selected=0;this.berries=0;
    this.pickups=[];this.foods=[];this.hand=null;this.clock=0;this.lastAction=-10;this.serial=0;
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
    const hits=ray.intersectObjects(this.pickups.map(x=>x.mesh),true);
    if(hits.length){let o=hits[0].object;while(o.parent&&o.parent!==this.root)o=o.parent;const item=this.pickups.find(x=>x.mesh===o);if(item&&this.app.birdSystem.lineOfSight(ray.ray.origin,item.position.clone().add(new T.Vector3(0,.15,0))))return {kind:'pickup',item};}
    return {kind:'empty',ray:ray.ray};
  }
  primary(){
    if(this.clock-this.lastAction<.3)return;this.lastAction=this.clock;
    const target=this.aim();
    if(target.kind==='pickup'){
      if(this.berries>=CHIRP_CONFIG.inventory.maxBerries){this.app.toast('浆果袋已经满了。');return;}
      this.root.remove(target.item.mesh);this.pickups=this.pickups.filter(x=>x!==target.item);this.berries++;this.render();this.app.toast('拾取浆果 +1',1400);return;
    }
    if(this.selected!==1)return;
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
    this.app.toast('保持蹲下静止 '+CHIRP_CONFIG.inventory.handWaitSeconds+' 秒；转头可以，移动或切换物品会收回食物。',4500);
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
    if(food.kind==='hand'){
      if(food!==this.hand||this.berries<=0||food.wait<CHIRP_CONFIG.inventory.handWaitSeconds)return false;
      this.berries--;this.cancelHand();
    }else{this.root.remove(food.mesh);this.foods=this.foods.filter(f=>f!==food);food.active=false;}
    this.render();return true;
  }
  tick(dt){
    this.clock+=dt;
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
    if(this.hand)return this.hand.wait<wait?'安静等待 '+Math.max(0,wait-this.hand.wait).toFixed(1)+' 秒 · 移动取消':'正在等待鸟类靠近 · 移动取消';
    if(this.aim().kind==='pickup')return '左键 · 拾取浆果';
    return this.selected===1?'左键 放到近处地面 · E 蹲下伸手等待':this.selected===0?'C 举起相机 · 左键拾取浆果':'左键拾取浆果 · 1–4 切换物品';
  }
}
window.ChirpInventory=ChirpInventory;
