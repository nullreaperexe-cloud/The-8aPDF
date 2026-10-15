import {handler} from '../_catalogue.js';
export default (req,res)=>handler(req,res,'materials',String(req.query.id||''));
