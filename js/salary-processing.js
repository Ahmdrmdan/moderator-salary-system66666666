'use strict';

/* Snapshot-only review, approval, and payment layer. */
const SalaryProcessing = (() => {
  const collection='salary_processing', $=id=>document.getElementById(id); let snapshot=null, periodId=null, drawerId=null, charts=[];
  const val=(row,keys)=>Number(keys.map(k=>row[k]).find(v=>v!==undefined)||0), money=v=>Utils.formatCurrency(v||0), name=row=>row.name||row.moderatorName||'—', employeeId=row=>row.moderatorId||row.employeeId||name(row);
  // Snapshot rows use the monthly-report schema. This adapter only maps the
  // stored figures for display; it never recalculates salary or net pay.
  function financial(row,manualEntry={}){
    const hasMonthlyFields=row.totalAdjustments!==undefined||row.totalAdvances!==undefined||row.previousDebt!==undefined;
    const monthlyAdjustment=hasMonthlyFields?val(row,['totalAdjustments']):val(row,['additions','adjustments']);
    const reportAdditions=hasMonthlyFields?Math.max(monthlyAdjustment,0):monthlyAdjustment;
    const reportDeductions=hasMonthlyFields
      ?Math.max(-monthlyAdjustment,0)+val(row,['totalAdvances','advances'])+val(row,['previousDebt'])
      :val(row,['deductions','totalDeductions']);
    const manualAddition=Number(manualEntry.addition||0),manualDeduction=Number(manualEntry.deduction||0);
    const storedBonus=val(row,['bonus','totalBonus']);
    const hasCommissionField=row.commission!==undefined||row.totalCommission!==undefined;
    const commission=hasCommissionField?val(row,['commission','totalCommission']):(row.salaryType==='commission'?storedBonus:0);
    return {
      salary:val(row,['baseSalary','salary']), bonus:hasCommissionField||row.salaryType!=='commission'?storedBonus:0,
      commission,
      additions:reportAdditions+manualAddition, deductions:reportDeductions+manualDeduction,
      net:val(row,['netSalary','netPay','finalSalary'])+manualAddition-manualDeduction
    };
  }
  function aggregate(rows, manual={}){
    const totals={employees:rows.length,salary:0,bonus:0,commission:0,deductions:0,additions:0,net:0},depts=new Map();
    rows.forEach(row=>{const f=financial(row,manual[employeeId(row)]||{});Object.assign(totals,{salary:totals.salary+f.salary,bonus:totals.bonus+f.bonus,commission:totals.commission+f.commission,deductions:totals.deductions+f.deductions,additions:totals.additions+f.additions,net:totals.net+f.net});const key=row.departmentName||row.departmentId||'غير محدد',d=depts.get(key)||{name:key,employees:0,salary:0,bonus:0,commission:0,sales:0,orders:0};d.employees++;d.salary+=f.salary;d.bonus+=f.bonus;d.commission+=f.commission;d.sales+=val(row,['totalSales','sales']);d.orders+=val(row,['ordersCount','orders']);depts.set(key,d);});
    return{totals,depts:Array.from(depts.values())};
  }
  function card(label,value){return `<button type="button" class="stat-card" data-salary-drill="${label}"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></button>`;}
  function drawSnapshotChart(canvasId, emptyId, labels, values, label, onDrill) {
    const canvas=$(canvasId), empty=$(emptyId); if(!canvas||!empty)return;
    const old=charts.find(c=>c.canvas&&c.canvas.id===canvasId); if(old){old.destroy();charts=charts.filter(c=>c!==old);}
    const valid=labels.length && values.some(value=>Number(value)!==0); canvas.classList.toggle('hidden',!valid); empty.classList.toggle('hidden',valid);
    if(!valid)return;
    if(typeof Chart==='undefined'){ canvas.classList.add('hidden'); empty.textContent='لا توجد بيانات متاحة بعد'; empty.classList.remove('hidden'); return; }
    const chart=new Chart(canvas,{type:'bar',data:{labels,datasets:[{label,data:values,backgroundColor:'#73a7ff',borderRadius:6}]},options:{responsive:true,onClick:(event,elements)=>{const item=elements&&elements[0];if(item&&typeof onDrill==='function')onDrill(labels[item.index]);},plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}}); charts=charts.filter(c=>!(c.canvas&&c.canvas.id===canvasId)); charts.push(chart);
  }
  function renderSnapshotCharts(rows, summary) {
    const departments=summary.depts||[];
    drawSnapshotChart('salaryChartDepartments','salaryChartDepartmentsEmpty',departments.map(d=>d.name),departments.map(d=>d.salary),'الرواتب',label=>drillChartGroup('department',label,['baseSalary','salary'],'الرواتب'));
    drawSnapshotChart('salaryChartBonus','salaryChartBonusEmpty',departments.map(d=>d.name),departments.map(d=>d.bonus),'البونص',label=>drillChartGroup('department',label,['bonus','totalBonus'],'البونص'));
    drawSnapshotChart('salaryChartCommission','salaryChartCommissionEmpty',departments.map(d=>d.name),departments.map(d=>d.commission),'العمولات',label=>drillChartGroup('department',label,['commission','totalCommission'],'العمولات'));
    const types=new Map(); rows.forEach(row=>{const key=row.salaryType||'غير محدد';types.set(key,(types.get(key)||0)+1);});
    drawSnapshotChart('salaryChartTypes','salaryChartTypesEmpty',Array.from(types.keys()),Array.from(types.values()),'الموظفون',label=>drillChartGroup('salaryType',label,null,'الموظفون'));
    drawSnapshotChart('salaryChartHeadcount','salaryChartHeadcountEmpty',departments.map(d=>d.name),departments.map(d=>d.employees),'الموظفون',label=>drillChartGroup('department',label,null,'الموظفون'));
  }  function drillKpi(label) {
    const map={'إجمالي الرواتب':['baseSalary','salary'],'إجمالي البونص':['bonus','totalBonus'],'إجمالي العمولات':['commission','totalCommission'],'إجمالي الخصومات':['deductions','totalDeductions'],'إجمالي الإضافات':['additions','adjustments'],'صافي المستحقات':['netSalary','netPay','finalSalary']};
    const manual=snapshot?.employeeManualEntries||{},employeeCount=label==='عدد الموظفين', keys=map[label]; if(!employeeCount&&!keys)return; const value=row=>{const f=financial(row,manual[employeeId(row)]||{});if(label==='إجمالي الإضافات')return f.additions;if(label==='إجمالي الخصومات')return f.deductions;if(label==='صافي المستحقات')return f.net;return val(row,keys);}; const rows=employeeCount?(snapshot?.report||[]):(snapshot?.report||[]).filter(row=>value(row)!==0);
    $('salaryDrawerTitle').textContent=label;
    $('salaryDrawerBody').innerHTML=rows.length ? `<div class="table-wrap"><table><thead><tr><th>الموظف</th><th>القسم</th><th>القيمة</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${Utils.escapeHtml(name(row))}</td><td>${Utils.escapeHtml(row.departmentName||'—')}</td><td>${employeeCount?1:money(value(row))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="widget-empty">لا توجد بيانات متاحة بعد</div>';
    $('salaryEmployeeDrawer').classList.add('open');
  }  function drillDepartment(departmentName){
    const rows=(snapshot?.report||[]).filter(row=>(row.departmentName||row.departmentId||'غير محدد')===departmentName), manual=snapshot?.employeeManualEntries||{};
    const totals=rows.reduce((sum,row)=>{const f=financial(row,manual[employeeId(row)]||{});sum.salary+=f.salary;sum.bonus+=f.bonus;sum.commission+=f.commission;sum.additions+=f.additions;sum.deductions+=f.deductions;sum.net+=f.net;return sum;},{salary:0,bonus:0,commission:0,additions:0,deductions:0,net:0});
    $('salaryDrawerTitle').textContent=departmentName;
    $('salaryDrawerBody').innerHTML=`<section class="details-grid"><div>عدد الموظفين: ${rows.length}</div><div>إجمالي الرواتب: ${money(totals.salary)}</div><div>إجمالي البونص: ${money(totals.bonus)}</div><div>إجمالي العمولات: ${money(totals.commission)}</div><div>إجمالي الخصومات: ${money(totals.deductions)}</div><div>إجمالي الإضافات: ${money(totals.additions)}</div><div>صافي المستحقات: ${money(totals.net)}</div></section>${rows.length?`<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الوظيفة</th><th>الراتب الأساسي</th><th>البونص</th><th>العمولة</th><th>الإضافات</th><th>الخصومات</th><th>الصافي النهائي</th></tr></thead><tbody>${rows.map(row=>{const f=financial(row,manual[employeeId(row)]||{});return `<tr><td>${Utils.escapeHtml(name(row))}</td><td>${Utils.escapeHtml(row.jobTitle||row.position||row.role||'—')}</td><td>${money(f.salary)}</td><td>${money(f.bonus)}</td><td>${money(f.commission)}</td><td>${money(f.additions)}</td><td>${money(f.deductions)}</td><td>${money(f.net)}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="widget-empty">لا توجد بيانات متاحة بعد</div>'}`;
    $('salaryEmployeeDrawer').classList.add('open');
  }  function drillChartGroup(group,label,metricKeys,title){
    let rows=(snapshot?.report||[]).filter(row=>group==='department'?(row.departmentName||row.departmentId||'غير محدد')===label:(row.salaryType||'غير محدد')===label);
    if(metricKeys)rows=rows.filter(row=>val(row,metricKeys)!==0);
    $('salaryDrawerTitle').textContent=`${title}: ${label}`;
    const table=rows.length?`<div class="table-wrap"><table><thead><tr><th>الموظف</th><th>القسم</th><th>نوع الراتب</th>${metricKeys?'<th>القيمة</th>':''}</tr></thead><tbody>${rows.map(row=>`<tr><td>${Utils.escapeHtml(name(row))}</td><td>${Utils.escapeHtml(row.departmentName||row.departmentId||'—')}</td><td>${Utils.escapeHtml(row.salaryType||'—')}</td>${metricKeys?`<td>${money(val(row,metricKeys))}</td>`:''}</tr>`).join('')}</tbody></table></div>`:'<div class="widget-empty">لا توجد بيانات متاحة بعد</div>';
    $('salaryDrawerBody').innerHTML=table;
    $('salaryEmployeeDrawer').classList.add('open');
  }  function renderRanking(rows,manual){
    const metric=$('salaryRankingMetric')?.value||'net', direction=$('salaryRankingDirection')?.value||'desc';
    const config={net:{label:'صافي المستحق',keys:['netSalary','netPay','finalSalary'],currency:true},sales:{label:'إجمالي المبيعات',keys:['totalSales','sales'],currency:true},orders:{label:'عدد الطلبات',keys:['ordersCount','orders'],currency:false},packages:{label:'عدد العبوات',keys:['totalPackages','packages'],currency:false},bonus:{label:'قيمة البونص',keys:['bonus','totalBonus'],currency:true},commission:{label:'قيمة العمولة',keys:['commission','totalCommission'],currency:true}}[metric];
    if(!config)return; const value=row=>{const base=val(row,config.keys),m=manual[employeeId(row)]||{};return metric==='net'?base+Number(m.addition||0)-Number(m.deduction||0):base;};
    const sorted=rows.slice().sort((left,right)=>(value(right)-value(left))*(direction==='asc'?-1:1));
    const body=$('salaryRankingBody'),head=$('salaryRankingValueHeader'); if(!body||!head)return; head.textContent=config.label;
    body.innerHTML=sorted.length?sorted.map((row,index)=>`<tr data-details="${Utils.escapeHtml(employeeId(row))}" tabindex="0"><td>${index+1}</td><td>${Utils.escapeHtml(name(row))}</td><td>${Utils.escapeHtml(row.departmentName||row.departmentId||'—')}</td><td>${Utils.escapeHtml(row.salaryType||'—')}</td><td>${config.currency?money(value(row)):value(row)}</td></tr>`).join(''):'<tr><td colspan="5"><div class="widget-empty">لا توجد بيانات متاحة بعد</div></td></tr>';
  }  function render(){
    const panel=$('salarySnapshotDashboard');if(!snapshot){panel.classList.add('hidden');return;}
    const rows=snapshot.report||[],payments=snapshot.employeePayments||{},manual=snapshot.employeeManualEntries||{},a=aggregate(rows,manual);
    const canWrite=Permissions.can('salary_processing.write'),canPay=Permissions.can('salary_processing.pay'),canExport=Permissions.can('salary_processing.export');
    panel.classList.remove('hidden');renderSnapshotCharts(rows,a);renderRanking(rows,manual);
    $('salaryWorkflow').innerHTML=['① اختيار الفترة','② إنشاء التقرير','③ مراجعة الرواتب','④ اعتماد التقرير','⑤ صرف الرواتب','⑥ أرشفة التقرير'].map((x,i)=>`<span class="${snapshot.status==='approved'?(i<4?'done':''):''} ${snapshot.status==='paid'&&i<5?'done':''}">${x}</span>`).join('');
    $('salaryExecutiveSummary').innerHTML=[['عدد الموظفين',a.totals.employees],['إجمالي الرواتب',money(a.totals.salary)],['إجمالي البونص',money(a.totals.bonus)],['إجمالي العمولات',money(a.totals.commission)],['إجمالي الخصومات',money(a.totals.deductions)],['إجمالي الإضافات',money(a.totals.additions)],['صافي المستحقات',money(a.totals.net)]].map(([l,v])=>card(l,v)).join('');
    const high=(keys)=>rows.slice().sort((x,y)=>val(y,keys)-val(x,keys))[0];
    $('salaryKpis').innerHTML=[['أعلى راتب',['baseSalary','salary']],['أعلى بونص',['bonus','totalBonus']],['أعلى عمولة',['commission','totalCommission']],['أعلى مبيعات',['totalSales','sales']],['أعلى عدد طلبات',['ordersCount','orders']],['أعلى عدد عبوات',['totalPackages','packages']]].map(([l,k])=>{const r=high(k);return `<div class="dashboard-insight"><div><span class="dashboard-insight-label">${l}</span><span class="dashboard-insight-name">${r?Utils.escapeHtml(name(r)):'لا توجد بيانات متاحة بعد'}</span></div><span class="dashboard-insight-value">${r?money(val(r,k)):'—'}</span></div>`;}).join('');
    $('salaryDepartmentSummary').innerHTML=a.depts.length?a.depts.map(d=>`<button type="button" class="dashboard-insight" data-salary-department="${Utils.escapeHtml(d.name)}"><div><span class="dashboard-insight-label">${Utils.escapeHtml(d.name)}</span><span class="dashboard-insight-name">${d.employees} موظف · ${d.orders} طلب</span></div><span class="dashboard-insight-value">${money(d.salary+d.bonus+d.commission)}</span></button>`).join(''):'لا توجد بيانات متاحة بعد';
    $('salarySnapshotRows').innerHTML=rows.map(row=>{const id=employeeId(row),f=financial(row,manual[id]||{});return `<tr><td>${Utils.escapeHtml(name(row))}</td><td>${Utils.escapeHtml(row.departmentName||'—')}</td><td>${money(f.salary)}</td><td>${money(f.bonus)}</td><td>${money(f.commission)}</td><td>${money(f.additions)}</td><td>${money(f.deductions)}</td><td>${money(f.net)}</td><td>${canWrite&&snapshot.status!=='paid'?`<button class="btn btn-sm" data-adjust="${Utils.escapeHtml(id)}">تعديل</button>`:''}<button class="btn btn-sm" data-details="${Utils.escapeHtml(id)}">التفاصيل</button></td></tr>`;}).join('');
    $('salaryPaymentBody').innerHTML=rows.map(row=>{const p=payments[employeeId(row)]||{},f=financial(row,manual[employeeId(row)]||{});return `<tr><td>${Utils.escapeHtml(name(row))}</td><td>${Utils.escapeHtml(row.departmentName||'—')}</td><td>${money(f.net)}</td><td>${p.status==='paid'?'تم الصرف':'بانتظار الصرف'}</td><td>${p.paidAt||'—'}</td><td>${p.paidBy||'—'}</td><td>${p.status==='paid'||!canPay||snapshot.status!=='approved'?'—':`<button class="btn btn-sm" data-pay="${Utils.escapeHtml(employeeId(row))}">تسجيل الصرف</button>`}</td></tr>`;}).join('');
    const markAll=$('salaryMarkAllPaidBtn'),excel=$('salarySnapshotExcelBtn'),print=$('salarySnapshotPrintBtn');
    if(markAll){markAll.hidden=!canPay||snapshot.status!=='approved';markAll.disabled=!canPay||snapshot.status!=='approved';}
    [excel,print].forEach(button=>{if(button){button.hidden=!canExport;button.disabled=!canExport;}});
  }
  async function load(){
    if(!Permissions.can('salary_processing.read')){snapshot=null;render();return;}
    periodId=typeof App.getSelectedMonthId==='function'?App.getSelectedMonthId():null;
    if(!periodId)return;
    const doc=await db.collection(collection).doc(periodId).get();
    snapshot=doc.exists?doc.data():null;
    const node=$('salaryProcessingStatus');
    if(node){const status=snapshot?.status||'draft';node.textContent=status==='paid'?'مكتمل الصرف':status==='approved'?'معتمد':'مسودة';node.className=`badge ${status==='draft'?'badge-locked':'badge-approved'}`;}
    render();
  }
  // The original snapshot UI predates the central permission service. Keep
  // these guards beside the financial writes so they cannot be bypassed by
  // a newly added button or a direct function call from the console.
  async function commitWithAudit(applyWrite,audit){
    const batch=db.batch();
    applyWrite(batch);
    AuditService.appendToBatch(batch,audit);
    await batch.commit();
  }
  async function approve(){
    Permissions.require('salary_processing.approve');
    const c=App.getSalaryProcessingContext();
    if(!c.monthId||!c.rows.length)return Toast.show('أنشئ التقرير أولاً قبل الاعتماد','error');
    const warnings=c.rows.filter(r=>val(r,['deductions','totalDeductions'])&&!r.deductionReason);
    if(warnings.length&&!confirm(`يوجد ${warnings.length} خصم بلا سبب. هل تريد المتابعة؟`))return;
    const ref=db.collection(collection).doc(c.monthId);
    const month=Months.byId(c.monthId)||{};
    const workflowContext={month,report:c.rows,salarySnapshot:snapshot};
    PayrollWorkflow.assertAction(PayrollWorkflow.ACTION.CREATE_SALARY_SNAPSHOT,workflowContext);
    // The current product makes a newly saved salary snapshot immediately
    // payable. Keep that established one-step behavior while recording both
    // logical milestones so a later UI can expose them without migrating
    // historical snapshots or changing a financial calculation.
    PayrollWorkflow.assertTransition(PayrollWorkflow.STATE.SALARY_SNAPSHOT_CREATED,PayrollWorkflow.STATE.READY_FOR_PAYMENT,{
      ...workflowContext,
      salarySnapshot:{status:'approved',report:c.rows}
    });
    const workflow=PayrollWorkflow.metadata(PayrollWorkflow.STATE.READY_FOR_PAYMENT);
    await commitWithAudit(batch=>batch.set(ref,{version:1,period:{type:'month',monthId:c.monthId},status:'approved',approvedAt:firebase.firestore.FieldValue.serverTimestamp(),approvedBy:auth.currentUser?.email||null,report:c.rows,totals:c.totals,employeeManualEntries:{},employeePayments:{},payment:{status:'unpaid',paidAt:null,paidBy:null},salarySnapshotCreatedAt:firebase.firestore.FieldValue.serverTimestamp(),readyForPaymentAt:firebase.firestore.FieldValue.serverTimestamp(),createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),...workflow},{merge:false}),{action:'salary_processing.approved',entity:'salary_processing',operation:AuditService.OPERATION.CREATE,documentId:c.monthId,documentLabel:`Payroll ${c.monthId}`,monthId:c.monthId,severity:AuditService.SEVERITY.WARNING,details:{period:c.monthId,status:'approved',employeeCount:c.rows.length,workflowTransitions:[PayrollWorkflow.STATE.SALARY_SNAPSHOT_CREATED,PayrollWorkflow.STATE.READY_FOR_PAYMENT]}});
    await load();Toast.show('تم اعتماد وحفظ Snapshot الرواتب','success');
  }
  async function pay(ids){
    Permissions.require('salary_processing.pay');
    if(!snapshot||!periodId)return;
    if(snapshot.status!=='approved')throw new Error('لا يمكن الصرف قبل اعتماد Snapshot الرواتب.');
    const payments={...(snapshot.employeePayments||{})},actor=auth.currentUser?.email||null,when=new Date().toLocaleString('ar-EG');
    ids.forEach(id=>payments[id]={status:'paid',paidAt:when,paidBy:actor});
    const all=(snapshot.report||[]).every(r=>payments[employeeId(r)]?.status==='paid');
    const ref=db.collection(collection).doc(periodId);
    if(all){
      PayrollWorkflow.assertAction(PayrollWorkflow.ACTION.PAY,{month:Months.byId(periodId)||{},salarySnapshot:{...snapshot,employeePayments:payments}});
    }
    const workflow=all?PayrollWorkflow.metadata(PayrollWorkflow.STATE.PAID):{};
    await commitWithAudit(batch=>batch.update(ref,{employeePayments:payments,status:all?'paid':'approved',updatedAt:firebase.firestore.FieldValue.serverTimestamp(),...workflow}),{action:'salary_processing.paid',entity:'salary_processing',operation:AuditService.OPERATION.UPDATE,documentId:periodId,documentLabel:`Payroll ${periodId}`,monthId:periodId,severity:AuditService.SEVERITY.INFO,details:{period:periodId,status:all?'paid':'approved',workflowState:all?PayrollWorkflow.STATE.PAID:PayrollWorkflow.STATE.READY_FOR_PAYMENT,paidEmployeeIds:ids}});
    await load();
  }
  async function adjust(id){
    Permissions.require('salary_processing.write');
    if(!snapshot||snapshot.status==='paid')return Toast.show('لا يمكن تعديل Snapshot مدفوع','error');
    const old=(snapshot.employeeManualEntries||{})[id]||{},addition=Number(prompt('قيمة الإضافة المالية',old.addition||0)),deduction=Number(prompt('قيمة الخصم المالي',old.deduction||0));
    if(!Number.isFinite(addition)||!Number.isFinite(deduction))return;
    const note=prompt('ملاحظات / سبب الإضافة أو الخصم',old.note||'')||'';
    const entries={...(snapshot.employeeManualEntries||{}),[id]:{addition,deduction,note,updatedAt:new Date().toISOString(),updatedBy:auth.currentUser?.email||null}};
    const ref=db.collection(collection).doc(periodId);
    await commitWithAudit(batch=>batch.update(ref,{employeeManualEntries:entries,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}),{action:'salary_processing.manual_adjusted',entity:'salary_processing',operation:AuditService.OPERATION.UPDATE,documentId:periodId,documentLabel:`Payroll ${periodId}`,monthId:periodId,severity:AuditService.SEVERITY.WARNING,details:{employeeId:id,previous:{addition:Number(old.addition||0),deduction:Number(old.deduction||0)},current:{addition,deduction},note}});
    await load();
  }
  function exportSnapshot(){
    Permissions.require('salary_processing.export');
    if(!snapshot)return;
    const manual=snapshot.employeeManualEntries||{};
    const rows=(snapshot.report||[]).map(r=>{const adjustment=manual[employeeId(r)]||{},addition=Number(adjustment.addition||0),deduction=Number(adjustment.deduction||0),net=val(r,['netSalary','netPay','finalSalary'])+addition-deduction;return {الموظف:name(r),القسم:r.departmentName||'',الراتب:val(r,['baseSalary','salary']),البونص:val(r,['bonus','totalBonus']),العمولة:val(r,['commission','totalCommission']),الإضافات_اليدوية:addition,الخصومات_اليدوية:deduction,الصافي_بعد_التعديل:net,ملاحظة_التعديل:adjustment.note||''};});
    if(typeof XLSX==='undefined')return Toast.show('Excel غير متاح','error');
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Salary Snapshot');XLSX.writeFile(wb,`salary-snapshot-${periodId}.xlsx`);
    AuditService.log('salary_processing.exported',{entity:'salary_processing',operation:AuditService.OPERATION.UPDATE,documentId:periodId,documentLabel:`Payroll ${periodId}`,monthId:periodId,details:{format:'xlsx',employeeCount:rows.length}}).catch(()=>{});
  }
  let initialized=false;
  function init(){if(initialized)return;initialized=true;$('salaryExecutiveSummary').addEventListener('click',e=>{const b=e.target.closest('[data-salary-drill]');if(b)drillKpi(b.dataset.salaryDrill);});$('salaryDepartmentSummary').addEventListener('click',e=>{const b=e.target.closest('[data-salary-department]');if(b)drillDepartment(b.dataset.salaryDepartment);});$('salaryRankingBody').addEventListener('click',e=>{const row=e.target.closest('[data-details]');if(row)details(row.dataset.details);});['salaryRankingMetric','salaryRankingDirection'].forEach(id=>$(id).addEventListener('change',()=>{if(snapshot)renderRanking(snapshot.report||[],snapshot.employeeManualEntries||{});}));$('salarySnapshotApproveBtn').addEventListener('click',()=>approve().catch(e=>Toast.show('تعذر الاعتماد: '+e.message,'error')));$('salaryMarkAllPaidBtn').addEventListener('click',()=>pay((snapshot?.report||[]).map(employeeId)).catch(e=>Toast.show('تعذر تسجيل الدفع: '+e.message,'error')));$('salaryPaymentBody').addEventListener('click',e=>{const b=e.target.closest('[data-pay]');if(b)pay([b.dataset.pay]).catch(err=>Toast.show('تعذر تسجيل الدفع: '+err.message,'error'));});$('salarySnapshotRows').addEventListener('click',e=>{const b=e.target.closest('[data-adjust]');if(b)adjust(b.dataset.adjust).catch(err=>Toast.show('تعذر التعديل: '+err.message,'error'));const d=e.target.closest('[data-details]');if(d)details(d.dataset.details);});$('salaryDrawerCloseBtn').addEventListener('click',()=>$('salaryEmployeeDrawer').classList.remove('open'));$('salaryDrawerTabs').addEventListener('click',e=>{const b=e.target.closest('[data-salary-tab]');if(b&&drawerId)details(drawerId,b.dataset.salaryTab);});$('salarySnapshotExcelBtn').addEventListener('click',()=>{try{exportSnapshot();}catch(err){Toast.show('تعذر التصدير: '+err.message,'error');}});$('salarySnapshotPrintBtn').addEventListener('click',()=>{try{Permissions.require('salary_processing.export');window.print();}catch(err){Toast.show('تعذر الطباعة: '+err.message,'error');}});load().catch(()=>{});}
  return{init,load,isInitialized:()=>initialized};
})();
