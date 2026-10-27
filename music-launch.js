/* 8aPDF music launch announcement retired permanently.
 * Music Library and its player remain available through the normal navigation.
 * This module intentionally never creates or schedules a popup.
 */
(()=>{
 'use strict';
 const hiddenForever=()=>true;
 const close=()=>{
  const popup=document.getElementById('musicLaunchAnnouncement');
  if(popup)popup.remove();
  document.body?.classList.remove('music-launch-open');
 };
 window.__8apdfMusicLaunch={show:()=>{},close,dismissForever:close,hiddenForever};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',close,{once:true});
 else close();
})();
