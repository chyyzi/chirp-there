/* 小范围地面寻路：用于鸟走向食物、回家与逃离。水面、树干、陡坎不可通过。 */
'use strict';
class ChirpNavigation {
  constructor(world){this.world=world;this.step=.55;}
  point(x,z,upper=100){
    const y=this.world.floorAt(x,z,upper);
    if(y===null||this.world.collisionAt(x,y+.035,z,.5,.18))return null;
    return new AFRAME.THREE.Vector3(x,y+.025,z);
  }
  segment(a,b){
    const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.22));let prev=a;
    for(let i=1;i<=n;i++){
      const t=i/n,p=this.point(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,prev.y+.32);
      if(!p||Math.abs(p.y-prev.y)>.32)return false;prev=p;
    }return true;
  }
  path(start,end){
    if(start.distanceTo(end)>13)return null;
    const goal=this.point(end.x,end.z,end.y+.4);if(!goal)return null;
    if(this.segment(start,goal))return [goal];
    const step=this.step,key=(x,z)=>x+','+z,open=[],seen=new Map();
    const origin=start.clone();const h=p=>Math.hypot(goal.x-p.x,goal.z-p.z);
    const first={x:0,z:0,p:origin,g:0,f:h(origin),parent:null};open.push(first);seen.set('0,0',first);
    let count=0;
    while(open.length&&count++<500){
      open.sort((a,b)=>a.f-b.f);const n=open.shift();if(n.closed)continue;n.closed=true;
      if(h(n.p)<step*1.5&&this.segment(n.p,goal)){
        const result=[goal];for(let c=n;c.parent;c=c.parent)result.push(c.p);return result.reverse();
      }
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        const x=n.x+dx,z=n.z+dz;if(Math.abs(x)>20||Math.abs(z)>20)continue;
        const k=key(x,z),old=seen.get(k);if(old?.closed)continue;
        const p=this.point(origin.x+x*step,origin.z+z*step,n.p.y+.32);if(!p||!this.segment(n.p,p))continue;
        const g=n.g+n.p.distanceTo(p);if(old&&g>=old.g)continue;
        const c={x,z,p,g,f:g+h(p),parent:n};seen.set(k,c);open.push(c);
      }
    }return null;
  }
}
window.ChirpNavigation=ChirpNavigation;
