// Bundler — mirrors test/run.js. Builds stubs+game+probe_hack_infra_body.js and runs it.
const fs=require("fs"),path=require("path"),cp=require("child_process");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m){console.error("no <script> block");process.exit(1);}
const out=path.join(__dirname,".build_hack_infra.js");
fs.writeFileSync(out,
  fs.readFileSync(path.join(__dirname,"stubs.js"),"utf8")+"\n"+
  m[1]+"\n"+
  fs.readFileSync(path.join(__dirname,"probe_hack_infra_body.js"),"utf8"));
cp.execSync("node "+JSON.stringify(out),{stdio:"inherit"});
