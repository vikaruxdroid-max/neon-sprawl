// Builds and executes the headless test bundle: stubs + game script + smoke tests.
const fs=require("fs"),path=require("path"),cp=require("child_process");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m){console.error("ERROR: no <script> block found in index.html");process.exit(1)}
const out=path.join(__dirname,".build.js");
fs.writeFileSync(out,
  fs.readFileSync(path.join(__dirname,"stubs.js"),"utf8")+"\n"+
  m[1]+"\n"+
  fs.readFileSync(path.join(__dirname,"smoke.js"),"utf8"));
cp.execSync("node "+JSON.stringify(out),{stdio:"inherit"});
