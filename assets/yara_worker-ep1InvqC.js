(function(){"use strict";self.importScripts("/js/ice_yara.js"),self.onmessage=async function(u){const{binaryData:t,inputRule:n}=u.data,o=e=>self.Module._malloc(e),s=e=>self.Module._free(e),m=self.Module.cwrap("scan_with_yara","number",["number","number","string"]),f=self.Module.cwrap("get_matched_rule_names","number",["number"]);if(t&&n){const e=o(t.length);self.Module.HEAPU8.set(t,e),m(e,t.length,n);const l=o(4),c=f(l),i=self.Module.getValue(l,"i32"),r=[];for(let a=0;a<i;a++){const d=self.Module.getValue(c+a*4,"i32"),M=self.Module.UTF8ToString(d);r.push(M)}s(e),s(l),s(c),self.postMessage(r)}}})();
