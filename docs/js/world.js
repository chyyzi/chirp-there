'use strict';
AFRAME.registerComponent('chirp-world', {
  init() {
    this.ready = false;
    this.el.addEventListener('model-loaded', () => {
      window.dispatchEvent(new CustomEvent('chirp-loading', {detail: '正在准备林间小路…'}));
      setTimeout(() => { try { this.build(); } catch (e) { console.error(e); window.dispatchEvent(new CustomEvent('chirp-error', {detail: '场景加载失败，请刷新重试。'})); } }, 30);
    });
    this.el.addEventListener('model-error', () => window.dispatchEvent(new CustomEvent('chirp-error', {detail: '场景未能加载，请检查网络后刷新。'})));
  },
  build() {
    const T = AFRAME.THREE, root = this.el.getObject3D('mesh');
    this.floorTree = new ChirpCollision.Octree();
    this.rockFloorTree = new ChirpCollision.Octree();
    this.waterTree = new ChirpCollision.Octree();
    this.obstacleTree = new ChirpCollision.Octree();
    this.bounds = new T.Box3(); this.waterBounds = new T.Box3();
    this.ray = new T.Ray(); this.normal = new T.Vector3(); this.capsule = new ChirpCollision.Capsule();
    this.floorMeshes = []; this.blockers = []; this.occluders = []; this.deckBounds = [];
    root.updateWorldMatrix(true, true);
    const materialCache = new Map(); let meshCount=0;
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      meshCount++;
      const owner = chirpOwner(mesh, root), name = owner.name;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const foliage = mats.every(m => /Foliage/i.test(m.name));
      const tree = /^tree-/.test(name) && !foliage;
      const rock = /^(rock-|ground-rocks-|moss-)/.test(name);
      const floor = ChirpNames.floor.test(name), water = ChirpNames.water.test(name);
      const rail = ChirpNames.rail.test(name);
      if (floor) { chirpAddTriangles(this.floorTree, mesh); this.floorMeshes.push(mesh); this.bounds.expandByObject(mesh); }
      if (rock) chirpAddTriangles(this.rockFloorTree, mesh,Math.cos(CHIRP_CONFIG.player.maxSlope*Math.PI/180));
      if (water) { chirpAddTriangles(this.waterTree, mesh); this.waterBounds.expandByObject(mesh); }
      if (tree || rock || rail) { chirpAddTriangles(this.obstacleTree, mesh); this.blockers.push(mesh); }
      if (tree || rock || rail || floor || (/^tree-/.test(name) && foliage)) this.occluders.push(mesh);
      if (/^Deck_/.test(name)) this.deckBounds.push(new T.Box3().setFromObject(mesh));
      mesh.receiveShadow = true;
      // 地形、灌木与草花也参与遮光；平贴的小径和水面只接收阴影，避免重叠面自遮挡。
      mesh.castShadow = !water && !/^(Path_|PathEdge_)/.test(name);
      // 合并参数相同的材质。
      const mapped = mats.map(m => {
        const key = [m.type, m.name.replace(/\.\d+$/, ''), m.color?.getHex(), m.map?.uuid,
          m.roughness, m.roughnessMap?.uuid, m.metalness, m.metalnessMap?.uuid, m.opacity,
          m.alphaTest, m.transparent, m.side, m.emissive?.getHex(), m.emissiveIntensity,
          m.specularIntensity, m.ior, m.normalMap?.uuid, m.userData.chirpWindKind,
          m.vertexColors, m.normalScale?.toArray(), m.emissiveMap?.uuid, m.alphaMap?.uuid,
          m.clearcoat, m.transmission, m.thickness].join('|');
        if (materialCache.has(key)) return materialCache.get(key);
        materialCache.set(key, m); return m;
      });
      mesh.material = Array.isArray(mesh.material) ? mapped : mapped[0];
    });
    if (!this.floorMeshes.length) throw new Error('未识别到 Terrain / Path / Deck 地形。');
    this.floorTree.build(); this.rockFloorTree.build(); this.waterTree.build(); this.obstacleTree.build();
    this.ready = true;
    const batching=this.batchStaticMeshes(root);
    this.stats = {meshes: meshCount, floors: this.floorMeshes.length, blockers: this.blockers.length, materials: materialCache.size,...batching};
    this.applyEnvironment('normal');
    window.dispatchEvent(new CustomEvent('chirp-world-ready', {detail: this.stats}));
  },
  batchStaticMeshes(root){
    const T=AFRAME.THREE,groups=new Map();
    root.traverse(mesh=>{
      if(!mesh.isMesh||mesh.isSkinnedMesh||Array.isArray(mesh.material)||mesh.morphTargetInfluences?.length||mesh.matrixWorld.determinant()<0)return;
      if(/^waterplant-/.test(chirpOwner(mesh,root).name))return; // 荷叶保持独立浮动。
      const key=[mesh.geometry.uuid,mesh.material.uuid,mesh.customDepthMaterial?.uuid,mesh.castShadow,mesh.receiveShadow].join('|');
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
    });
    const batched=new T.Group();batched.name='chirp-static-instances';
    this.el.sceneEl.object3D.add(batched);let savedDrawCalls=0,instanceBatches=0;
    for(const list of groups.values()){
      if(list.length<3)continue;
      const first=list[0],inst=new T.InstancedMesh(first.geometry,first.material,list.length);
      inst.name='batch-'+first.name;inst.castShadow=first.castShadow;inst.receiveShadow=first.receiveShadow;
      inst.customDepthMaterial=first.customDepthMaterial;
      list.forEach((mesh,i)=>{inst.setMatrixAt(i,mesh.matrixWorld);mesh.visible=false;});
      inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();batched.add(inst);
      savedDrawCalls+=list.length-1;instanceBatches++;
    }
    this.batched=batched;
    return {instanceBatches,savedDrawCalls};
  },
  floorAt(x, z, upper = 100, ignoreWater = false) {
    if (!this.ready || x < this.bounds.min.x+.3 || x > this.bounds.max.x-.3 || z < this.bounds.min.z+.3 || z > this.bounds.max.z-.3) return null;
    this.ray.origin.set(x, upper, z); this.ray.direction.set(0,-1,0);
    let hit = this.floorTree.rayIntersect(this.ray);
    const rock = this.rockFloorTree.rayIntersect(this.ray);
    if (rock && (!hit || rock.position.y > hit.position.y)) {
      rock.triangle.getNormal(this.normal);
      if(this.normal.y >= Math.cos(CHIRP_CONFIG.player.maxSlope*Math.PI/180)) hit=rock;
    }
    if (!hit) return null;
    hit.triangle.getNormal(this.normal);
    if (this.normal.y < Math.cos(CHIRP_CONFIG.player.maxSlope*Math.PI/180)) return null;
    if (!ignoreWater && !this.waterBounds.isEmpty()) {
      this.ray.origin.y=100;
      const water = this.waterTree.rayIntersect(this.ray);
      if (water && water.position.y > hit.position.y+.035) return null;
    }
    return hit.position.y;
  },
  collisionAt(x, y, z, height = CHIRP_CONFIG.player.height, r = CHIRP_CONFIG.player.radius) {
    height=Math.max(height,r*2+.01);
    this.capsule.set(this.capsule.start.set(x,y+r,z),this.capsule.end.set(x,y+height-r,z),r);
    const hit=this.obstacleTree.capsuleIntersect(this.capsule);
    return hit && hit.depth > .0015 ? hit : null;
  },
  surfaceAt(x,y,z) {
    return this.deckBounds.some(b => x>b.min.x-.05 && x<b.max.x+.05 && z>b.min.z-.05 && z<b.max.z+.05 && Math.abs(y-b.max.y)<.25) ? 'wood' : 'grass';
  },
  waterDistance(p) {
    if (this.waterBounds.isEmpty()) return 100;
    const b=this.waterBounds;
    return Math.hypot(Math.max(b.min.x-p.x,0,p.x-b.max.x),Math.max(b.min.z-p.z,0,p.z-b.max.z));
  },
  applyEnvironment(name) {
    const cfg=CHIRP_CONFIG.environments[name];
    if(!cfg)return false;
    const env={...(CHIRP_CONFIG.environments[cfg.inherit||'normal']||{}),...cfg};
    const scene=this.el.sceneEl,T=AFRAME.THREE,settings=CHIRP_CONFIG.scene;
    const previousBackground=scene.object3D.background;
    scene.object3D.background=new T.Color(env.sky);
    if(previousBackground?.isTexture)previousBackground.dispose();
    // 连续切景时，过期天空只释放，不覆盖新场景。
    const requestId=this.skyRequestId=(this.skyRequestId||0)+1;
    if(env.skyTexture)new T.TextureLoader().load(env.skyTexture,texture=>{
      if(requestId!==this.skyRequestId){texture.dispose();return;}
      texture.colorSpace=T.SRGBColorSpace;texture.mapping=T.EquirectangularReflectionMapping;
      scene.object3D.background=texture;
    },undefined,error=>console.warn('天空图片加载失败：',env.skyTexture,error));
    scene.object3D.fog=new T.Fog(env.fog,env.fogNear,env.fogFar);
    if(!this.lights){
      const hemi=new T.HemisphereLight(),sun=new T.DirectionalLight(),fill=new T.DirectionalLight();
      fill.castShadow=false; // 侧向天空反弹光，提亮暗面但不增加第二张阴影贴图。
      sun.castShadow=settings.shadows;
      const size=Math.min(settings.shadowSize,scene.renderer?.capabilities?.maxTextureSize||settings.shadowSize);
      sun.shadow.mapSize.set(size,size);
      const radius=settings.shadowRadius||42,distance=settings.shadowDistance||90;
      Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:1,far:distance*2});
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias=settings.shadowBias??-.00012;
      sun.shadow.normalBias=settings.shadowNormalBias??.025;
      scene.object3D.add(hemi,sun,sun.target,fill,fill.target);this.lights={hemi,sun,fill};
      this.shadowCenter=new T.Vector3();this.sunOffset=new T.Vector3();
      this.shadowRight=new T.Vector3();this.shadowUp=new T.Vector3();
    }
    const {hemi,sun,fill}=this.lights;
    hemi.color.set(env.hemiSky);hemi.groundColor.set(env.hemiGround);hemi.intensity=env.hemiIntensity;
    sun.color.set(env.sun);sun.intensity=env.sunIntensity;
    sun.shadow.intensity=Math.max(0,Math.min(1,env.shadowStrength??1));
    fill.color.set(env.fill||env.hemiSky);fill.intensity=env.fillIntensity??0;
    fill.position.fromArray(env.fillDirection||[38,24,-42]);fill.target.position.set(0,0,0);
    this.sunOffset.fromArray(env.sunDirection||[-48,50,28]).normalize().multiplyScalar(settings.shadowDistance||90);
    // 固定光线方向，阴影覆盖区跟随玩家。
    this.shadowRight.set(0,1,0).cross(this.sunOffset).normalize();
    this.shadowUp.crossVectors(this.sunOffset,this.shadowRight).normalize();
    this.updateShadowCenter();
    if(scene.renderer){
      scene.renderer.shadowMap.enabled=true;scene.renderer.shadowMap.type=T.PCFSoftShadowMap;
      scene.renderer.toneMapping=T.ACESFilmicToneMapping;scene.renderer.toneMappingExposure=env.exposure;
      scene.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,settings.pixelRatio));
    }
    this.currentFilter=env.filter||'none';if(scene.canvas)scene.canvas.style.filter=this.currentFilter;
    this.setupDreamParticles();this.dreamParticles.visible=name==='dream';
    this.environment=name;return cfg.ready;
  },
  updateShadowCenter(){
    if(!this.lights)return;
    const player=window.ChirpApp?.player?.el.object3D.position;
    const spawn=CHIRP_CONFIG.player.spawn,center=this.shadowCenter,sun=this.lights.sun;
    center.set(player?.x??spawn.x,(player?.y??0)+4,player?.z??spawn.z);
    // 在光源平面中按阴影纹素对齐，替换原来每 180ms、每 3m 跳一次的世界坐标取整。
    // 同时移动光源和目标，避免跟随移动改变日光方向或造成树影游动。
    const camera=sun.shadow.camera;
    const texelX=(camera.right-camera.left)/sun.shadow.mapSize.x;
    const texelY=(camera.top-camera.bottom)/sun.shadow.mapSize.y;
    const x=center.dot(this.shadowRight),y=center.dot(this.shadowUp);
    center.addScaledVector(this.shadowRight,Math.round(x/texelX)*texelX-x);
    center.addScaledVector(this.shadowUp,Math.round(y/texelY)*texelY-y);
    sun.target.position.copy(center);sun.position.copy(center).add(this.sunOffset);
    sun.target.updateMatrixWorld();sun.updateMatrixWorld();
  },
  setupDreamParticles(){
    if(this.dreamParticles)return;
    const T=AFRAME.THREE,g=new T.BufferGeometry(),coords=new Float32Array(72*3),f=CHIRP_CONFIG.story.final;
    for(let i=0;i<72;i++){coords[i*3]=f.x+(Math.random()-.5)*20;coords[i*3+1]=2+Math.random()*6;coords[i*3+2]=f.z+(Math.random()-.5)*18;}
    g.setAttribute('position',new T.BufferAttribute(coords,3));this.particleBase=coords.slice();
    const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(16,16,0,16,16,16);grad.addColorStop(0,'#fffde5');grad.addColorStop(.2,'#f8e6caaa');grad.addColorStop(1,'#f8e6ca00');ctx.fillStyle=grad;ctx.fillRect(0,0,32,32);
    this.dreamParticles=new T.Points(g,new T.PointsMaterial({map:new T.CanvasTexture(c),size:.15,color:'#ffe5d1',transparent:true,opacity:.65,depthWrite:false,blending:T.AdditiveBlending}));this.el.sceneEl.object3D.add(this.dreamParticles);
  },
  tick(time) {
    if(this.dreamParticles?.visible){const a=this.dreamParticles.geometry.attributes.position;for(let i=0;i<a.count;i++){a.setY(i,this.particleBase[i*3+1]+Math.sin(time*.0004+i)*.35);a.setX(i,this.particleBase[i*3]+Math.sin(time*.00025+i)*.3);}a.needsUpdate=true;}

    if(this.lights?.sun.castShadow)this.updateShadowCenter();
  }
});
