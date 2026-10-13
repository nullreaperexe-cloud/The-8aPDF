import {dateKey} from './school-calendar-core.js';
import {isTestNotice} from './test-recognition.js';
export function noticeDateKey(value){if(!value)return'';if(value?.seconds)return dateKey(new Date(value.seconds*1000));if(value instanceof Date)return dateKey(value);const s=String(value);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const t=Date.parse(s);return Number.isFinite(t)?dateKey(new Date(t)):'';}
export function noticesForDay(notices,day){return notices.filter(n=>noticeDateKey(n.messageDate||n.createdAt)===day).sort((a,b)=>Date.parse(b.createdAt?.seconds?new Date(b.createdAt.seconds*1000):b.createdAt||0)-Date.parse(a.createdAt?.seconds?new Date(a.createdAt.seconds*1000):a.createdAt||0));}
export const importantNotices=notices=>notices.filter(isTestNotice);
