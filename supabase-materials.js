/*
 * 8aPDF study-material catalogue.
 * Supabase publishable keys are intended for browser use. Ensure public SELECT
 * is restricted using Supabase Row Level Security (RLS) policies.
 */
export const SUPABASE_PROJECT_URL='https://rzhtesfikvykdnmrqwjs.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_Jofg81Ze1uBcMPo85QRaKw_wQkS0080';
export const SUPABASE_MATERIALS_TABLE='study_materials';
export const SUPABASE_MATERIALS_URL=SUPABASE_PROJECT_URL+'/rest/v1/'+SUPABASE_MATERIALS_TABLE;

function validPageNumber(n,defaultValue,max){
  const v=n===undefined?defaultValue:Number(n);
  if(!Number.isSafeInteger(v)||v<0||v>max)throw new RangeError('Invalid Supabase pagination value');
  return v;
}

/**
 * Retrieve one page directly from the supplied Supabase REST table.
 * Supports both the public website and the Vercel API without Firestore.
 */
export async function listStudyMaterials({limit=500,offset=0,id=null,fetchImpl=fetch}={}){
  const size=validPageNumber(limit,500,1000);
  const start=validPageNumber(offset,0,1000000);
  if(size<1)throw new RangeError('Supabase page limit must be at least 1');
  const url=new URL(SUPABASE_MATERIALS_URL);
  url.searchParams.set('select','*');
  url.searchParams.set('apikey',SUPABASE_PUBLISHABLE_KEY);
  url.searchParams.set('limit',String(size));
  if(id!==null&&id!==undefined){
    url.searchParams.set('id','eq.'+String(id));
  }else{
    url.searchParams.set('offset',String(start));
    url.searchParams.set('order','id.asc');
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetchImpl(url.toString(),{
      method:'GET',
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Accept:'application/json'},
      cache:'no-store',
      signal:controller.signal
    });
    if(!response.ok){
      let detail='';
      try{const body=await response.json();detail=String(body?.message||body?.hint||body?.code||'')}catch{}
      throw new Error('Supabase study_materials request failed (HTTP '+response.status+')'+(detail?': '+detail.slice(0,170):''));
    }
    const data=await response.json();
    if(!Array.isArray(data))throw new Error('Supabase returned an unexpected materials response');
    return data;
  }finally{
    clearTimeout(timer);
  }
}

/** Load every accessible PDF record, rather than silently stopping at 1,000. */
export async function fetchAllStudyMaterials({pageSize=500,maxRows=30000,fetchImpl=fetch}={}){
  const size=validPageNumber(pageSize,500,1000);
  const max=validPageNumber(maxRows,30000,100000);
  if(!size||!max)throw new RangeError('Invalid Supabase read limit');
  const result=[];
  for(let offset=0;offset<max;offset+=size){
    const next=await listStudyMaterials({limit:Math.min(size,max-offset),offset,fetchImpl});
    result.push(...next);
    if(next.length<size)return result;
  }
  throw new Error('Supabase materials limit reached; increase maxRows to load the complete library');
}
