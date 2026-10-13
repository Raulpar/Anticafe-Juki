(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY_CLIENTES = 'juki_ant cafe_clientes_v1';
  const KEY_TIEMPO = 'juki_anticafe_tiempo_v1';
  const KEY_BEBIDAS = 'juki_anticafe_bebidas_v1';
  const drinks = [
    {name:'Té', price:4}, {name:'Matecito', price:4}, {name:'Café', price:4}, {name:'Chocolate', price:4},
    {name:'Avatar', price:3}, {name:'Mango', price:3}, {name:'Personal', price:3}, {name:'Limonada', price:3}, {name:'Tamarindo', price:3}
  ];
  const rateForHours = hours => {
    if (hours <= 0) return 0;
    const rates = [0, 6, 10, 14, 17, 20];
    return hours <= 5 ? rates[hours] : 20 + (hours - 5) * 3;
  };
  let clientes = load(KEY_CLIENTES), tiempos = load(KEY_TIEMPO), bebidas = load(KEY_BEBIDAS);
  let lastCalculation = null, editingTimeId = null, extrasTouched = false;
  function load(key){ try { const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; } }
  function save(key, data){ try { localStorage.setItem(key, JSON.stringify(data)); } catch { alert('No se pudieron guardar los datos. Revisa el espacio disponible del navegador.'); } }
  function id(){ return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2); }
  function esc(v){return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function money(v){return `${Number(v||0).toFixed(2).replace(/\.00$/,'')} Bs`;}
  function localNow(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}
  function dateText(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('es-BO',{dateStyle:'short',timeStyle:'short'});}
  function hoursBetween(a,b){return Math.max(0,(new Date(b)-new Date(a))/3600000);}
  function billedHours(a,b){const elapsed=hoursBetween(a,b);return elapsed>0?Math.max(1,Math.floor(elapsed)):0;}
  // Calcula el precio total de la visita y descuenta la primera hora ya pagada al entrar.
  function billHours(a,b,personas=1,overrideHours=null,firstHourPaid=true){
    const elapsed=hoursBetween(a,b), minutes=Math.max(0,Math.round(elapsed*60));
    const completedHours=Math.floor(minutes/60);
    const fullHours=minutes>0?Math.max(1,completedHours):0;
    const hours=overrideHours===null?fullHours:Math.max(0,Math.floor(Number(overrideHours)||0));
    const leftover=minutes%60;
    const extraMinutesFee=(completedHours>=1&&leftover>0)?2:0;
    const people=Math.max(1,Math.floor(Number(personas)||1));
    const totalPerPerson=minutes>0 ? rateForHours(Math.max(1,hours))+extraMinutesFee : 0;
    const paidPerPerson=firstHourPaid?6:0;
    const duePerPerson=Math.max(0,totalPerPerson-paidPerPerson);
    return {elapsed,hours,fullHours,leftover,extraMinutesFee,personas:people,totalPerPerson,paidPerPerson,duePerPerson,perPerson:duePerPerson,amount:duePerPerson*people,totalAmount:totalPerPerson*people,paidAmount:paidPerPerson*people};
  }
  function fmtDuration(hours){if(!Number.isFinite(hours)||hours<0)return '—';const mins=Math.round(hours*60);return `${Math.floor(mins/60)} h ${mins%60} min`;}
  function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2600);}
  function pdfDoc(title){if(!window.jspdf?.jsPDF){alert('No se pudo cargar el generador de PDF. Comprueba tu conexión a internet e inténtalo otra vez.');return null;}const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'});doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('JUKI · DE NUESTRO ANTICAFÉ',14,17);doc.setFont('helvetica','normal');doc.setFontSize(13);doc.text(title,14,26);doc.setFontSize(9);doc.text(`Generado: ${new Date().toLocaleString('es-BO')}`,14,32);return doc;}
  function pdfTable(doc, headers, rows, widths){let y=41;const pageW=182,x0=14,w=widths||headers.map(()=>pageW/headers.length);function header(){doc.setFillColor(112,74,54);doc.setTextColor(255,255,255);let x=x0;headers.forEach((h,i)=>{doc.rect(x,y,w[i],8,'F');doc.text(String(h),x+2,y+5.2,{maxWidth:w[i]-4});x+=w[i];});y+=8;doc.setTextColor(45,41,38);}header();rows.forEach((row,ri)=>{const wrapped=row.map((v,i)=>doc.splitTextToSize(String(v??'—'),w[i]-4));const lines=Math.max(1,...wrapped.map(a=>a.length));const rh=Math.max(7,lines*4+2);if(y+rh>282){doc.addPage();y=16;header();}if(ri%2===0){doc.setFillColor(249,246,241);doc.rect(x0,y,pageW,rh,'F');}let x=x0;row.forEach((v,i)=>{doc.setDrawColor(230,222,213);doc.rect(x,y,w[i],rh);doc.text(wrapped[i],x+2,y+4.5);x+=w[i];});y+=rh;});return y;}
  function downloadPDF(doc,name){doc.save(name);}
  // Navegación entre módulos
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===btn));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===`panel-${btn.dataset.tab}`));if(btn.dataset.tab==='tiempo')refreshTimeClients();}));

  // Registro de clientes
  $('clienteEntrada').value=localNow();
  $('clienteForm').addEventListener('submit',e=>{
    e.preventDefault();const existingId=$('clienteId').value;
    const record={id:existingId||id(),nombre:$('clienteNombre').value.trim(),personas:Math.max(1,Number($('clientePersonas').value)||1),entrada:$('clienteEntrada').value,salida:$('clienteSalida').value||'',primeraPagada:$('clientePrimeraPagada').checked};
    if(!record.nombre){toast('Escribe el nombre del cliente.');return;}
    if(record.salida&&new Date(record.salida)<new Date(record.entrada)){toast('La salida no puede ser anterior a la entrada.');return;}
    const ix=clientes.findIndex(c=>c.id===record.id);if(ix>=0)clientes[ix]=record;else clientes.unshift(record);
    save(KEY_CLIENTES,clientes);resetCliente();renderClientes();refreshTimeClients();refreshDrinkClients();toast(ix>=0?'Cliente actualizado.':'Cliente guardado.');
  });
  function resetCliente(){$('clienteForm').reset();$('clienteId').value='';$('clientePersonas').value=1;$('clientePrimeraPagada').checked=true;$('clienteEntrada').value=localNow();$('guardarCliente').textContent='Guardar cliente';}
  $('cancelarCliente').addEventListener('click',resetCliente);$('buscarCliente').addEventListener('input',renderClientes);
  function renderClientes(){
    const q=$('buscarCliente').value.toLowerCase().trim(),list=clientes.filter(c=>c.nombre.toLowerCase().includes(q));
    $('clienteCount').textContent=`${clientes.length} registro${clientes.length===1?'':'s'}`;
    const tableRows=list.map(c=>{const b=c.salida?billHours(c.entrada,c.salida,c.personas,null,c.primeraPagada!==false):null;const drinkOrders=bebidas.filter(d=>d.clienteId===c.id);const drinkText=drinkOrders.map(d=>drinkDetails(d)).filter(t=>t!=='Sin bebidas').join(' · ')||'Sin pedido';const paid=c.primeraPagada!==false?6*c.personas:0;return `<tr><td><b>${esc(c.nombre)}</b></td><td>${c.personas}</td><td>${esc(dateText(c.entrada))}</td><td>${esc(dateText(c.salida))}</td><td>${b?fmtDuration(b.elapsed):'En curso'}</td><td>${money(paid)}</td><td>${b?money(b.amount):'Pendiente'}</td><td>${esc(drinkText)}</td><td><div class="actions"><button class="action-btn" data-edit-client="${esc(c.id)}">Editar</button>${c.salida?'':`<button class="action-btn" data-checkout="${esc(c.id)}">Salida ahora</button>`}<button class="action-btn danger" data-delete-client="${esc(c.id)}">Borrar</button></div></td></tr>`;});
    const total=clientes.reduce((sum,c)=>sum+(c.salida?billHours(c.entrada,c.salida,c.personas,null,c.primeraPagada!==false).amount:0),0);
    const paidTotal=clientes.reduce((sum,c)=>sum+(c.primeraPagada!==false?6*c.personas:0),0);
    tableRows.push(`<tr class="total-row"><td colspan="6"><b>TOTAL SALDO PENDIENTE (clientes con salida)</b></td><td><b>${money(total)}</b></td><td colspan="2"><b>Pagado al entrar: ${money(paidTotal)}</b></td></tr>`);
    if(!list.length)tableRows.unshift('<tr><td class="empty" colspan="9">Todavía no hay clientes registrados.</td></tr>');
    $('clientesTabla').innerHTML=tableRows.join('');
  }
  $('clientesTabla').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const c=clientes.find(x=>x.id===b.dataset.editClient||x.id===b.dataset.checkout||x.id===b.dataset.deleteClient);if(!c)return;
    if(b.dataset.editClient){$('clienteId').value=c.id;$('clienteNombre').value=c.nombre;$('clientePersonas').value=c.personas;$('clienteEntrada').value=c.entrada;$('clienteSalida').value=c.salida;$('clientePrimeraPagada').checked=c.primeraPagada!==false;$('guardarCliente').textContent='Guardar cambios';window.scrollTo({top:0,behavior:'smooth'});}
    else if(b.dataset.checkout){c.salida=localNow();save(KEY_CLIENTES,clientes);renderClientes();refreshTimeClients();renderBebidas();toast('Hora de salida guardada.');}
    else if(b.dataset.deleteClient&&confirm(`¿Borrar el registro de ${c.nombre}?`)){clientes=clientes.filter(x=>x.id!==c.id);save(KEY_CLIENTES,clientes);renderClientes();refreshTimeClients();refreshDrinkClients();renderBebidas();toast('Registro borrado.');}
  });
  $('exportClientes').addEventListener('click',()=>{if(!clientes.length){toast('No hay clientes para exportar.');return;}const doc=pdfDoc('Registro de clientes y saldos');if(!doc)return;const rows=clientes.map(c=>{const b=c.salida?billHours(c.entrada,c.salida,c.personas,null,c.primeraPagada!==false):null;return [c.nombre,c.personas,dateText(c.entrada),dateText(c.salida),b?fmtDuration(b.elapsed):'En curso',money(c.primeraPagada!==false?6*c.personas:0),b?money(b.amount):'Pendiente'];});const total=clientes.reduce((sum,c)=>sum+(c.salida?billHours(c.entrada,c.salida,c.personas,null,c.primeraPagada!==false).amount:0),0);rows.push(['TOTAL SALDO PENDIENTE','','','','','',money(total)]);pdfTable(doc,['Cliente','Pers.','Entrada','Salida','Tiempo','Pagado','Saldo'],rows,[38,14,30,30,25,22,23]);downloadPDF(doc,'JUKI_registro_clientes.pdf');});

  // Calculadora de tiempo y tarifas escalonadas
  function refreshTimeClients(){const current=$('tiempoCliente').value;$('tiempoCliente').innerHTML='<option value="">Cliente manual / sin vincular</option>'+clientes.map(c=>`<option value="${esc(c.id)}">${esc(c.nombre)} (${c.personas} pers.)</option>`).join('');if(clientes.some(c=>c.id===current))$('tiempoCliente').value=current;}
  function suggestExtras(){const a=$('tiempoEntrada').value,b=$('tiempoSalida').value;if(a&&b&&new Date(b)>=new Date(a)&&!extrasTouched)$('tiempoExtras').value=Math.max(0,billedHours(a,b)-1);}
  $('tiempoCliente').addEventListener('change',()=>{const c=clientes.find(x=>x.id===$('tiempoCliente').value);if(c){$('tiempoEntrada').value=c.entrada;$('tiempoSalida').value=c.salida||localNow();$('tiempoPersonas').value=c.personas;extrasTouched=false;suggestExtras();}});
  ['tiempoEntrada','tiempoSalida'].forEach(k=>$(k).addEventListener('change',suggestExtras));
  $('tiempoExtras').addEventListener('input',()=>{extrasTouched=true;});
  $('tiempoForm').addEventListener('submit',e=>{
    e.preventDefault();const start=$('tiempoEntrada').value,end=$('tiempoSalida').value;
    if(!start||!end||new Date(end)<new Date(start)){toast('Revisa las horas de entrada y salida.');return;}
    const elapsed=hoursBetween(start,end),naturalExtra=Math.max(0,Math.floor(elapsed)-1),extra=Math.max(0,Math.floor(Number($('tiempoExtras').value)||0)),hours=elapsed===0?0:1+extra;
    const chosen=clientes.find(c=>c.id===$('tiempoCliente').value),personas=Math.max(1,Number($('tiempoPersonas').value)||1),bill=billHours(start,end,personas,hours,chosen?chosen.primeraPagada!==false:true);
    lastCalculation={id:editingTimeId||id(),clienteId:$('tiempoCliente').value,nombre:chosen?.nombre||'Cliente manual',entrada:start,salida:end,personas,horasTranscurridas:elapsed,horasExtra:extra,horasSugeridas:naturalExtra,horasCobradas:hours,recargoMinutos:bill.extraMinutesFee,importe:bill.amount,totalImporte:bill.totalAmount,pagadoEntrada:bill.paidAmount};
    $('importeTiempo').textContent=money(lastCalculation.importe);
    $('detalleTiempo').textContent=`Tiempo real: ${fmtDuration(elapsed)} · Tarifa total: ${money(bill.totalAmount)} · Ya pagado al entrar: ${money(bill.paidAmount)} · Saldo adicional a cobrar: ${money(bill.amount)} · Personas: ${lastCalculation.personas}. ${extra!==naturalExtra?'Horas extra ajustadas manualmente.':''}`;
    $('guardarCalculo').disabled=false;$('pdfCalculo').disabled=false;
  });
  $('limpiarTiempo').addEventListener('click',()=>{resetTimeForm();});
  function resetTimeForm(){$('tiempoForm').reset();$('tiempoPersonas').value=1;$('tiempoExtras').value=0;extrasTouched=false;editingTimeId=null;$('importeTiempo').textContent='0 Bs';$('detalleTiempo').textContent='Completa las horas para calcular.';$('guardarCalculo').disabled=true;$('pdfCalculo').disabled=true;$('guardarCalculo').textContent='Guardar cálculo';lastCalculation=null;}
  $('guardarCalculo').addEventListener('click',()=>{if(!lastCalculation)return;const ix=tiempos.findIndex(t=>t.id===lastCalculation.id);if(ix>=0)tiempos[ix]={...lastCalculation};else tiempos.unshift({...lastCalculation});save(KEY_TIEMPO,tiempos);renderTiempos();toast(ix>=0?'Cálculo actualizado.':'Cálculo guardado.');resetTimeForm();});
  $('pdfCalculo').addEventListener('click',()=>{if(!lastCalculation)return;const t=lastCalculation,doc=pdfDoc('Detalle de cálculo de tiempo');if(!doc)return;pdfTable(doc,['Dato','Detalle'],[['Cliente',t.nombre],['Entrada',dateText(t.entrada)],['Salida',dateText(t.salida)],['Personas',t.personas],['Tiempo transcurrido',fmtDuration(t.horasTranscurridas)],['Horas extra',t.horasExtra],['Horas cobradas',t.horasCobradas],['Recargo por minutos (por persona)',money(t.recargoMinutos||0)],['Tarifa total de la visita',money(t.totalImporte??t.importe)],['Pagado al entrar',money(t.pagadoEntrada||0)],['Saldo adicional',money(t.importe)],['Tarifario por persona','1 h 6 Bs · 2 h 10 Bs · 3 h 14 Bs · 4 h 17 Bs · 5 h 20 Bs · desde 6 h +3 Bs/h · minutos sobrantes después de la primera hora: +2 Bs por persona'],['Nota','El importe se multiplica por la cantidad de personas']], [60,122]);downloadPDF(doc,'JUKI_calculo_tiempo.pdf');});
  $('exportTiempo').addEventListener('click',()=>{if(!tiempos.length){toast('No hay cálculos guardados.');return;}const doc=pdfDoc('Cálculos de tiempo');if(!doc)return;pdfTable(doc,['Cliente','Entrada','Salida','Personas','Horas','Importe'],[...tiempos.map(t=>[t.nombre,dateText(t.entrada),dateText(t.salida),t.personas,t.horasCobradas??(1+(t.horasExtra||0)),money(t.importe)]),['TOTAL','','','', '',money(tiempos.reduce((s,t)=>s+(Number(t.importe)||0),0))]],[38,34,34,20,22,28]);downloadPDF(doc,'JUKI_calculos_tiempo.pdf');});
  function renderTiempos(){const rows=tiempos.map(t=>`<tr><td>${esc(t.nombre)}</td><td>${esc(dateText(t.entrada))}</td><td>${esc(dateText(t.salida))}</td><td>${t.personas}</td><td>${t.horasExtra}</td><td><b>${money(t.importe)}</b></td><td><div class="actions"><button class="action-btn" data-edit-time="${esc(t.id)}">Editar</button><button class="action-btn danger" data-delete-time="${esc(t.id)}">Borrar</button></div></td></tr>`);if(!rows.length)rows.push('<tr><td class="empty" colspan="7">Todavía no hay cálculos guardados.</td></tr>');const total=tiempos.reduce((sum,t)=>sum+(Number(t.importe)||0),0);rows.push(`<tr class="total-row"><td colspan="5"><b>TOTAL DE CÁLCULOS GUARDADOS</b></td><td><b>${money(total)}</b></td><td></td></tr>`);$('tiempoTabla').innerHTML=rows.join('');}
  $('tiempoTabla').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const t=tiempos.find(x=>x.id===b.dataset.editTime||x.id===b.dataset.deleteTime);if(!t)return;
    if(b.dataset.editTime){editingTimeId=t.id;refreshTimeClients();$('tiempoCliente').value=t.clienteId||'';$('tiempoEntrada').value=t.entrada;$('tiempoSalida').value=t.salida;$('tiempoPersonas').value=t.personas;$('tiempoExtras').value=t.horasExtra;extrasTouched=true;$('guardarCalculo').textContent='Guardar cambios';$('tiempoForm').requestSubmit();toast('Edita los campos y pulsa Guardar cambios.');window.scrollTo({top:0,behavior:'smooth'});}
    else if(b.dataset.deleteTime&&confirm('¿Borrar este cálculo?')){tiempos=tiempos.filter(x=>x.id!==t.id);save(KEY_TIEMPO,tiempos);renderTiempos();toast('Cálculo borrado.');}
  });

  // Registro de bebidas pagadas y de cortesía
  function refreshDrinkClients(){const select=$('bebidaClienteSelect');const current=select.value;select.innerHTML='<option value="">Cliente manual / sin vincular</option>'+clientes.map(c=>`<option value="${esc(c.id)}">${esc(c.nombre)} · ${c.personas} pers.</option>`).join('');if(clientes.some(c=>c.id===current))select.value=current;}
  $('bebidaClienteSelect').addEventListener('change',()=>{const c=clientes.find(x=>x.id===$('bebidaClienteSelect').value);if(c)$('bebidaCliente').value=c.nombre;});
  $('drinkGrid').innerHTML=drinks.map((d,i)=>`<div class="drink-item drink-item-expanded"><div class="drink-title"><b>${d.name}</b><small>${d.price} Bs si se cobra</small></div><label class="qty-label" for="drinkPaid${i}">Pagadas<input id="drinkPaid${i}" data-paid-index="${i}" type="number" min="0" step="1" value="0" aria-label="Cantidad pagada de ${d.name}"></label><label class="qty-label courtesy-label" for="drinkCourtesy${i}">Cortesía<input id="drinkCourtesy${i}" data-courtesy-index="${i}" type="number" min="0" step="1" value="0" aria-label="Cantidad de cortesía de ${d.name}"></label></div>`).join('');
  function paidCountsFromRecord(record){return drinks.map((d,i)=>Math.max(0,Math.floor(Number(record.cantidades?.[i])||0)));}
  function courtesyCountsFromRecord(record){return drinks.map((d,i)=>Math.max(0,Math.floor(Number(record.cortesias?.[i])||0)));}
  function getPaidCounts(){return drinks.map((d,i)=>Math.max(0,Math.floor(Number($(`drinkPaid${i}`).value)||0)));}
  function getCourtesyCounts(){return drinks.map((d,i)=>Math.max(0,Math.floor(Number($(`drinkCourtesy${i}`).value)||0)));}
  function drinkTotal(paid=getPaidCounts()){return drinks.reduce((sum,d,i)=>sum+(paid[i]||0)*d.price,0);}
  function courtesyCount(courtesy=getCourtesyCounts()){return courtesy.reduce((sum,q)=>sum+q,0);}
  function drinkDetails(record){const paid=paidCountsFromRecord(record),courtesy=courtesyCountsFromRecord(record);return drinks.map((d,i)=>{const parts=[];if(paid[i])parts.push(`${d.name} pagadas × ${paid[i]}`);if(courtesy[i])parts.push(`${d.name} cortesía × ${courtesy[i]}`);return parts.join('; ');}).filter(Boolean).join(', ')||'Sin bebidas';}
  function updateDrinkPreview(){$('bebidaTotalPreview').textContent=money(drinkTotal());$('bebidaCortesiasPreview').textContent=`${courtesyCount()} bebida${courtesyCount()===1?'':'s'} de cortesía (sin cargo)`;}
  $('drinkGrid').addEventListener('input',updateDrinkPreview);$('bebidaFecha').value=localNow();
  $('bebidaForm').addEventListener('submit',e=>{
    e.preventDefault();const cantidades=getPaidCounts(),cortesias=getCourtesyCounts();
    if(!cantidades.some(n=>n>0)&&!cortesias.some(n=>n>0)){toast('Añade al menos una bebida pagada o de cortesía.');return;}
    const existingId=$('bebidaId').value,record={id:existingId||id(),clienteId:$('bebidaClienteSelect').value||'',cliente:$('bebidaCliente').value.trim(),fecha:$('bebidaFecha').value,cantidades,cortesias,total:drinkTotal(cantidades)};
    if(!record.cliente){toast('Escribe el nombre del cliente o grupo.');return;}
    const ix=bebidas.findIndex(x=>x.id===record.id);if(ix>=0)bebidas[ix]=record;else bebidas.unshift(record);save(KEY_BEBIDAS,bebidas);resetBebida();renderBebidas();renderClientes();toast(ix>=0?'Registro de bebidas actualizado.':'Bebidas guardadas.');
  });
  function resetBebida(){$('bebidaForm').reset();$('bebidaId').value='';$('bebidaClienteSelect').value='';$('bebidaFecha').value=localNow();drinks.forEach((d,i)=>{$(`drinkPaid${i}`).value=0;$(`drinkCourtesy${i}`).value=0;});updateDrinkPreview();$('guardarBebida').textContent='Guardar bebidas';}
  $('cancelarBebida').addEventListener('click',resetBebida);$('buscarBebida').addEventListener('input',renderBebidas);
  function renderBebidas(){const q=$('buscarBebida').value.toLowerCase().trim(),list=bebidas.filter(b=>b.cliente.toLowerCase().includes(q));$('bebidaCount').textContent=`${bebidas.length} registro${bebidas.length===1?'':'s'}`;$('bebidasTabla').innerHTML=list.length?list.map(b=>`<tr><td><b>${esc(b.cliente)}</b></td><td>${esc(dateText(b.fecha))}</td><td>${esc(drinkDetails(b))}</td><td><b>${money(b.total)}</b></td><td><div class="actions"><button class="action-btn" data-edit-drink="${esc(b.id)}">Editar</button><button class="action-btn danger" data-delete-drink="${esc(b.id)}">Borrar</button></div></td></tr>`).join(''):'<tr><td class="empty" colspan="5">Todavía no hay bebidas registradas.</td></tr>';}
  $('bebidasTabla').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const record=bebidas.find(x=>x.id===b.dataset.editDrink||x.id===b.dataset.deleteDrink);if(!record)return;
    if(b.dataset.editDrink){$('bebidaId').value=record.id;refreshDrinkClients();$('bebidaClienteSelect').value=record.clienteId||'';$('bebidaCliente').value=record.cliente;$('bebidaFecha').value=record.fecha;const paid=paidCountsFromRecord(record),courtesy=courtesyCountsFromRecord(record);drinks.forEach((d,i)=>{$(`drinkPaid${i}`).value=paid[i];$(`drinkCourtesy${i}`).value=courtesy[i];});updateDrinkPreview();$('guardarBebida').textContent='Guardar cambios';window.scrollTo({top:0,behavior:'smooth'});}
    else if(b.dataset.deleteDrink&&confirm(`¿Borrar las bebidas de ${record.cliente}?`)){bebidas=bebidas.filter(x=>x.id!==record.id);save(KEY_BEBIDAS,bebidas);renderBebidas();renderClientes();toast('Registro de bebidas borrado.');}
  });
  $('exportBebidas').addEventListener('click',()=>{if(!bebidas.length){toast('No hay bebidas para exportar.');return;}const doc=pdfDoc('Registro de bebidas pagadas y de cortesía');if(!doc)return;const rows=bebidas.map(b=>[b.cliente,dateText(b.fecha),drinkDetails(b),money(b.total),courtesyCount(courtesyCountsFromRecord(b))]);const y=pdfTable(doc,['Cliente','Fecha','Detalle de bebidas','Total pagado','Cortesías'],rows,[32,30,76,26,18]);if(y<275){doc.setFont('helvetica','bold');doc.text(`TOTAL PAGADO: ${money(bebidas.reduce((s,b)=>s+(Number(b.total)||0),0))}`,14,y+10);doc.text(`TOTAL DE CORTESÍAS: ${bebidas.reduce((s,b)=>s+courtesyCount(courtesyCountsFromRecord(b)),0)}`,14,y+16);}downloadPDF(doc,'JUKI_registro_bebidas.pdf');});

  // Inicialización
  renderClientes();refreshTimeClients();refreshDrinkClients();renderTiempos();renderBebidas();updateDrinkPreview();
})();
