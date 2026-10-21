'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('homepage Watch Trailer leads to the real, active supplied YouTube embed without autoplay',()=>{
 const html=fs.readFileSync('index.html','utf8'),live=html.replace(/<!--[\s\S]*?-->/g,''),section=live.match(/<section class="trailer[^]*?<\/section>/)?.[0];assert.ok(section);
 assert.match(live,/href="#trailer"/);assert.match(section,/id="trailer"/);assert.doesNotMatch(section,/Coming Soon|KOJFnPcYvEQ/);
 const frame=section.match(/<iframe[^]*?<\/iframe>/)?.[0];assert.ok(frame);
 const url=new URL(frame.match(/src="([^"]+)"/)[1].replaceAll('&amp;','&'));
 assert.equal(url.origin,'https://www.youtube.com');assert.equal(url.pathname,'/embed/Z1ijl2PwrlA');assert.equal(url.searchParams.get('autoplay'),'0');
 assert.equal(url.searchParams.get('playsinline'),'1');assert.match(frame,/title="StoneForge Official Trailer"/);
 assert.match(frame,/loading="lazy"/);assert.match(frame,/allowfullscreen/);assert.match(frame,/referrerpolicy="strict-origin-when-cross-origin"/);
 assert.match(section,/href="https:\/\/www.youtube.com\/watch\?v=Z1ijl2PwrlA" target="_blank" rel="noopener noreferrer"/);
});
test('existing trailer container remains responsive with a playable minimum height',()=>{
 const css=fs.readFileSync('index.css','utf8'),wrapper=css.match(/\.trailer__video-wrapper\s*\{([^}]+)\}/)?.[1];assert.ok(wrapper);
 assert.match(wrapper,/width: 100%/);assert.match(wrapper,/aspect-ratio: 16 \/ 9/);assert.match(wrapper,/min-height: 200px/);
 assert.match(css,/\.trailer__video-wrapper iframe,[^}]+width: 100%;[^}]+height: 100%/);
});
