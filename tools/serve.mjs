import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
const ROOT = process.cwd();
const TYPES = {".html":"text/html",".css":"text/css",".js":"text/javascript",".json":"application/json",".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml"};
createServer(async (req,res)=>{
  try{
    let p = decodeURIComponent(req.url.split("?")[0]);
    if(p.endsWith("/")) p += "index.html";
    const fp = join(ROOT, p);
    const s = await stat(fp);
    const body = await readFile(s.isDirectory()? join(fp,"index.html"): fp);
    res.writeHead(200,{"content-type":TYPES[extname(fp)]||"application/octet-stream"});
    res.end(body);
  }catch(e){ res.writeHead(404); res.end("404"); }
}).listen(8099,()=>console.log("serving on 8099"));
