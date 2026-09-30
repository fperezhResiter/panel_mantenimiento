const fs=require('fs'),vm=require('vm');
module.exports=ctx=>{
 const listeners={};
 ctx.window=ctx;
 ctx.Event=class{constructor(type){this.type=type;}};
 ctx.addEventListener=(name,fn)=>(listeners[name]??=[]).push(fn);
 ctx.dispatchEvent=e=>(listeners[e.type]||[]).forEach(fn=>fn(e));
 ctx.document.querySelectorAll=()=>[];
 ctx.localStorage??={getItem:()=>null,setItem(){}};
 vm.runInContext(fs.readFileSync('web/js/configuracion.js','utf8'),ctx);
};
