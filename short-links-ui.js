/* 8aPDF · Original PDF sharing and permanent custom short links. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const STYLE = `
  .sl-mask{position:fixed;inset:0;z-index:16000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.74);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px)}
  .sl-mask.sl-open{display:flex;animation:sl-fade .2s ease both}
  @keyframes sl-fade{from{opacity:0}to{opacity:1}}
  .sl-panel{position:relative;width:min(100%,515px);max-height:min(760px,calc(100dvh - 32px));overflow:auto;background:var(--surface,#141414);color:var(--text,#fff);border:1px solid var(--line-bold,rgba(255,255,255,.23));border-radius:var(--user-radius,24px);padding:26px;box-shadow:0 38px 130px rgba(0,0,0,.5);animation:sl-rise .35s cubic-bezier(.18,.72,.22,1) both}
  @keyframes sl-rise{from{transform:translateY(16px) scale(.98);opacity:.5}to{transform:none;opacity:1}}
  .sl-panel button,.sl-panel input{font:inherit}.sl-head{display:flex;justify-content:space-between;align-items:start;gap:16px;margin-bottom:19px}.sl-eyebrow{color:var(--muted,#aaa);font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.sl-title{font-size:1.4rem;font-weight:750;letter-spacing:-.035em;margin:5px 0 0}.sl-sub{font-size:.86rem;color:var(--muted,#aaa);line-height:1.6;overflow-wrap:anywhere;margin:0 0 20px}
  .sl-close,.sl-back{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;border:1px solid var(--line-bold,#555);background:var(--surface-high,#262626);color:var(--text,#fff);cursor:pointer;flex-shrink:0}
  .sl-option{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left;padding:19px;border:1px solid var(--line-bold,#444);border-radius:16px;background:var(--surface-high,#242424);color:var(--text,#fff);cursor:pointer;margin:11px 0;transition:transform .25s,border-color .25s}.sl-option:hover{transform:translateY(-2px);border-color:var(--text,#fff)}.sl-option strong{font-size:.97rem}.sl-option small{display:block;font-size:.76rem;line-height:1.5;color:var(--muted,#aaa);margin-top:5px}.sl-arrow{font-size:1.4rem;color:var(--muted,#aaa)}
  .sl-label{display:block;font-size:.83rem;font-weight:700;margin-bottom:10px}.sl-slugbox{display:flex;align-items:center;border:1px solid var(--line-bold,#555);border-radius:13px;overflow:hidden;background:var(--surface-high,#222)}.sl-domain{font-size:.81rem;color:var(--muted,#aaa);white-space:nowrap;padding:0 3px 0 13px}.sl-field{width:100%;min-width:0;outline:0;border:0;background:transparent;color:var(--text,#fff);padding:13px 12px 13px 1px;font-size:.91rem}.sl-info{font-size:.77rem;color:var(--muted,#aaa);min-height:23px;margin:9px 0 18px}.sl-info.sl-bad{color:#ff918b}.sl-info.sl-good{color:#80d7a0}
  .sl-cta{border:0;border-radius:12px;min-height:46px;padding:10px 16px;background:var(--button,#fff);color:var(--button-text,#171717);font-weight:700;cursor:pointer}.sl-cta:disabled{cursor:not-allowed;opacity:.42}.sl-outline{background:var(--surface-high,#222);color:var(--text,#fff);border:1px solid var(--line-bold,#555)}.sl-actions{display:flex;gap:10px;flex-wrap:wrap}.sl-created{padding:14px 15px;border:1px solid var(--line-bold,#555);background:var(--surface-high,#222);border-radius:12px;overflow-wrap:anywhere;margin:14px 0 18px;font-size:.96rem;font-weight:650}.sl-created a{text-decoration:none;color:var(--text,#fff)}.sl-slow{font-size:.72rem;color:var(--muted,#aaa);line-height:1.6;margin:16px 0 0}
  @media(max-width:440px){.sl-panel{padding:20px}.sl-domain{font-size:.73rem}.sl-field{font-size:.84rem}.sl-option{padding:15px}.sl-actions .sl-cta{flex:1}}
  @media(prefers-reduced-motion:reduce){.sl-mask.sl-open,.sl-panel{animation:none!important}.sl-option{transition:none}}
  `;
  const managerStyle = `
  .my-short-links{padding:46px 0 60px;position:relative}.my-short-links .sl-manager-head{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;margin-bottom:20px}
  .my-short-links .sl-manager-head h2{font-size:clamp(1.65rem,2.8vw,2.35rem);letter-spacing:-.055em;line-height:1.1;margin:7px 0}
  .my-short-links .sl-manager-head p{color:var(--muted);font-size:.83rem;line-height:1.6;margin:6px 0 0;max-width:610px}
  .my-short-links .sl-manager-count{font-size:.72rem;color:var(--muted);letter-spacing:.07em;text-transform:uppercase;font-weight:700}
  .my-short-links .sl-manager-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,335px),1fr));gap:14px}
  .my-short-links .sl-manager-card{border:1px solid var(--line-bold);background:var(--surface-glass);border-radius:var(--user-radius,24px);padding:19px 20px;min-width:0;box-shadow:0 10px 38px rgba(0,0,0,.08);backdrop-filter:blur(14px)}
  .my-short-links .sl-manager-card strong{display:block;overflow-wrap:anywhere;font-size:.93rem;letter-spacing:-.012em}
  .my-short-links .sl-manager-card a.sl-manager-url{display:block;overflow-wrap:anywhere;color:var(--text);font-size:.83rem;margin:10px 0;text-decoration:underline;text-underline-offset:4px}
  .my-short-links .sl-manager-card small{display:block;color:var(--muted);font-size:.7rem;margin-bottom:14px}
  .my-short-links .sl-manager-actions{display:flex;flex-wrap:wrap;gap:7px}
  .my-short-links .sl-manager-actions button,.my-short-links .sl-manager-refresh{padding:10px 13px;border:1px solid var(--line-bold);border-radius:11px;background:var(--surface-high);color:var(--text);font:inherit;font-size:.77rem;font-weight:650;cursor:pointer;transition:transform .22s,border-color .22s}
  .my-short-links .sl-manager-actions button:hover,.my-short-links .sl-manager-refresh:hover{transform:translateY(-2px);border-color:var(--text)}
  .my-short-links .sl-manager-actions .sl-remove{margin-left:auto}
  .my-short-links .sl-manager-empty{border:1px dashed var(--line-bold);border-radius:var(--user-radius,24px);padding:25px;color:var(--muted);font-size:.85rem;line-height:1.7}
  .my-short-links #shortLinksStatus{font-size:.76rem;min-height:18px;margin:12px 0 0;color:var(--muted)}
  `;
  const managerCss=document.createElement('style');managerCss.textContent=managerStyle;document.head.append(managerCss);
  const sheet = document.createElement('style'); sheet.textContent = STYLE; document.head.append(sheet);
  const mask = document.createElement('div'); mask.className='sl-mask'; mask.id='eightPDFShareDialog';
  mask.innerHTML='<section class="sl-panel" role="dialog" aria-modal="true" aria-labelledby="slTitle"><div class="sl-head"><div><span class="sl-eyebrow">8aPDF · Smart Share</span><h2 class="sl-title" id="slTitle">Share this PDF</h2></div><button class="sl-close" type="button" aria-label="Close sharing">×</button></div><div id="slBody"></div></section>';
  document.body.append(mask);
  const body=mask.querySelector('#slBody');
  let current=null, timer=0, checkedSlug='', available=false, lastFocus=null;
  const OWNER_STORAGE='8apdf_short_links_owner_v1';
  function ownerKey(){
    try {
      let token=localStorage.getItem(OWNER_STORAGE);
      if(token && /^[a-f0-9]{64}$/.test(token))return token;
      const bytes=new Uint8Array(32);
      crypto.getRandomValues(bytes);
      token=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
      localStorage.setItem(OWNER_STORAGE,token);
      return token;
    }catch{return null}
  }
  let loadSerial=0;
  const manager=document.createElement('section');
  manager.className='my-short-links shell';
  manager.id='myShortLinks';
  manager.setAttribute('aria-label','Manage your custom short links');
  manager.innerHTML=`<div class="sl-manager-head"><div><span class="sl-manager-count">8aPDF · PERSONAL LINK MANAGER</span><h2>My Short Links</h2><p>Your custom PDF links, with quick Open, Copy, Share and Delete. Only links owned by this browser are manageable.</p></div><button type="button" class="sl-manager-refresh" id="slManagerRefresh">↻ Refresh links</button></div><div id="myShortLinksList" class="sl-manager-list" aria-live="polite"><div class="sl-manager-empty">Loading your links…</div></div><p id="shortLinksStatus"></p>`;
  const footer=document.querySelector('footer');
  if(footer)footer.before(manager);else document.body.append(manager);
  const managerList=manager.querySelector('#myShortLinksList'), managerStatus=manager.querySelector('#shortLinksStatus');
  const say=text=>{managerStatus.textContent=text||''};
  async function apiAction(action,payload={}){
    const key=ownerKey();
    if(!key)throw Error('This browser is blocking local storage. Enable it to manage your links.');
    const r=await fetch('/api/short-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,ownerKey:key,...payload}),cache:'no-store'});
    const data=await r.json().catch(()=>({error:'The server sent an invalid response.'}));
    if(!r.ok)throw Error(data.error||'Request failed');
    return data;
  }
  async function loadLinks(){
    const ticket=++loadSerial;
    managerList.innerHTML='<div class="sl-manager-empty">Loading your custom links…</div>';say('');
    try{
      const data=await apiAction('list');
      if(ticket!==loadSerial)return;
      const links=Array.isArray(data.links)?data.links:[];
      if(!links.length){managerList.innerHTML='<div class="sl-manager-empty">No managed links yet. Share a PDF → Create Custom Short Link to add one. Links created before the ownership feature cannot be automatically claimed.</div>';return}
      managerList.innerHTML=links.map(link=>`<article class="sl-manager-card" data-link-slug="${esc(link.slug)}"><strong>${esc(link.title||'School PDF')}</strong><a class="sl-manager-url" href="${esc(link.shortUrl)}" target="_blank" rel="noopener noreferrer">${esc(link.shortUrl)}</a><small>Created ${esc(link.createdAt?new Date(link.createdAt).toLocaleDateString('en-IN'):'recently')}</small><div class="sl-manager-actions"><button type="button" data-link-action="copy">Copy</button><button type="button" data-link-action="share">Share</button><button type="button" data-link-action="open">Open ↗</button><button type="button" class="sl-remove" data-link-action="delete">Delete</button></div></article>`).join('');
      say(links.length+' owned link'+(links.length===1?'':'s')+' · Links are public; management stays with this browser.');
    }catch(e){if(ticket!==loadSerial)return;managerList.innerHTML='<div class="sl-manager-empty">Could not load your links right now.</div>';say(e.message)}
  }
  manager.querySelector('#slManagerRefresh').addEventListener('click',loadLinks);
  managerList.addEventListener('click',async e=>{
    const button=e.target.closest('[data-link-action]'),card=e.target.closest('[data-link-slug]');
    if(!button||!card)return;
    const slug=card.dataset.linkSlug,url='https://8apdf.vercel.app/'+slug,action=button.dataset.linkAction;
    if(action==='open'){window.open(url,'_blank','noopener,noreferrer');return}
    if(action==='share'){await shareNative(url,slug+' · 8aPDF');return}
    if(action==='copy'){try{await navigator.clipboard.writeText(url);say('Copied '+url)}catch{window.prompt('Copy link:',url)}return}
    if(action==='delete'){
      if(!confirm('Delete '+url+' permanently? The public link will stop working.'))return;
      button.disabled=true;button.textContent='Deleting…';
      try{await apiAction('delete',{slug});await loadLinks();say('Deleted '+slug+' permanently.')}
      catch(err){say(err.message);button.disabled=false;button.textContent='Delete'}
    }
  });
  const footerLinks=document.querySelector('.footer-grid');
  if(footerLinks){const target=footerLinks.querySelector('div:nth-child(2)');if(target){const a=document.createElement('a');a.href='#myShortLinks';a.className='footer-link';a.textContent='My Short Links';target.append(a)}}
  loadLinks();
  const normalize=x=>String(x||'').trim().toLowerCase();
  const valid=x=>/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(x)&&!x.includes('--');
  function close(){mask.classList.remove('sl-open');document.body.style.removeProperty('overflow');current=null;clearTimeout(timer);lastFocus?.focus?.({preventScroll:true});}
  function setBody(html){body.innerHTML=html;}
  function setMessage(message,status=''){const el=mask.querySelector('#slAvailability');if(el){el.className='sl-info '+(status?'sl-'+status:'');el.textContent=message;}}
  async function shareNative(url,title){const text=`${title}\nby 8aPDF`;
    try {if(navigator.share) {await navigator.share({title,text,url});return true}}
    catch(e){if(e.name==='AbortError')return false}
    try{await navigator.clipboard.writeText(url);setMessage('Link copied to clipboard','good');return true}
    catch{window.prompt('Copy the PDF link:',url);return false}
  }
  function choices(){setBody(`<p class="sl-sub">${esc(current.title)}</p><button type="button" class="sl-option" id="slOriginal"><span><strong>Original PDF Link</strong><small>Open your phone’s native share sheet, or copy the original PDF URL.</small></span><span class="sl-arrow">↗</span></button><button type="button" class="sl-option" id="slSendActual"><span><strong>Send Entire PDF File</strong><small>Share the full downloadable PDF via your phone’s share sheet, not just its URL.</small></span><span class="sl-arrow">↗</span></button><button type="button" class="sl-option" id="slCustom"><span><strong>Create Custom Short Link</strong><small>Choose your own name, like <b>8apdf.vercel.app/goku</b>.</small></span><span class="sl-arrow">→</span></button>`);
    body.querySelector('#slOriginal').addEventListener('click',()=>shareNative(current.pdfUrl,current.title));
    body.querySelector('#slCustom').addEventListener('click',nameForm);
    body.querySelector('#slSendActual').addEventListener('click',sendEntirePdf);
  }
  async function sendEntirePdf(){
    if(!current?.pdfUrl)return;
    const item={...current};
    setBody('<p class="sl-sub">Preparing the complete PDF file…</p><div class="sl-info" id="slAvailability" aria-live="polite">Downloading original PDF securely.</div><button type="button" class="sl-cta sl-outline" id="slBack">Back</button>');
    body.querySelector('#slBack').onclick=choices;
    try{
      const url='/api/download?url='+encodeURIComponent(item.pdfUrl)+'&filename='+encodeURIComponent(item.title+'.pdf');
      const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),20000);
      let response;try{response=await fetch(url,{signal:ctrl.signal})}finally{clearTimeout(timeout)}
      if(!response.ok)throw Error('PDF file could not be downloaded ('+response.status+').');
      const pdfBlob=await response.blob();
      if(!pdfBlob.size||pdfBlob.size>45*1024*1024)throw Error('PDF file too large for direct sharing (45 MB maximum).');
      const file=new File([pdfBlob],(item.title||'8aPDF').replace(/[\\/:*?"<>|]/g,'-').slice(0,90)+'.pdf',{type:'application/pdf'});
      if(navigator.canShare?.({files:[file]})&&navigator.share){
        try{await navigator.share({files:[file],title:item.title,text:'Shared from 8aPDF'})}
        catch(e){if(e.name!=='AbortError')throw e}
        choices();return;
      }
      const objectURL=URL.createObjectURL(file),link=document.createElement('a');
      link.href=objectURL;link.download=file.name;document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(objectURL),20000);
      setMessage('Your complete PDF was downloaded. Attach this file to WhatsApp or any app to send it.','good');
      body.querySelector('#slBack').textContent='Back to sharing';
    }catch(e){setMessage('Could not share full PDF: '+e.message,'bad')}
  }
  function nameForm(){available=false;checkedSlug='';setBody(`<p class="sl-sub">Choose a unique short name for <strong>${esc(current.title)}</strong>.</p><label class="sl-label" for="slSlug">Your custom link name</label><div class="sl-slugbox"><span class="sl-domain">8apdf.vercel.app/</span><input id="slSlug" class="sl-field" maxlength="32" placeholder="goku" autocomplete="off" autocapitalize="off" spellcheck="false"/></div><p id="slAvailability" class="sl-info" aria-live="polite">3–32 characters · letters, numbers and hyphens.</p><div class="sl-actions"><button type="button" class="sl-cta sl-outline" id="slBack">Back</button><button type="button" class="sl-cta" id="slCreate" disabled>Create Short Link</button></div><p class="sl-slow">Names are public and permanently reserved after creation. Links point only to PDFs in the school library.</p>`);
    const input=body.querySelector('#slSlug'),button=body.querySelector('#slCreate');
    body.querySelector('#slBack').onclick=choices;
    input.addEventListener('input',()=>{clearTimeout(timer);available=false;checkedSlug='';button.disabled=true;const slug=normalize(input.value);if(!valid(slug)){setMessage('Use 3–32 characters: letters, numbers and single hyphens.');return}
      setMessage('Checking availability…');timer=setTimeout(async()=>{
        try{const r=await fetch(`/api/short-links?slug=${encodeURIComponent(slug)}`,{cache:'no-store'});const data=await r.json();if(normalize(input.value)!==slug)return;
          if(!r.ok){setMessage(data.error||'Service unavailable','bad');return}
          checkedSlug=slug;available=!!data.available;button.disabled=!available;
          setMessage(data.available?'This name is available':'This name is already used',data.available?'good':'bad');
        }catch{setMessage('Cannot check right now. Please try again.','bad')}
      },450);
    });
    button.addEventListener('click',async()=>{const slug=normalize(input.value);if(!available||slug!==checkedSlug)return;
      button.disabled=true;button.textContent='Creating…';setMessage('Saving your unique link…');
      try{const r=await fetch('/api/short-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,documentId:current.id,pdfUrl:current.pdfUrl,ownerKey:ownerKey()})});const data=await r.json();if(!r.ok){setMessage(data.error||'Could not create your short link','bad');button.textContent='Create Short Link';button.disabled=!available;if(r.status===409){available=false;button.disabled=true;}return}
        created(data.shortUrl);loadLinks();
      }catch{setMessage('Connection failed. Check internet and retry.','bad');button.disabled=false;button.textContent='Create Short Link'}
    });
    input.focus({preventScroll:true});
  }
  function created(url){setBody(`<p class="sl-sub">Your new custom link is ready! Send it to anyone and it will redirect to the original PDF.</p><div class="sl-created"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)} ↗</a></div><div class="sl-actions"><button class="sl-cta" type="button" id="slCopy">Copy Link</button><button class="sl-cta sl-outline" type="button" id="slShare">Share Link</button><button class="sl-cta sl-outline" type="button" id="slAgain">Done</button></div><p class="sl-info" id="slAvailability" aria-live="polite"></p>`);
    body.querySelector('#slCopy').onclick=async()=>{try{await navigator.clipboard.writeText(url);setMessage('Short link copied!','good')}catch{window.prompt('Copy link:',url)}};
    body.querySelector('#slShare').onclick=()=>shareNative(url,current.title);
    body.querySelector('#slAgain').onclick=close;
  }
  mask.querySelector('.sl-close').onclick=close;
  mask.addEventListener('click',event=>{if(event.target===mask)close()});
  document.addEventListener('keydown',event=>{if(!mask.classList.contains('sl-open'))return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}} ,true);
  window.__8aPDFShortLinks=pdf=>{
    if(!pdf?.id || !pdf.pdfUrl)return;
    current={id:String(pdf.id),title:String(pdf.title||'School PDF'),pdfUrl:String(pdf.pdfUrl)};
    lastFocus=document.activeElement;choices();mask.classList.add('sl-open');document.body.style.overflow='hidden';mask.querySelector('.sl-close').focus({preventScroll:true});
  };
})();