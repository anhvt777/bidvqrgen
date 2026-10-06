'use strict';
(()=>{
const $=s=>document.querySelector(s),num=n=>Math.round(Number(n)||0),money=n=>new Intl.NumberFormat('vi-VN').format(num(n))+' ₫';
function qrText(value,maxLength=25){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toUpperCase().replace(/[^A-Z0-9 _.-]/g,' ').replace(/\s+/g,' ').trim().slice(0,maxLength);}

function emvTag(id,value){const text=String(value);if(text.length>99)throw new Error(`Trường QR ${id} vượt độ dài cho phép.`);return id+String(text.length).padStart(2,'0')+text;}

function crc16ccitt(value){let crc=0xFFFF;for(let i=0;i<value.length;i++){crc^=value.charCodeAt(i)<<8;for(let bit=0;bit<8;bit++)crc=crc&0x8000?(crc<<1)^0x1021:crc<<1;crc&=0xFFFF;}return crc.toString(16).toUpperCase().padStart(4,'0');}

function buildVietQrPayload(config,amount,remark){
  const accountInfo=emvTag('00','A000000727')+emvTag('01',emvTag('00',config.bin)+emvTag('01',config.accountNumber))+emvTag('02','QRIBFTTA');
  const reference=emvTag('08',String(remark));
  let payload='000201010212'+emvTag('38',accountInfo)+'52040000'+'5303704'+emvTag('54',String(num(amount)))+'5802VN'+emvTag('59',qrText(config.accountName,25))+emvTag('60','VIETNAM')+emvTag('62',reference)+'6304';
  payload+=crc16ccitt(payload);return payload;
}

function noticeDateVi(value){if(!value)return '—';const [y,m,d]=value.split('-');return `${d}/${m}/${y}`;}

function insuranceQrCanvas(payload,maxSize=402){
  const holder=document.createElement('div'),qr=new QRCode(holder,{text:payload,width:256,height:256,correctLevel:QRCode.CorrectLevel.M});
  const matrix=qr._oQRCode,n=matrix.getModuleCount(),scale=Math.floor(maxSize/(n+8)),size=(n+8)*scale;
  if(scale<3)throw new Error('Nội dung QR quá dài để in rõ.');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.fillStyle='#000';
  for(let row=0;row<n;row++)for(let col=0;col<n;col++)if(matrix.isDark(row,col))ctx.fillRect((col+4)*scale,(row+4)*scale,scale,scale);
  return canvas;
}

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

const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const safe=v=>qrText(v,100).replace(/[^A-Z0-9._-]/g,'_')||'CHUA_DAT_TEN';
const state={groups:[],school:'',entries:[],index:0,busy:false,cancel:false};
const fields=[
 ['code','Mã học sinh gốc', ['studentid','student id','ma hoc sinh','ma hs','ma moet'],true],
 ['name','Họ tên học sinh',['ho ten co dau','ho va ten co dau','ho va ten hoc sinh','ho ten hoc sinh','ho va ten','ho ten','studentname','student name','ten hoc sinh','fullname','full name','accountname','account name'],true],
 ['className','Lớp',['class','lop'],true],
 ['birthdate','Ngày sinh (tùy chọn)',['ngay sinh','ngay thang nam sinh','birthdate','birth date','date of birth','dob'],false],
 ['paymentCode','Mã thu riêng (trống: dùng tài khoản định danh)',['customercode','customer code','ma thu','ma kh','ma khach hang','paymentcode','accountnumber','so tai khoan dinh danh'],false],
 ['label','Tên khoản / lựa chọn',['feename','fee name','ten lua chon','khoan thu','ten khoan thu'],true],
 ['amount','Số tiền của QR',['amount','so tien','so tien phai nop'],true],
 ['accountNumber','Tài khoản định danh của QR',['accountnumber','account number','so tai khoan dinh danh','so tai khoan','stk'],true],
 ['bin','BIN ngân hàng',['bankbin','bank bin','ma bin','bin'],true],
 ['accountName','Tên tài khoản nhận',['accountname','account name','ten tai khoan','ten khach hang'],true],
 ['remark','Nội dung chuyển khoản (trống: dùng mã thu)',['remark','noi dung','noi dung chuyen khoan'],false],
 ['group','Nhóm lựa chọn (tùy chọn)',['choicegroup','choice group','nhom lua chon','ma nhom lua chon'],false],
 ['includes','Các khoản bao gồm (tùy chọn)',['includes','cac khoan bao gom','bao gom'],false],
 ['note','Ghi chú lựa chọn (tùy chọn)',['choicenote','choice note','ghi chu lua chon'],false],
 ['order','Thứ tự lựa chọn (tùy chọn)',['choiceorder','choice order','thu tu'],false]
];
const templateHeaders=['AccountNumber','BankBin','Amount','AccountName','Remark','Class','StudentID','StudentName','FeeName','CustomerCode','ChoiceGroup','Includes','ChoiceNote','ChoiceOrder','Ngày sinh'];
const sampleRows=[
 ['000000000001','970418',631800,'TAI KHOAN MAU A','TEST001A','6A1','TEST001','HỌC SINH MẪU A','Chỉ nộp BHYT','TEST001A','BAOHIEM2026','BHYT: 631.800đ','Không tham gia BHTT trong lần nộp này',1],
 ['000000000002','970418',781800,'TAI KHOAN MAU B','TEST001B','6A1','TEST001','HỌC SINH MẪU A','Nộp BHYT + BHTT','TEST001B','BAOHIEM2026','BHYT: 631.800đ + BHTT: 150.000đ','Đã bao gồm BHYT. Không thanh toán thêm QR chỉ BHYT.',2],
 ['000000000003','970418',631800,'TAI KHOAN MAU C','TEST002A','6A2','TEST002','HỌC SINH MẪU B','Chỉ nộp BHYT','TEST002A','BAOHIEM2026','BHYT: 631.800đ','Không tham gia BHTT trong lần nộp này',1],
 ['000000000004','970418',781800,'TAI KHOAN MAU D','TEST002B','6A2','TEST002','HỌC SINH MẪU B','Nộp BHYT + BHTT','TEST002B','BAOHIEM2026','BHYT: 631.800đ + BHTT: 150.000đ','Đã bao gồm BHYT. Không thanh toán thêm QR chỉ BHYT.',2]
];
function invalidate(){state.entries=[];state.index=0;$('#biCanvas').textContent='Bấm Xem trước để tạo lại thông báo.';$('#biPage').textContent='Chưa có thông báo';$('#biPrev').disabled=$('#biNext').disabled=true;}
function config(){return {school:schoolNameInput.value.trim(),title:$('#biTitle').value.trim(),year:$('#biYear').value.trim(),deadline:$('#biDeadline').value,contact:$('#biContact').value.trim(),intro:$('#biIntro').value.trim(),authority:$('#biAuthority').value.trim(),place:$('#biPlace').value.trim(),issueDate:$('#biIssueDate').value,signer:$('#biSigner').value.trim(),signerRole:$('#biSignerRole').value.trim()};}
function configKey(){return 'bidvqrgen:choice-notice:'+norm(schoolNameInput.value);}
function loadConfig(){let s={};try{s=JSON.parse(localStorage.getItem(configKey())||'{}');}catch{}for(const [id,k] of [['biTitle','title'],['biYear','year'],['biDeadline','deadline'],['biContact','contact'],['biIntro','intro'],['biAuthority','authority'],['biPlace','place'],['biIssueDate','issueDate'],['biSigner','signer'],['biSignerRole','signerRole']])$('#'+id).value=s[k]||(id==='biTitle'?'THÔNG BÁO KHOẢN THU HỌC SINH':'');invalidate();}
function review(groups){const root=$('#biReview');root.replaceChildren();const table=document.createElement('table');const head=document.createElement('tr');for(const v of ['Mã HS · Nhóm','Lựa chọn','Mã thu','TK định danh','Số tiền']){const th=document.createElement('th');th.textContent=v;head.append(th);}table.append(head);let count=0;for(const g of groups)for(const o of g.options){if(count++>=50)continue;const tr=document.createElement('tr');for(const v of [g.student.code+' · '+g.group,o.label,o.paymentCode,o.accountNumber,money(o.amount)]){const td=document.createElement('td');td.textContent=v;tr.append(td);}table.append(tr);}root.append(table);if(count>50){const p=document.createElement('p');p.textContent='Đang hiển thị 50/'+count+' dòng. File xuất chứa đầy đủ dữ liệu.';root.append(p);}}
function accept(rows){const groups=PaymentChoices.groupRows(rows);state.groups=groups;state.school=schoolNameInput.value.trim();const classes=[...new Set(groups.map(g=>g.student.className))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));$('#biClasses').replaceChildren(new Option('Tất cả lớp','all',true,true),...classes.map(c=>new Option(c,c)));const students=new Set(groups.map(g=>g.student.code));const single=groups.filter(g=>g.options.length===1).length;$('#biDataStatus').textContent=`${students.size} học sinh · ${groups.length} nhóm lựa chọn · ${rows.length} QR · ${classes.length} lớp.\nKhông cộng các phương án thành tổng phải nộp.${single?' Có '+single+' nhóm chỉ có 1 lựa chọn; kiểm tra có thiếu dòng không.':''}`;review(groups);invalidate();$('#biProgress').textContent='Đã kiểm tra mã thu, thông tin học sinh và tài khoản từng QR. Kiểm tra lại bảng trước khi phát hành.';}
function mappingUi(rows,headerIndex){const root=$('#biMapping');root.replaceChildren();for(const [key,label,aliases,required] of fields){const l=document.createElement('label'),sel=document.createElement('select');l.textContent=label+(required?' *':'');sel.dataset.field=key;sel.add(new Option('Không chọn','-1'));rows[headerIndex].forEach((h,i)=>sel.add(new Option(String(h||'Cột '+(i+1)),String(i))));const candidates=aliases.map(a=>rows[headerIndex].findIndex(h=>norm(h)===a)).filter(i=>i>=0);const accented=key==='name'?candidates.find(i=>rows.slice(headerIndex+1,headerIndex+26).some(r=>/[À-ỹĐđ]/.test(String(r[i]||'')))):undefined;sel.value=String(accented??candidates[0]??-1);l.append(sel);root.append(l);}const b=document.createElement('button');b.textContent='Xác nhận ghép cột và kiểm tra';b.onclick=()=>{try{const m=Object.fromEntries([...root.querySelectorAll('select')].map(x=>[x.dataset.field,Number(x.value)]));for(const [k,label,,required] of fields)if(required&&m[k]<0)throw Error('Chọn cột '+label);const used=new Map();for(const [k,i] of Object.entries(m)){if(i<0)continue;const other=used.get(i);if(other&&!['accountName|name','paymentCode|remark','accountNumber|paymentCode'].includes([k,other].sort().join('|')))throw Error('Hai trường ghép cùng một cột: '+k+' và '+other);used.set(i,k);}const out=[];for(let i=headerIndex+1;i<rows.length;i++){const row=rows[i];if(!row.some(v=>String(v??'').trim()))continue;const o={sourceRow:i+1,nameFromAccount:m.name===m.accountName};for(const [k] of fields)o[k]=m[k]>=0?row[m[k]]:'';out.push(o);}accept(out);root.hidden=true;}catch(e){fail(e);}};root.append(b);root.hidden=false;}
function noticeCanvas(e){
 const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
 const c=canvas.getContext('2d'),teal='#00747b',ink='#183b48',muted='#536b75',border='#b9d5da';
 c.fillStyle='white';c.fillRect(0,0,1240,1754);c.textBaseline='top';
 const text=(s,x,y,size=24,color=ink,weight='400',align='left',max=1100)=>{c.fillStyle=color;c.textAlign=align;let fs=size;c.font=weight+' '+fs+'px Arial';while(c.measureText(String(s)).width>max&&fs>12)c.font=weight+' '+(--fs)+'px Arial';c.fillText(String(s),x,y);};
 const wrap=(s,x,y,width,size=21,line=27,maxLines=3)=>{c.font='400 '+size+'px Arial';let lines=[],row='';for(const word of String(s).split(/\s+/)){const next=row?row+' '+word:word;if(c.measureText(next).width>width&&row){lines.push(row);row=word;}else row=next;}if(row)lines.push(row);if(lines.length>maxLines)lines=[...lines.slice(0,maxLines-1),lines.slice(maxLines-1).join(' ')];lines.forEach((v,i)=>text(v,x,y+i*line,size,ink,'400','left',width));};
 const line=(y,x=70,w=1100)=>{c.strokeStyle=border;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.stroke();};
 const box=(x,y,w,h,fill='white')=>{c.fillStyle=fill;c.fillRect(x,y,w,h);c.strokeStyle=border;c.lineWidth=1;c.strokeRect(x,y,w,h);};
 // Compact vertical spacing; preserve the QR's native module size.
 c.save();c.translate(0,-20);
 // School notice heading, with optional issuing authority and signatory.
 text(e.settings.authority||'',310,70,21,teal,'700','center',470);
 text(e.settings.school,310,103,24,teal,'700','center',470);
 text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',905,70,21,teal,'700','center',535);
 text('Độc lập - Tự do - Hạnh phúc',905,103,21,ink,'700','center',535);
 text(e.settings.title,620,181,37,teal,'700','center',1100);
 text('Thông tin khoản thu và hướng dẫn lựa chọn thanh toán',620,234,21,muted,'400','center');
 text('Kỳ thu: '+e.settings.year,620,272,22,teal,'400','center');
 box(70,326,1100,95);line(421);
 const cols=[70,720,865];for(const x of cols.slice(1)){c.beginPath();c.moveTo(x,326);c.lineTo(x,421);c.stroke();}
 text('HỌ VÀ TÊN HỌC SINH',90,344,17,teal,'700');text(e.student.name,90,375,30,ink,'700','left',610);
 text('LỚP',740,344,17,teal,'700');text(e.student.className,740,375,26,ink,'700','left',105);
 text('NGÀY THÁNG NĂM SINH',885,344,17,teal,'700','left',265);text(e.student.birthdate||'Chưa có dữ liệu',885,375,26,ink,'700','left',265);
 text('CHI TIẾT CÁC KHOẢN THU',70,452,22,teal,'700');line(486);
 text('STT',95,501,18,teal,'700');text('NỘI DUNG KHOẢN THU',175,501,18,teal,'700');text('TÍNH CHẤT',780,501,18,teal,'700');text('SỐ TIỀN',1150,501,18,teal,'700','right');line(534);
 if(e.insuranceSummary){
  text('1',108,551,22);text('Bảo hiểm y tế (BHYT)',175,551,22);text('Bắt buộc',780,551,21);text(money(e.insuranceSummary.health),1150,551,23,ink,'700','right');line(587);
  text('2',108,605,22);text('Bảo hiểm thân thể (BHTT)',175,605,22);text('Tự nguyện',780,605,21);text(money(e.insuranceSummary.body),1150,605,23,ink,'700','right');line(640);
  text('BHYT bắt buộc theo thông báo của trường; BHTT tùy phụ huynh lựa chọn.',70,657,21,muted);
 }else{
  e.visible.forEach((o,i)=>{const y=551+i*54;text(String(e.choiceStart+i+1),108,y,22);text(o.label,175,y,22,ink,'400','left',580);text('Lựa chọn',780,y,21);text(money(o.amount),1150,y,23,ink,'700','right');line(y+36);});
  text('Số tiền trên là từng phương án thay thế nhau, không cộng thành tổng phải nộp.',70,657,21,muted);
 }
 if(e.settings.intro)wrap(e.settings.intro,70,695,1100,20,25,2);
 c.translate(0,e.settings.intro?-20:-65);
 box(70,759,1100,70,'#fff8e4');text('CHỌN 1 TRONG '+e.options.length+' PHƯƠNG ÁN · CHỈ QUÉT 1 QR',620,772,28,teal,'700','center');text(e.insuranceSummary?'Không thanh toán cả hai QR. QR gộp đã bao gồm khoản BHYT.':'Các phương án thay thế nhau; không cộng số tiền của các QR.',620,808,20,ink,'400','center');
 const w=530,start=e.visible.length===1?355:70;
 e.visible.forEach((o,i)=>{const x=start+i*570,center=x+w/2;box(x,853,w,550);
  text('LỰA CHỌN '+(e.choiceStart+i+1)+' · '+(o.displayLabel||o.label),center,871,25,teal,'700','center',w-28);
  text(money(o.amount),center,908,31,ink,'700','center');
  if(e.mark){c.drawImage(e.mark,center-18,952,36,36);}
  const q=insuranceQrCanvas(o.payload,290);c.imageSmoothingEnabled=false;c.drawImage(q,Math.round(center-q.width/2),992);c.imageSmoothingEnabled=true;
  text('BIDV',center,1284,25,teal,'700','center');text(e.student.name+' · Lớp '+e.student.className,center,1318,21,ink,'700','center',w-28);
  wrap('Bao gồm: '+o.includes,x+20,1348,w-40,20,26,2);
 });
 c.translate(0,-40);
 box(70,1461,1100,141,'#f8fcfc');text('HƯỚNG DẪN THANH TOÁN',90,1478,21,teal,'700');
 text('1. Chọn một phương án, mở ứng dụng ngân hàng và quét QR tương ứng.',90,1510,20);
 text('2. Kiểm tra người nhận, số tiền và nội dung; xác nhận chuyển khoản.',90,1538,20);
 text('3. Đã thanh toán: bỏ qua thông báo. Nếu chuyển nhầm, liên hệ nhà trường.',90,1566,20);
 text('Hạn nộp: '+(e.settings.deadline?noticeDateVi(e.settings.deadline):'Theo thông báo của trường'),70,1621,20,'#b13e36','700','left',680);
 if(e.settings.contact)text('Liên hệ: '+e.settings.contact,1170,1621,20,ink,'400','right',400);
 if(e.settings.place||e.settings.issueDate)text([e.settings.place,e.settings.issueDate?'ngày '+noticeDateVi(e.settings.issueDate):''].filter(Boolean).join(', '),930,1664,18,ink,'400','center',480);
 if(e.settings.signerRole)text(e.settings.signerRole.toUpperCase(),930,1690,18,teal,'700','center',480);
 if(e.settings.signer)text(e.settings.signer,930,1724,19,teal,'700','center',480);
 c.restore();
 text('Trang '+e.page+'/'+e.pageCount+' · Chỉ chọn 1 QR trong toàn nhóm',70,1727,16,muted);
 return canvas;
}
async function build(){const settings=config();if(!settings.school)throw Error('Nhập tên trường ở phía trên.');if(!settings.title||!settings.year)throw Error('Nhập tiêu đề và năm học / đợt thu.');if(!state.groups.length)throw Error('Nạp file lựa chọn thanh toán trước.');if(state.school!==settings.school)throw Error('Tên trường đã đổi. Nạp lại danh sách đúng trường.');const chosen=new Set([...$('#biClasses').selectedOptions].map(o=>o.value)),groups=state.groups.filter(g=>chosen.has('all')||chosen.has(g.student.className));if(!groups.length)throw Error('Chưa chọn lớp có dữ liệu.');const data=currentSchoolLogo(),logo=data?await loadImage(data):null,mark=(await loadBrandingImages())[0];return PaymentChoices.paginate(groups).map(e=>({...e,settings,logo,mark,visible:e.visible.map(o=>({...o,payload:buildVietQrPayload(o,o.amount,o.remark)}))}));}
function show(){const e=state.entries[state.index];if(!e)return;const canvas=noticeCanvas(e);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',e.student.name+' · '+e.group+' · '+e.visible.map(o=>o.label+' '+money(o.amount)+' mã thu '+o.paymentCode+' tài khoản '+o.accountNumber).join('; '));$('#biCanvas').replaceChildren(canvas);$('#biPage').textContent=`${state.index+1}/${state.entries.length} · ${e.student.className} · ${e.student.name} · trang ${e.page}/${e.pageCount}`;$('#biPrev').disabled=state.index===0;$('#biNext').disabled=state.index===state.entries.length-1;}
const csv=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
async function exportZip(entries,mode='all'){const zip=new JSZip(),classes=new Map(),records=[];for(const e of entries){if(!classes.has(e.student.className))classes.set(e.student.className,[]);classes.get(e.student.className).push(e);}const folders=new Set();let done=0,singlePdf=null;for(const [cls,list] of classes){let folderName=safe(cls);while(folders.has(folderName))folderName+='_';folders.add(folderName);const folder=zip.folder(folderName),pages=[],names=new Set();for(const e of list){if(state.cancel)throw Error('Đã hủy xuất.');const canvas=noticeCanvas(e);let stem=[folderName,safe(e.student.code),safe(e.student.name),safe(e.group),'TRANG'+e.page].join('_');while(names.has(stem))stem+='_';names.add(stem);if(mode!=='pdf'){const png=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!png)throw Error('Không tạo được ảnh.');folder.file(stem+'.png',await png.arrayBuffer());}if(mode!=='images'){const jpeg=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.96));if(!jpeg)throw Error('Không tạo được trang PDF.');pages.push(new Uint8Array(await jpeg.arrayBuffer()));}for(const o of e.visible)records.push([e.settings.school,e.settings.year,cls,e.student.code,e.student.name,e.group,o.label,o.paymentCode,o.bin,o.accountNumber,o.accountName,o.amount,o.remark,o.includes,o.note]);$('#biProgress').textContent='Đang tạo '+(++done)+'/'+entries.length+' trang…';await new Promise(r=>setTimeout(r,0));}if(mode!=='images'){const pdf=insurancePdf(pages),name='THONG_BAO_LUA_CHON_'+safe(entries[0].settings.year)+'_'+folderName+'.pdf';if(mode==='pdf'&&classes.size===1)singlePdf={pdf,name};else folder.file(name,await pdf.arrayBuffer());}}if(singlePdf){if(state.cancel)throw Error('Đã hủy xuất.');saveAs(singlePdf.pdf,singlePdf.name);$('#biProgress').textContent='Đã tạo PDF '+entries.length+' trang cho lớp '+[...classes.keys()][0]+'.';return;}
 const headers=['Trường','Đợt thu','Lớp','Mã học sinh','Họ tên','Nhóm lựa chọn','Tên lựa chọn','Mã thu','BIN','Tài khoản định danh','Tên tài khoản','Số tiền','Nội dung QR','Bao gồm','Ghi chú'];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,...records]),'DOI_CHIEU_QR');zip.file('BANG_DOI_CHIEU_QR.xlsx',XLSX.write(wb,{bookType:'xlsx',type:'array'}));zip.file('BANG_DOI_CHIEU_QR.csv','\uFEFF'+[headers,...records].map(r=>r.map(csv).join(',')).join('\r\n'));zip.file('HUONG_DAN.txt','Mỗi học sinh và nhóm lựa chọn là một thông báo, tối đa 2 QR/trang. Chỉ chọn 1 QR trong toàn bộ nhóm, kể cả khi có nhiều trang. Không cộng các lựa chọn thành nghĩa vụ phải thu.\nQR sử dụng tài khoản, số tiền, nội dung từ từng dòng nguồn; mã thu giữ trong bảng đối chiếu để tra soát. Web không đăng ký định danh với ngân hàng, không cập nhật trạng thái thu và không vô hiệu hóa QR đã gửi.\nBảng CSV đối chiếu chứa đúng các lựa chọn đã xuất. Lưu cùng file đầu vào của đợt phát hành.\n');const blob=await zip.generateAsync({type:'blob',compression:'STORE'},p=>{if(state.cancel)throw Error('Đã hủy xuất.');$('#biProgress').textContent='Đóng gói '+Math.round(p.percent)+'%';});if(state.cancel)throw Error('Đã hủy xuất.');saveAs(blob,(mode==='images'?'ANH_':mode==='pdf'?'PDF_':'')+'THONG_BAO_LUA_CHON_'+safe(entries[0].settings.school)+'_'+safe(entries[0].settings.year)+'_'+(classes.size===1?safe([...classes.keys()][0]):classes.size+'_LOP')+'.zip');$('#biProgress').textContent=mode==='images'?'Đã tạo '+entries.length+' ảnh theo '+classes.size+' lớp.':mode==='pdf'?'Đã tạo '+classes.size+' PDF lớp.':'Đã tạo '+entries.length+' trang ảnh và '+classes.size+' PDF lớp.';}
async function run(action){if(state.busy)return;state.busy=true;state.cancel=false;const controls=[...document.querySelectorAll('#insuranceTool input,#insuranceTool textarea,#insuranceTool select,#insuranceTool button,#schoolName,#schoolLogo,#removeSchoolLogo,#upload')].filter(x=>x.id!=='biCancel'),prior=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);$('#biCancel').hidden=action==='preview';$('#biProgress').textContent='Đang xử lý…';try{state.entries=await build();state.index=0;show();if(action!=='preview')await exportZip(state.entries,action==='pdf'?'pdf':action==='images'?'images':'all');else $('#biProgress').textContent='Đã tạo xem trước. Mỗi QR dùng đúng thông tin thanh toán của dòng nguồn.';}catch(e){fail(e);}finally{state.busy=false;controls.forEach((x,i)=>x.disabled=prior[i]);$('#biCancel').hidden=true;}}
function fail(e){$('#biProgress').textContent=e.message;}
$('#biFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;state.groups=[];invalidate();$('#biReview').replaceChildren();$('#biDataStatus').textContent='Đang nạp file mới. Xác nhận ghép cột trước khi tạo thông báo.';const book=XLSX.read(await file.arrayBuffer(),{type:'array'});let best=null;for(const name of book.SheetNames){const rows=XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false});for(let i=0;i<Math.min(rows.length,25);i++){const score=fields.filter(f=>rows[i].some(h=>f[2].includes(norm(h)))).length;if(!best||score>best.score)best={rows,index:i,score};}}if(!best||best.score<3)throw Error('Không nhận diện được tiêu đề. Dùng file mẫu mới: mỗi dòng là một lựa chọn QR.');mappingUi(best.rows,best.index);}catch(err){fail(err);}finally{e.target.value='';}};
$('#biTemplate').onclick=()=>{try{const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([templateHeaders,...sampleRows.map(r=>[...r,'01/01/2015'])]);sheet['!cols']=templateHeaders.map(h=>({wch:['Includes','ChoiceNote','StudentName','FeeName'].includes(h)?45:22}));XLSX.utils.book_append_sheet(book,sheet,'LUA_CHON_QR');XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['HƯỚNG DẪN'],['Dữ liệu mẫu giả. Thay bằng thông tin định danh đã đăng ký trước khi phát hành.'],['Mỗi dòng là 1 lựa chọn QR. StudentID giống nhau để gom cùng học sinh; không dùng mã khoản làm StudentID.'],['ChoiceGroup giống nhau: các phương án thay thế nhau, chỉ chọn 1 QR. Khác nhóm: các thông báo riêng.'],['AccountNumber, CustomerCode, StudentID, BankBin và Remark đặt dạng Text; giữ nguyên số 0 đầu.'],['Amount là tổng tiền của riêng QR đó, web không tự cộng tiền.'],['Includes mô tả thành phần khoản thu; ChoiceNote giải thích lựa chọn.'],['Không dùng file mẫu cũ có hai cột BHYT/BHTT.'],['Remark trống sẽ dùng CustomerCode. Nội dung QR không dấu, tối đa 95 ký tự; không tự cắt.'],['Nạp riêng ở tab Thông báo lựa chọn để giữ đủ các cột mở rộng.']]),'HUONG_DAN');XLSX.writeFile(book,'MAU_THONG_BAO_LUA_CHON_QR.xlsx');}catch(e){fail(e);}};
$('#biExisting').onclick=()=>{try{if(!allData.length)throw Error('Nạp file ở tab Tạo QR trước hoặc nạp riêng tại đây.');accept(allData.map(x=>({code:x.StudentID,name:x.StudentName||studentNameOnly(x),nameFromAccount:!x.StudentName,birthdate:x.BirthDate,className:x.Class,paymentCode:x.CustomerCode||x.AccountNumber,label:x.FeeName,amount:x.Amount,accountNumber:x.AccountNumber,bin:x.BankBin,accountName:x.AccountName,remark:x.Remark,group:x.ChoiceGroup,includes:x.Includes,note:x.ChoiceNote,order:x.ChoiceOrder})));$('#biMapping').hidden=true;}catch(e){fail(e);}};
$('#insuranceModeTab').onclick=()=>setMode('insurance');$('#biSave').onclick=()=>{try{const c=config();if(!c.school)throw Error('Nhập tên trường trước.');localStorage.setItem(configKey(),JSON.stringify(c));$('#biProgress').textContent='Đã lưu cách trình bày cho '+c.school+'.';}catch(e){fail(e);}};
$('#biPreview').onclick=()=>run('preview');$('#biExport').onclick=()=>run('export');$('#biPdf').onclick=()=>run('pdf');$('#biImages').onclick=()=>run('images');$('#biCancel').onclick=()=>state.cancel=true;$('#biPrev').onclick=()=>{if(state.index>0){state.index--;show();}};$('#biNext').onclick=()=>{if(state.index<state.entries.length-1){state.index++;show();}};
$('#biClasses').onchange=()=>{const el=$('#biClasses');if(el.selectedOptions.length>1)el.options[0].selected=false;invalidate();};for(const id of ['biTitle','biYear','biDeadline','biContact','biIntro','biAuthority','biPlace','biIssueDate','biSigner','biSignerRole'])$('#'+id).addEventListener('change',invalidate);schoolNameInput.addEventListener('change',()=>{if(state.groups.length&&state.school!==schoolNameInput.value.trim())$('#biDataStatus').textContent='Đã đổi trường. Nạp lại dữ liệu đúng trường.';loadConfig();});schoolLogoInput.addEventListener('change',invalidate);$('#removeSchoolLogo').addEventListener('click',invalidate);loadConfig();if(['#bao-hiem','#lua-chon'].includes(location.hash))setMode('insurance');

})();
