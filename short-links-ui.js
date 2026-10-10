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
  const sheet = document.createElement('style'); sheet.textContent = STYLE; document.head.append(sheet);
  const mask = document.createElement('div'); mask.className='sl-mask'; mask.id='eightPDFShareDialog';
  mask.innerHTML='<section class="sl-panel" role="dialog" aria-modal="true" aria-labelledby="slTitle"><div class="sl-head"><div><span class="sl-eyebrow">8aPDF · Smart Share</span><h2 class="sl-title" id="slTitle">Share this PDF</h2></div><button class="sl-close" type="button" aria-label="Close sharing">×</button></div><div id="slBody"></div></section>';
  document.body.append(mask);
  const body=mask.querySelector('#slBody');
  let current=null, timer=0, checkedSlug='', available=false, lastFocus=null;
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
  function choices(){setBody(`<p class="sl-sub">${esc(current.title)}</p><button type="button" class="sl-option" id="slOriginal"><span><strong>Original PDF Link</strong><small>Open your phone’s native share sheet, or copy the original PDF URL.</small></span><span class="sl-arrow">↗</span></button><button type="button" class="sl-option" id="slCustom"><span><strong>Create Custom Short Link</strong><small>Choose your own name, like <b>8apdf.vercel.app/goku</b>.</small></span><span class="sl-arrow">→</span></button>`);
    body.querySelector('#slOriginal').addEventListener('click',()=>shareNative(current.pdfUrl,current.title));
    body.querySelector('#slCustom').addEventListener('click',nameForm);
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
      try{const r=await fetch('/api/short-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,documentId:current.id})});const data=await r.json();if(!r.ok){setMessage(data.error||'Could not create your short link','bad');button.textContent='Create Short Link';button.disabled=!available;if(r.status===409){available=false;button.disabled=true;}return}
        created(data.shortUrl);
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