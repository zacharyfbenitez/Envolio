// Rasterize the shared vector passport mark for platform app icons.
import puppeteer from 'puppeteer-core';
import {readFile,writeFile} from 'node:fs/promises';
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 const source='data:image/svg+xml;base64,'+(await readFile('public/envolio-passport.svg')).toString('base64');
 for(const [name,size,scale]of[['envolio-passport-192.png',192,.9],['envolio-passport-512.png',512,.9],['envolio-passport-maskable-512.png',512,.7],['envolio-passport-apple.png',180,.9]]){
  const data=await page.evaluate(async({source,size,scale})=>{
   const img=new Image();img.src=source;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#111113';ctx.fillRect(0,0,size,size);
   ctx.drawImage(img,size*(1-scale)/2,size*(1-scale)/2,size*scale,size*scale);
   return canvas.toDataURL('image/png').split(',')[1];
  },{source,size,scale});
  await writeFile('public/'+name,Buffer.from(data,'base64'));
 }
}finally{await browser.close();}
