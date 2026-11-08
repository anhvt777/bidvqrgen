'use strict';
(function(){
  const $=id=>document.getElementById(id);
  let rows=[];
  const clean=x=>String(x??'').trim();
  const normalize=x=>clean(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toUpperCase().replace(/[^A-Z0-9 _.-]/g,' ').replace(/\s+/g,' ').trim();
  function money(v){const x=clean(v).replace(/[\s₫đ]/g,'');const y=/^\d+$/.test(x)?x:/^\d{1,3}([.,]\d{3})+$/.test(x)?x.replace(/[.,]/g,''):'NaN';const n=Number(y);if(!Number.isSafeInteger(n)||n<=0||n>999999999)throw Error('Số tiền không hợp lệ: '+clean(v));return n}
  function emv(bin,account,name,amount,remark){
    if(!window.BIDVQREngine)throw Error('Chưa tải được BIDV QR Engine V1');
    return window.BIDVQREngine.generate({bankBin:bin,accountNumber:account,accountName:name,amount,remark});
  }
  function exportQR(payload){
    const h=document.createElement('div');h.style.cssText='position:fixed;left:-10000px;top:0';
    document.body.appendChild(h);
    try {
      if(typeof QRCode==='undefined')throw Error('Chưa có bộ thư viện QR nội bộ');
      new QRCode(h,{text:payload,width:280,height:280,correctLevel:QRCode.CorrectLevel.M});
      const canvas=h.querySelector('canvas');
      if(!canvas)throw Error('Trình duyệt không cho tạo QR');
      const image=canvas.toDataURL('image/png');
      if(!/^data:image\/png;base64,/.test(image)||image.length>185000)throw Error('Ảnh QR quá lớn');
      return image.slice('data:image/png;base64,'.length);
    }finally{h.remove()}
  }
  async function save(downloadFile=true){
    const status=$('portalQrExportStatus');
    if(!rows.length){status.textContent='Hãy tải Excel tạo QR trước.';return}
    const candidates=[],held=[],refs=new Set();
    for(let i=0;i<rows.length;i++){
      const x=rows[i], account=clean(x.AccountNumber),bin=clean(x.BankBin),remark=clean(x.Remark),klass=clean(x.Class),fee=clean(x.FeeName),studentId=clean(x.StudentID);
      let person=clean(x.StudentName||x.AccountName);
      if(!clean(x.StudentName)&&klass&&normalize(person).endsWith(' '+normalize(klass)))person=person.slice(0,person.lastIndexOf(' ')).trim();
      try{
        const amount=money(x.Amount),accountName=clean(x.AccountName);
        if(!person||!klass||!fee||!accountName)throw Error('Thiếu họ tên/lớp/khoản thu/tên tài khoản');
        // Never infer a billing period from the account number. Admin reconciles it against D1.
        const key=bin+'|'+account+'|'+remark;
        if(refs.has(key))throw Error('Trùng cùng BIN + tài khoản + nội dung');
        refs.add(key);
        const payload=emv(bin,account,accountName,amount,remark);
        if(typeof window.bidvQrPortalRenderBranded!=='function')throw Error('Bộ vẽ QR logo chưa tải; vui lòng Ctrl+F5');
        candidates.push({student_id:studentId,student_name:person,class_name:klass,charge_name:fee,fee_code:clean(x.FeeCode),amount,bank_bin:bin,account_number:account,account_name:accountName,remark,qr_payload:payload,qr_png_base64:await window.bidvQrPortalRenderBranded(payload,x)});
      }catch(e){held.push({row:i+1,reason:String(e.message).slice(0,160)})}
    }
    if(!candidates.length){status.textContent='Không có dòng QR hợp lệ. '+held.length+' dòng cần sửa.';return}
    const data={qr_engine_version:window.BIDVQREngine.version,schema:'bidvqrgen-parent-qr-manifest/1',school_id:'TRUNGVUONG',status:'UNVERIFIED_QR_DRAFT',generated_at:new Date().toISOString(),source:'bidvqrgen',rows:candidates,held};
    if(downloadFile){const blob=new Blob([JSON.stringify(data)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='TRUNGVUONG_QR_CHUA_XAC_MINH_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
    status.textContent=(downloadFile?'Đã xuất ':'Đã chuẩn bị ')+candidates.length+' QR chưa xác minh, giữ lại '+held.length+' dòng. Tại Cloudflare phải đối chiếu và xác minh bằng app BIDV trước khi công bố.';return data;
  }
  document.addEventListener('bidvqrgen:data-loaded',e=>{
    rows=Array.isArray(e.detail?.rows)?e.detail.rows:[];const b=$('portalQrManifestExport');
    if(b)b.disabled=!rows.length;
    const c=$('portalQrConnect');if(c)c.disabled=!rows.length;
    const status=$('portalQrExportStatus');if(status)status.textContent=rows.length+' dòng QR sẵn sàng đối chiếu, chưa được công bố.';
  });
  async function connectPortal(){
    const target='https://school-parent-dev.tuananh0001.workers.dev',popup=window.open(target+'/admin/qr-review','schoolParentQrReview');
    if(!popup){$('portalQrExportStatus').textContent='Trình duyệt chặn cửa sổ mới. Hãy cho phép pop-up.';return}
    let data;
    try{data=await save(false)}catch(e){popup.close();$('portalQrExportStatus').textContent='Không thể chuẩn bị QR: '+e.message;return}
    const listener=ev=>{
      if(ev.origin!==target||ev.source!==popup||ev.data?.type!=='BIDV_QR_PORTAL_READY'||!(/^[a-f0-9]{40}$/).test(ev.data.challenge||''))return;
      window.removeEventListener('message',listener);
      popup.postMessage({type:'BIDV_QR_PORTAL_DRAFT',challenge:ev.data.challenge,manifest:data},target);
      $('portalQrExportStatus').textContent='Đã chuyển '+data.rows.length+' QR sang trang quản trị. Chưa công bố; cán bộ kiểm tra từng mã và quét xác minh.';
    };
    window.addEventListener('message',listener);
    popup.postMessage({type:'BIDV_QR_PORTAL_HELLO'},target);
    $('portalQrExportStatus').textContent='Đang mở xác thực Cloudflare Access. Sau đăng nhập, dữ liệu được chuyển qua cửa sổ quản trị.';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('portalQrManifestExport')?.addEventListener('click',()=>save().catch(e=>{$('portalQrExportStatus').textContent='Không thể xuất danh mục QR: '+e.message}));
    $('portalQrConnect')?.addEventListener('click',()=>connectPortal().catch(e=>{$('portalQrExportStatus').textContent='Kết nối lỗi: '+e.message}));
  });
  // Optional pure test hooks for local Node checks only.
  if(typeof module!=='undefined'&&module.exports)module.exports={emv,money,tag,crc};
})();
