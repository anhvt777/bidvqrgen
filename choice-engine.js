'use strict';
(function(root){
const clean=v=>String(v??'').trim();
const key=v=>clean(v).toUpperCase();
function amount(v){const s=clean(v).replace(/\s|₫|đ|VND/gi,'');let n;if(/^\d+$/.test(s))n=Number(s);else if(/^\d{1,3}([.,]\d{3})+$/.test(s))n=Number(s.replace(/[.,]/g,''));else throw Error('Số tiền phải là số nguyên VND: '+clean(v));if(!Number.isSafeInteger(n)||n<=0||n>999999999)throw Error('Số tiền phải lớn hơn 0 và không quá 999.999.999đ.');return n;}
function bounded(value,label,max,required=true){const s=clean(value);if(required&&!s)throw Error('Thiếu '+label);if(s.length>max)throw Error(label+' dài quá '+max+' ký tự.');return s;}
function groupRows(input){
 if(!input.length)throw Error('Không có dòng dữ liệu.');
 const groups=new Map(),identities=new Map(),codes=new Set(),routes=new Set();
 input.forEach((raw,index)=>{try{
 const code=bounded(raw.code,'mã học sinh gốc',64),className=bounded(raw.className,'lớp',40);let name=bounded(raw.name,'họ tên học sinh',100);if(raw.nameFromAccount&&name.toUpperCase().endsWith(' '+className.toUpperCase()))name=name.slice(0,-className.length).trim();
 const group=bounded(raw.group||'DOT_THU','nhóm lựa chọn',50),paymentCode=bounded(raw.paymentCode||raw.accountNumber,'mã thu / định danh',50),label=bounded(raw.label,'tên lựa chọn',90);
 const bin=clean(raw.bin),accountNumber=clean(raw.accountNumber),accountName=bounded(raw.accountName,'tên tài khoản',100),remark=bounded(raw.remark,'Remark (nội dung chuyển khoản)',95);
 if(!/^\d{6}$/.test(bin))throw Error('BIN phải gồm 6 chữ số.');
 if(!/^[A-Za-z0-9]{4,34}$/.test(accountNumber))throw Error('Tài khoản định danh phải gồm 4–34 ký tự chữ/số; đặt cột Excel dạng Text.');
 if(!/^[A-Za-z0-9 _.-]{1,95}$/.test(remark))throw Error('Nội dung QR phải dài 1–95 ký tự không dấu (chữ, số, khoảng trắng, _ . -). Web không tự cắt nội dung.');
 if(codes.has(key(paymentCode)))throw Error('Trùng mã thu: '+paymentCode);codes.add(key(paymentCode));
 const route=bin+'|'+accountNumber+'|'+key(remark);if(routes.has(route))throw Error('Hai dòng có cùng ngân hàng, tài khoản và nội dung QR; không phân biệt được lựa chọn.');routes.add(route);
 const studentKey=key(code),identity=JSON.stringify([name,className]);if(identities.has(studentKey)&&identities.get(studentKey)!==identity)throw Error('Mã học sinh có họ tên/lớp mâu thuẫn: '+code);identities.set(studentKey,identity);
 const groupKey=JSON.stringify([studentKey,key(group)]);if(!groups.has(groupKey))groups.set(groupKey,{student:{code,name,className,birthdate:bounded(raw.birthdate,'ngày sinh',40,false)},group,options:[]});
 const order=clean(raw.order);if(order&&!/^\d{1,4}$/.test(order))throw Error('Thứ tự phải là số nguyên 0–9999.');
 groups.get(groupKey).options.push({label,paymentCode,amount:amount(raw.amount),bin,accountNumber,accountName,remark,includesExplicit:!!clean(raw.includes),noteExplicit:!!clean(raw.note),includes:bounded(raw.includes||label,'khoản bao gồm',220),note:bounded(raw.note,'ghi chú lựa chọn',160,false),order:order?Number(order):index,sourceRow:raw.sourceRow||index+2});
 }catch(e){throw Error('Dòng '+(raw.sourceRow||index+2)+': '+e.message);}});
 for(const g of groups.values()){
  const names=new Set();for(const o of g.options){if(names.has(key(o.label)))throw Error('Tên lựa chọn trùng trong nhóm '+g.group+' của '+g.student.code);names.add(key(o.label));}
  g.options.sort((a,b)=>a.order-b.order||a.paymentCode.localeCompare(b.paymentCode));describeInsurance(g);
 }
 return [...groups.values()].sort((a,b)=>a.student.className.localeCompare(b.student.className,'vi',{numeric:true})||a.student.name.localeCompare(b.student.name,'vi')||a.group.localeCompare(b.group));
}
function describeInsurance(g){
 const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 if(g.options.length!==2)return;
 const single=g.options.find(o=>['bao hiem y te','bhyt','chi nop bhyt'].includes(norm(o.label)));
 const combined=g.options.find(o=>['bao hiem y te va bh than the','bao hiem y te va bao hiem than the','bhyt bhtt','nop bhyt bhtt'].includes(norm(o.label)));
 if(!single||!combined||combined.amount<=single.amount)return;
 g.insuranceSummary={health:single.amount,body:combined.amount-single.amount};g.options=[single,combined];
 single.displayLabel='CHỈ NỘP BHYT';combined.displayLabel='NỘP BHYT + BHTT';
 const money=n=>new Intl.NumberFormat('vi-VN').format(n)+'đ';
 if(!single.includesExplicit)single.includes='BHYT: '+money(single.amount);
 if(!combined.includesExplicit)combined.includes='BHYT: '+money(single.amount)+' + BHTT: '+money(combined.amount-single.amount);
 if(!single.noteExplicit)single.note='Không tham gia BHTT trong đợt này.';
 if(!combined.noteExplicit)combined.note='Đã bao gồm BHYT. Không thanh toán thêm QR lựa chọn 1.';
}
function paginate(groups){return groups.flatMap(g=>{const count=Math.ceil(g.options.length/2);return Array.from({length:count},(_,i)=>({...g,visible:g.options.slice(i*2,i*2+2),page:i+1,pageCount:count,choiceStart:i*2}));});}
const api={amount,groupRows,paginate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PaymentChoices=api;
})(globalThis);
