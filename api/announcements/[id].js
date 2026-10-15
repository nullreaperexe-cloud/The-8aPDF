import {handler} from '../_catalogue.js';
export default (req,res)=>handler(req,res,'announcements',String(req.query.id||''));
