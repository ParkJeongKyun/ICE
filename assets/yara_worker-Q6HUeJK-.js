(function(){"use strict";self.importScripts("/js/ice_yara.js"),self.onmessage=async function(m){const{binaryData:a,inputRule:o}=m.data,l=e=>self.Module._malloc(e),u=e=>{self.Module._free(e)},i=(e,t,n)=>new Promise(s=>{self.Module.cwrap("scan_with_yara","number",["number","number","string"])(e,t,n),s()}),f=e=>new Promise(t=>{const s=self.Module.cwrap("get_matched_rule_names","number",["number"])(e);t(s)});if(a&&o){const e=l(a.length);self.Module.HEAPU8.set(a,e),await i(e,a.length,o);const t=l(4),n=await f(t),s=self.Module.getValue(t,"i32"),r=[];for(let c=0;c<s;c++){const d=self.Module.getValue(n+c*4,"i32"),M=self.Module.UTF8ToString(d);r.push(M)}u(e),u(t),self.postMessage(r)}}})();
