'use strict';
(()=>{
const $=s=>document.querySelector(s),num=n=>Math.round(Number(n)||0),money=n=>new Intl.NumberFormat('vi-VN').format(num(n))+' ₫';
function qrText(value,maxLength=25){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toUpperCase().replace(/[^A-Z0-9 _.-]/g,' ').replace(/\s+/g,' ').trim().slice(0,maxLength);}

function emvTag(id,value){const text=String(value);if(text.length>99)throw new Error(`Trường QR ${id} vượt độ dài cho phép.`);return id+String(text.length).padStart(2,'0')+text;}

function crc16ccitt(value){let crc=0xFFFF;for(let i=0;i<value.length;i++){crc^=value.charCodeAt(i)<<8;for(let bit=0;bit<8;bit++)crc=crc&0x8000?(crc<<1)^0x1021:crc<<1;crc&=0xFFFF;}return crc.toString(16).toUpperCase().padStart(4,'0');}

function buildVietQrPayload(config,amount,remark){
  const accountInfo=emvTag('00','A000000727')+emvTag('01',emvTag('00',config.bin)+emvTag('01',config.accountNumber))+emvTag('02','QRIBFTTA');
  const reference=emvTag('08',qrText(remark,25));
  let payload='000201010212'+emvTag('38',accountInfo)+'52040000'+'5303704'+emvTag('54',String(num(amount)))+'5802VN'+emvTag('59',qrText(config.accountName,25))+emvTag('60','VIETNAM')+emvTag('62',reference)+'6304';
  payload+=crc16ccitt(payload);return payload;
}

function noticeDateVi(value){if(!value)return '—';const [y,m,d]=value.split('-');return `${d}/${m}/${y}`;}

async function insurancePlan(student,option,config,year){
  const allocations=option.items.map(x=>({itemId:x.id,amount:x.amount})).sort((a,b)=>a.itemId.localeCompare(b.itemId));
  const signature=JSON.stringify([config.school||'',student.code,allocations,config.bin,config.accountNumber,year]);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature)));
  const remark='IB'+[...digest].slice(0,10).map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
  return {kind:'insurance-choice',remark,signature,studentCode:student.code,itemIds:allocations.map(x=>x.itemId),allocations,amount:option.amount,year,account:{bin:config.bin,accountNumber:config.accountNumber},createdAt:new Date().toISOString()};
}

function insuranceQrCanvas(payload,maxSize=402){
  const holder=document.createElement('div'),qr=new QRCode(holder,{text:payload,width:256,height:256,correctLevel:QRCode.CorrectLevel.M});
  const matrix=qr._oQRCode,n=matrix.getModuleCount(),scale=Math.floor(maxSize/(n+8)),size=(n+8)*scale;
  if(scale<3)throw new Error('Nội dung QR quá dài để in rõ.');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.fillStyle='#000';
  for(let row=0;row<n;row++)for(let col=0;col<n;col++)if(matrix.isDark(row,col))ctx.fillRect((col+4)*scale,(row+4)*scale,scale,scale);
  return canvas;
}

function insuranceCanvas(entry){
  const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
  const c=canvas.getContext('2d'),teal='#006b68',ink='#173b3b',muted='#536b6b',gold='#e3bb53';
  c.fillStyle='#fff';c.fillRect(0,0,1240,1754);c.textBaseline='top';
  const text=(str,x,y,size=28,color=ink,weight='400',align='left',max=1100)=>{
    c.fillStyle=color;c.textAlign=align;let fs=size;c.font=`${weight} ${fs}px Arial`;
    while(c.measureText(String(str)).width>max&&fs>16){fs--;c.font=`${weight} ${fs}px Arial`;}
    c.fillText(str,x,y);return fs;
  };
  const wrap=(str,x,y,width,size=26,line=36,color=muted)=>{
    c.font=`400 ${size}px Arial`;let row='',dy=y;
    for(const word of String(str).split(/\s+/)){const next=row?row+' '+word:word;if(c.measureText(next).width>width&&row){text(row,x,dy,size,color);row=word;dy+=line;}else row=next;}
    if(row)text(row,x,dy,size,color);return dy+line;
  };
  c.fillStyle=teal;c.fillRect(0,0,1240,18);
  if(entry.logo){const r=Math.min(78/entry.logo.naturalWidth,78/entry.logo.naturalHeight);c.drawImage(entry.logo,62,45,entry.logo.naturalWidth*r,entry.logo.naturalHeight*r);}text(entry.school.schoolName,entry.logo?158:62,54,31,teal,'700','left',entry.logo?755:875);text('BIDV',1178,51,47,teal,'700','right',220);
  text('THÔNG BÁO NỘP BẢO HIỂM',620,139,49,teal,'700','center');
  text('Năm học '+entry.settings.year,620,206,28,muted,'400','center');
  c.fillStyle='#eef7f5';c.fillRect(62,272,1116,160);
  text('HỌC SINH',86,291,21,muted,'700');text(entry.student.name,86,325,39,ink,'700','left',1060);
  text('Lớp: '+(entry.student.className||'—'),86,386,26,ink,'700');text('Mã HS: '+entry.student.code,1154,386,26,ink,'400','right',830);
  text('CHI TIẾT KHOẢN THU · CHỌN CÁCH NỘP BÊN DƯỚI',62,477,23,muted,'700');
  text('Bảo hiểm y tế (BHYT)',62,522,28,ink,'700');text(entry.healthPaid?'ĐÃ NỘP':money(entry.health.amount),1178,522,28,teal,'700','right');
  text('Bắt buộc theo đối tượng tham gia · Mức thu đã phân giao',62,562,23,muted);
  text('Bảo hiểm thân thể (BHTT)',62,613,28,ink,'700');text(entry.bodyPaid?'ĐÃ NỘP':money(entry.body.amount),1178,613,28,teal,'700','right');
  text('Tự nguyện · Phụ huynh lựa chọn tham gia',62,653,23,muted);
  if(entry.complete){
    c.fillStyle='#eef7f5';c.fillRect(62,737,1116,520);
    text('ĐÃ HOÀN THÀNH',620,906,52,teal,'700','center');
    text('CÁC KHOẢN BẢO HIỂM ĐÃ CHỌN',620,986,32,ink,'700','center');
    text('Không cần thanh toán thêm.',620,1050,30,muted,'400','center');
  }else{
    const width=entry.options.length===2?540:720,start=entry.options.length===2?62:260;
    entry.options.forEach((o,i)=>{
      const x=start+i*576,y=734;
      c.strokeStyle='#b6d7d0';c.lineWidth=2;c.strokeRect(x,y,width,646);c.fillStyle='#eef7f5';c.fillRect(x+1,y+1,width-2,171);
      text(entry.options.length===2?'PHƯƠNG ÁN '+(i+1):'KHOẢN CÒN LẠI',x+width/2,y+24,22,muted,'700','center');
      text(entry.options.length===2?(i===0?'CHỈ NỘP BHYT':'NỘP BHYT + BHTT'):o.label,x+width/2,y+65,34,teal,'700','center',width-30);
      text(money(o.amount),x+width/2,y+111,40,ink,'700','center',width-30);
      text(entry.options.length===2?(i===0?'Không tham gia BHTT trong lần nộp này':'Đã gồm BHYT · Không quét thêm QR bên trái'):'Chỉ gồm khoản chưa nộp hiển thị ở trên',x+width/2,y+157,20,ink,'400','center',width-26);
      const qr=insuranceQrCanvas(o.payload);c.drawImage(qr,Math.round(x+(width-qr.width)/2),y+190);
      text('Mã thanh toán: '+o.plan.remark,x+width/2,y+601,23,muted,'400','center',width-30);
    });
  }
  const warning=entry.complete?'Cảm ơn quý phụ huynh đã hoàn thành.':entry.options.length===2?'CHỌN 1 PHƯƠNG ÁN · CHỈ QUÉT 1 MÃ QR':'CHỈ THANH TOÁN KHOẢN CÒN LẠI';
  c.fillStyle='#fff5d9';c.fillRect(62,1410,1116,92);c.fillStyle=gold;c.fillRect(62,1410,7,92);
  text(warning,620,1427,31,ink,'700','center',1070);
  text(entry.complete?'Trạng thái theo báo cáo đã cập nhật tại trường.':'QR gộp đã bao gồm BHYT. Đã nộp rồi: không dùng lại thông báo này.',620,1470,23,ink,'400','center',1070);
  if(!entry.complete){
    text('TK nhận: '+entry.config.accountNumber+' · BIN '+entry.config.bin,62,1523,24,ink);
    text(entry.config.accountName,62,1558,25,ink,'700');
    text('Kiểm tra người nhận, giữ nguyên số tiền và mã nội dung khi chuyển.',62,1595,23,muted);
  }
  text('Hạn nộp: '+(entry.settings.deadline?noticeDateVi(entry.settings.deadline):'Theo thông báo của trường'),62,1642,24,ink,'700','left',1090);
  if(entry.settings.contact)text('Liên hệ: '+entry.settings.contact,62,1677,23,muted,'400','left',1090);
  c.fillStyle=teal;c.fillRect(0,1722,1240,32);text('BIDV – Đồng hành chuyển đổi số cùng ngành Giáo dục',620,1728,20,'#fff','400','center');
  return canvas;
}

// Minimal PDF writer: one high-resolution JPEG per A5 page, embedded without dependencies.

function insurancePdf(pages){
  const encoder=new TextEncoder(),parts=[],offsets=[0];let size=0;
  const append=value=>{const bytes=typeof value==='string'?encoder.encode(value):value;parts.push(bytes);size+=bytes.length;};
  const object=(id,body)=>{offsets[id]=size;append(`${id} 0 obj\n${body}\nendobj\n`);};
  append('%PDF-1.4\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
  pages.forEach((jpeg,i)=>{
    const id=3+i*3;
    object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 419.53 595.28] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
    offsets[id+1]=size;append(`${id+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);append(jpeg);append('\nendstream\nendobj\n');
    const stream='q\n419.53 0 0 595.28 0 0 cm\n/Im0 Do\nQ\n';object(id+2,`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);
  });
  const count=pages.length*3+3,xref=size;append(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for(let i=1;i<count;i++)append(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
  append(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts,{type:'application/pdf'});
}

function insuranceSafeName(value){return qrText(value,100).replace(/[^A-Z0-9._-]/g,'_')||'CHUA_XEP_LOP';}

const state={rows:[],school:'',entries:[],index:0,busy:false,cancel:false,raw:null};
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const fields=[['code','Mã học sinh',['ma hoc sinh','ma hs','ma moet','studentid']],['name','Họ tên',['ho va ten','ho ten','ten hoc sinh','studentname']],['className','Lớp',['lop','class']],['health','Số tiền BHYT',['bhyt','so tien bhyt']],['body','Số tiền BHTT',['bhtt','so tien bhtt']],['hp','Đã nộp BHYT (tùy chọn)',['da nop bhyt']],['bp','Đã nộp BHTT (tùy chọn)',['da nop bhtt']]];
function amount(v){const t=String(v??'').trim();if(t==='')throw Error('Thiếu số tiền');const clean=t.replace(/\s|₫|đ|VND/gi,'');let n;if(/^\d+$/.test(clean))n=Number(clean);else if(/^\d{1,3}([.,]\d{3})+$/.test(clean))n=Number(clean.replace(/[.,]/g,''));else throw Error('Số tiền phải là số nguyên VND: '+t);if(!Number.isSafeInteger(n)||n<0||n>999999999)throw Error('Số tiền ngoài phạm vi hợp lệ: '+t);return n;}
function paid(v){const t=norm(v);if(['','0','false','no','chua nop','chua','khong'].includes(t))return false;if(['1','true','yes','co','da nop','da thu','da thanh toan','x'].includes(t))return true;throw Error('Trạng thái chưa rõ: '+v+' (dùng Đã nộp / Chưa nộp)');}
function invalidate(){state.entries=[];state.index=0;$('#biCanvas').textContent='Bấm Xem trước để tạo lại theo dữ liệu hiện tại.';$('#biPage').textContent='Chưa có thông báo';$('#biPrev').disabled=$('#biNext').disabled=true;}
function acceptRows(rows){const seen=new Set();for(const r of rows){if(!r.code||!r.name||!r.className)throw Error('Thiếu mã học sinh, họ tên hoặc lớp.');const key=norm(r.code);if(seen.has(key))throw Error('Mã học sinh trùng: '+r.code);seen.add(key);}if(!rows.length)throw Error('Không có học sinh hợp lệ.');state.rows=rows;state.school=schoolNameInput.value.trim();const classes=[...new Set(rows.map(r=>r.className))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));$('#biClasses').replaceChildren(new Option('Tất cả lớp','all',true,true),...classes.map(c=>new Option(c,c)));$('#biDataStatus').textContent=`${rows.length} học sinh · ${classes.length} lớp. Trường: ${state.school||'Chưa đặt tên'}.`;invalidate();}
function settings(){return {school:schoolNameInput.value.trim(),bin:$('#biBin').value.trim(),accountNumber:$('#biAccount').value.trim(),accountName:qrText($('#biAccountName').value,25),year:$('#biYear').value.trim(),deadline:$('#biDeadline').value,contact:$('#biContact').value.trim()};}
function configKey(){return 'bidvqrgen:insurance-config:'+norm(schoolNameInput.value);}
function loadConfig(){let c={};try{c=JSON.parse(localStorage.getItem(configKey())||'{}');}catch{}for(const [id,key] of [['biBin','bin'],['biAccount','accountNumber'],['biAccountName','accountName'],['biYear','year'],['biDeadline','deadline'],['biContact','contact']])$('#'+id).value=c[key]||(id==='biBin'?'970418':'');invalidate();}
function validateConfig(c){if(!c.school)throw Error('Nhập tên trường ở phần đầu trang.');if(!/^\d{6}$/.test(c.bin)||!/^\d{4,19}$/.test(c.accountNumber)||!c.accountName)throw Error('Nhập BIN 6 chữ số, tài khoản 4–19 chữ số và tên chủ tài khoản.');if(!c.year)throw Error('Nhập năm học / đợt thu.');}
function choosePlans(row){const health={id:'BHYT',name:'BHYT',amount:row.health},body={id:'BHTT',name:'BHTT',amount:row.body},hp=row.hp||!row.health,bp=row.bp||!row.body;let options=[];if(!hp&&!bp)options=[{label:'Chỉ nộp BHYT',items:[health]},{label:'BHYT + BHTT',items:[health,body]}];else if(!hp)options=[{label:'Chỉ nộp BHYT',items:[health]}];else if(!bp)options=[{label:'Chỉ nộp BHTT',items:[body]}];return {student:{code:row.code,name:row.name,className:row.className},health,body,healthPaid:hp,bodyPaid:bp,complete:hp&&bp,options:options.map(o=>({...o,amount:o.items.reduce((s,x)=>s+x.amount,0)}))};}
async function build(){const c=settings();validateConfig(c);if(!state.rows.length)throw Error('Nạp danh sách bảo hiểm trước.');if(state.school!==c.school)throw Error('Tên trường đã thay đổi. Nạp lại danh sách cho trường đang chọn.');const selected=new Set([...$('#biClasses').selectedOptions].map(o=>o.value));const logoData=currentSchoolLogo(),logo=logoData?await loadImage(logoData):null;const entries=[],codes=new Set();for(const row of state.rows){if(selected.size&&!selected.has('all')&&!selected.has(row.className))continue;const e=choosePlans(row);if(e.complete&&$('#biStatus').value!=='all')continue;e.settings=c;e.school={schoolName:c.school};e.config=c;e.logo=logo;for(const o of e.options){o.plan=await insurancePlan(e.student,o,c,c.year);if(codes.has(o.plan.remark))throw Error('Phát hiện trùng mã thanh toán.');codes.add(o.plan.remark);o.payload=buildVietQrPayload(c,o.amount,o.plan.remark);}entries.push(e);}if(!entries.length)throw Error('Không có thông báo phù hợp với lớp và trạng thái đã chọn.');return entries.sort((a,b)=>a.student.className.localeCompare(b.student.className,'vi',{numeric:true})||a.student.name.localeCompare(b.student.name,'vi'));}
function show(){const e=state.entries[state.index];if(!e)return;const canvas=insuranceCanvas(e);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${e.student.name} · ${e.options.map(o=>o.label+' '+money(o.amount)).join('; ')||'Đã hoàn thành'}`);$('#biCanvas').replaceChildren(canvas);$('#biPage').textContent=`${state.index+1}/${state.entries.length} · ${e.student.className} · ${e.student.name}`;$('#biPrev').disabled=state.index===0;$('#biNext').disabled=state.index===state.entries.length-1;}
async function exportZip(entries){const zip=new JSZip(),groups=new Map(),usedFolders=new Set(),map=[];let done=0;for(const e of entries){if(!groups.has(e.student.className))groups.set(e.student.className,[]);groups.get(e.student.className).push(e);}for(const [cls,list] of groups){let folderName=insuranceSafeName(cls);while(usedFolders.has(folderName))folderName+='_';usedFolders.add(folderName);const folder=zip.folder(folderName),pages=[],names=new Set();for(const e of list){if(state.cancel)throw Error('Đã hủy xuất.');const canvas=insuranceCanvas(e);let stem=`${folderName}_${insuranceSafeName(e.student.code)}_${insuranceSafeName(e.student.name)}_BHYT_BHTT`;while(names.has(stem))stem+='_';names.add(stem);const png=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!png)throw Error('Không tạo được ảnh');folder.file(stem+'.png',await png.arrayBuffer());const jpg=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.96));pages.push(new Uint8Array(await jpg.arrayBuffer()));for(const o of e.options)map.push({school:e.school.schoolName,year:e.settings.year,studentCode:e.student.code,studentName:e.student.name,className:cls,choice:o.label,...o.plan});$('#biProgress').textContent=`Đang tạo ${++done}/${entries.length} thông báo…`;await new Promise(r=>setTimeout(r,0));}folder.file(`THONG_BAO_BHYT_BHTT_${folderName}.pdf`,await insurancePdf(pages).arrayBuffer());}
const headers=['Trường','Năm học','Lớp','Mã HS','Họ tên','Phương án','Mã tham chiếu','Tổng tiền','BHYT','BHTT'];const esc=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const rows=map.map(m=>[m.school,entries[0].settings.year,m.className,m.studentCode,m.studentName,m.choice,m.remark,m.amount,m.allocations.find(a=>a.itemId==='BHYT')?.amount||0,m.allocations.find(a=>a.itemId==='BHTT')?.amount||0]);zip.file('BANG_MA_THANH_TOAN.csv','\uFEFF'+[headers,...rows].map(r=>r.map(esc).join(',')).join('\r\n'));zip.file('BANG_PHAN_BO_THANH_TOAN.json',JSON.stringify({format:'BIDVQRGEN_INSURANCE_V1',createdAt:new Date().toISOString(),items:map},null,2));zip.file('HUONG_DAN.txt','Mỗi thư mục lớp có PNG học sinh và PDF A5 cả lớp. Chỉ thanh toán một phương án. QR cũ không tự vô hiệu hóa.\nQR chuyển khoản đến tài khoản đã cấu hình; không tự đăng ký hóa đơn thu hộ tại ngân hàng.\nGiữ bảng mã CSV/JSON để đối chiếu. Web trường chưa tự nhập bảng mã này; dữ liệu thu không tự đồng bộ.\n');const blob=await zip.generateAsync({type:'blob',compression:'STORE'},p=>{if(state.cancel)throw Error('Đã hủy xuất.');$('#biProgress').textContent=`Đóng gói ${Math.round(p.percent)}%`;});saveAs(blob,`QR_BAO_HIEM_${insuranceSafeName(entries[0].school.schoolName)}_BHYT_BHTT_${groups.size===1?insuranceSafeName([...groups.keys()][0]):groups.size+'_LOP'}.zip`);$('#biProgress').textContent=`Đã tạo ${entries.length} thông báo và ${groups.size} PDF lớp.`;}
async function run(action){if(state.busy)return;state.busy=true;state.cancel=false;const controls=[...document.querySelectorAll('#insuranceTool input,#insuranceTool select,#insuranceTool button,#schoolName,#schoolLogo,#removeSchoolLogo,#upload')].filter(x=>x.id!=='biCancel'),prior=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);$('#biCancel').hidden=action!=='export';$('#biProgress').textContent='Đang xử lý…';try{state.entries=await build();state.index=0;show();if(action==='export')await exportZip(state.entries);else $('#biProgress').textContent='Đã tạo bản xem trước. Kiểm tra tài khoản trước khi gửi phụ huynh.';}catch(e){$('#biProgress').textContent=e.message;}finally{state.busy=false;controls.forEach((x,i)=>x.disabled=prior[i]);$('#biCancel').hidden=true;show();}}
function fail(e){$('#biProgress').textContent=e.message;}
function mappingUi(rows,headerIndex){state.raw={rows,headerIndex};const root=$('#biMapping');root.replaceChildren();for(const [key,label,aliases] of fields){const l=document.createElement('label'),select=document.createElement('select');l.textContent=label;select.dataset.field=key;select.add(new Option('Không chọn','-1'));const hs=rows[headerIndex];hs.forEach((h,i)=>select.add(new Option(String(h||'Cột '+(i+1)),String(i))));const found=hs.findIndex(h=>aliases.includes(norm(h)));select.value=String(found);l.append(select);root.append(l);}const b=document.createElement('button');b.textContent='Xác nhận ghép cột';b.onclick=()=>{try{const m=Object.fromEntries([...root.querySelectorAll('select')].map(x=>[x.dataset.field,Number(x.value)]));for(const k of ['code','name','className','health','body'])if(m[k]<0)throw Error('Chọn đủ mã, họ tên, lớp và hai cột số tiền.');if(new Set(['code','name','className','health','body'].map(k=>m[k])).size!==5)throw Error('Mỗi trường bắt buộc phải ghép với một cột khác nhau.');const out=[];for(let i=headerIndex+1;i<rows.length;i++){const r=rows[i];if(!r.some(v=>String(v??'').trim()))continue;try{out.push({code:String(r[m.code]??'').trim(),name:String(r[m.name]??'').trim(),className:String(r[m.className]??'').trim(),health:amount(r[m.health]),body:amount(r[m.body]),hp:paid(r[m.hp]),bp:paid(r[m.bp])});}catch(e){throw Error('Dòng '+(i+1)+': '+e.message);}}acceptRows(out);root.hidden=true;}catch(e){fail(e);}};root.append(b);root.hidden=false;}
$('#biFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const book=XLSX.read(await file.arrayBuffer(),{type:'array',raw:true});let best=null;for(const name of book.SheetNames){const rows=XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false});for(let i=0;i<Math.min(rows.length,25);i++){const score=fields.filter(f=>rows[i].some(h=>f[2].includes(norm(h)))).length;if(!best||score>best.score)best={rows,index:i,score};}}if(!best||best.score<2)throw Error('Không nhận diện được tiêu đề. Dùng file mẫu để nhập dữ liệu.');mappingUi(best.rows,best.index);$('#biSourceChoices').hidden=true;}catch(err){fail(err);}finally{e.target.value='';}};
$('#biTemplate').onclick=()=>saveAs(new Blob(['\uFEFFMã học sinh,Họ và tên,Lớp,BHYT,BHTT,Đã nộp BHYT,Đã nộp BHTT\r\nTEST001,HỌC SINH MẪU,6A1,631800,150000,Chưa nộp,Chưa nộp\r\n'],{type:'text/csv;charset=utf-8'}),'MAU_BAO_HIEM_2_PHUONG_AN.csv');
$('#biExisting').onclick=()=>{if(!allData.length)return fail(Error('Nạp file Excel ở phần đầu trang trước hoặc dùng file mẫu riêng.'));const fees=[...new Set(allData.map(x=>x.FeeName))];for(const id of ['biHealthFee','biBodyFee'])$('#'+id).replaceChildren(new Option('Chọn khoản…',''),...fees.map(f=>new Option(f,f)));$('#biSourceChoices').hidden=false;$('#biMapping').hidden=true;};
$('#biUseFees').onclick=()=>{try{const h=$('#biHealthFee').value,b=$('#biBodyFee').value;if(!h||!b||h===b)throw Error('Chọn hai khoản khác nhau.');const groups=new Map();for(const x of allData.filter(x=>[h,b].includes(x.FeeName))){const code=String(x.StudentID||'').trim();if(!code)throw Error('File thiếu mã học sinh gốc; không ghép theo họ tên hoặc tự cắt mã khoản.');const key=norm(code),r=groups.get(key)||{code,name:studentNameOnly(x),className:String(x.Class||'').trim(),hp:false,bp:false};if(r.name!==studentNameOnly(x)||r.className!==String(x.Class||'').trim())throw Error('Mã học sinh có tên/lớp mâu thuẫn: '+code);const field=x.FeeName===h?'health':'body';if(r[field]!==undefined)throw Error('Một học sinh có nhiều dòng cùng khoản: '+code);r[field]=amount(x.Amount);groups.set(key,r);}const rows=[...groups.values()];if(rows.some(r=>r.health===undefined||r.body===undefined))throw Error('Có học sinh thiếu một khoản. Dùng file mẫu mỗi học sinh một dòng để rà soát.');acceptRows(rows);$('#biProgress').textContent='Dữ liệu QR cũ không có trạng thái thu: đang coi là chưa nộp. Nếu đã thu, nạp file mẫu có trạng thái mới nhất trước khi phát hành.';}catch(e){fail(e);}};
$('#insuranceModeTab').onclick=()=>setMode('insurance');
$('#biSave').onclick=()=>{try{const c=settings();validateConfig(c);localStorage.setItem(configKey(),JSON.stringify(c));$('#biProgress').textContent='Đã lưu cấu hình riêng cho '+c.school;}catch(e){fail(e);}};
$('#biPreview').onclick=()=>run('preview');$('#biExport').onclick=()=>run('export');$('#biCancel').onclick=()=>state.cancel=true;
$('#biPrev').onclick=()=>{if(state.index>0){state.index--;show();}};$('#biNext').onclick=()=>{if(state.index<state.entries.length-1){state.index++;show();}};
$('#biClasses').onchange=()=>{const el=$('#biClasses');if(el.selectedOptions.length>1)el.options[0].selected=false;invalidate();};
for(const id of ['biBin','biAccount','biAccountName','biYear','biDeadline','biContact','biStatus'])$('#'+id).addEventListener('change',invalidate);
schoolNameInput.addEventListener('change',()=>{if(state.rows.length&&state.school!==schoolNameInput.value.trim()){$('#biDataStatus').textContent='Đã đổi trường. Nạp lại danh sách đúng trường trước khi tạo thông báo.';}loadConfig();});schoolLogoInput.addEventListener('change',invalidate);$('#removeSchoolLogo').addEventListener('click',invalidate);loadConfig();if(location.hash==='#bao-hiem')setMode('insurance');
})();
