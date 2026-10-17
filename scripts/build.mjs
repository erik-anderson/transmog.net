import {mkdir,copyFile,cp} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(resolve(root,'dist'),{recursive:true});
// Publish only the website. Maintenance tools and provenance stay in Git.
for(const file of ['index.html','styles.css','site.js','CNAME','.nojekyll','robots.txt','sitemap.xml'])await copyFile(resolve(root,file),resolve(root,'dist',file));
await cp(resolve(root,'assets'),resolve(root,'dist/assets'),{recursive:true});
console.log('Static website ready in dist/');
