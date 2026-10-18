'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context={};
vm.runInNewContext(fs.readFileSync(path.join(root,'data/grants.js'),'utf8')+';result={grants:GRANTS_DATA,categories:CATEGORIES};',context,{timeout:1000});
const {grants,categories}=context.result;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const count=grants.length;
const selected=[...grants].sort((a,b)=>Number(b.deadline==='Rolling')-Number(a.deadline==='Rolling')||Number(b.featured)-Number(a.featured)).slice(0,6);
const cards=selected.map(g=>`<article class="card grant-card"><h3><a href="/grants/?id=${encodeURIComponent(g.id)}">${esc(g.title)}</a></h3><p>${esc(g.funder)}</p><p>${esc(g.description)}</p><p>Recorded deadline: ${esc(g.deadline)}${/^\d{4}-/.test(g.deadline)&&g.deadline<today?' — past date; check the next cycle':''}. Dates and availability must be confirmed with the funder.</p><a href="${esc(g.applicationUrl)}" target="_blank" rel="noopener">Check the official program source</a></article>`).join('\n');
const categoryCards=categories.map(c=>`<a class="category-card" href="/grants/?category=${encodeURIComponent(c)}"><h3>${esc(c)}</h3><p>${grants.filter(g=>g.category===c).length} program records</p></a>`).join('\n');
let t=fs.readFileSync(path.join(root,'index.html'),'utf8');
function section(id,content){const re=new RegExp('(<div id="'+id+'"[^>]*>)[\\s\\S]*?(</div><!-- prerender:'+id+' -->|</div>)');if(!re.test(t))throw Error('Missing '+id);t=t.replace(re,'$1'+content+'</div><!-- prerender:'+id+' -->');}
// Idempotent replacement of previously rendered containers.
for(const [id,content] of [['featuredGrants',cards],['categoriesGrid',categoryCards]]){
 const start=t.indexOf('<div id="'+id+'"');const endMarker='</div><!-- prerender:'+id+' -->';const marker=t.indexOf(endMarker,start);
 if(marker>=0){const open=t.indexOf('>',start)+1;t=t.slice(0,open)+content+t.slice(marker);}else section(id,content);
}
t=t.replace(/<span class="stat-value">[^<]*<\/span>\s*<span class="stat-label">(?:Grants Listed|Program Records)<\/span>/,`<span class="stat-value">${count}</span><span class="stat-label">Program Records</span>`).replace(/<span class="stat-value">[^<]*<\/span>\s*<span class="stat-label">(?:Available Funding|Funding Categories)<\/span>/,`<span class="stat-value">${categories.length}</span><span class="stat-label">Funding Categories</span>`);
t=t.replace('Handpicked opportunities worth your attention','Program research starting points. Confirm the current cycle, eligibility and deadline with each funder.');
t=t.replace('Discover thousands of grant opportunities','Research nonprofit funding programs').replace('Submit your application and track your progress. Our platform helps you manage deadlines and follow up on submissions.','Submit through the funder’s official application process. Keep your own calendar of deadlines and follow-up dates.');
t=t.replace(/Free nonprofit grant database helping organizations discover and apply for thousands of grants across the USA\. Over \$50B in available funding indexed\./g,'Research nonprofit funding program records and verify availability with the original funder.').replace(/Free nonprofit grant database\. Search \$50B\+ in available funding across the USA\./g,'Search nonprofit funding program records and check the original source before applying.').replace(/GrantFinder indexes over 10,000 active grants[^"<]+/g,'GrantFinder currently bundles '+count+' program records. Records may include past cycles; verify current dates, eligibility and funding with the original source.');
// Preserve server-rendered lists; client scripts should not replace them with stale featured deadlines.
t=t.replace('if (featuredContainer) {','if (featuredContainer && !featuredContainer.children.length) {').replace('if (categoriesContainer) {','if (categoriesContainer && !categoriesContainer.children.length) {');
fs.writeFileSync(path.join(root,'index.html'),t);
console.log(`Rendered ${selected.length} programs, ${categories.length} categories from ${count} records.`);
