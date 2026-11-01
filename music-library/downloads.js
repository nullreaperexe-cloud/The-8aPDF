/* Songs are fetched in the server's 2 MB range chunks to avoid truncated MP3 downloads. */
const api=id=>'/api/music-search?provider=drive&action=stream&id='+encodeURIComponent(id);
export async function downloadTrack(track,onProgress=()=>{}){
 if(!track||!/^[A-Za-z0-9_-]{10,180}$/.test(track.id))throw Error('Invalid song');
 const size=Number(track.size);
 if(!Number.isSafeInteger(size)||size<1||size>1024*1024*1024)throw Error('Invalid audio size');
 const chunks=[],chunkSize=2*1024*1024;
 for(let pos=0;pos<size;){
  const end=Math.min(size-1,pos+chunkSize-1);
  const res=await fetch(api(track.id),{headers:{Range:'bytes='+pos+'-'+end},cache:'no-store'});
  if(res.status!==206)throw Error('Download stopped (HTTP '+res.status+')');
  const bytes=await res.arrayBuffer();
  if(bytes.byteLength!==end-pos+1)throw Error('Incomplete audio chunk');
  chunks.push(bytes);pos=end+1;onProgress(pos,size);
 }
 const blob=new Blob(chunks,{type:track.mimeType||'audio/mpeg'});
 const url=URL.createObjectURL(blob);
 const extension=/audio\/(?:mp4|x-m4a)/.test(track.mimeType||'')?'.m4a':'.mp3';
 const filename=(track.title||'8aPDF Music').replace(/[\\/:*?"<>|\x00-\x1f]/g,'').trim().slice(0,100)||'8aPDF Music';
 const link=document.createElement('a');link.href=url;link.download=filename+extension;document.body.append(link);
 link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 return true;
}
