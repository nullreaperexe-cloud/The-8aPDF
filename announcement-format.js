/* Shared accessible announcement presentation for 8aPDF.
 * No browser AI requests: the sync worker supplies optional Groq keyPoints.
 * Historical notices use a deterministic format, with zero additional API credits.
 */
(function (root) {
  'use strict';
  const PERSONAL_ATTENDANCE_ID = 'edusecure-0779a1bb3f03949fb1c2b02fe692838b';
  const personalAttendance = /\battendance\b[\s\S]{0,180}\byour\s+child\b[\s\S]{0,140}\b(?:absent|present|late|on\s+leave)\b/i;
  function blocked(x) {
    if (!x) return true;
    if (String(x.id || x.sourceMessageId || x.source_message_id || '') === PERSONAL_ATTENDANCE_ID) return true;
    return personalAttendance.test([x.title, x.description, x.message, x.originalMessage].join(' '));
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function cleanText(value) {
    let text = String(value || '').replace(/\r/g, '\n')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .replace(/\u200b|\u200c|\u200d/g, '').trim();
    const date = '(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+20\\d{2})';
    text = text.replace(new RegExp('^\\s*(?:(?:Message|Circular|School\\s*Diary|Attendance|Announcement)\\s+)?'+date+'\\s*', 'i'), '');
    text = text.replace(/^\s*(?:message|circular|school diary|announcement)\s+/i, '');
    text = text.replace(/^\s*(?:dear\s+(?:parents?|students?|all)|respected\s+parents?|good\s+(?:morning|afternoon|evening))[,:\s.!-]*/i, '');
    text = text.replace(/\s*(?:warm\s+regards|best\s+regards|kind\s+regards|regards)[,:\s-]+(?:team\s+)?(?:manav\s+mangal|school[\s\S]*)$/i, '');
    text = text.replace(/(?:\s+(?:Pay\s*Now|Read\s*More|View\s*More|Attachment|Attachments)){1,6}\s*$/i, '');
    return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  function sentences(value) {
    const cleaned = cleanText(value);
    if (!cleaned) return [];
    return cleaned.split(/\n+|;\s+|(?<=[.!?])\s+(?=[A-Z(])/)
      .map(t => t.trim().replace(/^[•\-\d.)\s]+/,'').trim())
      .filter(Boolean);
  }
  const labels = {
    'homework':'Homework', 'home work':'Homework',
    'classwork':'Classwork', 'class work':'Classwork',
    'instructions':'Instructions', 'instruction':'Instructions',
    'note':'Note', 'important':'Important',
    'things to bring':'Bring to School', 'bring':'Bring to School',
    'submission':'Submission'
  };
  const labelRe = /\b(home\s*work|class\s*work|instructions?|important|note|things\s+to\s+bring|submission)\s*[:：\-–]\s*/gi;
  function fromLabelledText(text) {
    const matches = Array.from(text.matchAll(labelRe));
    if (!matches.length) return null;
    const sections = [];
    const leading = text.slice(0, matches[0].index).trim();
    if (leading) sections.push({heading:'Overview',points:sentences(leading)});
    matches.forEach((m, i) => {
      const value = text.slice(m.index + m[0].length, i+1<matches.length?matches[i+1].index:text.length).trim();
      const key = m[1].toLowerCase().replace(/\s+/g,' ');
      const points = sentences(value);
      if (points.length) sections.push({heading:labels[key]||'Details',points});
    });
    return sections.length ? sections : null;
  }
  function normalizePoints(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 5).map(x=>cleanText(x)).filter(x=>x.length>4 && x.length<300);
  }
  function build(x) {
    const title = cleanText(x?.title || 'School Update').replace(/^[*#\s]+/,'') || 'School Update';
    const body = cleanText(x?.originalMessage || x?.message || x?.fullMessage || x?.description || title);
    let sections = fromLabelledText(body);
    if (!sections) {
      // Groq summaries were generated during the regular ingestion call; no
      // additional request (or invented information) is produced in the browser.
      const aiPoints = normalizePoints(x?.keyPoints || x?.raw?.keyPoints);
      const points = aiPoints.length ? aiPoints : sentences(body);
      sections = [{heading: 'Key details', points: points.length ? points : [title]}];
    }
    // Keep multiple independent notices separate and never lose unparsed text.
    sections = sections.filter(s=>s.points.length).slice(0, 12);
    return {title,sections,category:cleanText(x?.category||'School Notice')};
  }
  function toWhatsApp(x) {
    const d = build(x);
    const out = ['*'+d.title.replace(/[*_~]/g,'')+'*'];
    for (const s of d.sections) {
      out.push('', '*'+s.heading+'*');
      for (const point of s.points) out.push('• '+point.replace(/^[•\s]+/, '').replace(/[*]/g,''));
    }
    out.push('', '_Shared via 8aPDF_');
    return out.join('\n');
  }
  function preview(x, max = 180) {
    const d = build(x);
    const text = d.sections.flatMap(s=>s.points).join(' • ');
    return text.length > max ? text.slice(0,max-1).replace(/\s+\S*$/, '')+'…' : text;
  }
  function toHtml(x) {
    const d = build(x);
    return '<div class="intelligent-notice" role="article">' +
      '<div class="intelligent-notice-eyebrow"><span class="intelligent-notice-dot"></span> TEACHER UPDATE <span class="intelligent-notice-category">'+escapeHtml(d.category)+'</span></div>' +
      d.sections.map((s,i)=>
        '<section class="intelligent-notice-section"><div class="intelligent-notice-section-head"><span class="intelligent-notice-number">'+String(i+1).padStart(2,'0')+'</span><h4>'+escapeHtml(s.heading)+'</h4></div>' +
        '<ul>'+s.points.map(p=>'<li>'+escapeHtml(p)+'</li>').join('')+'</ul></section>'
      ).join('') +
      '<div class="intelligent-notice-footer">Formatted for easy reading and sharing · Verify school instructions in EduSecure</div></div>';
  }
  const api={blocked,escapeHtml,cleanText,build,preview,toHtml,toWhatsApp};
  root.__8aPDFAnnouncementFormat=api;
  if (typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
