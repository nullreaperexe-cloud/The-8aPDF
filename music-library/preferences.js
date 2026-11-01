const KEY='8apdf_music_library_ui_v1';
const defaults={compact:false,queue:true,lowData:true,autofocus:false};
export function readUI(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}}
export function saveUI(value){try{localStorage.setItem(KEY,JSON.stringify({...defaults,...value}))}catch{}}
export function clearUI(){try{localStorage.removeItem(KEY)}catch{}}
