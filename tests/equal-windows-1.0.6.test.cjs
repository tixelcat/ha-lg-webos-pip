'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const appPath = process.argv[2] || require('path').join(__dirname, '..', 'webos-app/app/js/app.js');
const cssPath = process.argv[3] || require('path').join(__dirname, '..', 'webos-app/app/css/app.css');
if (!appPath || !cssPath) throw new Error('Pass app.js and app.css paths');
const source = fs.readFileSync(appPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
assert(/\.pip\s*\{[\s\S]*?aspect-ratio:\s*16\s*\/\s*9\s*;/m.test(css), 'PIP needs fixed 16:9 CSS default');
assert(/width:\s*calc\(100vw\s*\*\s*var\(--size/.test(css), 'PIP widths must use same sizing formula');
assert(/object-fit:\s*contain\s*;/.test(css), 'Feed must be fitted without cropping');

class Classes {
  constructor(names) { this.names = new Set(names); }
  add(...names) { names.forEach(x => this.names.add(x)); }
  remove(...names) { names.forEach(x => this.names.delete(x)); }
  contains(name) { return this.names.has(name); }
  toggle(name, on) {
    if (on === undefined) on = !this.contains(name);
    if (on) this.add(name); else this.remove(name);
  }
}
function elem(id) {
  return {
    id,
    classList: new Classes(['hidden']),
    style: {setProperty(name, value) { this[name] = value; }},
    textContent: '',
    muted: false,
    getAttribute() { return null; },
    removeAttribute() {},
    addEventListener() {}
  };
}
async function run(params, saved, resolutions) {
  let playCount = 0, connections = 0, opened = 0, closed = 0;
  const played = [];
  const nodes = {};
  for (const id of ['pip','pip2','label','label2','error','error2','spinner','spinner2','frame','frame2','video','video2','toast']) nodes[id]=elem(id);
  class FakePlayer {
    constructor(video, img, callback) { this.slot = video.id === 'video2' ? 2 : 1; this.callback = callback; }
    stop() {}
    play(client, opts) {
      played.push({slot:this.slot, camera:opts.camera, position:opts.position, size:opts.size});
      playCount++;
      const info = resolutions[this.slot];
      this.callback('loading');
      this.callback('playing', info);
      return Promise.resolve();
    }
  }
  class FakeHA {
    constructor() { connections++; this.connected=false; }
    connect() { this.connected=true; return Promise.resolve(); }
    close() { this.connected=false; }
    friendlyName() { return Promise.resolve('Camera'); }
  }
  const context = {
    window: {webOSSystem: {launchParams:params,close() {closed++}}, APP_INFO:{version:'1.0.6'},innerWidth:1920},
    document: {getElementById(id) { if (!nodes[id]) throw Error('missing '+id); return nodes[id]; },addEventListener() {},hidden:false},
    Store:{get(){return saved;},save(){return true;}},
    Player: FakePlayer, HAClient: FakeHA,
    Settings:{close() {},open(){opened++},hide(){},resume(){},isOpen(){return false;},handleKey(){}},
    console:{warn() {}},setTimeout(){return 1;},clearTimeout(){},location:{search:''}
  };
  context.window.PalmServiceBridge = function() { this.call = function(){}; };
  vm.createContext(context);
  vm.runInContext(source,context);
  for (let i=0;i<10;i++) await Promise.resolve();
  return {nodes,playCount,connections,opened,closed,played};
}
(async () => {
  const saved={url:'http://ha.example:8123', token:'test',camera:'camera.door',camera2:'camera.drive',
    mode:'mjpeg',position:'top-right',position2:'bottom-left',size:30,size2:30,timeout:10};
  // Two cameras have different native ratios: frames still have identical 16:9
  // box dimensions, independent of whether camera 1 or camera 2 is 4:3.
  for (const resolutions of [
    {1:{width:640,height:480},2:{width:1920,height:1080}},
    {1:{width:1920,height:1080},2:{width:640,height:480}},
    {1:{width:1280,height:720},2:{width:1280,height:960}}
  ]) {
    const t=await run({show_saved:true,timeout:10},saved,resolutions);
    assert.equal(t.playCount,2,'both cameras play');
    assert.equal(t.connections,1,'both cameras share HA connection');
    assert.equal(t.nodes.pip.classList.contains('hidden'),false);
    assert.equal(t.nodes.pip2.classList.contains('hidden'),false);
    assert.equal(t.nodes.pip.style.aspectRatio,'','camera 1 must retain fixed CSS 16:9 frame');
    assert.equal(t.nodes.pip2.style.aspectRatio,'','camera 2 must retain fixed CSS 16:9 frame');
    assert.equal(t.nodes.pip.style['--size'],0.3);
    assert.equal(t.nodes.pip2.style['--size'],0.3);
  }
  // No regression: a single camera still adapts its frame aspect to the feed.
  const single=await run({show_saved:true}, {...saved,camera2:''}, {1:{width:640,height:480}});
  assert.equal(single.playCount,1);
  assert.equal(single.nodes.pip.style.aspectRatio,'640 / 480');
  assert.equal(single.nodes.pip2.classList.contains('hidden'),true);
  const legacy=await run({camera:'camera.door',timeout:10},saved,{1:{width:800,height:600}});
  assert.equal(legacy.playCount,1);
  assert.equal(legacy.nodes.pip.style.aspectRatio,'800 / 600');
  assert.equal(legacy.nodes.pip2.classList.contains('hidden'),true);
  // Preserved settings without boolean flags default to ON (migration from earlier 1.0.6).
  const only1=await run({show_saved:true}, {...saved,enabled1:true,enabled2:false}, {1:{width:640,height:480}});
  assert.equal(only1.playCount,1);
  assert.equal(only1.played[0].camera,'camera.door');
  assert.equal(only1.played[0].position,'top-right');
  assert.equal(only1.nodes.pip2.classList.contains('hidden'),true);
  // When Camera 1 is OFF, Camera 2 still displays at its configured corner
  // and size, using the original single-PIP renderer.
  const only2=await run({show_saved:true}, {...saved,enabled1:false,enabled2:true,size2:40}, {1:{width:640,height:480}});
  assert.equal(only2.playCount,1);
  assert.equal(only2.connections,1);
  assert.equal(only2.played[0].camera,'camera.drive');
  assert.equal(only2.played[0].position,'bottom-left');
  assert.equal(only2.played[0].size,0.4);
  assert.equal(only2.nodes.pip.style.aspectRatio,'640 / 480');
  assert.equal(only2.nodes.pip2.classList.contains('hidden'),true);
  // Both OFF: do not display any PIP, do not connect to HA, release the app.
  const none=await run({show_saved:true}, {...saved,enabled1:false,enabled2:false}, {});
  assert.equal(none.playCount,0);
  assert.equal(none.connections,0);
  assert.equal(none.closed,1);
  assert.equal(none.nodes.pip.classList.contains('hidden'),true);
  assert.equal(none.nodes.pip2.classList.contains('hidden'),true);
  // Also no camera selected, irrespective of ON switches.
  const empty=await run({show_saved:true}, {...saved,camera:'',camera2:'',enabled1:true,enabled2:true}, {});
  assert.equal(empty.playCount,0);
  assert.equal(empty.closed,1);
  // Legacy automation explicitly naming a camera must work even if saved switches are off.
  const explicit=await run({camera:'camera.door'}, {...saved,enabled1:false,enabled2:false}, {1:{width:800,height:600}});
  assert.equal(explicit.playCount,1);
  assert.equal(explicit.played[0].camera,'camera.door');
  assert.equal(explicit.closed,0);
  console.log('PASS: equal dual frames, camera 1 only, camera 2 only, both off, no selection, legacy automation');
})().catch(err=>{console.error(err);process.exit(1)});
