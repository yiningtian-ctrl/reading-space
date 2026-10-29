// Fixed TLS destination and fixed message template. No untrusted SMTP commands/headers.
export async function sendVerificationMail(password,{to,code,purpose},connector,from){
 if(!password||typeof from!=='string'||!/^[a-z0-9_.+-]+@163\.com$/i.test(from)||!/^\d{6}$/.test(code)||!to||/[\r\n<>]/.test(to))throw new Error('Mail configuration/input invalid');
 const connect=connector||(await import('cloudflare:sockets')).connect;
 const socket=connect({hostname:'smtp.163.com',port:465},{secureTransport:'on'});
 socket.closed.catch(()=>{});
 const reader=socket.readable.getReader(),writer=socket.writable.getWriter(),encoder=new TextEncoder(),decoder=new TextDecoder();let buffer='';
 const timeout=setTimeout(()=>{void socket.close().catch(()=>{});},15000);
 async function response(expected){let bytes=0;while(true){const end=buffer.indexOf('\r\n');if(end<0){const v=await reader.read();if(v.done)throw new Error('SMTP closed');bytes+=v.value.length;if(bytes>16384)throw new Error('SMTP response too large');buffer+=decoder.decode(v.value,{stream:true});continue;}const line=buffer.slice(0,end);buffer=buffer.slice(end+2);if(!/^\d{3}[- ]/.test(line))throw new Error('SMTP protocol');if(line[3]==='-')continue;if(!expected.includes(Number(line.slice(0,3))))throw new Error('SMTP rejected');return;}}
 async function command(value,expected){await writer.write(encoder.encode(value+'\r\n'));await response(expected);}
 try{
  await socket.opened;await response([220]);await command('EHLO reading-space-a42.pages.dev',[250]);await command('AUTH LOGIN',[334]);await command(btoa(from),[334]);await command(btoa(password),[235]);
  await command(`MAIL FROM:<${from}>`,[250]);await command(`RCPT TO:<${to}>`,[250,251]);await command('DATA',[354]);
  const action=purpose==='register'?'注册':purpose==='bind'?'绑定邮箱':'登录';
  const content=`ReadSpace ${action}验证码：${code}\n\n有效期 10 分钟，仅限本次操作。请勿向他人提供验证码。\n如果不是你本人操作，请忽略此邮件。`;
  const encoded=btoa(String.fromCharCode(...encoder.encode(content))).match(/.{1,76}/g).join('\r\n');
  await command(`From: ReadSpace <${from}>\r\nTo: <${to}>\r\nDate: ${new Date().toUTCString()}\r\nMessage-ID: <${crypto.randomUUID()}@163.com>\r\nSubject: ReadSpace verification code\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${encoded}\r\n.`,[250]);
  // Delivery is accepted after DATA, even if the optional QUIT response is lost.
 }finally{clearTimeout(timeout);reader.releaseLock();writer.releaseLock();await socket.close().catch(()=>{});}
}
