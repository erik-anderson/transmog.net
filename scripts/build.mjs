import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist');
// This fixed output path is owned by the build; remove retired files too.
if(dirname(output)!==root)throw new Error('Build output escaped the website root');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
// Publish only the website. Maintenance tools and provenance stay in Git.
for(const file of ['index.html','styles.css','site.js','CNAME','.nojekyll','robots.txt','sitemap.xml'])await copyFile(resolve(root,file),resolve(root,'dist',file));
await cp(resolve(root,'assets'),resolve(root,'dist/assets'),{recursive:true});
console.log('Static website ready in dist/');
