import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calendarDay,dateKey} from '../shared/school-calendar-core.js';

const config=JSON.parse(readFileSync(new URL('../data/school-calendar.json',import.meta.url),'utf8'));
const snapshot=JSON.parse(readFileSync(new URL('../data/school-calendar-days.json',import.meta.url),'utf8'));
const at=date=>calendarDay(date,config);
assert.equal(config.timeZone,'Asia/Kolkata');
assert.equal(dateKey(new Date('2026-11-03T20:00:00Z')),'2026-11-04');
assert.deepEqual(config.weeklyOff,[0]);
assert.deepEqual(config.saturdayOff,[2,4]);
assert.deepEqual([at('2026-11-03').schoolDay,at('2026-11-04').schoolDay,at('2026-11-05').schoolDay],[6,1,2]);
assert.equal(at('2026-11-04').holiday,false);
assert.equal(at('2026-11-03').nextDay,1);
assert.equal(at('2026-11-03').nextDate,'2026-11-04');
for(const d of ['2026-11-03','2026-11-04','2026-11-05']){
  const row=snapshot.dates.find(x=>x.date===d),expected=at(d);
  assert.deepEqual(row,expected);
}
assert.equal(snapshot.dates.length,536);
const main=readFileSync(new URL('../features/app-core.js',import.meta.url),'utf8');
const premium=readFileSync(new URL('../premium-workspace.js',import.meta.url),'utf8');
assert.ok(!main.includes("store.get('8apdf_selected_school_day_v1'"));
assert.ok(!premium.includes("'Day 5 Next'"));
console.log('PASS: 3 Nov Day 6, 4 Nov Day 1, 5 Nov Day 2; database snapshot matches the site.');
