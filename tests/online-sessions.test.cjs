const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path"); const Module = require("node:module");
const ts = require("typescript"); const React = require("react"); const {create,act} = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT=true;
function load(file,mocks={}) {const filename=path.resolve(file);const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));const original=mod.require.bind(mod);mod.require=(id)=>Object.hasOwn(mocks,id)?mocks[id]:original(id);mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return mod.exports;}
const view = load("lib/online-session-view.ts");
async function setup(t,overrides={}) {
 const writes=[],saved=[],closed=[];
 const {OnlineSessionEditor}=load("components/online-sessions/session-editor.tsx",{
  "@/context/auth-context":{useAuth:()=>({user:{id:"teacher"}})},
  "@/lib/online-session-view":view,
  "@/lib/online-sessions-api":{onlineSessionApi:{roster:async()=>({students:[{id:"s1",fullName:"Nguyễn An",accountName:"an"},{id:"s2",fullName:"Lê Bình",accountName:"binh"}],teachers:[{id:"teacher",fullName:"Cô Lan"}]}),save:async(...args)=>{writes.push(args);if(overrides.fail)throw new Error("Buổi học đã thay đổi");}}},
  "@/components/ui/modal":{Modal:({children,footer})=>React.createElement("section",null,children,React.createElement("footer",null,footer))},
  "@/components/ui/button":{Button:({children,...p})=>React.createElement("button",p,children)},
  "@/components/ui/form-control":{Input:p=>React.createElement("input",p),Textarea:p=>React.createElement("textarea",p),Checkbox:p=>React.createElement("input",{...p,type:"checkbox"}),Select:({children,...p})=>React.createElement("select",p,children)},
 });
 let ui;await act(async()=>{ui=create(React.createElement(OnlineSessionEditor,{role:"teacher",courseId:"course",courseName:"Toán 12A1",onClose:()=>closed.push(true),onSaved:()=>saved.push(true),...overrides.props}));});t.after(async()=>act(async()=>ui.unmount()));
 const field=label=>ui.root.findAll(node=>typeof node.type==="string"&&node.props.label===label)[0];
 const change=async(label,value)=>act(async()=>field(label).props.onChange({target:{value}}));
 const submit=async()=>act(async()=>ui.root.findByType("form").props.onSubmit({preventDefault(){}}));
 return {ui,writes,saved,closed,change,submit,field};
}
test("draft form edits and cancel never write; footer has only cancel and confirm",async t=>{
 const s=await setup(t);await s.change("Tên buổi học","Tên chưa lưu");await s.change("Trạng thái","DRAFT");assert.equal(s.writes.length,0);
 const buttons=s.ui.root.findByType("footer").findAllByType("button");assert.deepEqual(buttons.map(b=>b.children.join("")),["Hủy","Xác nhận"]);await act(async()=>buttons[0].props.onClick());assert.equal(s.closed.length,1);assert.equal(s.writes.length,0);
});
test("confirm sends one request with Vietnam times and only selected students",async t=>{
 const s=await setup(t);await s.change("Tên buổi học","Ôn tập");await s.change("Đường dẫn tham gia","https://meet.google.com/abc-defg-hij");await s.change("Bắt đầu (giờ Việt Nam)","2026-10-23T19:00");await s.change("Kết thúc (giờ Việt Nam)","2026-10-23T20:00");await s.change("Đối tượng tham gia","SELECTED");
 const checks=s.ui.root.findAllByType("input").filter(n=>n.props.type==="checkbox");await act(async()=>checks[0].props.onChange({target:{checked:true}}));await s.submit();assert.equal(s.writes.length,1);assert.equal(s.saved.length,1);
 const [role,course,id,input]=s.writes[0];assert.equal(role,"teacher");assert.equal(course,"course");assert.equal(id,undefined);assert.deepEqual(input.studentIds,["s1"]);assert.equal(input.startsAt,"2026-10-23T12:00:00.000Z");assert.equal(input.endsAt,"2026-10-23T13:00:00.000Z");assert.match(input.requestKey,/^[a-f0-9-]{36}$/);
});
test("empty group does not save and errors preserve edits",async t=>{
 const s=await setup(t,{fail:true});await s.change("Tên buổi học","Ôn tập");await s.change("Đối tượng tham gia","SELECTED");await s.submit();assert.equal(s.writes.length,0);assert.match(JSON.stringify(s.ui.toJSON()),/Chọn ít nhất/);await s.change("Đối tượng tham gia","ALL");await s.submit();assert.equal(s.writes.length,1);assert.equal(s.saved.length,0);assert.equal(s.field("Tên buổi học").props.value,"Ôn tập");assert.match(JSON.stringify(s.ui.toJSON()),/Buổi học đã thay đổi/);
});
test("server-relative clock opens at 15 minutes and ends exclusively; cancellation disables join",()=>{
 const row={status:"SCHEDULED",startsAt:"2026-10-23T12:00:00Z",endsAt:"2026-10-23T13:00:00Z",joinOpensAt:"2026-10-23T11:45:00Z"};
 assert.equal(view.canEnterOnline(row,Date.parse("2026-10-23T11:44:59Z")),false);assert.equal(view.canEnterOnline(row,Date.parse(row.joinOpensAt)),true);assert.equal(view.canEnterOnline(row,Date.parse(row.endsAt)),false);assert.equal(view.canEnterOnline({...row,status:"CANCELLED"},Date.parse(row.startsAt)),false);assert.equal(view.onlineLiveState(row,Date.parse(row.startsAt)),"LIVE");assert.equal(view.onlineLiveState(row,Date.parse(row.endsAt)),"ENDED");assert.equal(view.onlineUTC(view.onlineLocalInput(row.startsAt)),"2026-10-23T12:00:00.000Z");
});

test("editing an existing session preserves unchanged schedule precision", async t => {
 const session={id:"meeting",revision:3,organizerId:"teacher",title:"Ôn tập",description:"",platform:"MEET",meetingUrl:"https://meet.google.com/abc-defg-hij",startsAt:"2026-10-23T12:00:41.123Z",endsAt:"2026-10-23T13:00:41.123Z",audience:"ALL",status:"SCHEDULED",studentIds:[]};
 const s=await setup(t,{props:{session}});await s.change("Nội dung / mục tiêu rèn luyện","Mô tả mới");await s.submit();assert.equal(s.writes[0][3].startsAt,session.startsAt);assert.equal(s.writes[0][3].endsAt,session.endsAt);assert.equal(s.writes[0][3].revision,3);
});

test("teacher with multiple courses can choose a course and open its session editor", async t => {
 const previousWindow=global.window;
 global.window={setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){}};
 const calls=[];
 const {OnlineSessionPanel}=load("components/online-sessions/session-panel.tsx",{
  "@/components/ui/responsive-filter-toolbar":{defineToolbarFilter:require("./helpers/filter-toolbar.cjs").defineToolbarFilter,ResponsiveFilterToolbar:require("./helpers/filter-toolbar.cjs").filterToolbar()},
  "@/components/ui/button":{Button:({children,...props})=>React.createElement("button",props,children)},
  "@/components/ui/modal":{Modal:()=>null},
  "@/components/ui/form-control":{Input:p=>React.createElement("input",p),Textarea:p=>React.createElement("textarea",p),Select:({children,...p})=>React.createElement("select",p,children)},
  "./meeting-passcode":{MeetingPasscode:()=>null},
  "./session-editor":{OnlineSessionEditor:({courseId})=>React.createElement("div",{"data-editor-course":courseId})},
  "@/lib/online-sessions-api":{onlineSessionApi:{list:async(role,id)=>{calls.push([role,id]);return []}}},
  "@/lib/course-offering-api":{courseOfferingApi:{list:async()=>[{id:"math",displayName:"Toán · 12A2",primaryClassId:"class"},{id:"history",displayName:"Lịch sử · 12A2",primaryClassId:"class"}]}},
  "@/lib/course-workspace":{currentCourseId:()=>""},
  "@/lib/online-session-view":view,
  "@/context/permissions-context":{usePermissions:()=>({can:()=>true})},
  "@/components/ui/action-notification":{useActionNotification:()=>({notify(){}})},
 });
 let ui;await act(async()=>{ui=create(React.createElement(OnlineSessionPanel,{role:"teacher"}));await new Promise(setImmediate);});
 t.after(async()=>{await act(async()=>ui.unmount());global.window=previousWindow;});
 const createButton=()=>ui.root.findAllByType("button").find(node=>node.children.includes("Tạo buổi học"));
 assert.equal(createButton().props.disabled,true);
 const selector=ui.root.findByProps({"aria-label":"Lớp môn học của buổi học online"});
 assert.equal(selector.findAllByType("option").length,3);
 await act(async()=>{selector.props.onChange({target:{value:"history"}});await new Promise(setImmediate);});
 assert.deepEqual(calls.at(-1),["teacher","history"]);
 assert.equal(createButton().props.disabled,false);
 await act(async()=>createButton().props.onClick());
 assert.equal(ui.root.findAllByProps({"data-editor-course":"history"}).length,1);
 await act(async()=>selector.props.onChange({target:{value:""}}));
 assert.equal(createButton().props.disabled,true);
 assert.equal(ui.root.findAllByProps({"data-editor-course":"history"}).length,0);
});


test("Zoom passcode round-trips as text and switching to Meet clears it", async t => {
 const passcode="007Ab#";
 const session={id:"meeting",revision:3,organizerId:"teacher",title:"Zoom",description:"",platform:"ZOOM",meetingUrl:"https://zoom.us/j/123456789?pwd=encrypted-token",meetingPasscode:passcode,startsAt:"2026-10-23T12:00:00Z",endsAt:"2026-10-23T13:00:00Z",audience:"ALL",status:"SCHEDULED",studentIds:[]};
 const s=await setup(t,{props:{session}});
 assert.equal(s.field("Mật khẩu tham gia (không bắt buộc)").props.value,passcode);
 await s.submit();
 assert.equal(s.writes[0][3].meetingPasscode,passcode);
 assert.equal(s.writes[0][3].meetingUrl,session.meetingUrl);
 await s.change("Nền tảng","MEET");
 assert.equal(s.ui.root.findAll(node=>typeof node.type==="string"&&node.props.label==="Mật khẩu tham gia (không bắt buộc)").length,0);
 await s.change("Đường dẫn tham gia","https://meet.google.com/abc-defg-hij");
 await s.submit();
 assert.equal(s.writes[1][3].meetingPasscode,"");
});

test("student sees a passcode only after joining and a denied retry removes it",async t=>{
 const previousWindow=global.window;
 const opened={location:{href:""},close(){}};
 global.window={setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){},open:()=>opened};
 const now=new Date().toISOString();let denied=false;
 const row={id:"meeting",revision:3,courseOfferingId:"course",title:"Zoom hỗ trợ",courseName:"Toán · 12A2",platform:"ZOOM",status:"SCHEDULED",audience:"ALL",startsAt:now,joinOpensAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),serverNow:now};
 const {OnlineSessionPanel}=load("components/online-sessions/session-panel.tsx",{
  "@/components/ui/responsive-filter-toolbar":{defineToolbarFilter:require("./helpers/filter-toolbar.cjs").defineToolbarFilter,ResponsiveFilterToolbar:require("./helpers/filter-toolbar.cjs").filterToolbar()},
  "@/components/ui/button":{Button:({children,...p})=>React.createElement("button",p,children)},
  "@/components/ui/modal":{Modal:()=>null},
  "@/components/ui/form-control":{Input:p=>React.createElement("input",p),Textarea:p=>React.createElement("textarea",p),Select:({children,...p})=>React.createElement("select",p,children)},
  "./session-editor":{OnlineSessionEditor:()=>null},
  "./meeting-passcode":{MeetingPasscode:({value,roomUrl})=>React.createElement("code",{"data-room-url":roomUrl},value)},
  "@/lib/online-sessions-api":{onlineSessionApi:{list:async()=>[row],join:async()=>{if(denied)throw new Error("Lời mời đã thu hồi");return {url:"https://zoom.us/j/123",meetingPasscode:"007Class#A"}}}},
  "@/lib/course-offering-api":{courseOfferingApi:{list:async()=>[]}},
  "@/lib/course-workspace":{currentCourseId:()=>""},
  "@/lib/online-session-view":view,
  "@/context/permissions-context":{usePermissions:()=>({can:()=>true})},
  "@/components/ui/action-notification":{useActionNotification:()=>({notify(){}})},
 });
 let ui;await act(async()=>{ui=create(React.createElement(OnlineSessionPanel,{role:"student",courseId:"course"}));await new Promise(setImmediate);});
 t.after(async()=>{await act(async()=>ui.unmount());global.window=previousWindow;});
 const join=()=>ui.root.findAllByType("button").find(node=>node.children.includes("Vào học"));
 assert.doesNotMatch(JSON.stringify(ui.toJSON()),/007Class#A/);
 await act(async()=>join().props.onClick());
 assert.match(JSON.stringify(ui.toJSON()),/007Class#A/);
 assert.equal(opened.location.href,"https://zoom.us/j/123");
 global.window.open=()=>null;
 await act(async()=>join().props.onClick());
 assert.equal(ui.root.findByType("code").props["data-room-url"],"https://zoom.us/j/123");
 denied=true;await act(async()=>join().props.onClick());
 assert.doesNotMatch(JSON.stringify(ui.toJSON()),/007Class#A/);
 assert.match(JSON.stringify(ui.toJSON()),/Lời mời đã thu hồi/);
});
