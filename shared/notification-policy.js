export function notificationAllowed(state,key,fingerprint,day,firstOpening){
 const old=state.seen?.[key];
 return !old||old.fingerprint!==fingerprint||(firstOpening&&old.day!==day);
}
export function recordNotification(state,key,fingerprint,day){
 state.seen||={};state.seen[key]={fingerprint,day};
 const keys=Object.keys(state.seen);for(const k of keys.slice(0,Math.max(0,keys.length-600)))delete state.seen[k];return state;
}
