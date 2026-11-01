export const musicUrl=(id,action='stream')=>'/api/music-search?provider=drive&action='+action+'&id='+encodeURIComponent(id);
export function downloadTrack(track){
 if(!track||!/^[\w-]{10,180}$/.test(track.id))throw Error('Invalid song');
 const a=document.createElement('a');a.href=musicUrl(track.id,'download');
 a.download=(track.title||'8aPDF Music').replace(/[\\/:*?"<>|\x00-\x1f]/g,'').slice(0,100)+'.mp3';
 document.body.appendChild(a);a.click();a.remove();
}
