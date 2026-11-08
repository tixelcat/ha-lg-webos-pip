'use strict';
// No npm/test framework required. Tests actual TV settings logic with a small DOM stub.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const base = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'webos-app', 'app');
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(base, 'css', 'app.css'), 'utf8');
const source = fs.readFileSync(path.join(base, 'js', 'settings.js'), 'utf8');

class ClassList {
  constructor(items=[]) { this.s = new Set(items); }
  contains(s) { return this.s.has(s); }
  add(...xs) { xs.forEach(x => this.s.add(x)); }
  remove(...xs) { xs.forEach(x => this.s.delete(x)); }
  toggle(x, on) { if(on === undefined) on=!this.contains(x); if(on) this.add(x); else this.remove(x); }
}
class E {
  constructor(tag, opts={}) {
    this.tagName = tag.toUpperCase(); this.classList = new ClassList(opts.classes||[]);
    this.textContent = ''; this.value = ''; this.key = opts.key || null;
    this.parentNode = opts.parent || null; this.action = opts.action || null;
    this.children = [];
  }
  getAttribute(name) { return name === 'data-key' ? this.key : name === 'data-action' ? this.action : null; }
  querySelector(sel) { return sel === 'input' ? this.children.find(x=>x.tagName==='INPUT')||null : sel === '.value' ? this.children.find(x=>x.classList.contains('value'))||null : null; }
  querySelectorAll() { return this.children; }
  scrollIntoView() {}
  focus() {}
  blur() {}
  closest(sel) {
    if (sel === '.row') return this.tagName === 'DIV' && this.classList.contains('row') ? this : this.parentNode;
    return this;
  }
}
function dom(saved) {
  let saveCalls = [];
  let handlers = {};
  const rows = [];
  const keys = ['url','token','test','enabled1','camera','position','size','enabled2','camera2','position2','size2','mode','timeout','actions'];
  for (const key of keys) {
    const buttonRow = key === 'test' || key === 'actions';
    const input = key === 'url' || key === 'token';
    const row = new E('div', {key: buttonRow?null:key,classes:['row'].concat(!input&&!buttonRow ? ['choice']:[]).concat(key==='enabled1'||key==='enabled2' ? ['camera-toggle']:[])});
    if (input) row.children.push(new E('input',{parent:row}));
    else if (buttonRow) row.children.push(...(key === 'test' ? ['test'] : ['save','preview','exit']).map(action=>new E('button',{parent:row,action})));
    else row.children.push(new E('span',{classes:['value'],parent:row}));
    rows.push(row);
  }
  const root = new E('section',{classes:['hidden']});
  root.querySelectorAll = selector => selector === '.row' ? rows : selector === '.focused' ? rows.flatMap(r=>[r,...r.children]).filter(e=>e.classList.contains('focused')) : [];
  root.querySelector = selector => selector === '[data-key="camera"]' ? rows.find(r=>r.key==='camera') : null;
  root.addEventListener = (event,fn) => { handlers[event]=fn; };
  const status = new E('span'); status.className='';
  const version = new E('span');
  const document = {getElementById: id => ({settings:root,'s-status':status,'s-version':version})[id],body:{classList:new ClassList()},activeElement:null};
  const Store = {get:()=>saved,save(x){saveCalls.push({...x});return true;}};
  class HAClient {
    constructor() {this.haVersion='2026.11';}
    connect(){return Promise.resolve()}
    currentUser(){return Promise.resolve({name:'Tester'})}
    listCameras(){return Promise.resolve([{id:'camera.front',name:'Front'},{id:'camera.garage',name:'Garage'},{id:'camera.garden',name:'Garden'}])}
    close(){}
  }
  const ctx = {window:{},document,Store,HAClient,console};
  vm.createContext(ctx); vm.runInContext(source,ctx);
  const row = name => rows.find(x=>x.key===name);
  const value = name => row(name).children[0].textContent;
  const click = name => handlers.click({target:row(name).children[0]});
  const action = name => handlers.click({target:rows[rows.length-1].children.find(c=>c.action===name)});
  return {Settings:ctx.window.Settings, saveCalls, row, value, click, action,handlers,status,root};
}
(async () => {
  // Visual hierarchy: HA always first, columns before persistent actions.
  assert(html.indexOf('Home Assistant connection') < html.indexOf('class="camera-grid"'));
  assert(html.indexOf('data-camera-panel="1"') < html.indexOf('data-camera-panel="2"'));
  assert(html.indexOf('data-camera-panel="2"') < html.indexOf('data-action="save"'));
  assert(/grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/.test(css));

  const saved = {url:'http://ha.local:8123',token:'x',camera:'camera.front',camera2:'camera.garage',position:'top-right',position2:'bottom-left',size:25,size2:45,timeout:30,mode:'mjpeg'};
  let d = dom(saved);
  d.Settings.open({version:'1.0.6'});
  await new Promise(resolve=>setImmediate(resolve));
  assert(html.includes('data-key="enabled1"') && html.includes('data-key="enabled2"'), 'both columns need one-click switches');
  assert.equal(d.value('enabled1'), 'On');
  assert.equal(d.value('enabled2'), 'On');
  assert.equal(d.value('size'), '30 % of screen width','old 25% rounds to nearest 10');
  assert.equal(d.value('size2'), '50 % of screen width','old 45% rounds to nearest 10');
  // Camera 1 owns top-right: camera2 choices must never include it.
  let opts2=[];
  for(let i=0;i<8;i++){d.click('position2');opts2.push(d.value('position2'));}
  assert(!opts2.includes('Top right'),'Camera 2 must exclude occupied corner');
  // Camera2 owns another corner; camera1 can never select it.
  let occupied=d.value('position2');
  let opts1=[];
  for(let i=0;i<8;i++){d.click('position');opts1.push(d.value('position'));}
  assert(!opts1.includes(occupied),'Camera 1 must exclude occupied corner');
  const sizes=[];
  for(let i=0;i<6;i++){ sizes.push(d.value('size')); d.click('size'); }
  assert.deepEqual(sizes,['30 % of screen width','40 % of screen width','50 % of screen width','10 % of screen width','20 % of screen width','30 % of screen width']);
  d.action('save');
  assert.equal(d.saveCalls.length,1);
  assert.notEqual(d.saveCalls[0].position,d.saveCalls[0].position2);
  assert.equal(d.saveCalls[0].size % 10,0);
  assert.equal(d.saveCalls[0].size2 % 10,0);
  // Legacy conflict in stored settings repaired on menu open.
  d=dom({...saved,position2:'top-right'});
  d.Settings.open({version:'1.0.6'});
  assert.notEqual(d.value('position'),d.value('position2'));
  // Turning off Camera 2 keeps its source and frees its corner.
  d=dom(saved);d.Settings.open({version:'1.0.6'});
  await new Promise(resolve=>setImmediate(resolve));
  d.handlers.click({target:d.row('enabled2')}); // click the row, not just its value
  assert.equal(d.value('enabled2'),'Off');
  let all=[];
  for(let i=0;i<4;i++){all.push(d.value('position'));d.click('position');}
  assert.equal(new Set(all).size,4,'turning off 2 frees its corner');
  d.action('save');
  assert.equal(d.saveCalls[0].camera2,'camera.garage','camera selection is retained');
  assert.strictEqual(d.saveCalls[0].enabled2,false);
  assert.strictEqual(d.saveCalls[0].enabled1,true);
  d.click('enabled2');
  assert.equal(d.value('enabled2'),'On');
  d.action('save');
  assert.notEqual(d.saveCalls[1].position,d.saveCalls[1].position2,'re-enabling avoids overlapping corners');
  // Turning off Camera 1 while leaving Camera 2 enabled must be valid.
  d=dom(saved);d.Settings.open({version:'1.0.6'});
  await new Promise(resolve=>setImmediate(resolve));
  d.click('enabled1');
  d.action('save');
  assert.equal(d.saveCalls.length,1);
  assert.strictEqual(d.saveCalls[0].enabled1,false);
  assert.strictEqual(d.saveCalls[0].enabled2,true);
  // Both cameras may be disabled and persisted without deleting the selections.
  d.click('enabled2');
  d.action('save');
  assert.strictEqual(d.saveCalls[1].enabled1,false);
  assert.strictEqual(d.saveCalls[1].enabled2,false);
  assert.equal(d.saveCalls[1].camera,'camera.front');
  assert.equal(d.saveCalls[1].camera2,'camera.garage');
  // Empty Camera 2 also frees its corner, even when its switch is On.
  d=dom(saved);d.Settings.open({version:'1.0.6'});
  await new Promise(resolve=>setImmediate(resolve));
  d.click('camera2'); d.click('camera2');
  assert.equal(d.value('camera2'),'None (select a camera)');
  all=[];
  for(let i=0;i<4;i++){all.push(d.value('position'));d.click('position');}
  assert.equal(new Set(all).size,4);
  d.action('save');
  assert.equal(d.saveCalls[0].camera2,'');
  console.log('PASS: 12 menu checks - one-click toggles, corner release, both off, saved selections, 10% steps');
})().catch(e=>{console.error(e);process.exit(1)});
