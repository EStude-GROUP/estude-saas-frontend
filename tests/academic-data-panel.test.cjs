require('./helpers/register-ui.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const React=require('react');
const {create,act}=require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT=true;
const flush=()=>new Promise(setImmediate);
function text(node){return typeof node==='string'?node:node&&typeof node==='object'?(node.children??[]).map(text).join(''):'';}
async function setup(t,options={}){
 const years=[{id:'now',name:'2026–2027',status:'ACTIVE',startsAt:'2026-07-31T17:00:00Z',endsAt:'2027-07-31T17:00:00Z',dateBoundaryMode:'EXCLUSIVE'}, {id:'old',name:'2025–2026',status:'COMPLETED',startsAt:'2025-08-01',endsAt:'2026-08-01'}];
 const terms=[{id:'a',academicYearId:'now',name:'Học kỳ 1',displayOrder:1,status:'ACTIVE',startsAt:'2026-08-01',endsAt:'2027-01-01'}, {id:'b',academicYearId:'now',name:'Học kỳ 2',displayOrder:2,status:'UPCOMING',startsAt:'2027-01-01',endsAt:'2027-06-01'},...[1,2].map(n=>({id:'old'+n,academicYearId:'old',name:'Học kỳ '+n,displayOrder:n,status:'LOCKED',startsAt:'2025-08-01',endsAt:'2026-01-01'}))];
 const checks=[],writes=[],pushes=[];
 const filename=path.resolve('components/admin/academic-data-panel.tsx');
 const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));const original=loaded.require.bind(loaded);
 loaded.require=id=>{
  if(id==='lucide-react')return new Proxy({},{get:()=>()=>React.createElement('svg')});
  if(id==='@/context/permissions-context')return{usePermissions:()=>({can:key=>!options.denied?.includes(key)})};
  if(id==='@/lib/portal-navigation')return{useRouter:()=>({push:url=>pushes.push(url)})};
  if(id==='@/lib/course-offering-api')return{courseOfferingApi:{list:async()=>{if(options.statsFail)throw Error('offline');return[{id:'c',academicYearId:'now',termId:'a',primaryClassId:'class',status:'OPEN',activeStudentCount:30,activeTeachers:[{teacherId:'teacher'}]}]}}};
  if(id==='@/lib/assessment-api')return{academicDataService:{
   getAcademicYears:async()=>structuredClone(years),getTerms:async()=>structuredClone(terms),getClasses:async()=>[{id:'class',academicYearId:'now'}],
   termClosureChecklist:async(id,target)=>{checks.push({id,target});return options.check?options.check():{canProceed:true,issues:[]}},
   updateTerm:async(id,input)=>{writes.push({id,input});Object.assign(terms.find(t=>t.id===id),input)},
  }};
  if(id==='@/components/ui/button')return{Button:({children,permission,...props})=>permission&&options.denied?.includes(permission)?null:React.createElement('button',props,children)};
  if(id==='@/components/ui/modal')return{Modal:({open,title,children,footer,onClose})=>open?React.createElement('section',{role:'dialog','aria-label':title},children,footer,React.createElement('button',{'aria-label':'Đóng',onClick:onClose})):null};
  if(id==='@/components/ui/confirmation-dialog')return{ConfirmationDialog:()=>null};
  if(id==='@/components/ui/form-control')return{Input:({label,...props})=>React.createElement('input',{'aria-label':label,...props}),Select:({label,children,...props})=>React.createElement('select',{'aria-label':label,...props},children)};
  if(id==='@/components/ui/date-range-picker')return{DateInput:({label,...props})=>React.createElement('input',{'aria-label':label,...props})};
  return original(id);
 };
 loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
 let renderer;await act(async()=>{renderer=create(React.createElement(loaded.exports.AcademicDataPanel));await flush()});
 t.after(async()=>{await act(async()=>renderer.unmount())});
 return{renderer,checks,writes,pushes,click:async button=>act(async()=>{button.props.onClick();await flush()}),button:label=>renderer.root.findAllByType('button').find(b=>text(b.toJSON?.()??{children:b.children})===label),buttons:()=>renderer.root.findAllByType('button')};
}
function buttonByText(renderer,label){return renderer.root.findAllByType('button').find(b=>b.children.some(c=>c===label));}
test('calendar initially shows only the active year and switches to read-only historic semesters',async t=>{
 const {renderer,click}=await setup(t);
 assert.equal(renderer.root.findAllByType('article').length,2);
 assert.ok(renderer.root.findByProps({'aria-label':'Chọn năm học 2026–2027'}).props['aria-pressed']);
 assert.ok(buttonByText(renderer,'Bắt đầu học kỳ').props.disabled);
 await click(renderer.root.findByProps({'aria-label':'Chọn năm học 2025–2026'}));
 assert.equal(renderer.root.findAllByType('article').length,2);
 assert.ok(renderer.root.findAllByType('article').every(a=>a.props['aria-label'].includes('2025–2026')));
 assert.equal(buttonByText(renderer,'Kết thúc học kỳ'),undefined);
 assert.equal(renderer.root.findAllByProps({'aria-label':'Chỉnh sửa'}).length,0);
});
test('ending a term waits for validation, blocks unsettled work and commits only after a clean recheck',async t=>{
 let resolve;let current=new Promise(r=>resolve=r);
 const {renderer,click,checks,writes}=await setup(t,{check:()=>current});
 await click(buttonByText(renderer,'Kết thúc học kỳ'));
 const confirm=()=>renderer.root.findByProps({role:'dialog'}).findAllByType('button').find(b=>b.children.some(c=>c==='Kết thúc học kỳ'));
 assert.equal(confirm().props.disabled,true);assert.deepEqual(writes,[]);
 await act(async()=>resolve({canProceed:false,issues:[{code:'OPEN',message:'Còn lớp môn đang mở',count:2,sources:[]}]}));
 assert.equal(confirm().props.disabled,true);
 assert.match(text(renderer.toJSON()),/Còn lớp môn đang mở/);
 current=Promise.resolve({canProceed:true,issues:[]});
 await click(buttonByText(renderer,'Kiểm tra lại'));
 assert.equal(confirm().props.disabled,false);
 await click(confirm());
 assert.deepEqual(writes,[{id:'a',input:{status:'COMPLETED'}}]);
 assert.equal(checks.length,2);assert.equal(renderer.root.findAllByProps({role:'dialog'}).length,0);
 assert.equal(buttonByText(renderer,'Bắt đầu học kỳ').props.disabled,false);
 assert.ok(buttonByText(renderer,'Khóa học kỳ'));
});
test('validation failures fail closed while optional overview failures preserve the calendar',async t=>{
 const {renderer,click,writes}=await setup(t,{statsFail:true,check:()=>Promise.reject(Error('Không kết nối được máy chủ'))});
 assert.equal(renderer.root.findAllByType('article').length,2);
 await click(buttonByText(renderer,'Kết thúc học kỳ'));
 const dialog=renderer.root.findByProps({role:'dialog'});
 assert.equal(dialog.findAllByType('button').find(b=>b.children.some(c=>c==='Kết thúc học kỳ')).props.disabled,true);
 assert.match(text(renderer.toJSON()),/Không kết nối được máy chủ/);assert.deepEqual(writes,[]);
});
test('calendar links carry selected year/term and read-only permissions hide lifecycle actions',async t=>{
 const {renderer,click,pushes}=await setup(t,{denied:['academic.update']});
 assert.equal(buttonByText(renderer,'Kết thúc học kỳ'),undefined);
 await click(buttonByText(renderer,'Xem lớp môn học'));
 assert.equal(pushes[0],'/admin/course-offerings?academicYearId=now&termId=a');
});
