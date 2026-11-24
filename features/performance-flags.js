/* 8aPDF performance flags. Visual styling and motion remain owned by the
 * existing files. This module only schedules work that is not needed for the
 * first interactive view. */
(()=>{
  'use strict';
  const root=document.documentElement;
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  const reducedData=Boolean(connection?.saveData||/^(slow-2g|2g)$/.test(connection?.effectiveType||''));
  const memory=Number(navigator.deviceMemory||0), cores=Number(navigator.hardwareConcurrency||0);
  const lowEnd=(memory>0&&memory<=4)||(cores>0&&cores<=4)||reducedData;
  root.dataset.perfTier=lowEnd?'low':'full';
  root.dataset.reducedData=reducedData?'on':'off';
  window.__8apdfPerformance={lowEnd,reducedData,tier:root.dataset.perfTier};
})();
