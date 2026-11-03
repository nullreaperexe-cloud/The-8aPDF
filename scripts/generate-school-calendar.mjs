import {readFileSync,writeFileSync} from 'node:fs';
import {calendarDay,addDays,dateMs} from '../shared/school-calendar-core.js';

// Deterministic, device-independent daily snapshot for all supported dates.
// Never infer a school closure: only configured Sundays, 2nd/4th Saturdays and
// externally verified EduSecure holiday banners may pause the six-day cycle.
const config=JSON.parse(readFileSync(new URL('../data/school-calendar.json',import.meta.url),'utf8'));
dateMs(config.start);dateMs(config.end);
if(config.end<config.start)throw new Error('Invalid calendar range');
const dates=[];
for(let d=config.start;d<=config.end;d=addDays(d,1)){
 if(dates.length>=800)throw new Error('Calendar range exceeds safe limit');
 dates.push(calendarDay(d,config));
}
const payload={
 version:1,timeZone:'Asia/Kolkata',
 start:config.start,end:config.end,
 generatedAt:new Date().toISOString(),
 dates
};
writeFileSync(new URL('../data/school-calendar-days.json',import.meta.url),JSON.stringify(payload,null,2)+'\n','utf8');
console.log('Generated '+dates.length+' canonical calendar days.');
