// Deterministic, multilingual recognition. No AI service or API key is used.
export function cleanSchoolText(value){return String(value||'').normalize('NFKC').replace(/(?:pay\s*now\s*)?class\s*test\s*more/gi,' ').replace(/\bpay\s*now\b|\bread\s*more\b/gi,' ').replace(/\s+/g,' ').trim();}
export function isTestNotice(item){return /\b(?:test|exam(?:ination)?|quiz|assessment|datesheet|date\s*sheet)\b|परीक्षा|टेस्ट|ਮੁਲਾਂਕਣ|ਪ੍ਰੀਖਿਆ|ਟੈਸਟ/i.test(cleanSchoolText([item.title,item.description,item.message,item.fullMessage,item.category].join(' ')));}
export function classifyTestPdf(doc,text=''){
 const metadata=cleanSchoolText([doc.title,doc.description,doc.chapter,doc.subject].join(' ')),body=cleanSchoolText(text),reasons=[];let score=0,kind='paper';
 const artifact=/\b(?:(?:mock|revision|practice|unit|class|periodic|sample|pre[ -]?board)\s+(?:test|exam|assessment)(?:\s+(?:paper|worksheet|\d+))?|(?:test|exam|question|assessment)\s*(?:paper|worksheet)|(?:pdf|attachment|attached|pfa).{0,35}(?:of\s+(?:the\s+)?)?(?:mock\s+|revision\s+)?test|test.{0,25}(?:pdf|attached)|(?:test|exam).{0,20}(?:conducted|answer\s*key)|answer\s*key\s+(?:of|for).{0,20}test|revision\s*worksheet)\b|प्रश्न\s*पत्र|ਪ੍ਰਸ਼ਨ\s*ਪੱਤਰ/i;
 const noticeOnly=/\b(?:prepare|bring|tomorrow|scheduled|will\s+be|test\s+of|test\s+on)\b/i.test(metadata)&&!/(?:test.{0,25}(?:pdf|attached|conducted)|(?:pdf|attached).{0,35}test|question\s*paper|answer\s*key)/i.test(metadata);
 if(artifact.test(metadata)&&!noticeOnly){score+=6;reasons.push('Test document described in title');}
 if(/\b(?:question\s*paper|maximum\s*marks|max\.?\s*marks|time\s*(?:allowed|duration)|general\s*instructions|all\s*questions\s*are\s*compulsory)\b|पूर्णांक|समय\s*:/i.test(body)){score+=4;reasons.push('Question-paper structure');}
 if(/\b(?:test|examination|assessment|mock\s*test|unit\s*test|revision\s*test)\b|परीक्षा|ਪ੍ਰੀਖਿਆ/i.test(body.slice(0,1600))){score+=3;reasons.push('Test heading inside PDF');}
 const structures=[/\bsection\s*[-:]?\s*[a-d]\b/i,/\b(?:q(?:uestion)?\.?\s*\d+|\d+\s*\.\s*[^.]{4})/i,/\b(?:choose\s*the\s*correct|multiple\s*choice|answer\s*the\s*following|fill\s*in\s*the\s*blanks)\b/i,/\b\d+\s*(?:marks|×\s*\d+|x\s*\d+)\b/i];
 if(structures.filter(r=>r.test(body)).length>=3){score+=3;reasons.push('Numbered questions and scoring');}
 if(/\b(?:answer\s*key|solution[s]?)\b/i.test(metadata+' '+body.slice(0,350)))kind='solutions';else if(/\b(?:mock|revision|practice|sample)\b/i.test(metadata+' '+body.slice(0,350)))kind='practice';
 if(/\b(?:notes|explanation|chapter\s*summary|notebook\s*work)\b/i.test(metadata)&&!artifact.test(metadata)&&!reasons.includes('Test heading inside PDF'))score=Math.max(0,score-4);
 return {isTest:score>=6,candidate:isTestNotice(doc)||score>=3,score,kind,reasons,version:2,source:body?'PDF text':'Document details'};
}
