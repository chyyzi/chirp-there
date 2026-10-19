/* 小型离线 ZIP 写入器：JPEG 已压缩，采用 Store，保留照片原始字节。
 * PKWARE APPNOTE: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 * UTF-8 文件名、CRC32、中央目录；不依赖 CDN，不支持超出 32 位尺寸的 ZIP64。
 */
'use strict';
window.ChirpPhotoZip={
  async create(entries,onProgress=()=>{}){
    if(!entries.length||entries.length>65535)throw new Error('请选择需要保存的照片');
    const table=new Uint32Array(256);
    for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
    const encoder=new TextEncoder(),parts=[],directory=[],names=new Set();let offset=0,centralSize=0;
    const header=size=>{const bytes=new Uint8Array(size);return{bytes,view:new DataView(bytes.buffer)};};
    for(let index=0;index<entries.length;index++){
      const entry=entries[index],name=encoder.encode(entry.name);
      if(!name.length||name.length>65535||/[\\/\0]/.test(entry.name)||names.has(entry.name))throw new Error('照片文件名无效');names.add(entry.name);
      if(entry.blob.size>=0xffffffff)throw new Error('照片过大，请分批保存');
      const data=new Uint8Array(await entry.blob.arrayBuffer());let crc=0xffffffff;
      for(const byte of data)crc=table[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
      const d=new Date(entry.created);if(!Number.isFinite(d.getTime()))throw new Error('照片日期无效');
      const year=Math.min(2107,Math.max(1980,d.getFullYear()));
      const time=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date=((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
      const local=header(30+name.length),v=local.view;
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(10,time,true);v.setUint16(12,date,true);
      v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.bytes.set(name,30);
      const central=header(46+name.length),c=central.view;
      c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(12,time,true);c.setUint16(14,date,true);
      c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.bytes.set(name,46);
      parts.push(local.bytes,data);directory.push(central.bytes);offset+=local.bytes.length+data.length;centralSize+=central.bytes.length;
      if(offset+centralSize+22>=0xffffffff)throw new Error('相册过大，请减少所选照片分批保存');
      onProgress(index+1,entries.length);
    }
    const end=header(22),v=end.view;v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
    return new Blob([...parts,...directory,end.bytes],{type:'application/zip'});
  }
};
