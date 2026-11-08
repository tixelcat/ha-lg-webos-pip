const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const base=require('path').join(__dirname, '..', 'webos-app', 'app', 'js')+require('path').sep;
class FakeClasses {
  constructor(initial=''){this.x=new Set(initial.split(/\s+/).filter(Boolean));}
  add(...items){items.forEach(i=>this.x.add(i));}
  remove(...items){items.forEach(i=>this.x.delete(i));}
  toggle(x,val){if(val===undefined) val=!this.contains(x);if(val)this.x.add(x);else this.x.delete(x);}
  contains(x){return this.x.has(x);}
}
function el(id){return {id,classList:new FakeClasses(id.startsWith('pip')?'hidden':'hidden'), style:{setProperty(k,v){this[k]=v}},textContent:'',muted:false,getAttribute(){return null},removeAttribute(){},addEventListener(){},scrollIntoView(){}};}
async function setup(params, saved, failSecond=false){
 const els={};
 ['pip','pip2','label','label2','error','error2','spinner','spinner2','frame','frame2','video','video2','toast'].forEach(i=>els[i]=el(i));
 let settingsOpened=0, closed=0, connects=0, events={}, plays=[],stops=0, scheduled=[];
 const store={get:()=>saved,save:()=>true};
 class P {
   constructor(video,img,cb){this.video=video;this.img=img;this.cb=cb;this.slot=video.id==='video2'?2:1;}
   stop(){stops++}
   play(client,opts){plays.push({slot:this.slot,opts});this.cb('loading');if(failSecond&&this.slot===2)return Promise.reject(Error('Second offline'));this.cb('playing',{width:1920,height:1080});return Promise.resolve()}
 }
 class H{
  constructor(url,token){connects++;this.connected=false}
  connect(){return Promise.resolve().then(()=>{this.connected=true;});}
  close(){this.connected=false}
  friendlyName(id){return Promise.resolve(id)}
 }
 const doc={getElementById(id){if(!els[id])throw Error('missing '+id);return els[id]},addEventListener(key,cb){events[key]=cb},hidden:false};
 const c={window:{webOSSystem:{launchParams:params,close(){closed++}},APP_INFO:{version:'1.0.6',title:'Home Assistant PIP'}},document:doc,Store:store,
 Player:P,HAClient:H,Settings:{close(){},open(){settingsOpened++},hide(){},resume(){},isOpen(){return false},handleKey(){}},
 console:{warn(){}},setTimeout(fn,delay){scheduled.push({fn,delay});return scheduled.length},clearTimeout(){},location:{search:''}};
 c.window.PalmServiceBridge=function(){this.call=()=>{}};
 vm.createContext(c);
 vm.runInContext(fs.readFileSync(base+'app.js','utf8'),c);
 await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 return {els,plays,settingsOpened,connects,closed,events,scheduled,store,stopCount:stops};
}
(async()=>{
 const s={url:'http://127.0.0.1:8123',token:'test',camera:'camera.front',camera2:'camera.garage',mode:'mjpeg',position:'top-right',position2:'bottom-left',size:20,size2:45,timeout:10};
 let t=await setup({show_saved:true},s);
 assert.equal(t.plays.length,2,'saved mode plays two');
 assert.deepEqual(t.plays.map(p=>p.slot),[1,2]);
 assert.equal(t.plays[0].opts.camera,'camera.front');
 assert.equal(t.plays[1].opts.camera,'camera.garage');
 assert.equal(t.plays[1].opts.position,'bottom-left');
 assert.equal(t.plays[1].opts.size,0.45);
 assert.equal(t.connects,1,'one websocket for two streams');
 assert.equal(t.els.pip2.classList.contains('hidden'),false);
 t=await setup({camera:'camera.doorbell',timeout:10},s);
 assert.equal(t.plays.length,1,'legacy launch plays one');
 assert.equal(t.plays[0].opts.camera,'camera.doorbell');
 assert.equal(t.els.pip2.classList.contains('hidden'),true);
 t=await setup({},s);
 assert.equal(t.settingsOpened,1,'normal launch opens old setup');
 assert.equal(t.plays.length,0);
 t=await setup({show_saved:true}, {...s,camera2:''});
 assert.equal(t.plays.length,1,'optional camera2 off');
 t=await setup({show_saved:true},s,true);
 assert.equal(t.plays.length,2,'second fails independently');
 assert.equal(t.els.pip.classList.contains('hidden'),false);
 assert.equal(t.els.error2.classList.contains('hidden'),false);
 assert.ok(t.scheduled.some(x=>x.delay===3000),'secondary reconnect scheduled');
 // Re-launch from 2 camera to legacy single: old second feed must hide and stop.
 t=await setup({show_saved:true},s);
 t.events.webOSRelaunch({detail:{camera:'camera.doorbell',timeout:10}});
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(t.els.pip2.classList.contains('hidden'),true,'single re-launch hides second camera');
 
 // 1.0.6: either saved camera can be turned off, and both Off exit without PIP.
 t=await setup({show_saved:true}, {...s,enabled1:false,enabled2:true});
 assert.equal(t.plays.length,1,'Camera 2 alone plays');
 assert.equal(t.plays[0].opts.camera,'camera.garage');
 t=await setup({show_saved:true}, {...s,enabled1:true,enabled2:false});
 assert.equal(t.plays.length,1,'Camera 1 alone plays');
 t=await setup({show_saved:true}, {...s,enabled1:false,enabled2:false});
 assert.equal(t.plays.length,0,'both Off means no playback');
 assert.equal(t.closed,1,'both Off closes the app');
 t=await setup({show_saved:true,title:'Doorbell'},s);
 assert.equal(t.els.label.textContent,'Doorbell','title shown on Camera 1');
 t=await setup({show_saved:true,title:'Doorbell'}, {...s,enabled1:false,enabled2:true});
 assert.equal(t.els.label.textContent,'Doorbell','title shown on Camera 2 if Camera 1 disabled');
 t=await setup({camera:'camera.override'}, {...s,enabled1:false,enabled2:false});
 assert.equal(t.plays.length,1,'explicit legacy camera ignores saved switches');
 console.log('PASS: 12 saved/legacy app scenarios, switches, title and shared HA connection');
})().catch(e=>{console.error(e);process.exit(1)});
